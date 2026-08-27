/**
 * SerpAPI client with automatic key rotation and quota-error handling.
 * Also exposes higher-level fetch helpers for trending topics, political
 * news, topic-level articles, and category feeds.
 */

const { getJson } = require('serpapi');
const { isFresh, cleanText } = require('../../utils/textHelpers');
const { classifyPolitics, classifyPoliticsWorld01 } = require('./politicsClassifier');
const { TRENDS_CATEGORY_NAMES } = require('./ingestionConfig');

// ── Key rotation state ─────────────────────────────────────────

const _serpKeys = (() => {
  const raw = process.env.SERPAPI_KEYS || process.env.SERPAPI_KEY || '';
  return raw.split(',').map(k => k.trim()).filter(Boolean);
})();
let _keyIndex = 0;

const currentKey  = () => (_serpKeys.length ? _serpKeys[_keyIndex % _serpKeys.length] : null);
const rotateKey   = () => {
  _keyIndex = (_keyIndex + 1) % _serpKeys.length;
  console.warn(`[SerpAPI] Rotating to key index ${_keyIndex}`);
};

// ── Core request wrapper ───────────────────────────────────────

/**
 * Execute a SerpAPI request with automatic key rotation on quota / auth errors.
 * Throws an enriched Error on unrecoverable failure.
 */
const serpRequest = async (params) => {
  if (_serpKeys.length === 0) throw new Error('SERPAPI_KEYS missing');

  for (let attempt = 0; attempt < _serpKeys.length; attempt++) {
    const key = currentKey();
    try {
      const json = await getJson({ api_key: key, ...params });
      if (!json) throw new Error('Empty response from SerpAPI');
      if (json.error) {
        if (typeof json.error === 'string' && json.error.startsWith('{')) {
          try { throw new Error(JSON.parse(json.error).error || json.error); } catch { /* fall through */ }
        }
        throw new Error(json.error);
      }
      return json;
    } catch (error) {
      let message = error.message || 'SerpAPI request failed';
      if (typeof error === 'string') {
        try { message = JSON.parse(error).error || error; } catch { message = error; }
      }
      if (error.response?.status === 429) message = 'Rate limit exceeded from SerpApi';

      const isQuota   = /Rate limit|quota|run out of searches|Your account has run/i.test(message) || error.response?.status === 429;
      const isAuthErr = /Invalid API key|API key/i.test(message) || error.response?.status === 401;

      if ((isQuota || isAuthErr) && _serpKeys.length > 1) { rotateKey(); continue; }

      const meta = `engine=${params.engine || 'unknown'} q=${params.q || params.topic_token || ''}`.trim();
      const enriched = new Error(`SerpAPI: ${message}${meta ? ` (${meta})` : ''}`);
      enriched.cause = error;
      enriched.isQuotaError = isQuota;
      throw enriched;
    }
  }

  const meta = `engine=${params.engine || 'unknown'} q=${params.q || params.topic_token || ''}`.trim();
  const err = new Error(`SerpAPI: All API keys exhausted (${meta})`);
  err.isQuotaError = true;
  throw err;
};

// ── Higher-level fetch helpers ─────────────────────────────────

/**
 * Fetch Google News articles for a single topic.
 * Attaches the raw SerpAPI response for downstream thumbnail extraction.
 */
const fetchTopicArticles = async (topic, limit = 6, timeRange = 'qdr:h24') => {
  // Truncate to a max of 15 words to prevent SerpApi timeouts on extremely long headlines
  const truncatedTopic = topic.trim().split(/\s+/).slice(0, 15).join(' ');

  const response = await serpRequest({
    engine: 'google_news', q: truncatedTopic, num: limit,
    tbs: `${timeRange},sbd:1`,
  });

  const articles = (response.news_results || [])
    .map(item => ({
      source:      typeof item.source === 'string' ? item.source : item.source?.name || item.publisher?.name || null,
      title:       item.title || topic,
      snippet:     item.snippet || '',
      link:        item.link || item.news_url || null,
      publishedAt: item.date || item.published_at || null,
    }))
    .filter(a => Boolean(a.link) && isFresh(a.publishedAt));

  articles._serpApiResponse = response;
  return articles;
};

/**
 * Fetch articles for a pre-defined category feed (Google Search with News tab & date sorting).
 */
const fetchCategoryArticles = async (feed, limit = 8) => {
  const timeRange = feed.timeRange || 'qdr:h24';
  const freshnessHours = feed.freshnessHours || 36;

  const response = await serpRequest({
    engine: 'google',
    tbm: 'nws',
    hl: feed.lang || 'en', gl: feed.country || 'in',
    q: feed.query, num: limit, tbs: `${timeRange},sbd:1`,
  });

  const articles = (response.news_results || [])
    .map(item => ({
      source:      typeof item.source === 'string' ? item.source : item.source?.name || item.publisher?.name || null,
      title:       item.title || feed.topic,
      snippet:     item.snippet || item.summary || '',
      link:        item.link || item.url || null,
      thumbnail:   item.thumbnail || null,
      publishedAt: item.date || item.published_at || null,
    }))
    .filter(a => Boolean(a.link) && (isFresh(a.publishedAt, freshnessHours) || !a.publishedAt));

  articles._serpApiResponse = response;
  return articles;
};

/**
 * Fetch trending topics from Google Trends for given category configs.
 * Returns `{ items, stats }`.
 */
const fetchTrendingTopics = async (categoriesConfig) => {
  const allTopics = new Set();
  const validItems = [];
  const statsLog = [];

  console.log(`[Trending] Fetching topics for categories: ${categoriesConfig.map(c => c.id).join(', ')}...`);

  for (const catConf of categoriesConfig) {
    const catId = catConf.id;
    try {
      const response = await serpRequest({
        engine: 'google_trends_trending_now',
        geo: 'IN', hours: '24', category_id: catId,
      });

      const searches = response.trending_searches || [];
      const isPolitics = catId === 14;

      const catTopics = searches
        .map(item => item?.query?.text || item?.query || item?.title)
        .filter(Boolean)
        .filter(topic => isPolitics || topic.trim().split(/\s+/).length > 1);

      const catName = TRENDS_CATEGORY_NAMES[catId] || 'General';
      console.log(`[Trending] Cat ${catId} (${catName}) found: ${catTopics.length} topics`);
      statsLog.push(`[Trending] Cat ${catId} (${catName}) found: ${catTopics.length} topics`);

      for (const t of catTopics.slice(0, catConf.count)) {
        const cleaned = cleanText(t);
        if (!allTopics.has(cleaned.toLowerCase())) {
          allTopics.add(cleaned.toLowerCase());
          validItems.push({
            topic: cleaned,
            category: catName,
            timeRange: catConf.timeRange,
            isTrending: true,
          });
        }
      }
    } catch (error) {
      console.warn(`[Trending] Failed to fetch category ${catId}: ${error.message || error}`);
      if (error.message?.includes('run out of searches')) {
        console.error('[Trending] 🛑 SerpApi quota exceeded. Stopping further category fetches.');
        break;
      }
    }
  }

  console.log(`[Trending] Total unique topics found: ${validItems.length}`);
  return { items: validItems, stats: statsLog };
};

/**
 * Fetch the latest political news headlines from Google News (sorted by date),
 * classify them, verify freshness, and return up to `limit` political topics.
 * Returns `{ items, log }`.
 */
const fetchSpecificPoliticalTopics = async (limit = 7) => {
  console.log('[Political Fetch] Starting specialized political news search...');
  const logs = [];

  try {
    const response = await serpRequest({
      engine: 'google', q: 'India politics', tbm: 'nws',
      tbs: 'qdr:h6,sbd:1', gl: 'in', hl: 'en', num: 50,
    });

    const rawResults = response.news_results || [];
    const validResults = rawResults.filter(r => r.title && (isFresh(r.date || r.published_at, 24) || !r.date));
    const uniqueMap = new Map();
    for (const r of validResults) {
      if (!uniqueMap.has(r.title)) uniqueMap.set(r.title, r);
    }
    const uniqueResults = Array.from(uniqueMap.values());
    console.log(`[Political Fetch] Found ${uniqueResults.length} fresh unique items.`);
    logs.push(`[Political Fetch] Found ${uniqueResults.length} fresh unique items from Google News.`);

    const political = uniqueResults.filter(r => classifyPolitics(r.title) === 1);
    console.log(`[Political Fetch] Classified ${political.length} items as strictly political.`);
    logs.push(`[Political Fetch] Classified ${political.length} items as strictly political.`);

    const items = political.slice(0, limit).map(item => ({
      topic: item.title,
      category: 'Politics',
      timeRange: 'qdr:h6',
      isTrending: false,
      thumbnail: item.thumbnail || null
    }));

    return { items, log: logs };
  } catch (error) {
    console.error(`[Political Fetch] Failed: ${error.message}`);
    return { items: [], log: [`[Political Fetch] Failed: ${error.message}`] };
  }
};

/**
 * Fetch the latest world politics headlines from Google News (sorted by date),
 * classify them, verify freshness, and return up to `limit` world topics.
 * Returns `{ items, log }`.
 */
const fetchSpecificWorldTopics = async (limit = 5) => {
  console.log('[World Fetch] Starting specialized world political news search...');
  const logs = [];

  try {
    const response = await serpRequest({
      engine: 'google', q: 'world politics OR global politics', tbm: 'nws',
      tbs: 'qdr:d,sbd:1', gl: 'in', hl: 'en', num: 50,
    });

    const rawResults = response.news_results || [];
    const validResults = rawResults.filter(r => r.title && (isFresh(r.date || r.published_at, 36) || !r.date));
    const uniqueMap = new Map();
    for (const r of validResults) {
      if (!uniqueMap.has(r.title)) uniqueMap.set(r.title, r);
    }
    const uniqueResults = Array.from(uniqueMap.values());
    console.log(`[World Fetch] Found ${uniqueResults.length} fresh unique items.`);
    logs.push(`[World Fetch] Found ${uniqueResults.length} fresh unique items from Google News.`);

    const political = uniqueResults.filter(r => classifyPoliticsWorld01(r.title) === 1);
    console.log(`[World Fetch] Classified ${political.length} items as strictly world political.`);
    logs.push(`[World Fetch] Classified ${political.length} items as strictly world political.`);

    const items = political.slice(0, limit).map(item => ({
      topic: item.title,
      category: 'World',
      timeRange: 'qdr:d',
      isTrending: false,
      thumbnail: item.thumbnail || null
    }));

    return { items, log: logs };
  } catch (error) {
    console.error(`[World Fetch] Failed: ${error.message}`);
    return { items: [], log: [`[World Fetch] Failed: ${error.message}`] };
  }
};

/**
 * Helper to parse numerical search volume from SerpApi trending_searches items.
 * Converts strings like "500K+", "1M+", "50,000+" to numbers.
 */
const parseSearchVolume = (item) => {
  const val = item?.search_volume || item?.traffic || item?.search_count || item?.searches || 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.toUpperCase().replace(/,/g, '').replace(/\+/g, '').trim();
    if (cleaned.endsWith('K')) return parseFloat(cleaned) * 1000;
    if (cleaned.endsWith('M')) return parseFloat(cleaned) * 1000000;
    if (cleaned.endsWith('B')) return parseFloat(cleaned) * 1000000000;
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

/**
 * Fetch top weekly trending topics across specified SerpApi categories (default: Politics=14, Law & Government=10)
 * for a duration of 7 days (168 hours).
 * Returns an array of candidate objects ordered by volume/rank descending.
 */
const fetchWeeklyTopTrendingTopics = async (categoryIds = [14, 10], hours = '168') => {
  console.log(`[SerpAPI Weekly Trends] Fetching 7-day trending topics for categories: ${categoryIds.join(', ')}...`);
  const candidates = [];
  const seenTopics = new Set();

  for (const catId of categoryIds) {
    try {
      const response = await serpRequest({
        engine: 'google_trends_trending_now',
        geo: 'IN',
        hours: String(hours),
        category_id: catId,
      });

      const searches = response.trending_searches || [];
      const catName = TRENDS_CATEGORY_NAMES[catId] || 'Politics';

      console.log(`[SerpAPI Weekly Trends] Cat ${catId} (${catName}) returned ${searches.length} trending items for ${hours}h window.`);

      searches.forEach((item, index) => {
        const rawTopic = item?.query?.text || item?.query || item?.title;
        if (!rawTopic) return;
        const topicStr = cleanText(rawTopic);
        if (topicStr.length < 3) return;

        const topicKey = topicStr.toLowerCase();
        if (seenTopics.has(topicKey)) return;
        seenTopics.add(topicKey);

        const volume = parseSearchVolume(item);
        // Rank score: volume + bonus for earlier list position
        const rankScore = volume + Math.max(0, 100 - index);

        candidates.push({
          topic: topicStr,
          category: catName,
          catId,
          volume,
          rankScore,
          rawItem: item,
        });
      });
    } catch (err) {
      console.warn(`[SerpAPI Weekly Trends] Failed to fetch category ${catId}: ${err.message}`);
    }
  }

  // Sort candidate list by rankScore descending
  candidates.sort((a, b) => b.rankScore - a.rankScore);

  console.log(`[SerpAPI Weekly Trends] Compiled ${candidates.length} unique weekly trending candidates across categories.`);
  if (candidates.length > 0) {
    console.log(`[SerpAPI Weekly Trends] Top candidate: "${candidates[0].topic}" (volume=${candidates[0].volume}, cat=${candidates[0].category})`);
  }

  return candidates;
};

module.exports = {
  serpRequest,
  fetchTopicArticles,
  fetchCategoryArticles,
  fetchTrendingTopics,
  fetchSpecificPoliticalTopics,
  fetchSpecificWorldTopics,
  fetchWeeklyTopTrendingTopics,
};
