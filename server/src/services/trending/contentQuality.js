/**
 * Minimum content-depth enforcement.
 *
 * The Gemini prompts require 400-500+ word articles, but nothing previously checked the
 * output before publishing it. This enforces that bar so thin/derivative drafts get
 * skipped (and can be retried on a later run) instead of published.
 */

const { MIN_CONTENT_WORDS } = require('./ingestionConfig');

const countWords = (text) => (text ? text.trim().split(/\s+/).filter(Boolean).length : 0);

const meetsQualityBar = (content) => countWords(content) >= MIN_CONTENT_WORDS;

module.exports = { meetsQualityBar, countWords };
