const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    claim: { type: String },
    claimant: { type: String },
    publisher: { type: String },
    verdict: { type: String },
    publisherDate: { type: Date }
  },
  { _id: false }
);

const pibMatchSchema = new mongoose.Schema(
  {
    title: { type: String },
    link: { type: String },
    date: { type: String }
  },
  { _id: false }
);

const signalSchema = new mongoose.Schema(
  {
    sensationalism: { type: Number },
    attribution: { type: Number },
    consistency: { type: Number },
    credibility: { type: Number },
    coherence: { type: Number }
  },
  { _id: false }
);

const factCheckSchema = new mongoose.Schema(
  {
    headlineHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    headline: {
      type: String,
      required: true
    },
    // Google Fact Check Tools API
    factApiScore: {
      type: Number,
      default: 0
    },
    matches: {
      type: [matchSchema],
      default: []
    },
    // PIB Fact Check RSS
    pibScore: {
      type: Number,
      default: null
    },
    pibMatches: {
      type: [pibMatchSchema],
      default: []
    },
    // Gemini AI linguistic analysis
    aiScore: {
      type: Number,
      default: 0
    },
    aiVerdict: {
      type: String,
      default: ''
    },
    aiSignals: {
      type: signalSchema,
      default: null
    },
    aiFlags: {
      type: [String],
      default: []
    },
    // Headline vs body mismatch detection
    mismatchScore: {
      type: Number,
      default: null   // null = not available (headline-only check)
    },
    mismatchVerdict: {
      type: String,
      default: null   // "Accurate" | "Slightly Misleading" | "Clickbait" | "Misleading"
    },
    mismatchReason: {
      type: String,
      default: null
    },
    // Aggregated final score
    finalScore: {
      type: Number,
      required: true
    },
    verdict: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400 // 24 hours TTL index
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('FactCheck', factCheckSchema);
