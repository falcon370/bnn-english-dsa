#!/usr/bin/env node
/**
 * Runs one real ingestion pass for ONLY the Udaan CATEGORY_FEEDS entry
 * (SerpApi fetch -> udaan.filterDuplicates -> Gemini synthesis -> image
 * resolution -> udaan.registerArticle), against the isolated `bnn_demo`
 * database. Scoped to just this one feed (rather than
 * refreshCategoryFeeds(), which runs all 8) to minimize real SerpApi/
 * Gemini API spend for this test.
 *
 * Refuses to run unless MONGO_URI resolves to bnn_demo.
 *
 * Usage: node scripts/triggerUdaanIngestion.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.demo'), quiet: true });
require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const { ingestCategoryFeeds } = require('../src/services/trending/ingestionOrchestrator');
const { CATEGORY_FEEDS } = require('../src/services/trending/ingestionConfig');

const assertDemoDb = () => {
  const uri = process.env.MONGO_URI || '';
  if (!/\/bnn_demo(\?|$)/.test(uri)) {
    console.error('[trigger] MONGO_URI does not point at bnn_demo — refusing to run against anything else.');
    process.exit(1);
  }
};

const run = async () => {
  assertDemoDb();
  await connectDB();

  const udaanFeed = CATEGORY_FEEDS.find((f) => f.id === 'udaan');
  if (!udaanFeed) {
    console.error('[trigger] No "udaan" entry found in CATEGORY_FEEDS.');
    process.exitCode = 1;
    return mongoose.connection.close();
  }

  console.log('[trigger] Running real ingestion for the Udaan feed only (SerpApi + Gemini will be called)...');
  const issues = [];
  const records = await ingestCategoryFeeds(issues, [udaanFeed]);

  console.log(`\n[trigger] Done. ${records.length} article(s) published:`);
  records.forEach((r) => console.log(`  - "${r.title}" (${r._id})`));

  if (issues.length) {
    console.log(`\n[trigger] ${issues.length} issue(s) logged:`);
    issues.forEach((i) => console.log(`  - ${i}`));
  }

  await mongoose.connection.close();
};

run().catch((err) => {
  console.error('[trigger] Failed:', err.message);
  process.exitCode = 1;
  mongoose.connection.close().catch(() => {});
});
