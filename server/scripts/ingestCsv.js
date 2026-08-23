#!/usr/bin/env node

require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const ImageMetadata = require('../src/models/ImageMetadata');
const { EmbeddingClient } = require('../src/services/embeddingClient');
const { mapCsvRowToImageMetadata } = require('../src/utils/imageSearchText');

const DEFAULT_CSV_DIR = path.resolve(__dirname, '../csv_data');
const CSV_PATH = path.resolve(process.env.IMAGE_CSV_PATH || process.argv[2] || DEFAULT_CSV_DIR);
const BATCH_SIZE = Number(process.env.IMAGE_INGEST_BATCH_SIZE || 50);
const EMBEDDING_BATCH_SIZE = Number(process.env.IMAGE_EMBEDDING_BATCH_SIZE || 16);
const DRY_RUN = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run');
const UPSERT = process.env.IMAGE_INGEST_UPSERT !== '0';

const stats = {
  read: 0,
  prepared: 0,
  inserted: 0,
  skipped: 0,
  failed: 0,
};

const log = (message, payload = null) => {
  if (payload) {
    console.log(`[image-ingest] ${message}`, payload);
  } else {
    console.log(`[image-ingest] ${message}`);
  }
};

const isValidMetadata = (metadata) => {
  if (!metadata.uniqueId || !metadata.leader || !metadata.searchableText) {
    return false;
  }

  if (metadata.searchableText.length < 5) {
    return false;
  }

  return true;
};

const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const writeBatch = async (documents) => {
  if (!documents.length || DRY_RUN) {
    return 0;
  }

  if (!UPSERT) {
    const result = await ImageMetadata.insertMany(documents, { ordered: false });
    return result.length;
  }

  const operations = documents.map((document) => ({
    updateOne: {
      filter: {
        uniqueId: document.uniqueId,
        imageUrl: document.imageUrl,
      },
      update: {
        $set: {
          ...document,
          ingestedAt: new Date(),
        },
      },
      upsert: true,
    },
  }));

  const result = await ImageMetadata.bulkWrite(operations, { ordered: false });
  return (result.upsertedCount || 0) + (result.modifiedCount || 0) + (result.matchedCount || 0);
};

const enrichWithEmbeddings = async (embeddingClient, batch) => {
  const enriched = [];

  for (const miniBatch of chunk(batch, EMBEDDING_BATCH_SIZE)) {
    const embeddings = await embeddingClient.embedBatch(miniBatch.map((item) => item.searchableText));
    embeddings.forEach((embedding, index) => {
      enriched.push({
        ...miniBatch[index],
        embedding,
      });
    });
  }

  return enriched;
};

const ingestSingleFile = async (filePath, embeddingClient) => {
  const filename = path.basename(filePath);
  let category = 'politics';
  if (filename !== 'BNN_image.csv') {
    category = filename.replace(/\.csv$/i, '').toLowerCase();
  }

  log(`Ingesting ${filename} with category: ${category}`);

  const pending = [];
  const csvStream = fs
    .createReadStream(filePath)
    .pipe(csv({
      mapHeaders: ({ header, index }) => {
        const trimmed = String(header || '').trim();
        if (trimmed === '') {
          if (index === 0) return 'UniqueID';
          return null; // Ignore other empty columns
        }
        const lower = trimmed.toLowerCase();
        if (lower === 'name') return 'Name';
        if (lower === 'any other name' || lower === 'full name') return 'Any other name';
        if (lower.startsWith('description of the leader') || lower.startsWith('description of the person') || lower === 'description') {
          return 'Description of the leader';
        }
        if (lower.startsWith('description of the image')) return 'Description of the image';
        if (lower.startsWith('url')) return 'Url';
        if (lower.startsWith('file name')) return 'File name';
        return trimmed;
      }
    }));

  let fileReadCount = 0;
  let filePreparedCount = 0;
  let fileSkippedCount = 0;

  for await (const row of csvStream) {
    fileReadCount += 1;
    stats.read += 1;
    const rowNumber = fileReadCount + 1;
    const metadata = mapCsvRowToImageMetadata(row, rowNumber, category);

    // Explicitly make sure category and source are populated on the metadata object
    metadata.category = category;
    metadata.source = filename;

    if (!isValidMetadata(metadata)) {
      fileSkippedCount += 1;
      stats.skipped += 1;
      log(`Skipping malformed row ${rowNumber} in ${filename}`, {
        uniqueId: metadata.uniqueId || null,
        leader: metadata.leader || null,
      });
      continue;
    }

    pending.push(metadata);
    filePreparedCount += 1;
    stats.prepared += 1;

    if (pending.length >= BATCH_SIZE) {
      await flushBatch(embeddingClient, pending);
      pending.length = 0;
    }
  }

  if (pending.length) {
    await flushBatch(embeddingClient, pending);
  }

  log(`Finished ingesting ${filename}: read ${fileReadCount}, prepared ${filePreparedCount}, skipped ${fileSkippedCount}`);
};

const ingest = async () => {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV path not found: ${CSV_PATH}`);
  }

  const embeddingClient = new EmbeddingClient();
  const stat = fs.statSync(CSV_PATH);

  if (stat.isDirectory()) {
    log(`Reading all CSV files from directory ${CSV_PATH}`);
    const files = fs.readdirSync(CSV_PATH).filter(f => f.endsWith('.csv'));
    if (files.length === 0) {
      log(`No CSV files found in directory ${CSV_PATH}`);
      return;
    }
    // Process BNN_image.csv first if it exists
    files.sort((a, b) => {
      if (a === 'BNN_image.csv') return -1;
      if (b === 'BNN_image.csv') return 1;
      return a.localeCompare(b);
    });
    for (const file of files) {
      await ingestSingleFile(path.join(CSV_PATH, file), embeddingClient);
    }
  } else {
    await ingestSingleFile(CSV_PATH, embeddingClient);
  }

  log('All ingestion finished', stats);
};

const flushBatch = async (embeddingClient, batch) => {
  try {
    if (DRY_RUN) {
      log(`Prepared ${batch.length} image metadata documents`, {
        read: stats.read,
        prepared: stats.prepared,
        skipped: stats.skipped,
        sample: batch[0]
          ? {
              uniqueId: batch[0].uniqueId,
              leader: batch[0].leader,
              searchableText: batch[0].searchableText,
            }
          : null,
      });
      return;
    }

    const enriched = await enrichWithEmbeddings(embeddingClient, batch);
    const written = await writeBatch(enriched);
    stats.inserted += written;
    log(`Stored ${enriched.length} image metadata documents`, {
      read: stats.read,
      prepared: stats.prepared,
      stored: stats.inserted,
      skipped: stats.skipped,
    });
  } catch (error) {
    stats.failed += batch.length;
    console.error(`[image-ingest] Failed to process batch ending near row ${batch[batch.length - 1].sourceRowNumber}:`, error.message);
  }
};

const main = async () => {
  try {
    if (!DRY_RUN) {
      await connectDB();
    }
    await ingest();

    if (stats.failed > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('[image-ingest] Fatal error:', error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
};

main();
