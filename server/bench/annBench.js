#!/usr/bin/env node
/**
 * M0 — brute-force exact k-NN benchmark (docs/UDAAN_VERTICAL_SPEC.md §6.1).
 *
 * This is the ground truth every later recall figure gets measured against —
 * an approximate index (LSH in M1, HNSW in M2) can be shown fast without
 * this, but never shown correct.
 *
 * Usage: node bench/annBench.js
 * Requires fixtures from "node scripts/exportUdaanFixture.js" to exist first.
 */

const fs = require('fs');
const path = require('path');
const assert = require('node:assert');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const RESULTS_DIR = path.join(__dirname, 'results');
const TOP_K = 10;
const QUERY_COUNT = 20; // documents used as queries per fixture

// ── Core primitive: cosine similarity ──────────────────────────

const dot = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

const norm = (a) => Math.sqrt(dot(a, a));

const cosineSimilarity = (a, b) => {
  const denom = norm(a) * norm(b);
  return denom === 0 ? 0 : dot(a, b) / denom;
};

/**
 * Brute-force exact top-k nearest neighbours by cosine similarity.
 * O(n) per query to score, O(n log n) to rank — the naive baseline every
 * approximate structure in this project (LSH, HNSW) is checked against.
 */
const bruteForceTopK = (queryVector, corpus, k, excludeId = null) => {
  const scored = [];
  for (const doc of corpus) {
    if (doc.id === excludeId) continue;
    scored.push({ id: doc.id, score: cosineSimilarity(queryVector, doc.embedding) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
};

// ── Correctness check on a tiny hand-checkable synthetic fixture ──
// Separate from the real-corpus fixtures below: this exists purely to prove
// bruteForceTopK/cosineSimilarity are correct on a case a human can verify
// by inspection, before trusting them as ground truth for anything else.

const runCorrectnessCheck = () => {
  const synthetic = [];
  for (let i = 0; i < 20; i++) {
    synthetic.push({
      id: `s${i}`,
      embedding: [i % 4 === 0 ? 1 : 0, i % 4 === 1 ? 1 : 0, i % 4 === 2 ? 1 : 0, i % 4 === 3 ? 1 : 0],
    });
  }
  // s1 is an exact duplicate of s0 — the only unambiguous top match.
  synthetic[1].embedding = [...synthetic[0].embedding];

  const top = bruteForceTopK(synthetic[0].embedding, synthetic, 3, 's0');
  assert.strictEqual(top[0].id, 's1', 'exact duplicate must rank first');
  assert.ok(Math.abs(top[0].score - 1) < 1e-9, 'exact duplicate must score cosine similarity 1.0');
  console.log('[annBench] Correctness check passed (n=20 synthetic fixture).');
};

// ── Latency benchmark over real-corpus fixtures ────────────────

const percentile = (sortedValues, p) => {
  const idx = Math.min(sortedValues.length - 1, Math.floor((p / 100) * sortedValues.length));
  return sortedValues[idx];
};

const benchmarkFixture = (corpus) => {
  const queries = corpus.slice(0, Math.min(QUERY_COUNT, corpus.length));
  const timingsMs = [];
  const groundTruth = {};

  for (const query of queries) {
    const start = process.hrtime.bigint();
    const top = bruteForceTopK(query.embedding, corpus, TOP_K, query.id);
    const end = process.hrtime.bigint();
    timingsMs.push(Number(end - start) / 1e6);
    groundTruth[query.id] = top.map((r) => r.id);
  }

  timingsMs.sort((a, b) => a - b);

  return {
    corpusSize: corpus.length,
    queries: queries.length,
    p50Ms: percentile(timingsMs, 50),
    p95Ms: percentile(timingsMs, 95),
    groundTruth,
  };
};

// ── Main ─────────────────────────────────────────────────────

const main = () => {
  runCorrectnessCheck();

  if (!fs.existsSync(FIXTURES_DIR)) {
    console.error(`[annBench] No fixtures directory at ${FIXTURES_DIR}. Run "node scripts/exportUdaanFixture.js" first.`);
    process.exitCode = 1;
    return;
  }

  const fixtureFiles = fs.readdirSync(FIXTURES_DIR)
    .filter((f) => /^corpus-\d+\.json$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

  if (!fixtureFiles.length) {
    console.error(`[annBench] No corpus-*.json fixtures found in ${FIXTURES_DIR}. Run "node scripts/exportUdaanFixture.js" first.`);
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const series = [];

  for (const file of fixtureFiles) {
    const corpus = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, file), 'utf-8'));
    console.log(`[annBench] Running brute-force top-${TOP_K} over n=${corpus.length} (fixture "${file}")...`);

    const result = benchmarkFixture(corpus);

    const groundTruthPath = path.join(FIXTURES_DIR, `groundtruth-${result.corpusSize}.json`);
    fs.writeFileSync(groundTruthPath, JSON.stringify(result.groundTruth, null, 2));
    console.log(`[annBench]   p50=${result.p50Ms.toFixed(3)}ms p95=${result.p95Ms.toFixed(3)}ms -> ${groundTruthPath}`);

    series.push({
      n: result.corpusSize,
      queries: result.queries,
      p50Ms: result.p50Ms,
      p95Ms: result.p95Ms,
    });
  }

  const resultsPath = path.join(RESULTS_DIR, 'bruteforce-latency.json');
  fs.writeFileSync(
    resultsPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), topK: TOP_K, series }, null, 2),
  );
  console.log(`[annBench] Wrote latency series -> ${resultsPath}`);
  console.log(
    '[annBench] Done. This "brute force" series is series 1 of 3 for the required log-x latency ' +
    'plot (spec §7) — the Atlas and HNSW series are added in M2.',
  );
};

main();
