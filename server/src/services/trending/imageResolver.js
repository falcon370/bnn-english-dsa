/**
 * Article image resolution pipeline.
 *
 * Priority follows the editorial policy:
 *  - specific person: self repository -> Wikimedia -> local fallback
 *  - political party/alliance: self repository -> Wikimedia symbol/flag -> local fallback
 *  - specific place/institution: self repository -> Wikimedia -> local fallback
 *  - data/election/analysis: Wikimedia map/visual -> local fallback
 *  - generic society/lifestyle/economy/etc: Unsplash conceptual -> Wikimedia -> local fallback
 *
 * Unsplash is intentionally not used for specific people or political parties.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { extractKeywords } = require('../../utils/textHelpers');
const { findRepositoryImage } = require('../imageRepositoryService');
const News = require('../../models/News');

const IMAGE_SUBJECT_TYPES = Object.freeze({
  SPECIFIC_PERSON: 'specific_person',
  POLITICAL_PARTY: 'political_party',
  SPECIFIC_PLACE: 'specific_place',
  DATA_ANALYTICAL: 'data_analytical',
  GENERIC_SOCIETY: 'generic_society',
  GENERIC: 'generic',
});

let _fallbackMap = {};
let _fallbackIndex = {};

try {
  const imagesDir = path.join(__dirname, '../../../BNN_images');
  if (fs.existsSync(imagesDir)) {
    for (const cat of fs.readdirSync(imagesDir)) {
      const catPath = path.join(imagesDir, cat);
      if (fs.statSync(catPath).isDirectory()) {
        const files = fs.readdirSync(catPath).filter((file) => /\.(png|jpe?g|webp|avif)$/i.test(file));
        if (files.length) {
          _fallbackMap[cat] = files;
          _fallbackIndex[cat] = 0;
        }
      }
    }
  }
} catch (error) {
  console.warn('[Image] Could not initialize BNN_images directory:', error.message);
}

const normalizeQuery = (query) => String(query || '').replace(/\s+/g, ' ').trim();

const stripHtml = (value) => String(value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const normalizeImageSubjectType = (value) => {
  const normalized = normalizeQuery(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (['specific_person', 'specificperson', 'person', 'named_person', 'individual'].includes(normalized)) {
    return IMAGE_SUBJECT_TYPES.SPECIFIC_PERSON;
  }
  if (['political_party', 'party', 'alliance', 'specific_party', 'political_alliance'].includes(normalized)) {
    return IMAGE_SUBJECT_TYPES.POLITICAL_PARTY;
  }
  if (['specific_place', 'place', 'location', 'city', 'monument', 'court', 'institution', 'specific_location'].includes(normalized)) {
    return IMAGE_SUBJECT_TYPES.SPECIFIC_PLACE;
  }
  if (['data_analytical', 'data', 'analytical', 'election', 'election_analysis', 'analysis'].includes(normalized)) {
    return IMAGE_SUBJECT_TYPES.DATA_ANALYTICAL;
  }
  if (['generic_society', 'society', 'lifestyle', 'economy', 'education', 'health', 'environment'].includes(normalized)) {
    return IMAGE_SUBJECT_TYPES.GENERIC_SOCIETY;
  }
  return IMAGE_SUBJECT_TYPES.GENERIC;
};

const resolveCategoryFolderName = (category) => {
  if (!category) return null;
  const normalized = String(category).toLowerCase().trim();
  
  // 1. Check direct case-insensitive match with existing folders
  const folderNames = Object.keys(_fallbackMap);
  const directMatch = folderNames.find((f) => f.toLowerCase() === normalized);
  if (directMatch) return directMatch;
  
  // 2. Map synonyms / common variants
  if (['tech', 'technology', 'science', 'science and technology', 'science_and_technology'].includes(normalized)) {
    const techMatch = folderNames.find((f) => f.toLowerCase() === 'tech');
    if (techMatch) return techMatch;
  }
  if (['politics', 'political', 'governance', 'policy'].includes(normalized)) {
    const politicsMatch = folderNames.find((f) => f.toLowerCase() === 'politics');
    if (politicsMatch) return politicsMatch;
  }
  if (['world', 'international', 'global'].includes(normalized)) {
    const worldMatch = folderNames.find((f) => f.toLowerCase() === 'world');
    if (worldMatch) return worldMatch;
  }
  if (['business', 'markets', 'economy', 'finance'].includes(normalized)) {
    const businessMatch = folderNames.find((f) => f.toLowerCase() === 'business');
    if (businessMatch) return businessMatch;
  }
  if (['sports', 'sport'].includes(normalized)) {
    const sportsMatch = folderNames.find((f) => f.toLowerCase() === 'sports');
    if (sportsMatch) return sportsMatch;
  }
  if (['entertainment', 'celeb', 'celebrity', 'movies', 'cinema', 'bollywood'].includes(normalized)) {
    const entMatch = folderNames.find((f) => f.toLowerCase() === 'entertainment');
    if (entMatch) return entMatch;
  }
  
  return null;
};

const getFallbackImage = (category) => {
  let selectedCategory = resolveCategoryFolderName(category);
  if (!selectedCategory || !_fallbackMap[selectedCategory]?.length) {
    if (_fallbackMap.General?.length) selectedCategory = 'General';
    else {
      const available = Object.keys(_fallbackMap);
      selectedCategory = available[0] || null;
    }
  }

  if (!selectedCategory) return null;

  const files = _fallbackMap[selectedCategory];
  const index = _fallbackIndex[selectedCategory] || 0;
  const file = files[index];
  _fallbackIndex[selectedCategory] = (index + 1) % files.length;

  const backendUrl = process.env.BACKEND_URL || 'https://backend-service-682124901351.asia-south1.run.app';
  return `${backendUrl}/BNN_images/${encodeURIComponent(selectedCategory)}/${encodeURIComponent(file)}`;
};

const getFallbackResult = (category, reason) => {
  const imageUrl = getFallbackImage(category);
  if (!imageUrl) return { imageUrl: null, imageSource: null };
  console.log(`[Image] Local fallback (${reason || category || 'General'}): ${imageUrl}`);
  return { imageUrl, imageSource: null };
};

const uniqueQueries = (queries) => {
  const seen = new Set();
  return queries
    .map(normalizeQuery)
    .filter(Boolean)
    .filter((query) => {
      const key = query.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const buildRepositoryParams = ({ topic, category, imageDescription, imageSubjectName, repositoryFilters, allowRepositoryVector, requireExactMatch }) => ({
  subjectName: imageSubjectName,
  topic,
  category,
  imageDescription,
  filters: repositoryFilters || {},
  allowVector: allowRepositoryVector !== false,
  requireExactMatch: requireExactMatch === true,
});

const resolveRepositoryImage = async (params, reason) => {
  const repositoryImage = await findRepositoryImage(buildRepositoryParams(params)).catch((error) => {
    console.warn(`[Image] Self repository lookup skipped: ${error.message}`);
    return null;
  });

  if (!repositoryImage?.imageUrl) return null;

  console.log(`[Image] Self repository ${reason ? `(${reason})` : ''}: ${repositoryImage.imageSource || repositoryImage.imageUrl}`);
  return repositoryImage;
};

const buildWikimediaSource = (page) => {
  return 'Wikimedia';
};

/** Levenshtein distance calculation to handle spelling and phonetic variations */
const editDistance = (a, b) => {
  const dp = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
};

/** Validate if a Wikipedia page title matches the queried entity */
const isWikipediaPageRelevant = (query, pageTitle) => {
  const getTokens = (str) =>
    String(str || '')
      .toLowerCase()
      .replace(/\([^)]*\)/g, ' ') // Strip parentheses (e.g. " (politician)")
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map(w => w.trim())
      .filter(w => w.length > 2); // Ignore short tokens (<= 2 chars)

  const qTokens = getTokens(query);
  const tTokens = getTokens(pageTitle);

  if (!qTokens.length || !tTokens.length) return true; // If empty, allow fallback

  const commonTokens = qTokens.filter(tok => tTokens.includes(tok));

  // If the query is short (<= 4 words), it represents a specific proper name (person, party, place)
  if (qTokens.length <= 4) {
    if (commonTokens.length === 0) return false;

    // Check for conflicting major tokens in the page title
    const unmatchedTitleTokens = tTokens.filter(tok => !qTokens.includes(tok));
    for (const tTok of unmatchedTitleTokens) {
      // If the unmatched title token doesn't closely match any query token (edit distance <= 2), it's a conflict
      const hasCloseCounterpart = qTokens.some(qTok => editDistance(tTok, qTok) <= 2);
      if (!hasCloseCounterpart) {
        return false; // Mismatch / conflict
      }
    }
    return true;
  }

  // If the query is a long topic/headline, require sharing a subset of major words
  return commonTokens.length >= Math.min(2, tTokens.length);
};

const fetchWikipediaPageImage = async (query) => {
  const cleanQuery = normalizeQuery(query);
  if (!cleanQuery) return null;

  try {
    const { data } = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        format: 'json',
        generator: 'search',
        gsrsearch: cleanQuery,
        gsrlimit: 3,
        prop: 'pageimages',
        piprop: 'thumbnail',
        pithumbsize: 1000,
        pilimit: 3,
      },
      headers: {
        'User-Agent': process.env.WIKIMEDIA_USER_AGENT || 'BNN-NewsImageResolver/1.0 (https://backend-service-682124901351.asia-south1.run.app; contact: admin@bharatnewsnarratives.com)',
        Accept: 'application/json',
      },
      timeout: 10000,
    });

    const pages = Object.values(data?.query?.pages || {});
    if (!pages.length) return null;
    
    // Get recently used image URLs
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentArticles = await News.find({
      createdAt: { $gte: twentyFourHoursAgo },
      imageUrl: { $ne: null }
    }).select('imageUrl').lean();
    const usedUrls = new Set(
      recentArticles
        .map(n => (n.imageUrl && typeof n.imageUrl === 'string') ? n.imageUrl.split('?')[0] : '')
        .filter(Boolean)
    );

    const isWikipediaLandscape = (page) => {
      const thumb = page?.thumbnail;
      if (!thumb) return false;
      const w = thumb.width || 0;
      const h = thumb.height || 0;
      return w > 0 && h > 0 && (w / h) >= 1.2;
    };

    // Filter relevant pages that have valid, unused images
    const validPages = pages.filter(page => {
      if (!isWikipediaPageRelevant(cleanQuery, page.title)) return false;
      const imageUrl = page?.thumbnail?.source;
      if (!imageUrl) return false;
      if (/\.(pdf|djvu|tiff?|epub)(?:\/|$)/i.test(imageUrl) || imageUrl.toLowerCase().includes('.pdf')) return false;
      const strippedUrl = imageUrl.split('?')[0];
      return !usedUrls.has(strippedUrl);
    });

    if (!validPages.length) return null;

    // Sort valid pages: prefer landscape images when there are multiple relevant images
    validPages.sort((a, b) => {
      const aWide = isWikipediaLandscape(a);
      const bWide = isWikipediaLandscape(b);
      if (aWide !== bWide) {
        return aWide ? -1 : 1;
      }
      return (a.index || 0) - (b.index || 0);
    });

    const chosenPage = validPages[0];
    console.log(`[Image] Wikipedia PageImage match: "${cleanQuery}" -> ${chosenPage.thumbnail.source} (Page: "${chosenPage.title}")`);
    return {
      imageUrl: chosenPage.thumbnail.source,
      imageSource: 'Wikipedia',
    };
  } catch (error) {
    console.warn(`[Image] Wikipedia PageImage lookup failed for "${cleanQuery}": ${error.message}`);
    return null;
  }
};

/** Validate if a Wikimedia Commons filename matches the queried person's name */
const isWikimediaFilenameRelevant = (query, filename) => {
  const cleanQuery = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  const cleanFilename = filename.toLowerCase()
    .replace(/^file:/i, '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();

  const qWords = cleanQuery.split(/\s+/).filter(w => w.length > 2);
  const fWords = cleanFilename.split(/\s+/).filter(w => w.length > 2);

  if (!qWords.length) return true;

  // 1. Filename must contain at least one major word from the query
  const intersection = qWords.filter(w => fWords.includes(w));
  if (intersection.length === 0) return false;

  // 2. Identify potential first name conflicts (e.g. "Priyank Kharge" vs "Mallikarjun Kharge")
  const surnames = ['kharge', 'kumar', 'gandhi', 'modi', 'singh', 'patel', 'shah', 'scindia', 'stalin', 'yadav', 'banerjee', 'naidu'];
  for (const surname of surnames) {
    if (qWords.includes(surname) && fWords.includes(surname)) {
      // Find the index of the surname in the filename
      const fIdx = fWords.indexOf(surname);
      if (fIdx > 0) {
        const fPreceding = fWords[fIdx - 1];
        // If the preceding word is not in the query, and is not a common connector/title
        const ignoreWords = ['and', 'with', 'for', 'the', 'meeting', 'welcomes', 'greets', 'meets', 'honourable', 'shri', 'mr', 'dr'];
        if (!qWords.includes(fPreceding) && !ignoreWords.includes(fPreceding)) {
          // Check if there's any close counterpart in the query
          const hasCloseCounterpart = qWords.some(qW => editDistance(fPreceding, qW) <= 2);
          if (!hasCloseCounterpart) {
            console.log(`[Image] Rejecting Wikimedia filename "${filename}" for query "${query}" due to preceding name conflict: "${fPreceding}"`);
            return false; // Conflicting first name preceding the surname
          }
        }
      }
    }
  }

  return true;
};

const fetchWikimediaImage = async (query, isPersonSearch = false) => {
  const cleanQuery = normalizeQuery(query);
  if (!cleanQuery) return null;

  try {
    let responseData = null;

    // Attempt 1: Refined search with double-quotes for exact phrase and filetype filter
    try {
      let refinedQuery = cleanQuery;
      if (cleanQuery.includes(' ') && !cleanQuery.includes('"')) {
        refinedQuery = `"${cleanQuery}"`;
      }
      refinedQuery += ' filetype:bitmap';

      const response = await axios.get('https://commons.wikimedia.org/w/api.php', {
        params: {
          action: 'query',
          format: 'json',
          generator: 'search',
          gsrnamespace: 6,
          gsrsearch: refinedQuery,
          gsrlimit: 10,
          prop: 'imageinfo',
          iiprop: 'url|extmetadata|size',
          iiurlwidth: 1000,
        },
        headers: {
          'User-Agent': process.env.WIKIMEDIA_USER_AGENT || 'BNN-NewsImageResolver/1.0 (https://backend-service-682124901351.asia-south1.run.app; contact: admin@bharatnewsnarratives.com)',
          Accept: 'application/json',
        },
        timeout: 12000,
      });
      responseData = response.data;
    } catch (err) {
      console.warn(`[Image] Commons refined search failed: ${err.message}. Trying fallback search.`);
    }

    // Attempt 2: Fallback search with the original cleanQuery
    if (!responseData?.query?.pages) {
      const response = await axios.get('https://commons.wikimedia.org/w/api.php', {
        params: {
          action: 'query',
          format: 'json',
          generator: 'search',
          gsrnamespace: 6,
          gsrsearch: cleanQuery,
          gsrlimit: 10,
          prop: 'imageinfo',
          iiprop: 'url|extmetadata|size',
          iiurlwidth: 1000,
        },
        headers: {
          'User-Agent': process.env.WIKIMEDIA_USER_AGENT || 'BNN-NewsImageResolver/1.0 (https://backend-service-682124901351.asia-south1.run.app; contact: admin@bharatnewsnarratives.com)',
          Accept: 'application/json',
        },
        timeout: 12000,
      });
      responseData = response.data;
    }

    const pages = Object.values(responseData?.query?.pages || {});
    
    // Ensure we only select actual images, not PDFs, SVGs, or audio/video files
    const isValidImage = (url) => {
      if (typeof url !== 'string') return false;
      if (!/\.(jpe?g|png|webp|avif|gif)(?:\?.*)?$/i.test(url)) return false;
      // Exclude document page scans like PDFs, DJVUs, EPUBs, etc.
      if (/\.(pdf|djvu|tiff?|epub)(?:\/|$)/i.test(url) || url.toLowerCase().includes('.pdf')) return false;
      return true;
    };
    
    // Get all image URLs used in the last 24 hours to avoid repetition
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentArticles = await News.find({
      createdAt: { $gte: twentyFourHoursAgo },
      imageUrl: { $ne: null }
    }).select('imageUrl').lean();
    
    // Normalize used URLs by stripping query parameters for accurate comparison
    const usedUrls = new Set(
      recentArticles
        .map(n => (n.imageUrl && typeof n.imageUrl === 'string') ? n.imageUrl.split('?')[0] : '')
        .filter(Boolean)
    );

    // Extract date from extmetadata to prioritize and filter by age
    const extractDate = (page) => {
      const meta = page?.imageinfo?.[0]?.extmetadata || {};
      const dateStr = String(meta.DateTimeOriginal?.value || meta.DateTime?.value || '').replace(/<[^>]*>?/gm, '').trim();
      const timestamp = Date.parse(dateStr);
      return isNaN(timestamp) ? 0 : timestamp;
    };

    const isWikimediaLandscape = (page) => {
      const info = page?.imageinfo?.[0];
      if (!info) return false;
      const w = info.width || info.thumbwidth || 0;
      const h = info.height || info.thumbheight || 0;
      return w > 0 && h > 0 && (w / h) >= 1.2;
    };

    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;

    let validPages = pages.filter((candidate) => {
      const url = candidate?.imageinfo?.[0]?.thumburl || candidate?.imageinfo?.[0]?.url;
      const strippedUrl = url ? url.split('?')[0] : '';
      if (!url || !isValidImage(url) || usedUrls.has(strippedUrl)) return false;

      // Check filename relevance if it is a specific person search
      if (isPersonSearch && !isWikimediaFilenameRelevant(cleanQuery, candidate.title)) {
        console.log(`[Image] Wikimedia filename validation skipped: "${candidate.title}" is irrelevant to "${cleanQuery}"`);
        return false;
      }

      // Ensure the image is less than a year old
      const dateTimestamp = extractDate(candidate);
      return dateTimestamp >= oneYearAgo;
    });

    // 1. Sort primarily by API relevance index
    validPages.sort((a, b) => (a.index || 0) - (b.index || 0));

    // 2. Take the top 3 most relevant results and pick the newest/landscape one
    const topRelevant = validPages.slice(0, 3);
    topRelevant.sort((a, b) => {
      const aWide = isWikimediaLandscape(a);
      const bWide = isWikimediaLandscape(b);
      if (aWide !== bWide) {
        return aWide ? -1 : 1; // Landscape comes first
      }

      const dateA = extractDate(a);
      const dateB = extractDate(b);
      if (dateA !== dateB) return dateB - dateA; // newest first
      return (a.index || 0) - (b.index || 0);
    });

    const page = topRelevant[0];
    const imageUrl = page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url || null;
    if (!imageUrl) return null;

    return {
      imageUrl,
      imageSource: buildWikimediaSource(page),
    };
  } catch (error) {
    console.warn(`[Image] Wikimedia lookup failed for "${cleanQuery}": ${error.message}`);
    return null;
  }
};

const fetchFirstWikimediaImage = async (queries, isPersonSearch = false) => {
  for (const query of uniqueQueries(queries)) {
    const wikimedia = await fetchWikimediaImage(query, isPersonSearch);
    if (wikimedia?.imageUrl) {
      console.log(`[Image] Wikimedia: "${query}" -> ${wikimedia.imageSource}`);
      return wikimedia;
    }
  }
  return null;
};

const getKeywordScore = (text, query) => {
  const queryWords = normalizeQuery(query).toLowerCase().split(/\s+/).filter((word) => word.length > 2);
  const lowerText = String(text || '').toLowerCase();
  return queryWords.filter((word) => lowerText.includes(word)).length;
};

const hasSpecificPersonMetadata = (image) => {
  const raw = `${image?.slug || ''} ${image?.description || ''} ${image?.alt_description || ''}`;
  if (!raw.trim()) return true;
  return /\b(portrait|headshot|selfie|close[-\s]?up|face|model|person|man|woman|politician|leader|candidate)\b/i.test(raw);
};

const rankUnsplashCandidates = (images, query) =>
  [...images].sort((a, b) => {
    const scoreA = getKeywordScore(`${a.description || ''} ${a.alt_description || ''}`, query);
    const scoreB = getKeywordScore(`${b.description || ''} ${b.alt_description || ''}`, query);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0));
  });

const fetchUnsplashImage = async (query, { avoidSpecificPerson = false } = {}) => {
  const cleanQuery = normalizeQuery(query);
  if (!process.env.UNSPLASH_ACCESS_KEY || !cleanQuery) return null;

  try {
    const { data } = await axios.get('https://api.unsplash.com/search/photos', {
      params: { query: cleanQuery, orientation: 'landscape', per_page: 20 },
      headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
      timeout: 12000,
    });

    // Get all image URLs used in the last 24 hours to avoid repetition
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentArticles = await News.find({
      createdAt: { $gte: twentyFourHoursAgo },
      imageUrl: { $ne: null }
    }).select('imageUrl').lean();
    
    const usedUrls = new Set(
      recentArticles
        .map(n => (n.imageUrl && typeof n.imageUrl === 'string') ? n.imageUrl.split('?')[0] : '')
        .filter(Boolean)
    );

    const candidates = (data?.results || []).filter((image) => {
      if (!image?.urls?.regular) return false;
      if (avoidSpecificPerson && hasSpecificPersonMetadata(image)) return false;

      const baseUrl = image.urls.regular.split('?')[0];
      if (usedUrls.has(baseUrl)) return false;

      return true;
    });

    if (!candidates.length) return null;

    const landscape = candidates.filter((image) => (image.width || 0) >= 720 && (image.height || 0) >= 480);
    const best = rankUnsplashCandidates(landscape.length ? landscape : candidates, cleanQuery)[0];

    return {
      imageUrl: best.urls.regular,
      imageSource: 'Unsplash',
      imageWidth: best.width || null,
      imageHeight: best.height || null,
    };
  } catch (error) {
    if (error.response && (error.response.status === 403 || error.response.status === 429)) {
      console.warn('[Image] Unsplash API rate limit exceeded.');
    } else {
      console.warn(`[Image] Unsplash lookup failed for "${cleanQuery}": ${error.message}`);
    }
    return null;
  }
};

const fetchFirstUnsplashImage = async (queries) => {
  for (const query of uniqueQueries(queries)) {
    const unsplash = await fetchUnsplashImage(query, { avoidSpecificPerson: true });
    if (unsplash?.imageUrl) {
      console.log(`[Image] Unsplash generic: "${query}"`);
      return unsplash;
    }
  }
  return null;
};

const buildGenericQueries = ({ topic, category, imageDescription, imageQueriesUnsplash = [], imageQueriesWikimedia = [] }) => {
  const keywordTopic = extractKeywords(topic || '');
  const keywordDescription = extractKeywords(imageDescription || '');
  
  const unsplashQueries = uniqueQueries([
    ...imageQueriesUnsplash,
    imageDescription,
    `${keywordDescription || keywordTopic} India`,
    `Indian ${keywordDescription || keywordTopic}`,
    `${category || ''} India`,
  ]);

  const wikimediaQueries = uniqueQueries([
    ...imageQueriesWikimedia,
    imageDescription,
    topic,
    keywordTopic,
  ]);

  return {
    unsplash: unsplashQueries,
    wikimedia: wikimediaQueries,
  };
};

const resolveSpecificPersonImage = async (params) => {
  const repository = await resolveRepositoryImage({ ...params, allowRepositoryVector: false, requireExactMatch: true }, 'specific person');
  if (repository) return repository;

  if (params.imageSubjectName) {
    const wikipedia = await fetchWikipediaPageImage(params.imageSubjectName);
    if (wikipedia) return wikipedia;

    const wikimedia = await fetchFirstWikimediaImage([params.imageSubjectName], true);
    if (wikimedia) return wikimedia;
  }

  return getFallbackResult(params.category, 'specific person');
};

const resolvePoliticalPartyImage = async (params) => {
  const repository = await resolveRepositoryImage({
    ...params,
    repositoryFilters: {
      requireAnyTerms: ['flag', 'rally', 'office', 'alliance', 'symbol', 'logo', 'supporters', 'workers', 'campaign'],
      rejectTerms: ['formal pose', 'portrait', 'headshot', 'sitting alone', 'close-up portrait'],
    },
  }, 'political party/alliance');
  if (repository) return repository;

  const entity = params.imageSubjectName || params.topic;

  const wikipedia = await fetchWikipediaPageImage(entity);
  if (wikipedia) return wikipedia;

  const wikimedia = await fetchFirstWikimediaImage([
    `${entity} flag`,
    `${entity} symbol`,
    `${entity} logo`,
    `${entity} political party office`,
    params.topic,
  ]);
  if (wikimedia) return wikimedia;

  return getFallbackResult(params.category || 'Politics', 'political party/alliance');
};

const isTechCategory = (category) => {
  const normalized = String(category || '').toLowerCase().trim();
  return ['tech', 'technology', 'science', 'science and technology', 'science_and_technology'].includes(normalized);
};

const resolveSpecificPlaceImage = async (params) => {
  const entity = params.imageSubjectName || params.topic;

  if (isTechCategory(params.category)) {
    const unsplash = await fetchFirstUnsplashImage([entity, params.topic]);
    if (unsplash) return unsplash;

    const wikipedia = await fetchWikipediaPageImage(entity);
    if (wikipedia) return wikipedia;

    const wikimedia = await fetchFirstWikimediaImage([
      entity,
      `${entity} India`,
      params.topic,
    ]);
    if (wikimedia) return wikimedia;
  } else {
    const wikipedia = await fetchWikipediaPageImage(entity);
    if (wikipedia) return wikipedia;

    const wikimedia = await fetchFirstWikimediaImage([
      entity,
      `${entity} India`,
      params.topic,
    ]);
    if (wikimedia) return wikimedia;

    if (String(params.category || '').toLowerCase() !== 'politics') {
      const unsplash = await fetchFirstUnsplashImage([entity, params.topic]);
      if (unsplash) return unsplash;
    }
  }

  return getFallbackResult(params.category, 'specific place/institution');
};

const resolveDataAnalyticalImage = async (params) => {
  const queries = uniqueQueries([
    ...(params.imageQueriesWikimedia || []),
    params.imageDescription,
    `${params.topic} chart`,
    `${params.topic} map`,
    `${params.imageSubjectName || params.topic} election map`,
    params.topic,
  ]);

  const wikimedia = await fetchFirstWikimediaImage(queries);
  if (wikimedia) return wikimedia;

  return getFallbackResult(params.category || 'General', 'data/analysis');
};

const resolveGenericSocietyImage = async (params) => {
  const queries = buildGenericQueries(params);
  
  if (String(params.category || '').toLowerCase() !== 'politics') {
    const unsplash = await fetchFirstUnsplashImage(queries.unsplash);
    if (unsplash) return unsplash;
  }

  const wikimedia = await fetchFirstWikimediaImage(queries.wikimedia);
  if (wikimedia) return wikimedia;

  return getFallbackResult(params.category || 'General', 'generic society');
};

const resolveGenericImage = async (params) => {
  const queries = buildGenericQueries(params);

  if (isTechCategory(params.category)) {
    const unsplash = await fetchFirstUnsplashImage(queries.unsplash);
    if (unsplash) return unsplash;

    const wikimedia = await fetchFirstWikimediaImage(queries.wikimedia);
    if (wikimedia) return wikimedia;
  } else {
    const wikimedia = await fetchFirstWikimediaImage(queries.wikimedia);
    if (wikimedia) return wikimedia;

    if (String(params.category || '').toLowerCase() !== 'politics') {
      const unsplash = await fetchFirstUnsplashImage(queries.unsplash);
      if (unsplash) return unsplash;
    }
  }

  return getFallbackResult(params.category || 'General', 'generic');
};

const resolveBestImage = async ({
  topic,
  category,
  imageDescription,
  imageSubjectType,
  imageSubjectName,
  imageQueriesUnsplash = [],
  imageQueriesWikimedia = [],
  debugInfo = null,
  model = 'unknown',
}) => {
  console.log(`[Gemini Image Assignment] Model: "${model}", Type: "${imageSubjectType}", Name: "${imageSubjectName}", Description: "${imageDescription}"`);

  const params = {
    topic,
    category,
    imageDescription,
    imageSubjectType: normalizeImageSubjectType(imageSubjectType),
    imageSubjectName: normalizeQuery(imageSubjectName),
    imageQueriesUnsplash,
    imageQueriesWikimedia,
  };

  if (debugInfo && typeof debugInfo === 'object') {
    debugInfo.imageSubjectType = params.imageSubjectType;
    debugInfo.imageSubjectName = params.imageSubjectName || null;
  }

  switch (params.imageSubjectType) {
    case IMAGE_SUBJECT_TYPES.SPECIFIC_PERSON:
      return resolveSpecificPersonImage(params);
    case IMAGE_SUBJECT_TYPES.POLITICAL_PARTY:
      return resolvePoliticalPartyImage(params);
    case IMAGE_SUBJECT_TYPES.SPECIFIC_PLACE:
      return resolveSpecificPlaceImage(params);
    case IMAGE_SUBJECT_TYPES.DATA_ANALYTICAL:
      return resolveDataAnalyticalImage(params);
    case IMAGE_SUBJECT_TYPES.GENERIC_SOCIETY:
      return resolveGenericSocietyImage(params);
    case IMAGE_SUBJECT_TYPES.GENERIC:
    default:
      return resolveGenericImage(params);
  }
};

module.exports = {
  resolveBestImage,
};
