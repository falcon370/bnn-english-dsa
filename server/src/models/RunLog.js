const mongoose = require('mongoose');

const runLogSchema = new mongoose.Schema(
  {
    runType: {
      type: String,
      enum: ['trending', 'category'],
      required: true,
    },
    topicsFound: { type: Number, required: true },
    topicsStored: { type: Number, required: true },
    finishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RunLog', runLogSchema);
