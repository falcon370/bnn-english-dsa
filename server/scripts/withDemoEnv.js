#!/usr/bin/env node
/**
 * Generic wrapper: loads .env.demo (pinning MONGO_URI to the isolated
 * bnn_demo database) before requiring whatever script path is passed as
 * the first CLI argument. Lets any existing scripts/*.js be safely re-run
 * against the demo database without duplicating logic per-script.
 *
 * Usage: node scripts/withDemoEnv.js scripts/backfillEmbeddings.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.demo'), quiet: true });

const target = process.argv[2];
if (!target) {
  console.error('Usage: node scripts/withDemoEnv.js <path-to-script.js>');
  process.exit(1);
}

require(path.resolve(target));
