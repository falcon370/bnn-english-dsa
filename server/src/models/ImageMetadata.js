const mongoose = require('mongoose');

const EMBEDDING_DIMENSIONS = 384;

const imageMetadataSchema = new mongoose.Schema(
  {
    uniqueId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    leader: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    otherNames: {
      type: [String],
      default: [],
      index: true,
    },
    leaderDescription: {
      type: String,
      default: '',
      trim: true,
    },
    imageDescription: {
      type: String,
      default: '',
      trim: true,
    },
    imageUrl: {
      type: String,
      default: '',
      trim: true,
    },
    fileName: {
      type: String,
      default: '',
      trim: true,
    },
    repositoryImageUrl: {
      type: String,
      default: '',
      trim: true,
    },
    searchableText: {
      type: String,
      required: true,
      trim: true,
    },
    embedding: {
      type: [Number],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length === EMBEDDING_DIMENSIONS;
        },
        message: `Embedding must contain exactly ${EMBEDDING_DIMENSIONS} dimensions.`,
      },
      select: false,
    },
    source: {
      type: String,
      default: 'BNN_image.csv',
      trim: true,
    },
    category: {
      type: String,
      default: 'politics',
      trim: true,
      index: true,
    },
    sourceRowNumber: {
      type: Number,
      default: null,
    },
    instagramId: {
      type: String,
      default: '',
      trim: true,
    },
    facebookId: {
      type: String,
      default: '',
      trim: true,
    },
    ingestedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'image_metadata',
  }
);

imageMetadataSchema.index({ uniqueId: 1, imageUrl: 1 }, { unique: true });
imageMetadataSchema.index({ leader: 1, uniqueId: 1 });
imageMetadataSchema.index({ searchableText: 'text' });

module.exports = mongoose.model('ImageMetadata', imageMetadataSchema);
module.exports.EMBEDDING_DIMENSIONS = EMBEDDING_DIMENSIONS;
