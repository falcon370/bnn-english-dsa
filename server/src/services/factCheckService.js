const crypto = require('crypto');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const FactCheck = require('../models/FactCheck');
const { callGemini } = require('./trending/geminiClient');
const { serpRequest } = require('./trending/serpApiClient');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Queries Google Search via SerpAPI for real-time web context on the headline.
 * @param {string} headline
 * @returns {Promise<string>}
 */
const fetchWebSearchContext = async (headline) => {
  try {
    console.log(`[FactCheck Search] Querying SerpAPI for web context: "${headline}"`);
    const response = await serpRequest({
      engine: 'google',
      q: headline,
      num: 5
    });

    const organic = response.organic_results || [];
    if (organic.length === 0) return 'No real-time web search results found.';

    return organic
      .map((res, index) => {
        return `Result ${index + 1}:
Title: ${res.title}
Snippet: ${res.snippet || ''}
Source: ${res.source || res.link || ''}
Date: ${res.date || ''}`;
      })
      .join('\n\n');
  } catch (err) {
    console.warn('[FactCheck Search] Failed to fetch web search context:', err.message);
    return 'Failed to retrieve real-time search context due to an error.';
  }
};

/**
 * Computes SHA-256 hash of a normalized headline.
 * @param {string} headline
 * @returns {string}
 */
const getHeadlineHash = (headline) => {
  const normalized = (headline || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return crypto.createHash('sha256').update(normalized).digest('hex');
};

// ─────────────────────────────────────────────────────────────────────────────
// PIB FACT CHECK RSS  (Improvement 2)
// ─────────────────────────────────────────────────────────────────────────────

/** In-memory cache: { items: Array, fetchedAt: Date } */
let pibCache = null;
const PIB_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const PIB_RSS_URL =
  'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3';

/**
 * Fetches and parses the PIB Fact Check RSS feed, with in-memory caching.
 * @returns {Promise<Array<{ title: string, link: string, date: string }>>}
 */
const getPIBFeed = async () => {
  const now = Date.now();
  if (pibCache && now - pibCache.fetchedAt < PIB_CACHE_TTL_MS) {
    return pibCache.items;
  }

  try {
    console.log('[PIB] Fetching PIB Fact Check RSS feed...');
    const res = await axios.get(PIB_RSS_URL, {
      timeout: 6000,
      headers: { 'User-Agent': 'BNN-FactCheck/1.0' },
      responseType: 'text'
    });

    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(res.data);
    const items = parsed?.rss?.channel?.item || [];
    const normalizedItems = (Array.isArray(items) ? items : [items]).map((item) => ({
      title: (item.title || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
      link: (item.link || '').trim(),
      date: (item.pubDate || '').trim()
    }));

    pibCache = { items: normalizedItems, fetchedAt: now };
    console.log(`[PIB] Cached ${normalizedItems.length} PIB fact-check entries.`);
    return normalizedItems;
  } catch (err) {
    console.error('[PIB] Failed to fetch PIB RSS feed:', err.message);
    return pibCache?.items || []; // Return stale cache or empty
  }
};

/**
 * Computes a simple keyword overlap score between two strings.
 * Returns a value between 0 and 1.
 */
const keywordOverlap = (textA, textB) => {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to',
    'for', 'of', 'and', 'or', 'not', 'by', 'with', 'from', 'that', 'this',
    'it', 'its', 'as', 'be', 'been', 'has', 'have', 'had', 'does', 'do',
    'did', 'will', 'would', 'can', 'could', 'about', 'into', 'after', 'over'
  ]);
  const tokenize = (t) =>
    t.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

  const aTokens = new Set(tokenize(textA));
  const bTokens = new Set(tokenize(textB));
  const intersection = [...aTokens].filter((w) => bTokens.has(w));
  const union = new Set([...aTokens, ...bTokens]);
  return union.size > 0 ? intersection.length / union.size : 0;
};

/**
 * Queries the PIB Fact Check RSS feed for headlines similar to the query.
 * @param {string} headline
 * @returns {Promise<{ score: number|null, matches: Array }>}
 */
const queryPIBFactCheck = async (headline) => {
  const feed = await getPIBFeed();
  if (!feed.length) {
    return { score: null, matches: [] };
  }

  const SIMILARITY_THRESHOLD = 0.12; // Minimum Jaccard to count as a match
  const matches = [];

  for (const item of feed) {
    const similarity = keywordOverlap(headline, item.title);
    if (similarity >= SIMILARITY_THRESHOLD) {
      matches.push({ ...item, similarity });
    }
  }

  // Sort best matches first
  matches.sort((a, b) => b.similarity - a.similarity);
  const topMatches = matches.slice(0, 3);

  if (topMatches.length === 0) {
    return { score: null, matches: [] };
  }

  // PIB fact-checks are always debunking misinformation — treat each match as a red flag
  // The more matches, the lower the score. Best similarity drives the penalty.
  const bestSimilarity = topMatches[0].similarity;
  // Scale: 0.12 similarity → score 40, 0.5+ similarity → score 0
  const pibScore = Math.max(0, Math.round(100 - bestSimilarity * 200));

  console.log(`[PIB] Found ${topMatches.length} PIB match(es). PIB score: ${pibScore}`);
  return {
    score: pibScore,
    matches: topMatches.map(({ title, link, date }) => ({ title, link, date }))
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE FACT CHECK TOOLS API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Queries Google Fact Check Tools API for matching claims.
 * @param {string} headline
 * @returns {Promise<{ score: number|null, matches: Array }>}
 */
const queryGoogleFactCheckApi = async (headline) => {
  const keys = (() => {
    const raw =
      process.env.GOOGLE_FACT_CHECK_API_KEY ||
      process.env.GOOGLE_API_KEYS ||
      process.env.GOOGLE_API_KEY ||
      '';
    return raw.split(',').map((k) => k.trim()).filter(Boolean);
  })();

  if (keys.length === 0) {
    console.warn('[FactCheck API] No API keys available for Google Fact Check Tools API.');
    return { score: null, matches: [] };
  }

  const apiKey = keys[0];
  const url = `https://factchecktools.googleapis.com/v1alpha1/claims:search`;

  try {
    console.log(`[FactCheck API] Querying Google Fact Check API for: "${headline}"`);
    const response = await axios.get(url, {
      params: { query: headline, key: apiKey, languageCode: 'en' },
      timeout: 5000
    });

    const claims = response.data?.claims || [];
    if (claims.length === 0) {
      return { score: null, matches: [] };
    }

    const matches = [];
    let lowestScore = 100;

    for (const claim of claims) {
      const claimText = claim.text;
      const claimant = claim.claimant || 'Unknown';
      const review = claim.claimReview?.[0];
      if (!review) continue;

      const publisher = review.publisher?.name || 'Fact Checker';
      const textualRating = review.textualRating || 'Unverified';
      const publisherDate = review.reviewDate ? new Date(review.reviewDate) : null;

      const ratingLower = textualRating.toLowerCase();
      let score = 50;
      if (/false|fake|incorrect|untrue|misleading claim|fabricated|baseless|myth|debunked|fictitious/i.test(ratingLower)) {
        score = 0;
      } else if (/misleading|partially|half|mostly false|context|exaggerated|distorted/i.test(ratingLower)) {
        score = 30;
      } else if (/true|correct|accurate|verified|mostly true/i.test(ratingLower)) {
        score = 100;
      }

      if (score < lowestScore) lowestScore = score;
      matches.push({ claim: claimText, claimant, publisher, verdict: textualRating, publisherDate });
    }

    console.log(`[FactCheck API] ${matches.length} matches. Lowest API score: ${lowestScore}`);
    return { score: lowestScore, matches };
  } catch (error) {
    console.error('[FactCheck API] Error:', error.message);
    return { score: null, matches: [] };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI AI LINGUISTIC ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a structured prompt to Gemini to evaluate the headline's linguistic credibility.
 * @param {string} headline
 * @returns {Promise<object>}
 */
const queryGeminiFactCheck = async (headline, searchContext = '') => {
  const prompt = [
    'You are an expert fact-checking AI model for a professional Indian news platform (Bharat News Narratives).',
    'Evaluate the credibility of the following news headline.',
    `Headline: "${headline}"`,
    '',
    searchContext ? `Real-Time Google Search Context:\n${searchContext}\n` : '',
    'Analyze the following factors and score each out of 100 (where 0 is worst/highly sensational/fake, and 100 is best/neutral/accurate):',
    '- Sensationalism: Does the headline use clickbait, shocking terms, or emotional triggers? (High sensationalism = low score)',
    '- Attribution: Does the headline imply or state verified official sources (e.g. government agency, official scientific body)?',
    '- Consistency: Does the statement align with known general real-world facts and the provided real-time search context (if available)?',
    '- Credibility: What is the overall inherent trust level of such a statement based on real-world news reporting?',
    '- Coherence: Is the claim logically structured and free from contradictory fallacies?',
    '',
    'Output your analysis in STRICT JSON format with NO markdown wrapping. The JSON must follow this exact template:',
    '{',
    '  "aiScore": 85,',
    '  "verdict": "Credible",',
    '  "aiVerdict": "The headline uses neutral language and refers to a verifiable space mission launch by ISRO...",',
    '  "aiSignals": {',
    '    "sensationalism": 15,',
    '    "attribution": 90,',
    '    "consistency": 95,',
    '    "credibility": 90,',
    '    "coherence": 95',
    '  },',
    '  "aiFlags": ["Neutral tone", "Public agency source"]',
    '}',
    '',
    'Rules:',
    '- DO NOT wrap output in markdown or code blocks. Return raw JSON only.',
    '- "verdict" must be exactly one of: "Credible", "Needs Context", "Questionable", "Likely False", "Opinion".',
    '- Use "Opinion" ONLY when the headline is clearly a personal opinion, editorial view, analysis piece, or commentary — not a factual claim. Examples: "Why Modi is wrong about...", "India must rethink its...", "The case against...", "Opinion: ...". For Opinion verdicts, set aiScore to 60 (neutral — opinions are neither true nor false).',
    '- "aiScore" is 0-100.',
    '- Do NOT use double quotes inside string values. Use single quotes instead.',
    '- Do not use emoji in aiFlags.',
    '- IMPORTANT: If Real-Time Google Search Context is provided, prioritize it to determine facts and credibility. For example, if a recent election or event has happened and is documented in the search results, evaluate it as true/credible even if it contradicts static historical knowledge prior to 2021.'
  ].filter(Boolean).join('\n');

  try {
    console.log(`[FactCheck AI] Sending headline to Gemini for linguistic analysis...`);
    const response = await callGemini(prompt);

    let cleanText = response.text || '';
    if (cleanText.includes('```')) {
      const match = cleanText.match(/\{[\s\S]*\}/);
      if (match) cleanText = match[0];
    }

    const parsed = JSON.parse(cleanText.trim());
    return {
      aiScore: typeof parsed.aiScore === 'number' ? parsed.aiScore : 50,
      verdict: parsed.verdict || 'Questionable',
      aiVerdict: parsed.aiVerdict || 'No explanation provided.',
      aiSignals: parsed.aiSignals || { sensationalism: 50, attribution: 50, consistency: 50, credibility: 50, coherence: 50 },
      aiFlags: Array.isArray(parsed.aiFlags) ? parsed.aiFlags : []
    };
  } catch (error) {
    console.error('[FactCheck AI] Error:', error.message);
    return {
      aiScore: 50,
      verdict: 'Questionable',
      aiVerdict: 'AI analysis temporarily unavailable.',
      aiSignals: { sensationalism: 50, attribution: 50, consistency: 50, credibility: 50, coherence: 50 },
      aiFlags: ['Analysis limited']
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HEADLINE-BODY MISMATCH DETECTION  (Improvement 3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uses Gemini to detect whether the headline accurately represents the article body.
 * @param {string} headline
 * @param {string} summary
 * @param {string} [content]
 * @returns {Promise<{ mismatchScore: number, mismatchVerdict: string, mismatchReason: string }>}
 */
const queryGeminiMismatch = async (headline, summary, content) => {
  // Truncate content to keep prompt size manageable
  const bodyExcerpt = [summary, content].filter(Boolean).join('\n\n').slice(0, 1200);

  const prompt = [
    'You are an expert news editor evaluating headline accuracy for a professional Indian news platform.',
    'Your task: determine how accurately the headline represents the article body provided.',
    '',
    `Headline: "${headline}"`,
    '',
    'Article Body (excerpt):',
    bodyExcerpt,
    '',
    'Score the alignment between the headline and article body on a scale of 0-100:',
    '- 100: Headline perfectly and accurately represents the article content.',
    '- 70-99: Minor simplification but generally accurate.',
    '- 40-69: Headline is somewhat misleading or exaggerated compared to the body.',
    '- 0-39: Headline is significantly misleading, clickbait, or contradicts the article.',
    '',
    'Output STRICT JSON only. No markdown. Example:',
    '{',
    '  "mismatchScore": 85,',
    '  "mismatchVerdict": "Accurate",',
    '  "mismatchReason": "The headline correctly summarizes the main policy announced in the article."',
    '}',
    '',
    'Rules:',
    '- "mismatchVerdict" must be exactly one of: "Accurate", "Slightly Misleading", "Clickbait", "Misleading".',
    '- "mismatchScore" is 0-100.',
    '- Do NOT use double quotes inside string values.',
    '- Return raw JSON only, no markdown code blocks.'
  ].join('\n');

  try {
    console.log('[FactCheck Mismatch] Checking headline vs body alignment...');
    const response = await callGemini(prompt);

    let cleanText = response.text || '';
    if (cleanText.includes('```')) {
      const match = cleanText.match(/\{[\s\S]*\}/);
      if (match) cleanText = match[0];
    }

    const parsed = JSON.parse(cleanText.trim());
    return {
      mismatchScore: typeof parsed.mismatchScore === 'number' ? parsed.mismatchScore : null,
      mismatchVerdict: parsed.mismatchVerdict || null,
      mismatchReason: parsed.mismatchReason || null
    };
  } catch (err) {
    console.error('[FactCheck Mismatch] Error:', err.message);
    return { mismatchScore: null, mismatchVerdict: null, mismatchReason: null };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SCORE AGGREGATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the final weighted credibility score from all available signals.
 * @param {{ factApiScore: number|null, pibScore: number|null, aiScore: number, mismatchScore: number|null, aiVerdict: string }} scores
 * @returns {{ finalScore: number, verdict: string }}
 */
const aggregateScore = ({ factApiScore, pibScore, aiScore, mismatchScore, aiVerdict }) => {
  // Opinion headlines bypass scoring — they are neither true nor false
  if (aiVerdict === 'Opinion') {
    return { finalScore: 60, verdict: 'Opinion' };
  }

  let baseScore;

  const hasFactApi = factApiScore !== null;
  const hasPib = pibScore !== null;

  if (hasFactApi && hasPib) {
    baseScore = Math.round((factApiScore * 0.30) + (pibScore * 0.20) + (aiScore * 0.50));
  } else if (hasFactApi) {
    baseScore = Math.round((factApiScore * 0.40) + (aiScore * 0.60));
  } else if (hasPib) {
    baseScore = Math.round((pibScore * 0.30) + (aiScore * 0.70));
  } else {
    baseScore = Math.round(aiScore);
  }

  // Apply mismatch penalty (up to −15 points)
  let mismatchPenalty = 0;
  if (mismatchScore !== null) {
    mismatchPenalty = Math.round((1 - mismatchScore / 100) * 15);
  }

  const finalScore = Math.max(0, Math.min(100, baseScore - mismatchPenalty));

  let verdict;
  if (finalScore >= 75) verdict = 'Credible';
  else if (finalScore >= 50) verdict = 'Needs Context';
  else if (finalScore >= 30) verdict = 'Questionable';
  else verdict = 'Likely False';

  return { finalScore, verdict };
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Orchestrates fact-checking a headline, checking cache first, then running the full pipeline.
 * @param {string} headline
 * @param {{ summary?: string, content?: string }} [bodyOptions] - Optional article body for mismatch detection
 * @returns {Promise<object>}
 */
const runFactCheckPipeline = async (headline, bodyOptions = {}) => {
  if (!headline || !headline.trim()) {
    throw new Error('Headline is required for fact checking');
  }

  const hash = getHeadlineHash(headline);
  const hasBody = Boolean(bodyOptions?.summary || bodyOptions?.content);

  // 1. Check MongoDB Cache
  // If body is now available but cached result has no mismatch data, re-run
  try {
    const cached = await FactCheck.findOne({ headlineHash: hash });
    if (cached) {
      const needsMismatchUpdate = hasBody && cached.mismatchScore === null;
      if (!needsMismatchUpdate) {
        console.log(`[FactCheck] Cache hit for: "${headline}"`);
        return cached;
      }
      console.log(`[FactCheck] Cache hit but mismatch data missing — running mismatch check...`);
      // Run only the mismatch check and update
      const mismatchResult = await queryGeminiMismatch(
        headline,
        bodyOptions.summary,
        bodyOptions.content
      );
      if (mismatchResult.mismatchScore !== null) {
        const { finalScore, verdict } = aggregateScore({
          factApiScore: cached.factApiScore || null,
          pibScore: cached.pibScore,
          aiScore: cached.aiScore,
          mismatchScore: mismatchResult.mismatchScore,
          aiVerdict: cached.verdict
        });
        cached.mismatchScore = mismatchResult.mismatchScore;
        cached.mismatchVerdict = mismatchResult.mismatchVerdict;
        cached.mismatchReason = mismatchResult.mismatchReason;
        cached.finalScore = finalScore;
        cached.verdict = verdict;
        await cached.save();
      }
      return cached;
    }
  } catch (err) {
    console.error('[FactCheck] Cache read error:', err.message);
  }

  console.log(`[FactCheck] Cache miss. Running full pipeline for: "${headline}"`);

  // 2. Build web search context for RAG
  // Prefer pre-fetched source articles already stored on the news document
  // (saves one SerpAPI credit per auto-published article with identical quality).
  let searchContext = '';

  const prebuilt = bodyOptions?.prebuiltContext;
  if (Array.isArray(prebuilt) && prebuilt.length > 0) {
    console.log(`[FactCheck] Using ${prebuilt.length} pre-fetched source articles as web context (skipping SerpAPI).`);
    searchContext = prebuilt
      .slice(0, 5)
      .map((a, i) =>
        `Result ${i + 1}:\nTitle: ${a.title || ''}\nSnippet: ${a.snippet || ''}\nSource: ${a.source || a.link || ''}\nDate: ${a.publishedAt || ''}`
      )
      .join('\n\n');
  } else {
    const hasSerpKeys = (() => {
      const raw = process.env.SERPAPI_KEYS || process.env.SERPAPI_KEY || '';
      return raw.split(',').map((k) => k.trim()).filter(Boolean).length > 0;
    })();
    if (hasSerpKeys) {
      searchContext = await fetchWebSearchContext(headline);
    }
  }

  // 3. Run external checks and AI analysis in parallel
  const [apiResult, pibResult, aiResult] = await Promise.all([
    queryGoogleFactCheckApi(headline),
    queryPIBFactCheck(headline),
    queryGeminiFactCheck(headline, searchContext)
  ]);

  // 3. Run mismatch check if body is available (sequential — uses Gemini, rate-limited)
  let mismatchResult = { mismatchScore: null, mismatchVerdict: null, mismatchReason: null };
  if (hasBody) {
    mismatchResult = await queryGeminiMismatch(
      headline,
      bodyOptions.summary,
      bodyOptions.content
    );
  }

  // 4. Aggregate final score
  const { finalScore, verdict } = aggregateScore({
    factApiScore: apiResult.score,
    pibScore: pibResult.score,
    aiScore: aiResult.aiScore,
    mismatchScore: mismatchResult.mismatchScore,
    aiVerdict: aiResult.verdict
  });

  // 5. Persist to MongoDB cache
  const newFactCheck = new FactCheck({
    headlineHash: hash,
    headline,
    factApiScore: apiResult.score ?? 0,
    matches: apiResult.matches,
    pibScore: pibResult.score,
    pibMatches: pibResult.matches,
    aiScore: aiResult.aiScore,
    aiVerdict: aiResult.aiVerdict,
    aiSignals: aiResult.aiSignals,
    aiFlags: aiResult.aiFlags,
    mismatchScore: mismatchResult.mismatchScore,
    mismatchVerdict: mismatchResult.mismatchVerdict,
    mismatchReason: mismatchResult.mismatchReason,
    finalScore,
    verdict
  });

  try {
    await newFactCheck.save();
    console.log(`[FactCheck] Result cached. Score: ${finalScore} (${verdict})`);
  } catch (err) {
    console.error('[FactCheck] Cache write error:', err.message);
  }

  return newFactCheck;
};

module.exports = {
  getHeadlineHash,
  queryGoogleFactCheckApi,
  queryPIBFactCheck,
  queryGeminiFactCheck,
  queryGeminiMismatch,
  aggregateScore,
  runFactCheckPipeline
};
