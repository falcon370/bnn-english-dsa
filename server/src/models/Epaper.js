const mongoose = require('mongoose');

const epaperSchema = new mongoose.Schema(
  {
    editionDate: {
      type: Date,
      required: true,
      unique: true,
      index: true
    },
    filename: {
      type: String,
      required: true
    },
    filePath: {
      type: String,
      required: true
    },
    thumbnailPath: {
      type: String,
      default: null
    },
    fileSize: {
      type: Number,
      default: 0
    },
    articleCount: {
      type: Number,
      required: true,
      min: 0
    },
    categoryCount: {
      type: Number,
      required: true,
      min: 0
    },
    categories: [{
      type: String,
      enum: ['Politics', 'Sports', 'Tech', 'Business', 'Entertainment', 'General']
    }],
    status: {
      type: String,
      enum: ['generating', 'completed', 'failed'],
      default: 'generating'
    },
    generationTime: {
      type: Number, // milliseconds
      default: 0
    },
    errorMessage: {
      type: String,
      default: null
    },
    gcsUri: {
      type: String,
      default: null
    },
    gcsBucket: {
      type: String,
      default: null
    },
    gcsPrefix: {
      type: String,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    indexes: [
      { editionDate: -1 },
      { status: 1, editionDate: -1 }
    ]
  }
);

// Pre-save middleware to update updatedAt
epaperSchema.pre('save', function() {
  this.updatedAt = new Date();
});

// Static method to find latest edition
epaperSchema.statics.findLatest = function() {
  return this.findOne({ status: 'completed' }).sort({ editionDate: -1 });
};

// Static method to find by date range
epaperSchema.statics.findByDateRange = function(startDate, endDate) {
  return this.find({
    editionDate: {
      $gte: startDate,
      $lte: endDate
    },
    status: 'completed'
  }).sort({ editionDate: -1 });
};

// Instance method to get download URL
epaperSchema.methods.getDownloadUrl = function() {
  return `/api/epaper/${this._id}/download`;
};

// Instance method to get thumbnail URL
epaperSchema.methods.getThumbnailUrl = function() {
  if (this.thumbnailPath) {
    return `/api/epaper/${this._id}/thumbnail`;
  }
  return null;
};

module.exports = mongoose.model('Epaper', epaperSchema);