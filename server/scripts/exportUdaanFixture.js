#!/usr/bin/env node
/**
 * Exports frozen embedding fixtures from the real News corpus, at increasing
 * sizes, for the Udaan retrieval-layer benchmark harness (M0 ground truth —
 * see docs/UDAAN_VERTICAL_SPEC.md §6.1, §7).
 *
 * Real corpus, not synthetic vectors: recall and duplicate-precision figures
 * need to reflect the actual near-duplicate-heavy distribution the Udaan
 * vertical exists to handle (spec §2.2).
 *
 * Usage: node scripts/exportUdaanFixture.js
 * Requires MONGO_URI (server/.env) and a running embedding service
 * (EMBEDDING_SERVICE_URL, default http://localhost:8000).
 */

require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const News = require('../src/models/News');
const { EmbeddingClient } = require('../src/services/embeddingClient');

const TARGET_SIZES = [100, 500, 1000, 5000, 10000, 50000];
const EMBED_BATCH_SIZE = 64;
const FIXTURES_DIR = path.join(__dirname, '..', 'bench', 'fixtures');

const buildText = (doc) => {
  const title = doc.title || doc.topic || '';
  const summary = doc.summary || '';
  return `${title}\n\n${summary}`.trim();
};

const run = async () => {
  await connectDB();

  const maxN = TARGET_SIZES[TARGET_SIZES.length - 1];

  console.log('[fixture] Loading published articles from MongoDB...');
  const docs = await News.find({ status: 'published' })
    .select('title topic summary category publishedAt')
    .sort({ _id: 1 }) // deterministic ordering across re-runs
    .limit(maxN)
    .lean();

  if (!docs.length) {
    console.error('[fixture] No published articles found — nothing to export.');
    process.exitCode = 1;
    await mongoose.connection.close();
    return;
  }

  console.log(`[fixture] Loaded ${docs.length} articles (requested up to ${maxN}).`);

  const texts = docs.map(buildText);
  const embeddings = new Array(texts.length);
  const embeddingClient = new EmbeddingClient();

  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const chunk = texts.slice(i, i + EMBED_BATCH_SIZE);
    console.log(`[fixture] Embedding ${i + 1}-${i + chunk.length} of ${texts.length}...`);
    const chunkEmbeddings = await embeddingClient.embedBatch(chunk);
    chunkEmbeddings.forEach((vec, j) => { embeddings[i + j] = vec; });
  }

  const records = docs.map((doc, i) => ({
    id: String(doc._id),
    category: doc.category || null,
    publishedAt: doc.publishedAt || null,
    text: texts[i],
    embedding: embeddings[i],
  }));

  fs.mkdirSync(FIXTURES_DIR, { recursive: true });

  // Write nested subsets (corpus-100 is a prefix of corpus-500, etc.) so
  // benchmark comparisons across sizes stay apples-to-apples. Cap to the
  // real corpus size — if the DB has fewer articles than a target size,
  // skip that size and write one final fixture at the true corpus size
  // instead of padding with anything synthetic.
  const sizesToWrite = new Set(TARGET_SIZES.filter((n) => n <= records.length));
  if (sizesToWrite.size === 0 || Math.max(...sizesToWrite) < records.length) {
    sizesToWrite.add(records.length);
  }

  for (const n of [...sizesToWrite].sort((a, b) => a - b)) {
    const slice = records.slice(0, n);
    const outPath = path.join(FIXTURES_DIR, `corpus-${n}.json`);
    fs.writeFileSync(outPath, JSON.stringify(slice));
    console.log(`[fixture] Wrote ${slice.length} records -> ${outPath}`);
  }

  await mongoose.connection.close();
  console.log('[fixture] Done. Run "node bench/annBench.js" next.');
};

run().catch((err) => {
  console.error('[fixture] Failed:', err.message);
  process.exitCode = 1;
  mongoose.connection.close().catch(() => {});
});
