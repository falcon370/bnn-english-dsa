// SUPERSEDED by scripts/backfillArcs.js. This script forced the Politics-
// only regex/Jaccard pre-save hook in src/models/News.js to recompute event
// tags; that hook was removed when the Udaan MinHash/LSH/Union-Find dedup
// pipeline took over arc assignment at ingest time (M1, spec §6.2/§6.3).
// Kept only as a pattern reference — running this now just re-saves each
// document with no hook left to do anything.

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const News = require('../src/models/News');

const runMigration = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected successfully!');

    // Fetch all published politics articles from the last 30 days, oldest first
    console.log('Fetching published politics articles from the last 30 days...');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const articles = await News.find({
      category: /politics/i,
      status: 'published',
      publishedAt: { $gte: thirtyDaysAgo }
    }).sort({ createdAt: 1 });

    console.log(`Found ${articles.length} published politics articles to migrate.`);

    let migratedCount = 0;
    for (let i = 0; i < articles.length; i++) {
      const art = articles[i];
      // Force trigger the pre-save hook by saving the document
      // We will mark the tags as modified to ensure the save hook executes and updates it
      art.markModified('tags');
      await art.save();
      migratedCount++;
      if (migratedCount % 50 === 0 || migratedCount === articles.length) {
        console.log(`Migrated ${migratedCount}/${articles.length} articles...`);
      }
    }

    console.log('\nMigration complete! All politics articles have been updated with event-centric timeline tags.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
};

runMigration();
