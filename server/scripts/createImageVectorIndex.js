#!/usr/bin/env node

require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const { EMBEDDING_DIMENSIONS } = require('../src/models/ImageMetadata');

const INDEX_NAME = process.env.IMAGE_VECTOR_INDEX_NAME || 'image_embedding_vector_index';
const COLLECTION_NAME = process.env.IMAGE_COLLECTION_NAME || 'image_metadata';

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
    createSearchIndexes: COLLECTION_NAME,
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
    console.log(`[vector-index] Created Atlas Vector Search index "${INDEX_NAME}" on "${COLLECTION_NAME}".`);
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
