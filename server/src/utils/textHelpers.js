/**
 * Shared text utilities used across the ingestion pipeline.
 */

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'for', 'to', 'of', 'and', 'is', 'are',
  'was', 'were', 'be', 'been', 'with', 'from', 'by', 'about', 'as', 'into',
  'like', 'through', 'after', 'over', 'between', 'out', 'against', 'during',
  'without', 'before', 'under', 'around', 'among',
]);

const FRESHNESS_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * Extract up to 5 searchable keywords from text, filtering stop words.
 */
const extractKeywords = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 5)
    .join(' ');
};

/**
 * Clean AI-generated or raw text for publication.
 * Strips markdown formatting, AI prefixes, and surrounding quotes.
 */
const cleanText = (text, keepMarkdown = false) => {
  if (!text) return '';
  let clean = text;
  if (!keepMarkdown) {
    clean = clean.replace(/\*\*|__/g, '').replace(/^\#+\s*/gm, '');
  }
  clean = clean.replace(/^(Title:|Summary:|Headline:)\s*/i, '');
  clean = clean.replace(/^["']|["']$/g, '');
  return clean.charAt(0).toUpperCase() + clean.slice(1).trim();
};

/**
 * Check whether a date string (absolute or relative like "3 hours ago", "1 day ago")
 * represents a publication time within maxAgeHours (default 36 hours).
 */
const isFresh = (dateString, maxAgeHours = 36) => {
  if (!dateString) return false;

  const str = dateString.toLowerCase().trim();

  // Reject old relative indicators
  if (/week|month|year/.test(str)) {
    return false;
  }

  // Minutes / seconds / just now / recent
  if (/min|sec|just now|now/.test(str)) {
    return true;
  }

  // Hours: e.g. "5 hours ago", "5h ago", "1 hour ago"
  if (str.includes('hour') || /\b\d+h\b/.test(str)) {
    const parts = str.match(/(\d+)\s*(?:hour|h)/);
    if (parts && parts[1]) {
      return parseInt(parts[1], 10) <= maxAgeHours;
    }
    return true;
  }

  // Days: e.g. "1 day ago", "yesterday", "1d ago"
  if (str.includes('yesterday')) {
    return true;
  }
  if (str.includes('day') || /\b\d+d\b/.test(str)) {
    const parts = str.match(/(\d+)\s*(?:day|d)/);
    if (parts && parts[1]) {
      const days = parseInt(parts[1], 10);
      return (days * 24) <= maxAgeHours;
    }
  }

  // Absolute date parsing
  const parsed = Date.parse(dateString);
  if (!isNaN(parsed)) {
    const ageMs = Date.now() - parsed;
    // Allow slight future clock skew (-10 mins) up to maxAgeHours
    return ageMs >= -600000 && ageMs <= (maxAgeHours * 60 * 60 * 1000);
  }

  return false;
};

module.exports = { extractKeywords, cleanText, isFresh };
