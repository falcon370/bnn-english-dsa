const test = require('node:test');
const assert = require('node:assert');
const { shingles, computeSignature, estimateJaccard } = require('../src/services/udaan/minhash');

test('shingles produces overlapping k-word windows', () => {
  const s = shingles('the quick brown fox jumps over the lazy dog', 5);
  assert.strictEqual(s[0], 'the quick brown fox jumps');
  assert.strictEqual(s[1], 'quick brown fox jumps over');
  assert.strictEqual(s.length, 9 - 5 + 1);
});

test('shingles handles short text without throwing', () => {
  assert.deepStrictEqual(shingles(''), []);
  assert.deepStrictEqual(shingles('two words'), ['two words']);
});

test('computeSignature is deterministic and 128 entries long', () => {
  const text = 'IIT Madras student builds a low cost prosthetic for rural patients';
  const sigA = computeSignature(text);
  const sigB = computeSignature(text);
  assert.deepStrictEqual(sigA, sigB);
  assert.strictEqual(sigA.length, 128);
});

test('estimateJaccard is 1.0 for identical text and higher for near-duplicates than unrelated text', () => {
  const original = 'IIT Madras student builds a low cost prosthetic device for rural patients across India';
  const rewritten = 'A student at IIT Madras has built a low cost prosthetic device for rural patients across India';
  const unrelated = 'Local cricket team wins regional championship after a dramatic final over';

  const sigOriginal = computeSignature(original);
  const sigRewritten = computeSignature(rewritten);
  const sigUnrelated = computeSignature(unrelated);

  assert.strictEqual(estimateJaccard(sigOriginal, sigOriginal), 1);
  assert.ok(estimateJaccard(sigOriginal, sigRewritten) > estimateJaccard(sigOriginal, sigUnrelated));
});

test('estimateJaccard returns 0 for mismatched or empty signatures', () => {
  assert.strictEqual(estimateJaccard([], []), 0);
  assert.strictEqual(estimateJaccard([1, 2], [1, 2, 3]), 0);
  assert.strictEqual(estimateJaccard(null, [1]), 0);
});
