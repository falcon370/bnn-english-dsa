/**
 * Static configuration for the ingestion pipeline.
 * Centralises schedule profiles, category feed definitions, and constants.
 */

// --- Schedule Profiles (used by Cloud Scheduler) ---

const CONFIG_1AM = {
  runTime: '1am',
  trendingCategories: [
    { name: 'Sports',        id: 17, count: 5, timeRange: 'qdr:h24' },
    { name: 'Entertainment', id: 4,  count: 5, timeRange: 'qdr:h24' },
    { name: 'Tech',          id: 18, count: 5, timeRange: 'qdr:h24' },
    { name: 'Politics',      id: 14, count: 3, timeRange: 'qdr:h6'  },
    { name: 'Business',      id: 3,  count: 3, timeRange: 'qdr:h6'  },
  ],
  manualPolitics: { count: 5, timeRange: 'qdr:h3' },
  manualWorld: { count: 5, timeRange: 'qdr:d' },
};

const CONFIG_REGULAR = {
  runTime: '7am/1pm/7pm',
  trendingCategories: [
    { name: 'Politics', id: 14, count: 3, timeRange: 'qdr:h6' },
    { name: 'Business', id: 3,  count: 3, timeRange: 'qdr:h6' },
  ],
  manualPolitics: { count: 5, timeRange: 'qdr:h3' },
};

const CONFIG_MANUAL_5 = {
  runTime: 'manual-5-news',
  trendingCategories: [],
  manualPolitics: { count: 5, timeRange: 'qdr:h3' },
};

// --- Category feeds for the editorial/category pipeline ---

const CATEGORY_FEEDS = [
  { id: 'world',           topic: 'World Watch Briefing', query: 'India world diplomacy news',                category: 'World',            tags: ['world', 'global'] },
  { id: 'politics',        topic: 'Capital Circuit',      query: 'Indian politics parliament policy',         category: 'Politics',         tags: ['politics', 'policy'] },
  { id: 'sports',          topic: 'Sports Pulse',         query: 'India sports headline',                     category: 'Sports',           tags: ['sports'] },
  { id: 'tech',            topic: 'Tech Radar',           query: 'India technology startups',                 category: 'Technology',       tags: ['tech', 'innovation'] },
  { id: 'business',        topic: 'Boardroom Briefing',   query: 'India business markets economy',            category: 'Business',         tags: ['business', 'markets'] },
  { id: 'bolta-hai-bharat', topic: 'Bolta Hai Bharat',    query: 'India public opinion social issues debate', category: 'Bolta Hai Bharat', tags: ['opinion', 'social', 'india'] },
  { id: 'editorial',       topic: 'Editorial Desk',       query: 'India editorial opinion analysis commentary', category: 'Editorial',      tags: ['editorial', 'opinion', 'analysis'] },
];

// Google Trends category ID → human-readable name
const TRENDS_CATEGORY_NAMES = {
  14: 'Politics',
  10: 'Law & Government',
  3:  'Business',
  17: 'Sports',
  4:  'Entertainment',
  18: 'Tech',
};

const INGESTION_STATUS_KEY = 'ingestion';

// Minimum word count for an AI-generated article body to be considered substantial
// enough to publish (matches the floor requested in the Gemini prompts).
const MIN_CONTENT_WORDS = 400;

module.exports = {
  CONFIG_1AM,
  CONFIG_REGULAR,
  CONFIG_MANUAL_5,
  CATEGORY_FEEDS,
  TRENDS_CATEGORY_NAMES,
  INGESTION_STATUS_KEY,
  MIN_CONTENT_WORDS,
};
