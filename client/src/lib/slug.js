/**
 * slug.js — Helpers for SEO-friendly story URLs
 *
 * URL format: /story/{mongoId}-{title-slug}
 * Example:    /story/6a2e4b70bdeef7fcfba0306a-pm-modi-addresses-parliament-on-new-bill
 *
 * The MongoDB ObjectId (24 hex chars) is always the leading segment so the
 * server and client can extract it reliably by taking the first 24 characters.
 */

const SLUG_MAX_CHARS = 60;

/**
 * Converts a raw title string into a URL-safe slug.
 * Strips Devanagari + special chars, lowercases, collapses whitespace → hyphens,
 * and caps at SLUG_MAX_CHARS characters.
 *
 * @param {string} title
 * @returns {string}
 */
function titleToSlug(title = '') {
  return title
    .replace(/^Trending:\s*/i, '')   // strip "Trending:" prefix
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')         // keep word chars, spaces, hyphens
    .trim()
    .replace(/[\s_]+/g, '-')          // spaces/underscores → hyphen
    .replace(/-+/g, '-')              // collapse consecutive hyphens
    .slice(0, SLUG_MAX_CHARS)
    .replace(/-+$/, '');              // strip trailing hyphens after truncation
}

/**
 * Builds the full story path segment used in <Link href> everywhere.
 *
 * @param {{ _id: string, title?: string, topic?: string }} article
 * @returns {string}  e.g. "/story/6a2e4b70bdeef7fcfba0306a-pm-modi-addresses-parliament"
 */
export function makeStorySlug(article) {
  if (!article?._id) return '/';
  const raw = article.title || article.topic || '';
  const slug = titleToSlug(raw);
  return slug ? `/story/${article._id}-${slug}` : `/story/${article._id}`;
}

/**
 * Extracts the 24-character MongoDB ObjectId from a URL param that may look
 * like "6a2e4b70bdeef7fcfba0306a-pm-modi-addresses-parliament" or just
 * "6a2e4b70bdeef7fcfba0306a" (old-style bare-ID URL).
 *
 * @param {string} param  — the raw [id] route param value
 * @returns {string}       — the 24-char hex ObjectId
 */
export function extractIdFromParam(param = '') {
  // ObjectId is always exactly 24 hex characters
  return param.slice(0, 24);
}

/**
 * Returns true if the given URL param already contains the full slug
 * (i.e. it is longer than 24 chars and looks like id-slug).
 *
 * @param {string} param
 * @returns {boolean}
 */
export function hasSlug(param = '') {
  return param.length > 24 && param[24] === '-';
}
