const mongoose = require('mongoose');
const { EmbeddingClient } = require('./embeddingClient');

const COLLECTION_NAME = process.env.IMAGE_COLLECTION_NAME || 'image_metadata';
const INDEX_NAME = process.env.IMAGE_VECTOR_INDEX_NAME || 'image_embedding_vector_index';

const clampLimit = (value) => {
  const parsed = Number(value || 10);
  if (Number.isNaN(parsed)) {
    return 10;
  }
  return Math.min(Math.max(parsed, 1), 50);
};

const searchImagesByText = async (query, { limit = 10 } = {}) => {
  const trimmedQuery = String(query || '').trim();
  if (!trimmedQuery) {
    const error = new Error('Search query is required.');
    error.statusCode = 400;
    throw error;
  }

  const resultLimit = clampLimit(limit);
  const embeddingClient = new EmbeddingClient();
  const queryVector = await embeddingClient.embed(trimmedQuery);

  const results = await mongoose.connection.db
    .collection(COLLECTION_NAME)
    .aggregate([
      {
        $vectorSearch: {
          index: INDEX_NAME,
          path: 'embedding',
          queryVector,
          numCandidates: Math.max(resultLimit * 20, 100),
          limit: resultLimit,
        },
      },
      {
        $project: {
          _id: 0,
          uniqueId: 1,
          leader: 1,
          otherNames: 1,
          leaderDescription: 1,
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

  return results.filter((doc) => (doc.score || 0) >= 0.80);
};

module.exports = {
  searchImagesByText,
};
