const axios = require('axios');
const { EMBEDDING_DIMENSIONS } = require('../models/ImageMetadata');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const validateEmbedding = (embedding) => {
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding service returned invalid dimensions. Expected ${EMBEDDING_DIMENSIONS}.`);
  }

  for (const value of embedding) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new Error('Embedding service returned a non-numeric embedding value.');
    }
  }
};

class EmbeddingClient {
  constructor({
    baseUrl = process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8000',
    timeoutMs = Number(process.env.EMBEDDING_TIMEOUT_MS || 30000),
    retries = Number(process.env.EMBEDDING_RETRIES || 3),
    retryDelayMs = Number(process.env.EMBEDDING_RETRY_DELAY_MS || 750),
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.retries = retries;
    this.retryDelayMs = retryDelayMs;
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async embed(text) {
    let lastError;

    for (let attempt = 1; attempt <= this.retries + 1; attempt += 1) {
      try {
        const response = await this.http.post('/embed', { text });
        const embedding = response.data && response.data.embedding;
        validateEmbedding(embedding);
        return embedding;
      } catch (error) {
        lastError = error;
        const status = error.response && error.response.status;
        const retryable = !status || status === 408 || status === 429 || status >= 500;

        if (!retryable || attempt > this.retries) {
          break;
        }

        const delay = this.retryDelayMs * 2 ** (attempt - 1);
        await sleep(delay);
      }
    }

    const message = lastError.response
      ? `${lastError.response.status} ${JSON.stringify(lastError.response.data)}`
      : lastError.message;
    throw new Error(`Embedding request failed: ${message}`);
  }

  async embedBatch(texts) {
    if (!texts.length) {
      return [];
    }

    let lastError;

    for (let attempt = 1; attempt <= this.retries + 1; attempt += 1) {
      try {
        const response = await this.http.post('/embed/batch', { texts });
        const embeddings = response.data && response.data.embeddings;

        if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
          throw new Error('Embedding service returned the wrong number of batch embeddings.');
        }

        embeddings.forEach(validateEmbedding);
        return embeddings;
      } catch (error) {
        lastError = error;
        const status = error.response && error.response.status;
        const retryable = !status || status === 408 || status === 429 || status >= 500;

        if (!retryable || attempt > this.retries) {
          break;
        }

        const delay = this.retryDelayMs * 2 ** (attempt - 1);
        await sleep(delay);
      }
    }

    const message = lastError.response
      ? `${lastError.response.status} ${JSON.stringify(lastError.response.data)}`
      : lastError.message;
    throw new Error(`Batch embedding request failed: ${message}`);
  }
}

module.exports = {
  EmbeddingClient,
  validateEmbedding,
};
