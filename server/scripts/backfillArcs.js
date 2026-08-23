#!/usr/bin/env node
/**
 * One-time backfill: populates minhashSignature/arcId/isArcRepresentative
 * for existing published articles that predate the Udaan dedup pipeline
 * (M1 — docs/UDAAN_VERTICAL_SPEC.md §6.2/§6.3), so future ingestion runs
 * have signatures to compare new articles against.
 *
 * Does NOT retroactively cluster historical articles against each other —
 * each existing article becomes its own singleton arc (arcId = its own
 * _id). Supersedes run_timeline_migration.js's job (which forced the now-
 * removed News.js pre-save hook to recompute Politics-only event tags);
 * that script is kept only as a pattern reference, not run alongside this.
 *
 * Usage: node scripts/backfillArcs.js
 */

require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const News = require('../src/models/News');
const { computeSignature } = require('../src/services/udaan/minhash');

const buildDocText = (doc) => `${doc.title || doc.topic || ''}\n\n${doc.summary || ''}`.trim();

const run = async () => {
  await connectDB();

  const docs = await News.find({ status: 'published', arcId: null })
    .select('title topic summary')
    .lean();

  console.log(`[backfillArcs] Found ${docs.length} published articles without an arc.`);

  let updated = 0;
  for (const doc of docs) {
    const signature = computeSignature(buildDocText(doc));
    await News.findByIdAndUpdate(doc._id, {
      $set: {
        minhashSignature: signature,
        arcId: doc._id,
        isArcRepresentative: true,
        arcUpdateCount: 0,
      },
    });
    updated++;
    if (updated % 50 === 0) console.log(`[backfillArcs] ${updated}/${docs.length}...`);
  }

  console.log(`[backfillArcs] Done. Updated ${updated} articles.`);
  await mongoose.connection.close();
};

run().catch((err) => {
  console.error('[backfillArcs] Failed:', err.message);
  process.exitCode = 1;
  mongoose.connection.close().catch(() => {});
});
