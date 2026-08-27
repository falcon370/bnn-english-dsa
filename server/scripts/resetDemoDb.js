#!/usr/bin/env node
/**
 * Deletes every article from the isolated bnn_demo database, so
 * seedDemoArticles.js / triggerUdaanIngestion.js can be re-run from a
 * clean slate for a repeat demo. Refuses to run unless MONGO_URI
 * resolves to bnn_demo — never touches production.
 *
 * Usage: node scripts/resetDemoDb.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.demo'), quiet: true });
require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const News = require('../src/models/News');

const assertDemoDb = () => {
  const uri = process.env.MONGO_URI || '';
  if (!/\/bnn_demo(\?|$)/.test(uri)) {
    console.error('[reset] MONGO_URI does not point at bnn_demo — refusing to run against anything else.');
    process.exit(1);
  }
};

const run = async () => {
  assertDemoDb();
  await connectDB();

  const { deletedCount } = await News.deleteMany({});
  console.log(`[reset] Deleted ${deletedCount} article(s) from bnn_demo.`);

  await mongoose.connection.close();
};

run().catch((err) => {
  console.error('[reset] Failed:', err.message);
  process.exitCode = 1;
  mongoose.connection.close().catch(() => {});
});
