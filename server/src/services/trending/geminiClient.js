/**
 * Gemini (Google Generative AI) client with model fallback chain
 * and API key rotation.
 *
 * Exports:
 *  - callGemini(prompt)              → raw text response
 *  - summarizeWithGemini(topic, …)   → { title, summary, content, imageDescription, imageSubjectType, imageSubjectName, isFallback }
 *  - summarizeArticlesWithGemini(…)  → { title, summary, content, category, tags, imageDescription, imageSubjectType, imageSubjectName, isFallback }
 *  - IMAGE_SUBJECT_TYPES             → article image routing categories
 */

const { GoogleGenAI } = require('@google/genai');
const { cleanText } = require('../../utils/textHelpers');

// ── Configuration ──────────────────────────────────────────────

const MODELS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash"
];
const MIN_INTERVAL_MS = 15_000;
const IMAGE_SUBJECT_TYPES = Object.freeze({
  SPECIFIC_PERSON: 'specific_person',
  POLITICAL_PARTY: 'political_party',
  SPECIFIC_PLACE: 'specific_place',
  DATA_ANALYTICAL: 'data_analytical',
  GENERIC_SOCIETY: 'generic_society',
  GENERIC: 'generic',
});

// ── Key / model rotation state ─────────────────────────────────

const _keys = (() => {
  const raw = process.env.GOOGLE_API_KEYS || process.env.GOOGLE_API_KEY || '';
  return raw.split(',').map(k => k.trim()).filter(Boolean);
})();
let _keyIndex = 0;
let _modelIndex = 0;
let _lastCallAt = 0;

const currentKey = () => _keys[_keyIndex % _keys.length];
const rotateKey  = () => {
  _keyIndex = (_keyIndex + 1) % _keys.length;
  _modelIndex = 0;
  console.warn(`[Gemini] Rotating to API key index ${_keyIndex}, resetting model to ${MODELS[0]}`);
};

/** Rate-limit guard – ensures at least MIN_INTERVAL_MS between calls. */
const throttle = async () => {
  const elapsed = Date.now() - _lastCallAt;
  if (elapsed < MIN_INTERVAL_MS) {
    const wait = MIN_INTERVAL_MS - elapsed;
    console.log(`[Gemini Rate Limit] Waiting ${wait}ms before next call...`);
    await new Promise(r => setTimeout(r, wait));
  }
  _lastCallAt = Date.now();
};

// ── Core call ──────────────────────────────────────────────────

/**
 * Send a prompt to Gemini, cycling through models and keys on failure.
 * @param {string} prompt
 * @returns {string} Raw text response.
 */
const callGemini = async (prompt) => {
  if (_keys.length === 0) throw new Error('GOOGLE_API_KEYS missing');

  const maxAttempts = MODELS.length * _keys.length;
  let attempt = 0;
  let modelsTriedForKey = 0;

  while (attempt < maxAttempts) {
    const model  = MODELS[_modelIndex];
    const apiKey = currentKey();

    try {
      await throttle();
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
      });

      const text = response.text?.trim() || '';
      if (!text) throw new Error('Empty response from Gemini API');

      if (attempt > 0) console.log(`[Gemini] Recovered using model: ${model} on attempt ${attempt + 1}`);
      return { text, model };
    } catch (error) {
      const status = error.status || error.response?.status;
      const msg    = error.message || error.response?.data?.error?.message;
      console.warn(`[Gemini] Error with ${model} (Status: ${status}): ${msg}`);

      // Fatal (non-retryable) errors
      if ((status === 400 || status === 403) &&
          !msg.includes('quota') && !msg.includes('rate limit') && !msg.includes('429')) {
        throw new Error(`Gemini API Fatal Error (${status}): ${msg}`);
      }

      // Rotate model, then key if all models exhausted
      const prev = MODELS[_modelIndex];
      _modelIndex = (_modelIndex + 1) % MODELS.length;
      modelsTriedForKey++;

      if (modelsTriedForKey >= MODELS.length) {
        console.warn(`[Gemini] All models exhausted for key[${_keyIndex}]. Rotating API key.`);
        rotateKey();
        modelsTriedForKey = 0;
      } else {
        console.warn(`[Gemini] Switching model from ${prev} to ${MODELS[_modelIndex]}`);
      }

      attempt++;
      const wait = status === 429 ? 5000 + attempt * 2000 : 1000;
      await new Promise(r => setTimeout(r, wait));
    }
  }

  throw new Error(`Gemini API failed after ${maxAttempts} attempts. All models and keys exhausted.`);
};

// ── Summarisation helpers ──────────────────────────────────────

/** Extract fields using regular expressions when standard JSON.parse fails. */
const regexExtractJson = (text) => {
  const result = {};
  const clean = text.trim();

  // List of string fields
  const stringFields = [
    'title', 'summary', 'content', 'imageDescription',
    'imageSubjectType', 'imageSubjectName', 'category'
  ];

  // List of array fields
  const arrayFields = [
    'imageQueriesUnsplash', 'imageQueriesWikimedia', 'tags'
  ];

  // Helper to extract a string field
  const extractString = (field) => {
    // Matches "field" : "value", looking ahead for the next key or end of object
    const regex = new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,\\s*"|\\s*})`);
    const match = clean.match(regex);
    if (match) return match[1];

    // Fallback: simpler match
    const fallbackRegex = new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)"`);
    const fallbackMatch = clean.match(fallbackRegex);
    return fallbackMatch ? fallbackMatch[1] : null;
  };

  // Helper to extract an array field
  const extractArray = (field) => {
    // Matches "field" : [ ... ]
    const regex = new RegExp(`"${field}"\\s*:\\s*\\[([\\s\\S]*?)\\]`);
    const match = clean.match(regex);
    if (match) {
      const arrayContent = match[1];
      return arrayContent
        .split(',')
        .map(item => item.replace(/["'\[\]]/g, '').trim())
        .filter(Boolean);
    }
    return null;
  };

  for (const field of stringFields) {
    const val = extractString(field);
    if (val !== null) {
      result[field] = val
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .trim();
    }
  }

  for (const field of arrayFields) {
    const val = extractArray(field);
    if (val !== null) {
      result[field] = val;
    }
  }

  return result;
};

/** Extract the first JSON object from raw Gemini text, falling back to regex parsing on failure. */
const parseJsonFromResponse = (text) => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Gemini response missing JSON');
  
  const jsonText = match[0];
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    console.warn(`[Gemini JSON Repair] Standard JSON.parse failed: ${error.message}. Attempting regex extraction...`);
    try {
      const parsed = regexExtractJson(jsonText);
      // Ensure we successfully recovered core fields
      if (!parsed.title || !parsed.summary || !parsed.content) {
        throw new Error('Regex extraction failed to recover core fields (title, summary, content)');
      }
      console.log('[Gemini JSON Repair] ✅ Successfully repaired and extracted malformed JSON using regex!');
      return parsed;
    } catch (fallbackError) {
      throw new Error(`Gemini response JSON parsing failed: ${error.message}. Repair fallback failed: ${fallbackError.message}`);
    }
  }
};

const normalizeImageDescription = (value) => {
  if (typeof value !== 'string') return null;
  const cleaned = cleanText(value)
    .replace(/^["']+|["']+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned.length > 220 ? `${cleaned.slice(0, 217)}...` : cleaned;
};

const fallbackImageDescription = (topic, articles = []) => {
  const anchor = cleanText(articles[0]?.title || topic || '').replace(/\s+/g, ' ').trim();
  if (!anchor) return null;
  return normalizeImageDescription(`Editorial photo illustrating ${anchor}, real-world context, documentary style, no text overlay`);
};

const normalizeImageSubjectType = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (['specific_person', 'specificperson', 'person', 'named_person', 'individual'].includes(normalized)) {
    return IMAGE_SUBJECT_TYPES.SPECIFIC_PERSON;
  }
  if (['political_party', 'party', 'alliance', 'specific_party', 'political_alliance'].includes(normalized)) {
    return IMAGE_SUBJECT_TYPES.POLITICAL_PARTY;
  }
  if (['specific_place', 'place', 'location', 'city', 'monument', 'court', 'institution', 'specific_location'].includes(normalized)) {
    return IMAGE_SUBJECT_TYPES.SPECIFIC_PLACE;
  }
  if (['data_analytical', 'data', 'analytical', 'election_analysis', 'election', 'analysis'].includes(normalized)) {
    return IMAGE_SUBJECT_TYPES.DATA_ANALYTICAL;
  }
  if (['generic_society', 'society', 'lifestyle', 'economy', 'education', 'health', 'environment'].includes(normalized)) {
    return IMAGE_SUBJECT_TYPES.GENERIC_SOCIETY;
  }
  if (['generic', 'general', 'scene', 'concept', 'contextual', 'other'].includes(normalized)) {
    return IMAGE_SUBJECT_TYPES.GENERIC;
  }
  return null;
};

const normalizeImageSubjectName = (value) => {
  if (typeof value !== 'string') return null;
  const cleaned = cleanText(value).replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  if (/^(n\/a|na|none|null|unknown|not applicable|not required)$/i.test(cleaned)) return null;
  return cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
};

const normalizeQueriesArray = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(q => String(q || '').replace(/[^a-zA-Z0-9\s\-\,]/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
};

const buildImageSubjectMetadata = (parsed = {}) => {
  const imageSubjectType = normalizeImageSubjectType(parsed.imageSubjectType) || IMAGE_SUBJECT_TYPES.GENERIC;
  const imageSubjectName = [
    IMAGE_SUBJECT_TYPES.SPECIFIC_PERSON,
    IMAGE_SUBJECT_TYPES.POLITICAL_PARTY,
    IMAGE_SUBJECT_TYPES.SPECIFIC_PLACE,
  ].includes(imageSubjectType)
    ? normalizeImageSubjectName(parsed.imageSubjectName)
    : null;

  return { imageSubjectType, imageSubjectName };
};

/**
 * Generate a news article from a single trending topic.
 * Falls back to source-material compilation on error.
 */
const summarizeWithGemini = async (topic, _trendData, articles = [], category = null) => {
  const context = articles.length > 0
    ? articles.slice(0, 3).map(a => `Source: ${a.source}\nSnippet: ${a.snippet}\nTitle: ${a.title}`).join('\n\n')
    : 'No direct news context available.';

  const isTech = ['tech', 'technology'].includes(String(category || '').toLowerCase().trim());

  const prompt = isTech ? [
    'You are a professional news editor. Strictly write all response text (titles, summaries, article contents, and image descriptions) in English only. No other language text or non-English script should be returned under any circumstances.',
    'Produce a publish-ready tech news article JSON based on the context below.',
    'Rules:',
    '- Output strict JSON only without any markdown formatting wrappers (no ```json).',
    '- Strictly write the entire response (title, summary, content, and image descriptions) in the English language. No other language text should be returned under any circumstances.',
    '- title: Catchy, Tech-oriented, Title Case, ~10 words. Distinct from source titles.',
    '- summary: Max 80 words. Concise overview of the tech news.',
    '- content: Detailed factual reporting. Crucial: The article content MUST be highly comprehensive, detailed, in-depth, and reach AT LEAST 400 to 500 words (longer is better, there is no upper limit). Do not summarize or write brief descriptions under any circumstances. You can format the content with Markdown (e.g., bold, bullet points, headers) if the structure requires it, otherwise use plain text.',
    '- imageDescription: A very simple, short description of the physical tech product or brand (e.g. "iphone", "playstation", "nvidia logo", "laptop"). Keep it extremely simple.',
    '- imageQueriesUnsplash: An array of 1 to 2 extremely simple, direct, singular product or brand noun search queries specifically optimized for Unsplash to fetch a clean, standalone, high-quality image of the device or product itself. Do NOT include any descriptive adjectives, environments, or complex settings. For example, if the article is about an iPhone, return exactly ["iphone"]. If it is about a Sony PlayStation, return exactly ["playstation"]. If it is about a laptop, return exactly ["laptop"]. Keep the queries strictly to the 1-word or 2-word brand/product name itself.',
    '- imageQueriesWikimedia: An array of 1 to 2 extremely simple, direct, singular product or brand noun search queries specifically optimized for Wikimedia Commons. Do NOT include any descriptive adjectives, environments, or complex settings. For example, if the article is about an iPhone, return exactly ["iphone"]. If it is about a Sony PlayStation, return exactly ["playstation"]. Keep it strictly to the brand/product name itself.',
    '- imageSubjectType: choose exactly one of "specific_person", "political_party", "specific_place", "data_analytical", "generic_society", "generic".',
    '- Use "specific_person" only when the article is mainly about one named person.',
    '- Use "specific_place" when it is mainly about a specific place, monument, city, court, or institution.',
    '- Use "generic_society" for lifestyle, economy, education, health, environment, or general society stories.',
    '- imageSubjectName: full person, party/alliance, or place/institution name only for specific_person, political_party, or specific_place; otherwise empty string.',
    '- No AI references or meta-commentary.',
    '- CRITICAL JSON ESCAPING RULE: Do NOT use double quotes (") inside any of the string values. If you need to quote something (such as a product name, title, or a spoken quote), use single quotes (\') instead. Never output a raw double quote character inside any string value.',
    '- CRITICAL JSON FORMATTING RULE: Do not include unescaped control characters or unescaped literal newlines inside string values. All newlines inside the content string must be escaped as \\n.',
    `Topic: ${topic}`,
    `Context:\n${context}`,
    'Output JSON: {"title": "...", "summary": "...", "content": "...", "imageDescription": "...", "imageSubjectType": "generic", "imageSubjectName": "", "imageQueriesUnsplash": ["...", "..."], "imageQueriesWikimedia": ["...", "..."]}',
  ].join('\n') : [
    'You are a professional news editor. Strictly write all response text (titles, summaries, article contents, and image descriptions) in English only. No other language text or non-English script should be returned under any circumstances.',
    'Produce a publish-ready news article JSON based on the context below.',
    'Rules:',
    '- Output strict JSON only without any markdown formatting wrappers (no ```json).',
    '- Strictly write the entire response (title, summary, content, and image descriptions) in the English language. No other language text should be returned under any circumstances.',
    '- title: Catchy, Title Case, ~10 words. Distinct from source titles.',
    '- summary: Max 80 words. Concise overview.',
    '- content: Detailed factual reporting. Crucial: The article content MUST be highly comprehensive, detailed, in-depth, and reach AT LEAST 400 to 500 words (longer is better, there is no upper limit). Do not summarize or write brief descriptions under any circumstances. You can format the content with Markdown (e.g., bold, bullet points, headers) if the structure requires it, otherwise use plain text. Let the context dictate if Markdown is helpful.',
    '- imageDescription: Keep it extremely simple, bare minimum keywords (2-5 words), and easy to search on Wikimedia and Unsplash (e.g. "business executive", "office building", "cricket match").',
    '- imageQueriesUnsplash: An array of 2 to 3 highly aesthetic, tag-friendly search queries specifically optimized for Unsplash (e.g. ["indian office building modern", "mumbai business corporate"]). These queries MUST translate abstract concepts into concrete, real-world scenes and strictly anchor them to India or Indian settings.',
    '- imageQueriesWikimedia: An array of 2 to 3 encyclopedic, descriptive search queries specifically optimized for Wikimedia Commons (e.g. ["Bombay Stock Exchange building", "Reserve Bank of India logo"]).',
    '- imageSubjectType: choose exactly one of "specific_person", "political_party", "specific_place", "data_analytical", "generic_society", "generic".',
    '- Use "specific_person" only when the article is mainly about one named person.',
    '- Use "political_party" when it is mainly about a specific political party or alliance.',
    '- Use "specific_place" when it is mainly about a specific place, monument, city, court, or institution.',
    '- Use "data_analytical" when it is mainly data-heavy, election-related, or analytical.',
    '- Use "generic_society" for lifestyle, economy, education, health, environment, or general society stories.',
    '- imageSubjectName: full person, party/alliance, or place/institution name only for specific_person, political_party, or specific_place; otherwise empty string.',
    '- No AI references or meta-commentary.',
    '- CRITICAL JSON ESCAPING RULE: Do NOT use double quotes (") inside any of the string values. If you need to quote something (such as a product name, title, or a spoken quote), use single quotes (\') instead. Never output a raw double quote character inside any string value.',
    '- CRITICAL JSON FORMATTING RULE: Do not include unescaped control characters or unescaped literal newlines inside string values. All newlines inside the content string must be escaped as \\n.',
    `Topic: ${topic}`,
    `Context:\n${context}`,
    'Output JSON: {"title": "...", "summary": "...", "content": "...", "imageDescription": "...", "imageSubjectType": "generic", "imageSubjectName": "", "imageQueriesUnsplash": ["...", "..."], "imageQueriesWikimedia": ["...", "..."]}',
  ].join('\n');

  try {
    const { text, model } = await callGemini(prompt);
    const parsed = parseJsonFromResponse(text);
    const imageSubjectMeta = buildImageSubjectMetadata(parsed);
    return {
      title:   cleanText(parsed.title || topic),
      summary: cleanText(parsed.summary || 'Summary unavailable.'),
      content: cleanText(parsed.content || 'Content unavailable.', true),
      imageDescription: normalizeImageDescription(parsed.imageDescription) || fallbackImageDescription(topic, articles),
      imageQueriesUnsplash: normalizeQueriesArray(parsed.imageQueriesUnsplash),
      imageQueriesWikimedia: normalizeQueriesArray(parsed.imageQueriesWikimedia),
      ...imageSubjectMeta,
      isFallback: false,
      model,
    };
  } catch (error) {
    console.error('[Gemini] Trend summary failed:', error.message);
    if (articles.length > 0) {
      return {
        title:   cleanText(articles[0].title || topic),
        summary: cleanText(`Latest updates on ${topic}: ${articles[0].snippet || ''}`),
        content: cleanText(articles.map((a, i) => `${i + 1}. ${a.title} - ${a.source}`).join('\n'), true),
        imageDescription: fallbackImageDescription(topic, articles),
        imageQueriesUnsplash: [],
        imageQueriesWikimedia: [],
        imageSubjectType: IMAGE_SUBJECT_TYPES.GENERIC,
        imageSubjectName: null,
        isFallback: true,
        model: 'fallback',
      };
    }
    return {
      title: cleanText(topic),
      summary: 'Summary temporarily unavailable.',
      content: 'Content temporarily unavailable due to high load.',
      imageDescription: fallbackImageDescription(topic),
      imageQueriesUnsplash: [],
      imageQueriesWikimedia: [],
      imageSubjectType: IMAGE_SUBJECT_TYPES.GENERIC,
      imageSubjectName: null,
      isFallback: true,
      model: 'fallback',
    };
  }
};

/**
 * Synthesise multiple articles into one cohesive news write-up.
 * Falls back to a bullet-list compilation on error.
 */
const summarizeArticlesWithGemini = async (topic, articles) => {
  if (!Array.isArray(articles) || !articles.length) {
    throw new Error('No articles available to summarize');
  }

  const articlesText = articles
    .map((a, i) => `Article ${i + 1}:\nTitle: ${a.title}\nSource: ${a.source || 'Unknown'}\nSummary: ${a.snippet || 'No synopsis available'}\nLink: ${a.link || 'N/A'}`)
    .join('\n\n');

  const prompt = [
    'You are a professional news editor. Strictly write all response text (titles, summaries, article contents, and image descriptions) in English only. No other language text or non-English script should be returned under any circumstances. Combine the following source material into a single, factual news write-up.',
    `Topic: ${topic}`,
    'Sources:', articlesText,
    'Rules:',
    '- Output strict JSON only without any markdown formatting wrappers (no ```json).',
    '- Strictly write the entire response (title, summary, content, and image descriptions) in the English language. No other language text should be returned under any circumstances.',
    '- title: Catchy, Professional, Title Case. Distinct from source titles.',
    '- summary: Concise (~80 words).',
    '- content: Detailed factual reporting. Crucial: The article content MUST be highly comprehensive, detailed, in-depth, and reach AT LEAST 400 to 500 words (longer is better, there is no upper limit). Do not summarize or write brief descriptions under any circumstances. You can format the content with Markdown (e.g., bold, bullet points, headers) if the structure requires it, otherwise use plain text. Let the context dictate if Markdown is helpful.',
    '- category: Best matching single category name.',
    '- tags: Array of relevant lowercase tags.',
    '- imageDescription: Keep it extremely simple, bare minimum keywords (2-5 words), and easy to search on Wikimedia and Unsplash (e.g. "business executive", "office building", "cricket match").',
    '- imageQueriesUnsplash: An array of 2 to 3 highly aesthetic, tag-friendly search queries specifically optimized for Unsplash (e.g. ["indian office building modern", "mumbai business corporate"]). These queries MUST translate abstract concepts into concrete, real-world scenes and strictly anchor them to India or Indian settings.',
    '- imageQueriesWikimedia: An array of 2 to 3 encyclopedic, descriptive search queries specifically optimized for Wikimedia Commons (e.g. ["Bombay Stock Exchange building", "Reserve Bank of India logo"]).',
    '- imageSubjectType: choose exactly one of "specific_person", "political_party", "specific_place", "data_analytical", "generic_society", "generic".',
    '- Use "specific_person" only when the article is mainly about one named person.',
    '- Use "political_party" when it is mainly about a specific political party or alliance.',
    '- Use "specific_place" when it is mainly about a specific place, monument, city, court, or institution.',
    '- Use "data_analytical" when it is mainly data-heavy, election-related, or analytical.',
    '- Use "generic_society" for lifestyle, economy, education, health, environment, or general society stories.',
    '- imageSubjectName: full person, party/alliance, or place/institution name only for specific_person, political_party, or specific_place; otherwise empty string.',
    '- CRITICAL JSON ESCAPING RULE: Do NOT use double quotes (") inside any of the string values. If you need to quote something (such as a product name, title, or a spoken quote), use single quotes (\') instead. Never output a raw double quote character inside any string value.',
    '- CRITICAL JSON FORMATTING RULE: Do not include unescaped control characters or unescaped literal newlines inside string values. All newlines inside the content string must be escaped as \\n.',
    'Output JSON: {"title":"","summary":"","content":"","category":"","tags":[""],"imageDescription":"","imageSubjectType":"generic","imageSubjectName":"","imageQueriesUnsplash":["...","..."],"imageQueriesWikimedia":["...","..."]}',
  ].join('\n');

  try {
    const { text, model } = await callGemini(prompt);
    const parsed = parseJsonFromResponse(text);
    const imageSubjectMeta = buildImageSubjectMetadata(parsed);
    return {
      title:    cleanText(parsed.title || topic),
      summary:  cleanText(parsed.summary || parsed.content),
      content:  cleanText(parsed.content || parsed.summary || 'Content unavailable.', true),
      category: parsed.category || 'General',
      tags:     Array.isArray(parsed.tags) ? parsed.tags : [],
      imageDescription: normalizeImageDescription(parsed.imageDescription) || fallbackImageDescription(topic, articles),
      imageQueriesUnsplash: normalizeQueriesArray(parsed.imageQueriesUnsplash),
      imageQueriesWikimedia: normalizeQueriesArray(parsed.imageQueriesWikimedia),
      ...imageSubjectMeta,
      isFallback: false,
      model,
    };
  } catch (error) {
    console.error('[Gemini] Article synthesis failed:', error.message);
    return {
      title:    `Trending: ${topic}`,
      summary:  `Highlights for ${topic}: ${articles.slice(0, 2).map(a => a.snippet || a.title).join(' / ')}`,
      content:  articles.map((a, i) => `${i + 1}. ${a.title} - ${a.snippet || ''}`).join('\n'),
      category: 'General',
      tags:     [topic.toLowerCase().replace(/\s+/g, '-'), 'trending'],
      imageDescription: fallbackImageDescription(topic, articles),
      imageQueriesUnsplash: [],
      imageQueriesWikimedia: [],
      imageSubjectType: IMAGE_SUBJECT_TYPES.GENERIC,
      imageSubjectName: null,
      isFallback: true,
      model: 'fallback',
    };
  }
};

module.exports = {
  callGemini,
  summarizeWithGemini,
  summarizeArticlesWithGemini,
  IMAGE_SUBJECT_TYPES,
};
