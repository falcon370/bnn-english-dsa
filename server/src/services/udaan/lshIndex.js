'use strict';

/**
 * Banded LSH candidate generation over MinHash signatures
 * (docs/UDAAN_VERTICAL_SPEC.md §6.2). Converts all-pairs comparison into
 * expected-linear candidate generation: O(n·b) expected build/query,
 * b = band count.
 */

const DEFAULT_BANDS = 32;
const DEFAULT_ROWS = 4; // 32*4 = 128 = MinHash permutation count

class LSHIndex {
  constructor({ bands = DEFAULT_BANDS, rows = DEFAULT_ROWS } = {}) {
    this.bands = bands;
    this.rows = rows;
    // One bucket map per band: bandIndex -> Map<bucketKey, Set<id>>
    this.buckets = Array.from({ length: bands }, () => new Map());
    this.signatures = new Map(); // id -> signature (kept for verification callers)
  }

  _bandKey(signature, bandIndex) {
    const start = bandIndex * this.rows;
    return signature.slice(start, start + this.rows).join(',');
  }

  insert(id, signature) {
    this.signatures.set(id, signature);
    for (let b = 0; b < this.bands; b++) {
      const key = this._bandKey(signature, b);
      let bucket = this.buckets[b].get(key);
      if (!bucket) {
        bucket = new Set();
        this.buckets[b].set(key, bucket);
      }
      bucket.add(id);
    }
  }

  /**
   * Ids sharing at least one band bucket with `signature` — candidates for
   * full-signature verification, not confirmed duplicates. O(bands) bucket
   * lookups; candidate-set size is data-dependent, not proportional to n.
   */
  candidatesFor(signature, excludeId = null) {
    const candidates = new Set();
    for (let b = 0; b < this.bands; b++) {
      const key = this._bandKey(signature, b);
      const bucket = this.buckets[b].get(key);
      if (!bucket) continue;
      for (const id of bucket) {
        if (id !== excludeId) candidates.add(id);
      }
    }
    return candidates;
  }
}

/**
 * The LSH banding S-curve inflects at approximately (1/b)^(1/r). At b=32,
 * r=4 this is ≈0.42 Jaccard (spec §5).
 */
const bandingThreshold = (bands = DEFAULT_BANDS, rows = DEFAULT_ROWS) => Math.pow(1 / bands, 1 / rows);

module.exports = { LSHIndex, DEFAULT_BANDS, DEFAULT_ROWS, bandingThreshold };
