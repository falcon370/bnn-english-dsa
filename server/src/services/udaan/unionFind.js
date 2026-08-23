'use strict';

/**
 * Union-Find (disjoint-set) with path compression + union by rank
 * (docs/UDAAN_VERTICAL_SPEC.md §6.3). find/union: O(α(n)) amortized,
 * α = inverse Ackermann — effectively constant for any n this project
 * will ever see.
 */
class UnionFind {
  constructor() {
    this.parent = new Map();
    this.rank = new Map();
  }

  makeSet(x) {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
    return x;
  }

  find(x) {
    this.makeSet(x);
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root);
    }
    // Path compression: repoint every visited node directly at the root.
    let cur = x;
    while (this.parent.get(cur) !== root) {
      const next = this.parent.get(cur);
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  union(x, y) {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return rootX;

    const rankX = this.rank.get(rootX);
    const rankY = this.rank.get(rootY);

    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
      return rootY;
    }
    if (rankX > rankY) {
      this.parent.set(rootY, rootX);
      return rootX;
    }
    this.parent.set(rootY, rootX);
    this.rank.set(rootX, rankX + 1);
    return rootX;
  }

  connected(x, y) {
    return this.find(x) === this.find(y);
  }

  /** Groups every known element by its current root — reads out the arcs. */
  groups() {
    const out = new Map();
    for (const x of this.parent.keys()) {
      const root = this.find(x);
      if (!out.has(root)) out.set(root, []);
      out.get(root).push(x);
    }
    return out;
  }
}

module.exports = { UnionFind };
