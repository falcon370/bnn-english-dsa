
/**
 * Pre-Gemini Refinement Layer
 * Purpose: Clean, dedupe, rank, and select articles BEFORE Gemini
 */

const TRUSTED_SOURCES = new Set([
  'BBC',
  'Reuters',
  'The Hindu',
  'Indian Express',
  'ANI',
  'PTI',
]);

const CLICKBAIT_REGEX =
  /(shocking|breaking|you won’t believe|viral|must see|exclusive)/i;

const MIN_TEXT_LENGTH = 80;

/* -------------------- Utilities -------------------- */

const cleanText = (text = '') =>
  text
    .replace(/<[^>]*>/g, '')       // remove HTML
    .replace(/\s+/g, ' ')          // normalize whitespace
    .trim();

const normalizeArticle = (a) => ({
  ...a,
  title: cleanText(a.title),
  snippet: cleanText(a.snippet),
});

/* -------------------- Validation -------------------- */

const isValidArticle = (a) => {
  if (!a.link || !a.title) return false;

  const body = `${a.title} ${a.snippet || ''}`;

  if (body.length < MIN_TEXT_LENGTH) return false;
  if (CLICKBAIT_REGEX.test(body)) return false;

  return true;
};

/* -------------------- Deduplication -------------------- */

const dedupeByLink = (articles) => {
  const seen = new Set();
  return articles.filter((a) => {
    if (seen.has(a.link)) return false;
    seen.add(a.link);
    return true;
  });
};

/* -------------------- Scoring -------------------- */

const scoreArticle = (a) => {
  let score = 0;

  if (TRUSTED_SOURCES.has(a.source)) score += 4;
  if ((a.snippet || '').length > 120) score += 2;
  if (a.publishedAt) score += 1;
  if (a.imageUrl) score += 1;

  return score;
};

/* -------------------- MAIN REFINER -------------------- */

/**
 * Refines articles BEFORE Gemini sees them
 *
 * @param {Array} rawArticles
 * @param {number} limit - max articles sent to Gemini
 * @returns {Array}
 */
const refineForGemini = (rawArticles, limit = 5) => {
  if (!Array.isArray(rawArticles)) return [];

  const cleaned = rawArticles
    .map(normalizeArticle)
    .filter(isValidArticle);

  const unique = dedupeByLink(cleaned);

  unique.sort((a, b) => scoreArticle(b) - scoreArticle(a));

  return unique.slice(0, limit);
};

module.exports = { refineForGemini };