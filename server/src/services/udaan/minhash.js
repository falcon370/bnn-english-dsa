'use strict';

/**
 * MinHash signatures over k-word shingles (docs/UDAAN_VERTICAL_SPEC.md §6.2).
 * O(S·P) per document: S = shingles in the document, P = permutations (128).
 */

const NUM_PERMUTATIONS = 128;
const SHINGLE_SIZE = 5; // k-word shingles, per spec §6.2
const SEED = 0x9e3779b9; // fixed so signatures are reproducible across runs/processes

// Deterministic PRNG (mulberry32) — never Math.random(), so the permutation
// coefficients below are identical every time this module is loaded,
// anywhere. Two processes must derive the same signature for the same text.
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);
// Universal hash family h_i(x) = (a_i * x + b_i) mod 2^32, one (a,b) pair per
// permutation. Math.imul gives the correctly-wrapped low-32-bits product in
// one op — the standard trick for 32-bit hashing in JS without BigInt.
const PERMUTATIONS = Array.from({ length: NUM_PERMUTATIONS }, () => ({
  a: (Math.floor(rand() * 0xfffffffe) + 1) >>> 0,
  b: Math.floor(rand() * 0xffffffff) >>> 0,
}));

// FNV-1a 32-bit — fast, good-enough distribution for shingle hashing.
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const fnv1a32 = (str) => {
  let hash = FNV_OFFSET;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
};

const normalize = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** k-word shingles of `text`. O(S) where S = word count. */
const shingles = (text, k = SHINGLE_SIZE) => {
  const words = normalize(text);
  if (words.length === 0) return [];
  if (words.length < k) return [words.join(' ')];

  const result = [];
  for (let i = 0; i <= words.length - k; i++) {
    result.push(words.slice(i, i + k).join(' '));
  }
  return result;
};

/**
 * 128-entry MinHash signature. O(S·P): S shingles, P permutations.
 * Documents with no shingles (empty/very short text) get an all-max
 * sentinel signature, which by construction never collides in banding.
 */
const computeSignature = (text, { numPermutations = NUM_PERMUTATIONS, shingleSize = SHINGLE_SIZE } = {}) => {
  const permutations = numPermutations === NUM_PERMUTATIONS ? PERMUTATIONS : PERMUTATIONS.slice(0, numPermutations);
  const shingleHashes = shingles(text, shingleSize).map(fnv1a32);

  const signature = new Array(permutations.length).fill(0xffffffff);
  if (shingleHashes.length === 0) return signature;

  for (const x of shingleHashes) {
    for (let i = 0; i < permutations.length; i++) {
      const { a, b } = permutations[i];
      const h = (Math.imul(a, x) + b) >>> 0;
      if (h < signature[i]) signature[i] = h;
    }
  }

  return signature;
};

/**
 * Estimated Jaccard similarity between two signatures: fraction of matching
 * positions. O(P).
 */
const estimateJaccard = (sigA, sigB) => {
  if (!sigA || !sigB || sigA.length !== sigB.length || sigA.length === 0) return 0;
  let matches = 0;
  for (let i = 0; i < sigA.length; i++) {
    if (sigA[i] === sigB[i]) matches++;
  }
  return matches / sigA.length;
};

module.exports = {
  NUM_PERMUTATIONS,
  SHINGLE_SIZE,
  shingles,
  fnv1a32,
  computeSignature,
  estimateJaccard,
};
