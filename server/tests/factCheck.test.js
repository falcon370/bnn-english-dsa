const test = require('node:test');
const assert = require('node:assert/strict');
const { getHeadlineHash, aggregateScore } = require('../src/services/factCheckService');

test('getHeadlineHash normalizes headline before hashing', () => {
  const hash1 = getHeadlineHash('Cabinet Approves New Schemes');
  const hash2 = getHeadlineHash('  cabinet   approves   new   schemes  ');
  const hash3 = getHeadlineHash('cabinet approves new schemes');

  assert.equal(hash1.length, 64); // SHA-256 is 64 hex characters
  assert.equal(hash1, hash2);
  assert.equal(hash2, hash3);
});

test('getHeadlineHash returns different hash for different strings', () => {
  const hash1 = getHeadlineHash('Cabinet Approves New Schemes');
  const hash2 = getHeadlineHash('Cabinet Rejects New Schemes');

  assert.notEqual(hash1, hash2);
});

test('aggregateScore bypasses score and returns Opinion category if aiVerdict is Opinion', () => {
  const result = aggregateScore({
    factApiScore: 10,
    pibScore: 20,
    aiScore: 30,
    mismatchScore: 10,
    aiVerdict: 'Opinion'
  });

  assert.equal(result.finalScore, 60);
  assert.equal(result.verdict, 'Opinion');
});

test('aggregateScore correctly calculates weighted scores and mismatch penalties', () => {
  // Google Fact Check (80), PIB (70), AI Score (90), Mismatch (100 - no penalty)
  // Formula: factApi * 0.3 + pib * 0.2 + ai * 0.5 = 24 + 14 + 45 = 83
  const resultNoPenalty = aggregateScore({
    factApiScore: 80,
    pibScore: 70,
    aiScore: 90,
    mismatchScore: 100,
    aiVerdict: 'Credible'
  });
  assert.equal(resultNoPenalty.finalScore, 83);
  assert.equal(resultNoPenalty.verdict, 'Credible');

  // Google Fact Check (80), PIB (70), AI Score (90), Mismatch (50 - half mismatch)
  // Base score: 83. Penalty: (1 - 50/100) * 15 = 7.5 -> rounded to 8. Final score: 83 - 8 = 75
  const resultWithPenalty = aggregateScore({
    factApiScore: 80,
    pibScore: 70,
    aiScore: 90,
    mismatchScore: 50,
    aiVerdict: 'Credible'
  });
  assert.equal(resultWithPenalty.finalScore, 75);
  assert.equal(resultWithPenalty.verdict, 'Credible');
});
