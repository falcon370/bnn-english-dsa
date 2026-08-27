#!/usr/bin/env node
/**
 * Seeds a handful of realistic demo articles directly into the isolated
 * `bnn_demo` database (see .env.demo / scripts/runDemoServer.js), running
 * them through the SAME udaan.filterDuplicates / attachAsSource /
 * registerArticle functions the real ingestion pipeline uses in
 * ingestionOrchestrator.js. Skips only the SerpApi fetch and Gemini
 * synthesis steps (raw article text is used directly as the published
 * content) to avoid spending API credits, while still exercising the real
 * dedup + embedding code path end-to-end.
 *
 * Refuses to run unless MONGO_URI resolves to bnn_demo — never point this
 * at production.
 *
 * Usage: node scripts/seedDemoArticles.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.demo'), quiet: true });
require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const News = require('../src/models/News');
const udaan = require('../src/services/udaan');

const assertDemoDb = () => {
  const uri = process.env.MONGO_URI || '';
  if (!/\/bnn_demo(\?|$)/.test(uri)) {
    console.error('[seed] MONGO_URI does not point at bnn_demo — refusing to run against anything else.');
    process.exit(1);
  }
};

const rawFeeds = [
  {
    category: 'Udaan',
    tags: ['innovation', 'motivation', 'grit'],
    articles: [
      {
        title: 'IIT Madras student builds low cost prosthetic for rural patients',
        snippet: 'A team at IIT Madras has developed a low cost prosthetic limb designed to improve mobility for rural patients across India, the college said in a statement released this week.',
        source: 'The Hindu',
        link: 'https://example.com/demo/iit-prosthetic-a',
        publishedAt: new Date().toISOString(),
      },
      {
        title: 'Affordable prosthetic developed by IIT Madras team',
        snippet: 'A team at IIT Madras has developed a low cost prosthetic limb designed to improve mobility for rural patients across India, the college said in a statement released this week.',
        source: 'NDTV',
        link: 'https://example.com/demo/iit-prosthetic-b',
        publishedAt: new Date().toISOString(),
      },
      {
        title: 'Bengaluru startup launches solar powered irrigation pump for small farmers',
        snippet: 'A new solar powered irrigation pump has been launched to help small farmers cut costs and reduce dependency on erratic monsoon rains.',
        source: 'YourStory',
        link: 'https://example.com/demo/solar-irrigation',
        publishedAt: new Date().toISOString(),
      },
    ],
  },
  {
    category: 'Business',
    tags: ['business', 'markets'],
    articles: [
      {
        title: 'Rural fintech startup raises funding to expand digital lending in villages',
        snippet: 'A fintech startup focused on rural digital lending has raised a new funding round to expand access to credit for small farmers and rural entrepreneurs across India.',
        source: 'Economic Times',
        link: 'https://example.com/demo/rural-fintech',
        publishedAt: new Date().toISOString(),
      },
    ],
  },
  {
    category: 'Politics',
    tags: ['politics', 'policy'],
    articles: [
      {
        title: 'Parliament passes new agriculture reform bill amid opposition protests',
        snippet: 'The Indian Parliament passed a new agriculture sector reform bill on Thursday, with opposition parties staging protests over concerns about its impact on smallholder farmers.',
        source: 'Reuters',
        link: 'https://example.com/demo/agri-reform-bill',
        publishedAt: new Date().toISOString(),
      },
    ],
  },
];

const run = async () => {
  assertDemoDb();
  await connectDB();

  let created = 0;
  let merged = 0;

  for (const feed of rawFeeds) {
    console.log(`\n[seed] Category: ${feed.category}`);
    const { survivors, duplicates } = await udaan.filterDuplicates(feed.articles, { category: feed.category });

    for (const dup of duplicates.filter((d) => d.attachTo.type === 'existing')) {
      await udaan.attachAsSource(dup.attachTo.id, dup.article);
      console.log(`  merged (existing arc) "${dup.article.title}"`);
      merged++;
    }

    const savedIdByIndex = new Map();
    for (const survivor of survivors) {
      const article = survivor.article;
      const record = await News.create({
        topic: article.title,
        title: article.title,
        summary: article.snippet,
        content: `${article.snippet}\n\n(Demo seed content — not Gemini-generated.)`,
        category: feed.category,
        tags: feed.tags,
        primaryLink: article.link,
        externalUrl: article.link,
        sourceOptions: [article],
        availableSources: article.source ? [article.source] : [],
        selectedSource: article.source || null,
        primarySource: article.source || null,
        status: 'published',
        publishedAt: new Date(),
        autoGenerated: true,
        fromNewsApi: true,
      });

      const registered = await udaan.registerArticle(record, article);
      savedIdByIndex.set(survivor.index, registered._id);
      console.log(`  created "${registered.title}" (${registered._id}) — embedding: ${registered.embedding ? 'yes' : 'no'}`);
      created++;
    }

    for (const dup of duplicates.filter((d) => d.attachTo.type === 'pending')) {
      const targetId = savedIdByIndex.get(dup.attachTo.index);
      if (targetId) {
        await udaan.attachAsSource(targetId, dup.article);
        console.log(`  merged (within-batch) "${dup.article.title}" -> ${targetId}`);
        merged++;
      }
    }
  }

  console.log(`\n[seed] Done. Created ${created} articles, merged ${merged} duplicates.`);
  await mongoose.connection.close();
};

run().catch((err) => {
  console.error('[seed] Failed:', err.message);
  process.exitCode = 1;
  mongoose.connection.close().catch(() => {});
});
