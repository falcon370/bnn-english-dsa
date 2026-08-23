const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const News = require('../models/News');
const { buildRepositoryImageUrl, collapseWhitespace, mapCsvRowToImageMetadata } = require('../utils/imageSearchText');

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Levenshtein distance calculation to handle minor spelling and phonetic variations */
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

/** Validate if a matched candidate refers to the same person as requested */
const isSamePerson = (requestedName, matchedLeader, matchedOtherNames = []) => {
  const getTokens = (name) =>
    String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map(w => w.trim())
      .filter(Boolean);

  const reqTokens = getTokens(requestedName);
  const reqMajor = reqTokens.filter(w => w.length > 2);
  if (!reqMajor.length) return true; // fallback if requested name has no long words

  const candidates = [matchedLeader, ...(matchedOtherNames || [])].filter(Boolean);
  
  for (const candidate of candidates) {
    const matchTokens = getTokens(candidate);
    const matchMajor = matchTokens.filter(w => w.length > 2);
    if (!matchMajor.length) continue;

    // Find major tokens in match that are not in req
    const extraInMatch = matchMajor.filter(mWord => !reqTokens.includes(mWord));
    // Find major tokens in req that are not in match
    const extraInReq = reqMajor.filter(rWord => !matchTokens.includes(rWord));

    // If there are no extra major words in BOTH, they match perfectly!
    if (!extraInMatch.length && !extraInReq.length) {
      return true;
    }

    // Check if the extra words are just spelling/phonetic variations of each other
    let hasConflict = false;
    for (const mWord of extraInMatch) {
      // If this extra word in the match does not have a close counterpart in req, it's a conflict
      const hasCloseCounterpart = extraInReq.some(rWord => editDistance(mWord, rWord) <= 2);
      if (!hasCloseCounterpart) {
        hasConflict = true;
        break;
      }
    }

    if (!hasConflict) {
      for (const rWord of extraInReq) {
        // If this extra word in the req does not have a close counterpart in match, it's a conflict
        const hasCloseCounterpart = extraInMatch.some(mWord => editDistance(rWord, mWord) <= 2);
        if (!hasCloseCounterpart) {
          hasConflict = true;
          break;
        }
      }
    }

    if (!hasConflict) {
      return true;
    }
  }

  return false;
};

const candidateUrlFor = (document) => {
  if (!document) return null;
  if (document.repositoryImageUrl) return document.repositoryImageUrl;
  if (document.fileName) return buildRepositoryImageUrl(document.fileName, document.category);
  return null;
};

const scoreDocument = (document, query) => {
  const haystack = normalize([
    document.leader,
    ...(document.otherNames || []),
    document.leaderDescription,
    document.imageDescription,
    document.searchableText,
  ].join(' '));
  const words = normalize(query).split(' ').filter((word) => word.length > 2);
  const uniqueWords = [...new Set(words)];

  return uniqueWords.reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0);
};

const documentMatchesFilters = (document, { requireAnyTerms = [], rejectTerms = [] } = {}) => {
  const haystack = normalize([
    document.leader,
    ...(document.otherNames || []),
    document.leaderDescription,
    document.imageDescription,
    document.searchableText,
  ].join(' '));

  if (requireAnyTerms.length && !requireAnyTerms.some((term) => haystack.includes(normalize(term)))) {
    return false;
  }

  if (rejectTerms.length && rejectTerms.some((term) => haystack.includes(normalize(term)))) {
    return false;
  }

  return true;
};

const pickBestDocument = (documents, query, filters = {}, avoidRecentUrls = new Set(), subjectName = null) => {
  let eligible = documents.filter((document) => candidateUrlFor(document) && documentMatchesFilters(document, filters));
  
  if (subjectName) {
    eligible = eligible.filter((document) => isSamePerson(subjectName, document.leader, document.otherNames));
  }

  if (!eligible.length) return null;

  // Separate into those not recently used vs those that were
  const notRecentlyUsed = eligible.filter(doc => {
    const url = candidateUrlFor(doc);
    const strippedUrl = url ? url.split('?')[0] : '';
    return !avoidRecentUrls.has(strippedUrl);
  });

  const candidates = notRecentlyUsed.length > 0 ? notRecentlyUsed : eligible;

  // Fisher-Yates shuffle the candidates list to ensure a random distribution of matching images (preventing consecutive repeats)
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Sort primarily by keyword score to maintain semantic relevance, but if scores are equal, their randomized order is preserved
  shuffled.sort((a, b) => scoreDocument(b, query) - scoreDocument(a, query));

  return shuffled[0];
};

// --- In-Memory CSV Cache ---
let _cachedImages = null;

const loadAllCsvImages = async () => {
  if (_cachedImages !== null) return _cachedImages;

  const csvDir = path.resolve(__dirname, '../../csv_data');
  const files = ['BNN_image.csv', 'entertainment.csv', 'partyflag.csv', 'partyleaders.csv', 'sports.csv'];
  const allImages = [];

  for (const file of files) {
    const filePath = path.join(csvDir, file);
    if (!fs.existsSync(filePath)) continue;

    let category = 'politics';
    if (file !== 'BNN_image.csv') {
      category = file.replace(/\.csv$/i, '').toLowerCase();
    }

    const stream = fs.createReadStream(filePath).pipe(csv({
      mapHeaders: ({ header, index }) => {
        const trimmed = String(header || '').trim();
        if (trimmed === '') {
          if (index === 0) return 'UniqueID';
          return null;
        }
        const lower = trimmed.toLowerCase();
        if (lower === 'name') return 'Name';
        if (lower === 'any other name' || lower === 'full name') return 'Any other name';
        if (lower.startsWith('description of the leader') || lower.startsWith('description of the person') || lower === 'description') {
          return 'Description of the leader';
        }
        if (lower.startsWith('description of the image')) return 'Description of the image';
        if (lower.startsWith('url')) return 'Url';
        if (lower.startsWith('file name')) return 'File name';
        return trimmed;
      }
    }));

    let rowNum = 1;
    for await (const row of stream) {
      rowNum++;
      const metadata = mapCsvRowToImageMetadata(row, rowNum, category);
      if (metadata.uniqueId && metadata.leader && metadata.searchableText) {
        allImages.push(metadata);
      }
    }
  }

  _cachedImages = allImages;
  console.log(`[Image Repository] Loaded ${allImages.length} images from CSV files into memory.`);
  return allImages;
};

const findExactEntityMatch = async (entityName, query, filters = {}, avoidRecentUrls = new Set(), category = null) => {
  const cleanName = collapseWhitespace(entityName);
  if (!cleanName) return null;

  // Flexible regex to handle initials (e.g. "V.S. Babu", "M K Stalin")
  const letters = cleanName.replace(/[\.\s]+/g, ' ').trim().split(' ');
  const pattern = letters.map(l => escapeRegex(l)).join('[\\.\\s]*');
  const nameRegex = new RegExp(`\\b${pattern}\\b`, 'i');

  const images = await loadAllCsvImages();

  // First Attempt: Direct nameRegex match
  let filtered = images.filter(img => {
    if (category && img.category !== category) return false;
    return nameRegex.test(img.leader) || img.otherNames.some(name => nameRegex.test(name));
  });

  // Fallback 1: Match any major components (words > 2 chars) using AND condition
  if (!filtered.length && letters.length > 1) {
    const majorWords = letters.filter(l => l.length > 2).map(word => new RegExp(escapeRegex(word), 'i'));
    if (majorWords.length > 0) {
      filtered = images.filter(img => {
        if (category && img.category !== category) return false;
        return majorWords.every(rx => rx.test(img.leader) || img.otherNames.some(name => rx.test(name)));
      });
    }
  }

  // Fallback 2: Match individual long words if no combined match exists
  if (!filtered.length) {
    const longWords = letters.filter(l => l.length > 3).map(word => new RegExp(`\\b${escapeRegex(word)}\\b`, 'i'));
    if (longWords.length > 0) {
      filtered = images.filter(img => {
        if (category && img.category !== category) return false;
        return longWords.some(rx => rx.test(img.leader) || img.otherNames.some(name => rx.test(name)));
      });
    }
  }

  if (!filtered.length) return null;

  return pickBestDocument(filtered, query || cleanName, filters, avoidRecentUrls, entityName);
};

const findTextMatch = async (query, filters = {}, avoidRecentUrls = new Set(), subjectName = null, category = null) => {
  const cleanQuery = collapseWhitespace(query);
  if (!cleanQuery) return null;

  const images = await loadAllCsvImages();

  // Filter by category and check if score > 0
  const eligible = images.filter(img => {
    if (category && img.category !== category) return false;
    return scoreDocument(img, cleanQuery) > 0;
  });

  if (!eligible.length) return null;

  // Sort by score descending
  eligible.sort((a, b) => scoreDocument(b, cleanQuery) - scoreDocument(a, cleanQuery));

  // Limit to top 12
  const topDocuments = eligible.slice(0, 12);

  return pickBestDocument(topDocuments, cleanQuery, filters, avoidRecentUrls, subjectName);
};

const findVectorMatch = async (query, filters = {}, avoidRecentUrls = new Set(), subjectName = null) => {
  return null; // Semantic vector search is globally disabled for now
};

const buildRepositoryQuery = ({ subjectName, topic, imageDescription, category }) =>
  [subjectName, topic, imageDescription, category].map(collapseWhitespace).filter(Boolean).join(' ');

const getCategoryPriorityOrder = (newsCategory) => {
  const normCat = String(newsCategory || '').toLowerCase().trim();
  
  if (['politics', 'political', 'opinion', 'national', 'international'].includes(normCat)) {
    return ['politics', 'partyleaders', 'partyflag', 'sports', 'entertainment'];
  }
  if (['sports', 'cricket', 'football'].includes(normCat)) {
    return ['sports', 'politics', 'partyleaders', 'partyflag', 'entertainment'];
  }
  if (['entertainment', 'cinema', 'bollywood', 'movies', 'showbiz'].includes(normCat)) {
    return ['entertainment', 'politics', 'partyleaders', 'partyflag', 'sports'];
  }
  
  return ['politics', 'partyleaders', 'partyflag', 'sports', 'entertainment'];
};

const findRepositoryImage = async ({ subjectName, topic, imageDescription, category, filters = {}, allowVector = true, requireExactMatch = false } = {}) => {
  // Query recently used image URLs from News in the last 24 hours to prevent consecutive repetition
  const avoidRecentUrls = new Set();
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentArticles = await News.find({
      createdAt: { $gte: twentyFourHoursAgo },
      imageUrl: { $ne: null }
    }).select('imageUrl').lean();
    recentArticles.forEach(n => {
      if (n.imageUrl) {
        avoidRecentUrls.add(n.imageUrl.split('?')[0]);
      }
    });
  } catch (err) {
    console.warn('[Image Repository] Failed to fetch recently used image URLs from News database:', err.message);
  }

  const query = buildRepositoryQuery({ subjectName, topic, imageDescription, category });
  const priorityCategories = getCategoryPriorityOrder(category);

  // 1. First attempt: search for an exact match in category priority order
  let match = null;
  for (const csvCat of priorityCategories) {
    const exactMatch = await findExactEntityMatch(subjectName, query, filters, avoidRecentUrls, csvCat);
    if (exactMatch) {
      match = exactMatch;
      break;
    }
  }

  // 1b. Fallback: search for an exact match globally (without category restriction)
  if (!match) {
    const exactMatchGlobal = await findExactEntityMatch(subjectName, query, filters, avoidRecentUrls, null);
    if (exactMatchGlobal) {
      match = exactMatchGlobal;
    }
  }

  // 2. Second attempt: if no exact match, fall back to text match in category priority order (unless requireExactMatch is true)
  if (!match && !requireExactMatch) {
    for (const csvCat of priorityCategories) {
      const textMatch = await findTextMatch(query, filters, avoidRecentUrls, subjectName, csvCat);
      if (textMatch) {
        match = textMatch;
        break;
      }
    }
  }

  // 2b. Fallback: search for a text match globally (without category restriction)
  if (!match && !requireExactMatch) {
    const textMatchGlobal = await findTextMatch(query, filters, avoidRecentUrls, subjectName, null);
    if (textMatchGlobal) {
      match = textMatchGlobal;
    }
  }

  if (!match) return null;

  const imageUrl = candidateUrlFor(match);
  if (!imageUrl) return null;

  return {
    imageUrl,
    imageSource: '',
    repositoryId: match.uniqueId || null,
    repositoryFileName: match.fileName || null,
  };
};

module.exports = {
  findRepositoryImage,
  isSamePerson,
};
