#!/usr/bin/env node
/**
 * M1 — MinHash + banded-LSH dedup benchmark (docs/UDAAN_VERTICAL_SPEC.md
 * §6.2, §7).
 *
 * For each fixture, computes true O(n²) pairwise shingle-Jaccard duplicate
 * pairs as ground truth (capped at MAX_GROUND_TRUTH_N — a literal O(n²)
 * pass is infeasible at n=50000: that's over a billion set intersections)
 * and compares LSH candidate generation against it, swept over band count
 * b at fixed P=128 permutations, reporting precision/recall — the number
 * that picks the shipped b/r configuration (spec §5, §9).
 *
 * Also reimplements the reverted commit 4248a6e's nested-loop
 * Jaccard/containment dedup (spec §6.4) as a standalone comparison
 * baseline — NOT restored to production code, benchmark-only — so the
 * report can show "faster and more precise than the prior attempt," not
 * just "faster."
 *
 * Usage: node bench/dedupBench.js
 * Requires fixtures from "node scripts/exportUdaanFixture.js".
 */

const fs = require('fs');
const path = require('path');
const { shingles, computeSignature, estimateJaccard } = require('../src/services/udaan/minhash');
const { LSHIndex, bandingThreshold } = require('../src/services/udaan/lshIndex');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const RESULTS_DIR = path.join(__dirname, 'results');
const MAX_GROUND_TRUTH_N = 2000; // O(n²) pairwise pass is capped here — infeasible beyond it
const VERIFY_THRESHOLD = 0.5; // same threshold used in production (src/services/udaan/index.js)
const BAND_SWEEP = [16, 32, 64]; // at fixed P=128 -> r = 8, 4, 2 respectively
const NUM_PERMUTATIONS = 128;

// ── True O(n²) pairwise ground truth (shingle-set Jaccard, not MinHash estimate) ──

const truePairwiseDuplicates = (docs) => {
  const shingleSets = docs.map((d) => new Set(shingles(d.text)));
  const pairs = new Set();

  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      const a = shingleSets[i];
      const b = shingleSets[j];
      const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
      let intersection = 0;
      for (const s of smaller) if (larger.has(s)) intersection++;
      const union = a.size + b.size - intersection;
      const jaccard = union === 0 ? 0 : intersection / union;
      if (jaccard >= VERIFY_THRESHOLD) pairs.add(`${i}:${j}`);
    }
  }
  return pairs;
};

// ── Reverted-baseline reimplementation (commit 4248a6e, spec §6.4) — bench-only ──

const cleanWordsLegacy = (text) =>
  String(text || '').toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter((w) => w.length > 3);

const legacyCheckTopicSimilarity = (a, b) => {
  const wa = cleanWordsLegacy(a);
  const wb = cleanWordsLegacy(b);
  const setA = new Set(wa);
  const setB = new Set(wb);
  const sharedUnique = new Set(wa.filter((w) => setB.has(w))).size;
  const union = new Set([...wa, ...wb]).size;
  const jaccard = union === 0 ? 0 : sharedUnique / union;
  const containment = setA.size === 0 ? 0 : sharedUnique / setA.size;
  // The exact disjunction from the reverted commit — over-aggressive by design (spec §6.4).
  return jaccard >= 0.3 || (containment >= 0.4 && sharedUnique >= 2) || sharedUnique >= 3;
};

const legacyNestedScanDuplicates = (docs) => {
  const pairs = new Set();
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      if (legacyCheckTopicSimilarity(docs[i].text, docs[j].text)) pairs.add(`${i}:${j}`);
    }
  }
  return pairs;
};

// ── LSH candidate generation ────────────────────────────────

const lshCandidatePairs = (docs, bands, rows) => {
  const signatures = docs.map((d) => computeSignature(d.text, { numPermutations: bands * rows }));
  const index = new LSHIndex({ bands, rows });
  const pairs = new Set();

  for (let i = 0; i < docs.length; i++) {
    const candidates = index.candidatesFor(signatures[i], i);
    for (const j of candidates) {
      const key = i < j ? `${i}:${j}` : `${j}:${i}`;
      if (!pairs.has(key) && estimateJaccard(signatures[i], signatures[j]) >= VERIFY_THRESHOLD) {
        pairs.add(key);
      }
    }
    index.insert(i, signatures[i]);
  }
  return pairs;
};

// ── Precision / recall ──────────────────────────────────────

const precisionRecall = (predicted, groundTruth) => {
  let truePositive = 0;
  for (const p of predicted) if (groundTruth.has(p)) truePositive++;
  return {
    precision: predicted.size === 0 ? 1 : truePositive / predicted.size,
    recall: groundTruth.size === 0 ? 1 : truePositive / groundTruth.size,
    truePositive,
    predictedPairs: predicted.size,
    groundTruthPairs: groundTruth.size,
  };
};

// ── Main ─────────────────────────────────────────────────────

const main = () => {
  if (!fs.existsSync(FIXTURES_DIR)) {
    console.error(`[dedupBench] No fixtures directory. Run "node scripts/exportUdaanFixture.js" first.`);
    process.exitCode = 1;
    return;
  }

  const fixtureFiles = fs.readdirSync(FIXTURES_DIR)
    .filter((f) => /^corpus-\d+\.json$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

  if (!fixtureFiles.length) {
    console.error(`[dedupBench] No corpus-*.json fixtures found. Run "node scripts/exportUdaanFixture.js" first.`);
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const results = [];

  for (const file of fixtureFiles) {
    const docs = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, file), 'utf-8'));
    const n = docs.length;
    console.log(`\n[dedupBench] n=${n} (${file})`);

    let groundTruth = null;
    let legacy = null;

    if (n <= MAX_GROUND_TRUTH_N) {
      const gtStart = process.hrtime.bigint();
      groundTruth = truePairwiseDuplicates(docs);
      const gtMs = Number(process.hrtime.bigint() - gtStart) / 1e6;
      console.log(`  true O(n^2) pairwise: ${groundTruth.size} duplicate pairs in ${gtMs.toFixed(1)}ms`);

      const legacyStart = process.hrtime.bigint();
      const legacyPairs = legacyNestedScanDuplicates(docs);
      const legacyMs = Number(process.hrtime.bigint() - legacyStart) / 1e6;
      const legacyPR = precisionRecall(legacyPairs, groundTruth);
      legacy = { ms: legacyMs, ...legacyPR };
      console.log(
        `  reverted-baseline (4248a6e-shaped) nested scan: ${legacyPairs.size} pairs in ${legacyMs.toFixed(1)}ms, ` +
        `precision=${legacyPR.precision.toFixed(3)} recall=${legacyPR.recall.toFixed(3)}`,
      );
    } else {
      console.log(`  (n > ${MAX_GROUND_TRUTH_N} — true O(n^2) ground truth skipped, too slow to compute; LSH-only timing below)`);
    }

    const bandSeries = [];
    for (const bands of BAND_SWEEP) {
      const rows = NUM_PERMUTATIONS / bands;
      const start = process.hrtime.bigint();
      const candidates = lshCandidatePairs(docs, bands, rows);
      const ms = Number(process.hrtime.bigint() - start) / 1e6;

      const entry = { bands, rows, inflection: bandingThreshold(bands, rows), candidatePairs: candidates.size, ms };
      if (groundTruth) Object.assign(entry, precisionRecall(candidates, groundTruth));

      const summary = groundTruth
        ? `precision=${entry.precision.toFixed(3)} recall=${entry.recall.toFixed(3)}`
        : '(no ground truth at this n)';
      console.log(
        `  LSH b=${bands} r=${rows} (inflection~=${entry.inflection.toFixed(3)}): ` +
        `${candidates.size} candidate pairs in ${ms.toFixed(1)}ms — ${summary}`,
      );

      bandSeries.push(entry);
    }

    results.push({
      n,
      hasGroundTruth: Boolean(groundTruth),
      groundTruthPairs: groundTruth ? groundTruth.size : null,
      legacy,
      bandSeries,
    });
  }

  const resultsPath = path.join(RESULTS_DIR, 'dedup-bench.json');
  fs.writeFileSync(
    resultsPath,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      maxGroundTruthN: MAX_GROUND_TRUTH_N,
      verifyThreshold: VERIFY_THRESHOLD,
      results,
    }, null, 2),
  );
  console.log(`\n[dedupBench] Wrote results -> ${resultsPath}`);
};

main();
