#!/usr/bin/env node

require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const { EmbeddingClient } = require('../src/services/embeddingClient');

const COLLECTION_NAME = process.env.IMAGE_COLLECTION_NAME || 'image_metadata';
const INDEX_NAME = process.env.IMAGE_VECTOR_INDEX_NAME || 'image_embedding_vector_index';
const QUERY = process.argv.slice(2).join(' ').trim();
const LIMIT = Number(process.env.IMAGE_SEARCH_LIMIT || 5);

const main = async () => {
  if (!QUERY) {
    console.error('Usage: npm run image:search -- "leader at podium with flags"');
    process.exit(1);
  }

  await connectDB();
  const embeddingClient = new EmbeddingClient();
  const queryVector = await embeddingClient.embed(QUERY);

  const results = await mongoose.connection.db
    .collection(COLLECTION_NAME)
    .aggregate([
      {
        $vectorSearch: {
          index: INDEX_NAME,
          path: 'embedding',
          queryVector,
          numCandidates: Math.max(LIMIT * 20, 100),
          limit: LIMIT,
        },
      },
      {
        $project: {
          _id: 0,
          uniqueId: 1,
          leader: 1,
          otherNames: 1,
          imageDescription: 1,
          imageUrl: 1,
          fileName: 1,
          repositoryImageUrl: 1,
          searchableText: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ])
    .toArray();

  console.log(JSON.stringify(results, null, 2));
  await mongoose.connection.close();
};

main().catch(async (error) => {
  console.error('[image-search] Failed:', error);
  await mongoose.connection.close();
  process.exit(1);
});
