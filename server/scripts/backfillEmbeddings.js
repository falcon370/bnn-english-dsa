#!/usr/bin/env node
/**
 * One-time backfill: computes and stores `embedding` for published articles
 * that predate the semantic search / related-stories feature (or were
 * ingested while the embedding service was unreachable).
 *
 * Usage: node scripts/backfillEmbeddings.js
 * Requires MONGO_URI (server/.env) and a running embedding service
 * (EMBEDDING_SERVICE_URL, default http://localhost:8000).
 */

require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const News = require('../src/models/News');
const { EmbeddingClient } = require('../src/services/embeddingClient');

const BATCH_SIZE = 64;

const buildText = (doc) => `${doc.title || doc.topic || ''}\n\n${doc.summary || ''}`.trim();

const run = async () => {
  await connectDB();

  const docs = await News.find({ status: 'published', embedding: { $exists: false } })
    .select('title topic summary')
    .lean();

  console.log(`[backfillEmbeddings] Found ${docs.length} published articles without an embedding.`);

  const embeddingClient = new EmbeddingClient();
  let updated = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const texts = chunk.map(buildText);

    let embeddings;
    try {
      embeddings = await embeddingClient.embedBatch(texts);
    } catch (err) {
      console.warn(`[backfillEmbeddings] Batch ${i + 1}-${i + chunk.length} failed: ${err.message} — skipping.`);
      continue;
    }

    await Promise.all(
      chunk.map((doc, j) => News.findByIdAndUpdate(doc._id, { $set: { embedding: embeddings[j] } })),
    );

    updated += chunk.length;
    console.log(`[backfillEmbeddings] ${updated}/${docs.length}...`);
  }

  console.log(`[backfillEmbeddings] Done. Updated ${updated} articles.`);
  await mongoose.connection.close();
};

run().catch((err) => {
  console.error('[backfillEmbeddings] Failed:', err.message);
  process.exitCode = 1;
  mongoose.connection.close().catch(() => {});
});
