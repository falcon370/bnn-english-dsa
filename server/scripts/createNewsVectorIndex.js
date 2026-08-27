#!/usr/bin/env node
/**
 * Creates the MongoDB Atlas vector search index over News.embedding, used
 * by semantic search (newsController.getPublishedNews, mode=semantic) and
 * related-stories (newsController.getRelatedNews). Same shape as the
 * existing image-search index — see scripts/createImageVectorIndex.js.
 */

require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const { EMBEDDING_DIMENSIONS } = require('../src/models/ImageMetadata');
const News = require('../src/models/News');

const INDEX_NAME = process.env.NEWS_VECTOR_INDEX_NAME || 'news_embedding_vector_index';

const indexDefinition = {
  fields: [
    {
      type: 'vector',
      path: 'embedding',
      numDimensions: EMBEDDING_DIMENSIONS,
      similarity: 'cosine',
    },
  ],
};

const createIndex = async () => {
  await connectDB();

  const command = {
    createSearchIndexes: News.collection.name,
    indexes: [
      {
        name: INDEX_NAME,
        type: 'vectorSearch',
        definition: indexDefinition,
      },
    ],
  };

  try {
    const result = await mongoose.connection.db.command(command);
    console.log(`[vector-index] Created Atlas Vector Search index "${INDEX_NAME}" on "${News.collection.name}".`);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (/already exists/i.test(error.message)) {
      console.log(`[vector-index] Index "${INDEX_NAME}" already exists.`);
      return;
    }

    console.error('[vector-index] Failed to create index:', error.message);
    console.error('[vector-index] You can create it manually in Atlas with this definition:');
    console.error(JSON.stringify(indexDefinition, null, 2));
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

createIndex();
