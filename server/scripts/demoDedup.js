#!/usr/bin/env node
/**
 * Read-only demo of the Udaan dedup pipeline (MinHash + banded LSH +
 * Union-Find) — feeds three synthetic articles through
 * udaan.filterDuplicates() and prints what would happen, without writing
 * anything to the database or calling Gemini/SerpApi.
 *
 * Two of the three are paraphrases of the same story (should merge into
 * one survivor + one duplicate); the third is unrelated (stays a
 * survivor). Useful for demoing the merge behaviour without waiting for
 * real syndicated duplicates to show up in a live feed.
 *
 * Usage: node scripts/demoDedup.js
 */

require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const udaan = require('../src/services/udaan');

// Articles 0 and 1 share near-identical body text (as real syndicated
// coverage of the same press release/wire story typically does, even
// under different headlines) — the case dedup exists to catch. Article 2
// is unrelated and should survive independently.
const demoArticles = [
  {
    title: 'IIT Madras student builds low cost prosthetic for rural patients',
    snippet: 'A team at IIT Madras has developed a low cost prosthetic limb designed to improve mobility for rural patients across India, the college said in a statement released this week.',
    source: 'The Hindu',
    link: 'https://example.com/demo-a',
    publishedAt: new Date().toISOString(),
  },
  {
    title: 'Affordable prosthetic developed by IIT Madras team',
    snippet: 'A team at IIT Madras has developed a low cost prosthetic limb designed to improve mobility for rural patients across India, the college said in a statement released this week.',
    source: 'NDTV',
    link: 'https://example.com/demo-b',
    publishedAt: new Date().toISOString(),
  },
  {
    title: 'Bengaluru startup launches solar powered irrigation pump for small farmers',
    snippet: 'A new solar powered irrigation pump has been launched to help small farmers cut costs.',
    source: 'YourStory',
    link: 'https://example.com/demo-c',
    publishedAt: new Date().toISOString(),
  },
];

const run = async () => {
  await connectDB();

  console.log('[demo] Feeding 3 synthetic articles through udaan.filterDuplicates()...\n');
  demoArticles.forEach((a, i) => console.log(`  [${i}] "${a.title}" (${a.source})`));

  const { survivors, duplicates } = await udaan.filterDuplicates(demoArticles, { category: 'Udaan' });

  console.log(`\nSurvivors (${survivors.length}) — would proceed to Gemini + get published:`);
  survivors.forEach((s) => console.log(`  - [${s.index}] "${s.article.title}"`));

  console.log(`\nDuplicates (${duplicates.length}) — merged as a source, NO Gemini call:`);
  duplicates.forEach((d) => console.log(`  - "${d.article.title}" -> attaches to ${JSON.stringify(d.attachTo)}`));

  await mongoose.connection.close();
};

run().catch((err) => {
  console.error('[demo] Failed:', err.message);
  process.exitCode = 1;
  mongoose.connection.close().catch(() => {});
});
