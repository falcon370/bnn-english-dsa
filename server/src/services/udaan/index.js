'use strict';

/**
 * Udaan retrieval layer — wiring module.
 *
 * M1 (docs/UDAAN_VERTICAL_SPEC.md §6.2, §6.3): near-duplicate filtering via
 * MinHash + banded LSH, and story-arc clustering via Union-Find, applied
 * before any Gemini call so syndicated re-reporting of the same story never
 * reaches the paid synthesis step (spec §3.3).
 */

const News = require('../../models/News');
const { computeSignature, estimateJaccard } = require('./minhash');
const { LSHIndex, DEFAULT_BANDS, DEFAULT_ROWS } = require('./lshIndex');
const { UnionFind } = require('./unionFind');

// Above the banding inflection (~0.42 at b=32,r=4 — spec §5), so a candidate
// pair must clear both the LSH filter AND a stricter full-signature check
// before being treated as a duplicate. Shared with bench/dedupBench.js so
// the benchmark and the production path measure the same definition.
const VERIFY_THRESHOLD = 0.5;

// Matches the window the (now-removed) Politics-only pre-save hook used.
const DEDUP_WINDOW_DAYS = 45;

const buildArticleText = (article) => `${article.title || ''}\n\n${article.snippet || ''}`.trim();

/** Recent published articles that already carry a MinHash signature. */
const loadRecentSignedDocs = async (category) => {
  const cutoff = new Date(Date.now() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return News.find({
    status: 'published',
    category,
    publishedAt: { $gte: cutoff },
    minhashSignature: { $exists: true, $ne: [] },
  })
    .select('+minhashSignature publishedAt')
    .lean();
};

/**
 * Splits freshly-fetched articles into survivors (proceed to Gemini) and
 * duplicates (merge into an existing or soon-to-exist representative, skip
 * Gemini entirely). Union-Find groups both existing-corpus matches and
 * within-batch matches into arcs in a single pass.
 *
 * O(n·b) expected: n = existing docs + batch size, b = LSH bands.
 */
const filterDuplicates = async (articles, { category } = {}) => {
  const existingDocs = await loadRecentSignedDocs(category);

  const index = new LSHIndex({ bands: DEFAULT_BANDS, rows: DEFAULT_ROWS });
  const uf = new UnionFind();

  const existingKey = (doc) => `existing:${doc._id}`;
  const batchKey = (i) => `batch:${i}`;

  for (const doc of existingDocs) {
    const key = existingKey(doc);
    uf.makeSet(key);
    index.insert(key, doc.minhashSignature);
  }

  const batchSignatures = articles.map((article) => computeSignature(buildArticleText(article)));

  // Insert every batch item, unioning it with any verified match found so
  // far — either an existing published doc or an earlier item in this
  // same batch (this is what catches syndicated duplicates arriving in a
  // single fetch, not just duplicates across separate ingestion runs).
  for (let i = 0; i < articles.length; i++) {
    const key = batchKey(i);
    const signature = batchSignatures[i];
    uf.makeSet(key);

    const candidateKeys = index.candidatesFor(signature, key);
    for (const candidateKey of candidateKeys) {
      const candidateSignature = index.signatures.get(candidateKey);
      if (estimateJaccard(signature, candidateSignature) >= VERIFY_THRESHOLD) {
        uf.union(key, candidateKey);
      }
    }

    index.insert(key, signature);
  }

  // Read out arcs. Each connected component that touches ≥1 batch article
  // becomes either an "existing" attach target (component also touches an
  // existing doc — elect the earliest-published one as representative) or
  // a "pending" one (new-articles-only component — earliest batch index
  // becomes the survivor, the rest attach to it once it's saved).
  const groups = uf.groups();
  const survivors = [];
  const duplicates = [];
  const decidedBatchIndices = new Set();

  for (const members of groups.values()) {
    const existingMembers = members
      .filter((m) => m.startsWith('existing:'))
      .map((m) => existingDocs.find((d) => existingKey(d) === m))
      .filter(Boolean);
    const batchIndices = members
      .filter((m) => m.startsWith('batch:'))
      .map((m) => Number(m.split(':')[1]))
      .sort((a, b) => a - b);

    if (!batchIndices.length) continue; // pure existing-corpus component — nothing to do this run

    if (existingMembers.length) {
      existingMembers.sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));
      const target = existingMembers[0];
      for (const idx of batchIndices) {
        duplicates.push({ article: articles[idx], attachTo: { type: 'existing', id: target._id } });
        decidedBatchIndices.add(idx);
      }
    } else if (batchIndices.length === 1) {
      survivors.push({ index: batchIndices[0], article: articles[batchIndices[0]] });
      decidedBatchIndices.add(batchIndices[0]);
    } else {
      const [firstIdx, ...restIdx] = batchIndices;
      survivors.push({ index: firstIdx, article: articles[firstIdx] });
      decidedBatchIndices.add(firstIdx);
      for (const idx of restIdx) {
        duplicates.push({ article: articles[idx], attachTo: { type: 'pending', index: firstIdx } });
        decidedBatchIndices.add(idx);
      }
    }
  }

  // Safety net — every batch key is makeSet'd above so this shouldn't ever
  // fire, but never silently drop an article if it somehow does.
  for (let i = 0; i < articles.length; i++) {
    if (!decidedBatchIndices.has(i)) survivors.push({ index: i, article: articles[i] });
  }

  survivors.sort((a, b) => a.index - b.index);

  return { survivors, duplicates };
};

/**
 * Merges a duplicate article into an existing representative's source
 * list — no Gemini call, no new document.
 */
const attachAsSource = async (newsId, article) => {
  const updateOps = {
    $inc: { arcUpdateCount: 1 },
    $push: { sourceOptions: article },
  };
  if (article.source) {
    updateOps.$addToSet = { availableSources: article.source };
  }
  await News.findByIdAndUpdate(newsId, updateOps);
};

/**
 * Persists the MinHash signature + arc metadata on a newly-saved
 * representative article. In M1 every survivor is its own arc
 * (arcId = its own _id) — genuine multi-document arcs (follow-up stories
 * sharing an arc) are a later, separate feature.
 */
const registerArticle = async (record, article) => {
  const signature = computeSignature(buildArticleText(article));
  return News.findByIdAndUpdate(
    record._id,
    { $set: { minhashSignature: signature, arcId: record._id, isArcRepresentative: true } },
    { new: true },
  );
};

module.exports = {
  filterDuplicates,
  attachAsSource,
  registerArticle,
  buildArticleText,
  VERIFY_THRESHOLD,
  DEDUP_WINDOW_DAYS,
};
