const test = require('node:test');
const assert = require('node:assert');
const { isFresh } = require('../src/utils/textHelpers');

test('isFresh should validate relative and absolute date strings correctly', () => {
  // Fresh inputs
  assert.strictEqual(isFresh('5 mins ago'), true);
  assert.strictEqual(isFresh('10 minutes ago'), true);
  assert.strictEqual(isFresh('just now'), true);
  assert.strictEqual(isFresh('2 hours ago'), true);
  assert.strictEqual(isFresh('18 hours ago'), true);
  assert.strictEqual(isFresh('1 day ago'), true);
  assert.strictEqual(isFresh('yesterday'), true);
  assert.strictEqual(isFresh(new Date().toISOString()), true);

  // Stale inputs
  assert.strictEqual(isFresh('3 days ago'), false);
  assert.strictEqual(isFresh('1 week ago'), false);
  assert.strictEqual(isFresh('2 months ago'), false);
  assert.strictEqual(isFresh('1 year ago'), false);
  assert.strictEqual(isFresh('2022-01-01'), false);
  assert.strictEqual(isFresh(null), false);
  assert.strictEqual(isFresh(''), false);
});
