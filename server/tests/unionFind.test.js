const test = require('node:test');
const assert = require('node:assert');
const { UnionFind } = require('../src/services/udaan/unionFind');

test('union merges two sets and find returns a common root', () => {
  const uf = new UnionFind();
  uf.union('a', 'b');
  assert.strictEqual(uf.find('a'), uf.find('b'));
  assert.ok(uf.connected('a', 'b'));
});

test('transitive unions merge chained sets', () => {
  const uf = new UnionFind();
  uf.union('a', 'b');
  uf.union('b', 'c');
  assert.ok(uf.connected('a', 'c'));
  assert.ok(!uf.connected('a', 'z'));
});

test('unrelated elements stay in separate sets', () => {
  const uf = new UnionFind();
  uf.makeSet('a');
  uf.makeSet('b');
  assert.ok(!uf.connected('a', 'b'));
});

test('groups reflects the current partition', () => {
  const uf = new UnionFind();
  uf.union('a', 'b');
  uf.makeSet('c');
  const groups = uf.groups();
  const sizes = [...groups.values()].map((g) => g.length).sort();
  assert.deepStrictEqual(sizes, [1, 2]);
});

test('repeated union of the same pair is a no-op', () => {
  const uf = new UnionFind();
  uf.union('a', 'b');
  const rootBefore = uf.find('a');
  uf.union('a', 'b');
  assert.strictEqual(uf.find('a'), rootBefore);
});
