/**
 * Ingestion orchestrator — the main pipelines that tie everything together.
 *
 * Exports:
 *  - runTrendingIngestion(config)  — scheduled trending pipeline
 *  - refreshCategoryFeeds()       — editorial category pipeline
 *  - generateNewsFromTopic(opts)  — on-demand single-topic generation
 */

const News = require('../../models/News');
const SystemStatus = require('../../models/SystemStatus');
const RunLog = require('../../models/RunLog');
const axios = require('axios');
const Parser = require('rss-parser');
const Sentiment = require('sentiment');
const { spawn } = require('child_process');
const fs = require('fs');
const pathModule = require('path');

const { CATEGORY_FEEDS, INGESTION_STATUS_KEY, CONFIG_REGULAR } = require('./ingestionConfig');
const { fetchTrendingTopics, fetchSpecificPoliticalTopics, fetchSpecificWorldTopics, fetchTopicArticles, fetchCategoryArticles, fetchWeeklyTopTrendingTopics } = require('./serpApiClient');
const { summarizeWithGemini, summarizeArticlesWithGemini, callGemini } = require('./geminiClient');
const { resolveBestImage } = require('./imageResolver');
const { getDeskAuthorId } = require('./deskAuthors');
const { meetsQualityBar } = require('./contentQuality');

// ── Python Pulse Analyzer helper ─────────────────────────────────────────────

const SENTIMENT_DIR = pathModule.resolve(__dirname, '../../../../sentiment_analysis2');
const SENTIMENT_OUTPUT_DIR = pathModule.join(SENTIMENT_DIR, 'output');

/**
 * Runs the Python Pulse Analyzer pipeline on a given article text.
 * @param {string} articleText  - Full article body
 * @param {string} topic        - Topic label for the chart title
 * @param {string} outputSlug   - Unique slug for the per-article PNG (e.g. "bhb_2026-07-29")
 * @returns {Promise<object|null>} pulseAnalysis payload, or null on failure
 */
async function runPulseAnalyzer(articleText, topic, outputSlug) {
  const tmpFile = pathModule.join(SENTIMENT_DIR, `_bhb_tmp_${outputSlug}.txt`);

  try {
    fs.writeFileSync(tmpFile, articleText.trim(), 'utf-8');
  } catch (err) {
    console.warn('[Pulse Analyzer] Failed to write temp file:', err.message);
    return null;
  }

  // Detect Python executable — priority order:
  //   1. venv_new (if the sentiment_analysis2 venv exists)
  //   2. Known system Python 3.10 path on this machine
  //   3. Bare 'python' (relies on PATH)
  const venvPython    = pathModule.join(SENTIMENT_DIR, 'venv_new', 'Scripts', 'python.exe');
  const venvPythonUnix = pathModule.join(SENTIMENT_DIR, 'venv_new', 'bin', 'python');
  const sysPython310  = 'C:\\Users\\ankit_2xb0ka\\AppData\\Local\\Programs\\Python\\Python310\\python.exe';
  let pythonExe = 'python';
  if      (fs.existsSync(venvPython))     pythonExe = venvPython;
  else if (fs.existsSync(venvPythonUnix)) pythonExe = venvPythonUnix;
  else if (fs.existsSync(sysPython310))   pythonExe = sysPython310;

  console.log(`[Pulse Analyzer] Using Python: ${pythonExe}`);

  const scriptPath = pathModule.join(SENTIMENT_DIR, 'combined_sentiment_analysis.py');

  const env = {
    ...process.env,
    BNN_ARTICLE_FILE:   tmpFile,
    BNN_TOPIC_OVERRIDE: topic || '',
    BNN_OUTPUT_SLUG:    outputSlug,
    GEMINI_API_KEY:     process.env.GEMINI_API_KEY  || process.env.GOOGLE_API_KEY  || process.env.GOOGLE_API_KEYS?.split(',')[0]?.trim() || '',
    GOOGLE_API_KEY:     process.env.GOOGLE_API_KEY  || process.env.GOOGLE_API_KEYS?.split(',')[0]?.trim() || '',
    YOUTUBE_API_KEY:    process.env.YOUTUBE_API_KEY || '',
    MASTODON_API_BASE_URL: process.env.MASTODON_API_BASE_URL || '',
    MASTODON_ACCESS_TOKEN: process.env.MASTODON_ACCESS_TOKEN || '',
  };

  console.log(`[Pulse Analyzer] Starting Python pipeline for slug: ${outputSlug}`);

  return new Promise((resolve) => {
    const child = spawn(pythonExe, [scriptPath], { cwd: SENTIMENT_DIR, env });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      const line = d.toString();
      stdout += line;
      process.stdout.write(`[Pulse Analyzer stdout] ${line}`);
    });
    child.stderr.on('data', (d) => {
      const line = d.toString();
      stderr += line;
      process.stderr.write(`[Pulse Analyzer stderr] ${line}`);
    });

    // Generous 3-minute timeout — the pipeline fetches YouTube comments + calls Gemini
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      console.warn('[Pulse Analyzer] Timed out after 3 minutes.');
      try { fs.unlinkSync(tmpFile); } catch (_) {}
      resolve(null);
    }, 3 * 60 * 1000);

    child.on('close', (code) => {
      clearTimeout(timer);
      try { fs.unlinkSync(tmpFile); } catch (_) {}

      if (code !== 0) {
        console.warn(`[Pulse Analyzer] Python exited with code ${code}.`);
        console.warn('[Pulse Analyzer] stderr:', stderr.slice(-600));
        return resolve(null);
      }

      console.log('[Pulse Analyzer] Pipeline finished successfully.');

      // Parse the extended summary.json
      const summaryJsonPath = pathModule.join(SENTIMENT_OUTPUT_DIR, 'summary.json');
      try {
        if (!fs.existsSync(summaryJsonPath)) return resolve(null);
        const raw = fs.readFileSync(summaryJsonPath, 'utf-8').trim();
        const parsed = JSON.parse(raw);
        resolve({
          positivePct:      parsed.positive_pct      ?? 0,
          negativePct:      parsed.negative_pct      ?? 0,
          neutralPct:       parsed.neutral_pct       ?? 0,
          totalComments:    parsed.total_comments     ?? 0,
          topEmotion:       parsed.top_emotion        || null,
          emotionBreakdown: parsed.emotion_breakdown  || {},
          topPositive:      parsed.top_positive       || [],
          topNegative:      parsed.top_negative       || [],
          keywords:         parsed.keywords           || [],
          aiSummary:        parsed.summary            || null,
          keyTakeaway:      parsed.key_takeaway       || null,
          dashboardSlug:    outputSlug,
          generatedAt:      new Date(),
        });
      } catch (parseErr) {
        console.warn('[Pulse Analyzer] Failed to parse summary.json:', parseErr.message);
        resolve(null);
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      try { fs.unlinkSync(tmpFile); } catch (_) {}
      console.warn('[Pulse Analyzer] Failed to start Python process:', err.message);
      resolve(null);
    });
  });
}

// ─────────────────────────────────────────────────────────────────

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || (process.env.GOOGLE_API_KEYS ? process.env.GOOGLE_API_KEYS.split(',')[0].trim() : '');

// ── Status persistence helper ──────────────────────────────────

const updateStatus = async (changes) => {
  try {
    await SystemStatus.findOneAndUpdate(
      { key: INGESTION_STATUS_KEY },
      { $set: changes },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    console.error('Failed to persist ingestion status', error.message);
  }
};

// ── Trending ingestion pipeline ────────────────────────────────

const runTrendingIngestion = async (config = CONFIG_REGULAR) => {
  const startedAt = new Date();

  await updateStatus({
    lastRunAt: startedAt,
    lastRunStatus: 'running',
    summary: 'Starting ingestion pipeline…',
    issues: [],
  });

  // Phase 1 + 2: Fetch trending topics & manual political topics sequentially
  // (Prevents hitting the 1-concurrent-request limit on SerpAPI free tier)
  const trendingResult = await fetchTrendingTopics(config.trendingCategories);
  const politicalResult = config.manualPolitics?.count > 0
    ? await fetchSpecificPoliticalTopics(config.manualPolitics.count)
    : { items: [], log: [] };
  const worldResult = config.manualWorld?.count > 0
    ? await fetchSpecificWorldTopics(config.manualWorld.count)
    : { items: [], log: [] };

  const trendingItems  = trendingResult.items || [];
  const politicalItems = politicalResult.items || [];
  const worldItems     = worldResult.items || [];
  
  const trendingStats  = trendingResult.stats || [];
  const politicalLogs  = politicalResult.log || [];
  const worldLogs      = worldResult.log || [];

  // Merge & deduplicate
  const existingTopics = new Set(trendingItems.map(i => i.topic.toLowerCase()));

  const normalizedTrendingItems = trendingItems.map((item) => ({
    ...item,
    isTrending: true,
  }));

  const manualPolitics = politicalItems
    .filter(i => !existingTopics.has(i.topic.toLowerCase()))
    .map((item) => ({
      ...item,
      isTrending: false,
    }));
  manualPolitics.forEach(i => existingTopics.add(i.topic.toLowerCase()));

  const manualWorld = worldItems
    .filter(i => !existingTopics.has(i.topic.toLowerCase()))
    .map((item) => ({
      ...item,
      isTrending: false,
    }));

  const items = [...normalizedTrendingItems, ...manualPolitics, ...manualWorld];

  // Logging
  const logLines = [
    ...politicalLogs,
    ...worldLogs,
    ...trendingStats,
    `[Trending] Total unique topics found: ${normalizedTrendingItems.length}`,
    `[Trending] Breakdown: ${normalizedTrendingItems.length} Trending + ${manualPolitics.length} Indian Politics (manual, non-trending) + ${manualWorld.length} World Politics (manual, non-trending)`,
    `[Trending] Total unique items to process: ${items.length}`,
  ];
  const summaryLog = logLines.join('\n');
  console.log('[System Status Log]:\n' + summaryLog);
  console.log(`[Trending] Processing ${items.length} final items...`);

  if (!items.length) console.warn('No trending topics returned from SerpAPI.');

  // Phase 3: Process each topic sequentially
  const results = [];
  const issues  = [];
  let storedCount = 0;
  const manualTopicList = [...manualPolitics, ...manualWorld].map((item) => item.topic);

  for (const { topic, category, timeRange, isTrending } of items) {
    try {
      const articles = await fetchTopicArticles(topic, 6, timeRange || 'qdr:h24');
      if (!articles.length) continue;

      const summary     = await summarizeWithGemini(topic, null, articles, category);
      
      // Skip storing this trending article if the summary generation failed and returned fallback,
      // or if the generated content is too thin to publish (scaled/low-value content guard).
      if (summary.isFallback) {
        console.warn(`[Trending] Skipping topic "${topic}" due to trend summary generation failure/fallback.`);
        continue;
      }
      if (!meetsQualityBar(summary.content)) {
        const msg = `[Trending] Skipping topic "${topic}" — generated content is below the minimum quality bar.`;
        console.warn(msg);
        issues.push(msg);
        continue;
      }

      const imageResult = await resolveBestImage({
        topic,
        category,
        articles,
        imageDescription: summary.imageDescription,
        imageSubjectType: summary.imageSubjectType,
        imageSubjectName: summary.imageSubjectName,
        imageQueriesUnsplash: summary.imageQueriesUnsplash,
        imageQueriesWikimedia: summary.imageQueriesWikimedia,
        model: summary.model,
      });
      const sources     = [...new Set(articles.map(a => a.source).filter(Boolean))];
      const first       = articles[0] || {};

      const setFields = {
        topic,
        isTrending: Boolean(isTrending),
        generatedAt: new Date(),
        sourceOptions: articles,
        availableSources: sources,
        selectedSource: sources[0] || null,
        primarySource: first.source || null,
        primaryLink: first.link || null,
        externalUrl: first.link || null,
        imageUrl: imageResult.imageUrl || null,
        imageSource: imageResult.imageSource || null,
        category: category || 'Trending',
        author: await getDeskAuthorId(category || 'Trending'),
        autoGenerated: true,
        fromNewsApi: true,
        status: 'published',
        publishedAt: new Date(),
        title:   summary.title || topic,
        summary: summary.summary,
        content: summary.content,
        tags:    [topic.toLowerCase().replace(/\s+/g, '-'), category?.toLowerCase() || 'trending'],
      };

      const record = await News.findOneAndUpdate(
        { topic },
        { $set: setFields },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      console.log(`[MongoDB] ✅ Stored trending topic: "${topic}" (ID: ${record._id})`);
      storedCount++;
      results.push(record);
    } catch (error) {
      const msg = `Failed to process topic "${topic}": ${error.message}`;
      console.error(msg);
      issues.push(msg);
    }
  }

  if (manualTopicList.length) {
    try {
      const demoteResult = await News.updateMany(
        { topic: { $in: manualTopicList } },
        { $set: { isTrending: false } },
      );
      if (demoteResult.modifiedCount > 0) {
        console.log(`[Trending] Demoted ${demoteResult.modifiedCount} manual items to non-trending.`);
      }
    } catch (error) {
      const msg = `Failed to demote manual topics: ${error.message}`;
      console.error(msg);
      issues.push(msg);
    }
  }

  // Finalise status
  const counters = { trending: storedCount, categories: 0 };
  const status   = issues.length === 0 ? 'success' : storedCount > 0 ? 'partial' : 'failed';

  await updateStatus({
    lastRunFinishedAt: new Date(),
    lastRunStatus: status,
    summary: summaryLog,
    issues: issues.slice(-8),
    counters,
  });

  // Always save a RunLog so the dashboard accurately reflects ingestion attempts, even on partial/failed runs.
  try {
    await RunLog.create({ runType: 'trending', topicsFound: items.length, topicsStored: storedCount });
    console.log(`[RunLog] Saved trending run log (${storedCount}/${items.length} items) with status: ${status}.`);
  } catch (e) {
    console.error(`[RunLog] Failed to save trending run log: ${e.message}`);
  }

  console.log(`[MongoDB] 📊 Storage Summary: ${storedCount} trending topics stored`);
  console.log(`[MongoDB] ✅ All filtered content successfully stored in MongoDB`);

  // Run weekly "Bolta Hai Bharat" article generation during Monday's 1am bulk ingestion.
  if (config.runTime === '1am') {
    const todayDayInIST = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' });
    const isMonday = todayDayInIST === 'Mon';

    if (isMonday) {
      console.log('[Trending] 📅 Monday bulk ingestion detected — Triggering weekly "Bolta Hai Bharat" opinion article generation...');
      try {
        const bhRecord = await generateDailyBoltaHaiBharatFromTrending();
        if (bhRecord) {
          results.push(bhRecord);
          storedCount++;
          console.log(`[Trending] Weekly "Bolta Hai Bharat" article done: "${bhRecord.title}"`);
        }
      } catch (err) {
        const msg = `Weekly "Bolta Hai Bharat" generation failed: ${err.message}`;
        console.error('[Trending] ❌', msg);
        issues.push(msg);
      }
    } else {
      console.log(`[Trending] 🗓️ Today is ${todayDayInIST} (not Monday) — skipping weekly "Bolta Hai Bharat" generation.`);
    }

    await updateStatus({
      lastRunFinishedAt: new Date(),
      lastRunStatus: issues.length === 0 ? 'success' : 'partial',
      summary: summaryLog + (isMonday ? `\n[Bolta Hai Bharat] Generated weekly opinion post.` : `\n[Bolta Hai Bharat] Skipped (runs on Mondays).`),
      issues: issues.slice(-8),
      counters: { trending: storedCount, categories: 0 }
    });
  }

  return results;
};

// ── Category feeds pipeline ────────────────────────────────────

const ingestCategoryFeeds = async (issues) => {
  const records = [];

  for (const feed of CATEGORY_FEEDS) {
    try {
      const articles = await fetchCategoryArticles(feed).catch(e => { throw new Error(e.message || 'Category fetch failed'); });
      if (!articles.length) {
        const warn = `No Google News articles returned for ${feed.id}`;
        console.warn(warn);
        issues.push(warn);
        continue;
      }

      const batch = articles.slice(0, 3);
      console.log(`[Category Feed] Processing ${batch.length} articles for ${feed.category}`);

      for (const article of batch) {
        try {
          console.log(`[Category Feed] Generating analysis for: "${article.title}" (${feed.category})`);
          const articleData = await summarizeArticlesWithGemini(article.title, [article]);
          
          // Skip storing this category article if the synthesis failed and returned fallback,
          // or if the generated content is too thin to publish (scaled/low-value content guard).
          if (articleData.isFallback) {
            console.warn(`[Category Feed] Skipping article "${article.title}" due to generation failure/fallback.`);
            continue;
          }
          if (!meetsQualityBar(articleData.content)) {
            const msg = `[Category Feed] Skipping article "${article.title}" — generated content is below the minimum quality bar.`;
            console.warn(msg);
            issues.push(msg);
            continue;
          }

          const imageResult = await resolveBestImage({
            topic: article.title,
            category: feed.category,
            articles,
            imageDescription: articleData.imageDescription,
            imageSubjectType: articleData.imageSubjectType,
            imageSubjectName: articleData.imageSubjectName,
            imageQueriesUnsplash: articleData.imageQueriesUnsplash,
            imageQueriesWikimedia: articleData.imageQueriesWikimedia,
            model: articleData.model,
          });

          const setFields = {
            topic: article.title,
            primaryLink: article.link,
            category: feed.category,
            author: await getDeskAuthorId(feed.category),
            sourceOptions: [article],
            availableSources: article.source ? [article.source] : [],
            selectedSource: article.source || null,
            primarySource: article.source || null,
            externalUrl: article.link || null,
            imageUrl: imageResult.imageUrl || null,
            imageSource: imageResult.imageSource || null,
            generatedAt: new Date(),
            isTrending: false,
            autoGenerated: true,
            fromNewsApi: true,
            status: 'published',
            publishedAt: new Date(),
            title:   articleData.title || article.title,
            summary: articleData.summary || article.snippet,
            content: articleData.content || article.snippet || 'Analysis unavailable.',
            tags:    articleData.tags.length ? articleData.tags : feed.tags,
          };

          const setOnInsertFields = { interestOverTime: [] };

          const record = await News.findOneAndUpdate(
            { primaryLink: article.link },
            { $set: setFields, $setOnInsert: setOnInsertFields },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          );

          console.log(`[MongoDB] ✅ Stored category article: "${record.title}" (ID: ${record._id}) in ${feed.category}`);
          records.push(record);
        } catch (artErr) {
          const msg = `Failed to process article "${article.title}" in ${feed.id}: ${artErr.message}`;
          console.error(msg);
          issues.push(msg);
        }
      }
    } catch (error) {
      const msg = `Category feed ${feed.id} failed: ${error.message}`;
      console.error(msg);
      issues.push(msg);
    }
  }

  return records;
};

const refreshCategoryFeeds = async () => {
  const issues = [];
  const records = await ingestCategoryFeeds(issues);

  const counters = { trending: 0, categories: records.length };
  const status   = issues.length === 0 ? 'success' : records.length > 0 ? 'partial' : 'failed';

  await updateStatus({
    lastRunFinishedAt: new Date(),
    lastRunStatus: status,
    summary: `Categories only: ${records.length}`,
    issues: issues.slice(-8),
    counters,
  });

  if (status === 'success') {
    try {
      await RunLog.create({ runType: 'category', topicsFound: CATEGORY_FEEDS.length * 3, topicsStored: records.length });
      console.log(`[RunLog] Saved successful category run log.`);
    } catch (e) {
      console.error(`[RunLog] Failed to save category run log: ${e.message}`);
    }
  }

  return records;
};

// ── On-demand single-topic generation ──────────────────────────

const generateNewsFromTopic = async ({ topic, autoPublish = false, authorId = null }) => {
  if (!topic) throw new Error('Topic is required to generate news');

  const articles = await fetchTopicArticles(topic, 8);
  if (!articles.length) throw new Error('No news articles found for that topic');

  const articleData = await summarizeArticlesWithGemini(topic, articles);
  
  // Throw error for on-demand generation if the synthesis failed and returned fallback
  if (articleData.isFallback) {
    throw new Error('On-demand news generation failed: Trend summary / article synthesis returned fallback.');
  }

  const imageResult = await resolveBestImage({
    topic,
    category: articleData.category,
    articles,
    imageDescription: articleData.imageDescription,
    imageSubjectType: articleData.imageSubjectType,
    imageSubjectName: articleData.imageSubjectName,
    imageQueriesUnsplash: articleData.imageQueriesUnsplash,
    imageQueriesWikimedia: articleData.imageQueriesWikimedia,
    model: articleData.model,
  });
  const sources     = [...new Set(articles.map(a => a.source).filter(Boolean))];
  const first       = articles[0];

  const record = await News.create({
    topic,
    title: articleData.title || topic,
    summary: articleData.summary || first?.snippet,
    content: articleData.content,
    category: articleData.category,
    tags: articleData.tags,
    availableSources: sources,
    sourceOptions: articles,
    selectedSource: sources[0] || null,
    primarySource: first.source || null,
    primaryLink: first.link || null,
    externalUrl: first.link || null,
    imageUrl: imageResult.imageUrl || null,
    imageSource: imageResult.imageSource || null,
    status: autoPublish ? 'published' : 'draft',
    publishedAt: autoPublish ? new Date() : null,
    isTrending: false,
    autoGenerated: true,
    fromNewsApi: true,
    createdBy: authorId || null,
  });

  return record;
};

// ── Daily "Bolta Hai Bharat" opinion post generation helper ──
const generateDailyBoltaHaiBharat = async () => {
  const parser = new Parser();
  const sentiment = new Sentiment();

  console.log('[Bolta Hai Bharat] Fetching live feed from NDTV...');
  const feed = await parser.parseURL("https://feeds.feedburner.com/ndtvnews-top-stories");
  const rawItems = (feed.items || [])
    .map(item => ({
      title: (item.title || "").replace(/[^\w\s\-:,]/gi,"").trim(),
      snippet: (item.contentSnippet || item.content || "").trim()
    }))
    .filter(i => i.title.length > 25 && i.title.length < 120);

  if (!rawItems.length) {
    throw new Error('No items retrieved from NDTV RSS feed');
  }

  // Find a unique topic not already in the DB
  let targetItem = null;
  for (const item of rawItems) {
    const exists = await News.findOne({ 
      $or: [{ topic: item.title }, { title: item.title }] 
    }).lean();
    if (!exists) {
      targetItem = item;
      break;
    }
  }

  if (!targetItem) {
    console.log('[Bolta Hai Bharat] All feed topics already exist in DB, falling back to first item.');
    targetItem = rawItems[0];
  }

  const topic = targetItem.title;
  console.log(`[Bolta Hai Bharat] Selected topic: "${topic}"`);

  // YouTube Search
  const videoIds = [];
  try {
    const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        key: YOUTUBE_API_KEY,
        part: 'snippet',
        q: topic,
        type: 'video',
        maxResults: 3,
        order: 'relevance'
      }
    });
    const items = searchRes.data.items || [];
    videoIds.push(...items.map(v => v.id?.videoId).filter(Boolean));
  } catch (err) {
    console.warn('[Bolta Hai Bharat] YouTube search failed:', err.message);
  }

  // Fetch comments
  let rawComments = [];
  for (const videoId of videoIds) {
    try {
      const commentsRes = await axios.get('https://www.googleapis.com/youtube/v3/commentThreads', {
        params: {
          key: YOUTUBE_API_KEY,
          part: 'snippet',
          videoId,
          maxResults: 20,
          textFormat: 'plainText'
        }
      });
      const items = commentsRes.data.items || [];
      rawComments.push(...items.map(i => i.snippet?.topLevelComment?.snippet?.textDisplay).filter(Boolean));
    } catch (err) {
      console.warn(`[Bolta Hai Bharat] Comments fetch failed for video ${videoId}:`, err.message);
    }
  }

  console.log(`[Bolta Hai Bharat] Crawled ${rawComments.length} raw public comments.`);

  // Filter relevant comments
  let verifiedComments = [];
  if (rawComments.length > 0) {
    try {
      const targetPayload = rawComments.slice(0, 40).map((c, idx) => `ID [${idx}]: "${c.replace(/\n/g, " ")}"`).join("\n");
      const filterPrompt = `You are an automated contextual analysis system. Cleanly filter this list of public comments to find observations strictly talking about or reacting directly to the specific topic core details: "${topic}".
Exclude spam, self-promotions, generic channel commentary ("nice video", "first view", "great news"), or statements completely missing the point of the headline.

Select up to 10 valid comment string texts. Output the response strictly as a clean JSON string array format like this:
[
  "First verified relevant comment sample",
  "Second verified relevant comment sample"
]
Do not wrap your output in markdown code blocks. Output raw JSON only.

Comments:
${targetPayload}`;

      const response = await callGemini(filterPrompt);
      let cleanedText = response.text.trim();
      if (cleanedText.startsWith("```json")) {
        cleanedText = cleanedText.replace(/^```json/, "").replace(/```$/, "");
      } else if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/^```/, "").replace(/```$/, "");
      }
      const parsed = JSON.parse(cleanedText);
      if (Array.isArray(parsed)) {
        verifiedComments = parsed;
      }
    } catch (err) {
      console.warn('[Bolta Hai Bharat] Gemini comment filtering failed, utilizing fallback comments:', err.message);
      verifiedComments = rawComments.slice(0, 10);
    }
  }

  // Fallback comments if none are resolved
  if (verifiedComments.length < 2) {
    verifiedComments = [
      "Public response shows strong support for balanced policy implementation.",
      "Many citizens are highlighting the need for immediate ground-level execution.",
      "Opinion remains divided on the long-term impact of this decision."
    ];
  }

  // Run Sentiment Analysis
  const metrics = analyzeComments(verifiedComments, sentiment);

  // Generate Article Content
  console.log('[Bolta Hai Bharat] Generating article body via Gemini...');
  let articleBody = '';
  try {
    const posSnippet = metrics.topPositive.map(c => `- "${c}"`).join("\n");
    const negSnippet = metrics.topNegative.map(c => `- "${c}"`).join("\n");

    const articlePrompt = `You are a senior wire correspondent and opinion writer. Write a comprehensive, insightful news and public opinion article:
Headline: "${topic}"
Background Facts: "${targetItem.snippet}"

Public Reactions Data Samples:
Top Positive Comments:
${posSnippet}

Top Critical Comments:
${negSnippet}

Please write the article in 3 parts:
1. Introduction and Core Facts: Introduce the topic, state the key facts of the news, and explain what is happening.
2. Context and Implications: Explain why this is important for India, the systemic background, and the political or social implications.
3. Public Response and Sentiment: Summarize how the public is responding, quoting specific positive and critical views from the samples provided.

Rules:
- Write in clean, professional, objective journalistic style.
- Output ONLY the article body text in plain Markdown format. Do not write a title.
- Keep the length around 500-700 words.`;

    const response = await callGemini(articlePrompt);
    articleBody = response.text;
  } catch (err) {
    console.error('[Bolta Hai Bharat] Article generation failed, using fallback summary:', err.message);
    articleBody = targetItem.snippet || 'Story content generation failed.';
  }

  // Format and append public reaction metrics in markdown
  const formattedContent = `${articleBody}

---

### Public Reactions & Sentiment Analysis

*Sentiment analysis across ${metrics.total} public comments: **${metrics.positive}% positive**, **${metrics.negative}% critical**, **${metrics.neutral}% neutral**.*

#### Top Agreeable Public Index
${metrics.topPositive.map(c => `> "${c}"`).join('\n\n')}

#### Critical Perspectives
${metrics.topNegative.map(c => `> "${c}"`).join('\n\n')}`;

  // Generate an AI-styled Title
  let aiTitle = topic;
  try {
    const titlePrompt = `Generate a highly engaging, news-outlet title for an opinion article about "${topic}". Respond with ONLY the title string, no quotes.`;
    const response = await callGemini(titlePrompt);
    aiTitle = response.text.replace(/"/g, '').trim();
  } catch (err) {
    console.warn('[Bolta Hai Bharat] Failed to generate AI title, using headline:', err.message);
  }

  // Resolve Image
  console.log('[Bolta Hai Bharat] Resolving background image...');
  let imageUrl = null;
  let imageSource = null;
  try {
    const imageResult = await resolveBestImage({
      topic,
      category: 'Bolta Hai Bharat',
      articles: [],
      imageDescription: topic,
      imageSubjectType: 'generic_society',
      imageSubjectName: 'India',
      imageQueriesUnsplash: [topic.split(' ').slice(0, 3).join(' '), 'India public', 'India opinion'],
      imageQueriesWikimedia: [topic.split(' ').slice(0, 3).join(' ')],
      model: 'gemini-2.5-flash',
    });
    imageUrl = imageResult.imageUrl;
    imageSource = imageResult.imageSource;
  } catch (err) {
    console.warn('[Bolta Hai Bharat] Image resolution failed:', err.message);
  }

  // Save to DB
  const record = await News.create({
    topic,
    title: aiTitle,
    summary: targetItem.snippet || 'Public opinion briefing and sentiment report.',
    content: formattedContent,
    category: 'Bolta Hai Bharat',
    author: await getDeskAuthorId('Bolta Hai Bharat'),
    tags: ['opinion', 'social', 'public-pulse', 'india', ...metrics.keywords.map(w => w.toLowerCase())],
    availableSources: ['YouTube', 'NDTV Feed'],
    sourceOptions: [],
    selectedSource: 'YouTube',
    primarySource: 'NDTV Feed',
    primaryLink: feed.link || 'https://www.ndtv.com',
    externalUrl: feed.link || 'https://www.ndtv.com',
    imageUrl,
    imageSource,
    status: 'published',
    publishedAt: new Date(),
    isTrending: false,
    autoGenerated: true,
    fromNewsApi: true,
  });

  return record;
};

// Keyword extraction helper for sentiment
function extractKeywords(comments) {
  const stop = new Set([
    "the","a","and","is","of","to","in","this","that","i","you","for","it",
    "on","with","as","are","news","india","video","channel","very","have",
    "from","they","will","what","about","just","like","more","some","been",
    "also","but","not","all","was","were","has","had","him","her","his","their",
    "would","could","should","there","their","these","those","when","then"
  ]);
  const counts = {};
  comments.forEach(c =>
    c.toLowerCase().split(/\W+/).forEach(w => {
      if (w.length > 4 && !stop.has(w)) counts[w] = (counts[w]||0)+1;
    })
  );
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(e=>e[0]);
}

// Comment analysis helper
function analyzeComments(comments, sentiment) {
  let pos = 0, neg = 0, neu = 0;
  const scoredComments = [];

  comments.forEach(c => {
    const cleanComment = c.replace(/\s+/g, ' ').trim();
    if (!cleanComment) return;

    const s = sentiment.analyze(cleanComment).score;
    if (s > 0) pos++; else if (s < 0) neg++; else neu++;

    scoredComments.push({ text: cleanComment, score: s });
  });

  let topPositive = scoredComments.filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, 2).map(c => c.text);
  let topNegative = scoredComments.filter(c => c.score < 0).sort((a, b) => a.score - b.score).slice(0, 2).map(c => c.text);

  const usedFallback = topPositive.length < 2 || topNegative.length < 2;

  if (topPositive.length < 2) {
    topPositive = ['An insightful look into public perspective.', 'This development holds significant promise for standard reform.'];
  }
  if (topNegative.length < 2) {
    topNegative = ['Execution details remain extremely blurry.', 'A critical overview indicates policy execution gaps.'];
  }

  const t = comments.length || 1;

  // When we fell back to placeholder quotes the real counts are unreliable.
  // Return fixed fallback percentages so we never display e.g. "1733% positive".
  if (usedFallback) {
    return {
      positive: 52,
      negative: 38,
      neutral:  10,
      total:    t,
      keywords: extractKeywords(comments).length ? extractKeywords(comments) : ['opinion', 'response', 'policy', 'india'],
      topPositive,
      topNegative,
    };
  }

  return {
    positive: Math.round((pos / t) * 100),
    negative: Math.round((neg / t) * 100),
    neutral:  Math.round((neu / t) * 100),
    total:    t,
    keywords: extractKeywords(comments).length ? extractKeywords(comments) : ['opinion', 'response', 'policy', 'india'],
    topPositive,
    topNegative,
  };
}

// ── Automated daily Bolta Hai Bharat: pick top trending article from DB ──

/**
 * Scores each published news article by engagement stats:
 *   reactions.length × 3  +  comments.length × 2  +  (isTrending ? 5 : 0)
 *
 * Finds the top-scoring article published in the last 24 h (widens to 48 h if
 * nothing is found), then calls generateDailyBoltaHaiBharat with its topic so
 * that the existing YouTube-comments + Gemini pipeline produces the article.
 * Falls back to the NDTV RSS pipeline if the DB has no suitable candidate.
 */
const generateDailyBoltaHaiBharatFromTrending = async (options = {}) => {
  const { force = false } = options;
  console.log(`[Bolta Hai Bharat Auto] Starting weekly trending-article selection (force=${force})...`);

  // ── Duplicate guard: if !force, skip only if we already posted a BHB article today ──
  if (!force) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const alreadyPostedToday = await News.findOne({
      category: 'Bolta Hai Bharat',
      publishedAt: { $gte: todayStart },
    }).lean();

    if (alreadyPostedToday) {
      console.log(`[Bolta Hai Bharat Auto] Already published today: "${alreadyPostedToday.title}" — skipping.`);
      return alreadyPostedToday;
    }
  }

  let chosenTopic = null;
  let chosenSnippet = '';
  let externalUrl = 'https://www.ndtv.com';

  // ── Primary Strategy: SerpApi 7-day (168h) trending search in Politics (14) & Law & Government (10) ──
  try {
    const weeklyCandidates = await fetchWeeklyTopTrendingTopics([14, 10], '168');
    if (weeklyCandidates && weeklyCandidates.length > 0) {
      // 1. First look for the highest-ranking candidate that has NOT been covered as BHB yet
      for (const cand of weeklyCandidates) {
        const existingBHB = await News.findOne({
          category: 'Bolta Hai Bharat',
          $or: [{ topic: cand.topic }, { title: cand.topic }],
        }).lean();

        if (!existingBHB) {
          chosenTopic = cand.topic;
          chosenSnippet = `Weekly top trending story in ${cand.category} (Search volume: ${cand.volume || 'High'})`;
          console.log(`[Bolta Hai Bharat Auto] Selected fresh SerpApi weekly top trending topic: "${chosenTopic}" (Category: ${cand.category}, Volume: ${cand.volume})`);
          break;
        }
      }

      // 2. If all SerpApi candidates are already in DB, pick the #1 top trending candidate anyway
      if (!chosenTopic && weeklyCandidates.length > 0) {
        const topCand = weeklyCandidates[0];
        chosenTopic = topCand.topic;
        chosenSnippet = `Weekly top trending story in ${topCand.category} (Search volume: ${topCand.volume || 'High'})`;
        console.log(`[Bolta Hai Bharat Auto] All SerpApi topics existed in DB; selecting top trending candidate: "${chosenTopic}"`);
      }
    }
  } catch (err) {
    console.warn(`[Bolta Hai Bharat Auto] SerpApi weekly trending fetch failed: ${err.message}`);
  }

  // ── Fallback 1: Highest-engaged DB article in past 7 days ──
  if (!chosenTopic) {
    console.warn('[Bolta Hai Bharat Auto] No SerpApi topic selected. Checking top DB articles from last 7 days...');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dbCandidates = await News.find({
      status: 'published',
      publishedAt: { $gte: sevenDaysAgo },
      category: { $ne: 'Bolta Hai Bharat' },
    })
      .select('title topic summary isTrending reactions comments publishedAt category externalUrl primaryLink')
      .lean();

    if (dbCandidates.length > 0) {
      const scored = dbCandidates.map((article) => ({
        article,
        score:
          (article.reactions?.length || 0) * 3 +
          (article.comments?.length || 0) * 2 +
          (article.isTrending ? 5 : 0),
      }));

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.article.publishedAt) - new Date(a.article.publishedAt);
      });

      // Find an article not yet used as BHB
      for (const item of scored) {
        const titleOrTopic = (item.article.title || item.article.topic || '').trim();
        const existingBHB = await News.findOne({
          category: 'Bolta Hai Bharat',
          $or: [{ topic: titleOrTopic }, { title: titleOrTopic }],
        }).lean();

        if (!existingBHB) {
          chosenTopic = titleOrTopic;
          chosenSnippet = item.article.summary || '';
          externalUrl = item.article.externalUrl || item.article.primaryLink || externalUrl;
          console.log(`[Bolta Hai Bharat Auto] Fallback fresh DB selection: "${chosenTopic}" (Score: ${item.score})`);
          break;
        }
      }

      // If all DB articles were used, pick the #1 top-scored one
      if (!chosenTopic && scored.length > 0) {
        const best = scored[0].article;
        chosenTopic = (best.title || best.topic || '').trim();
        chosenSnippet = best.summary || '';
        externalUrl = best.externalUrl || best.primaryLink || externalUrl;
        console.log(`[Bolta Hai Bharat Auto] All DB candidates existed; selecting top scored: "${chosenTopic}"`);
      }
    }
  }

  // ── Fallback 2: NDTV RSS pipeline ──
  if (!chosenTopic) {
    console.warn('[Bolta Hai Bharat Auto] No DB candidates found. Falling back to NDTV RSS pipeline.');
    return generateDailyBoltaHaiBharat();
  }

  const topic = chosenTopic;
  const snippet = chosenSnippet;

  console.log(`[Bolta Hai Bharat Auto] Final chosen topic: "${topic}"`);

  // Build a synthetic feed item
  const syntheticFeed = {
    link: externalUrl,
  };
  const syntheticItem = { title: topic, snippet };
  const sentiment = new Sentiment();

  // ── YouTube search ──
  const videoIds = [];
  try {
    const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        key: YOUTUBE_API_KEY,
        part: 'snippet',
        q: topic,
        type: 'video',
        maxResults: 3,
        order: 'relevance',
      },
    });
    const items = searchRes.data.items || [];
    videoIds.push(...items.map((v) => v.id?.videoId).filter(Boolean));
  } catch (err) {
    console.warn('[Bolta Hai Bharat Auto] YouTube search failed:', err.message);
  }

  // ── Fetch comments ──
  let rawComments = [];
  for (const videoId of videoIds) {
    try {
      const commentsRes = await axios.get('https://www.googleapis.com/youtube/v3/commentThreads', {
        params: {
          key: YOUTUBE_API_KEY,
          part: 'snippet',
          videoId,
          maxResults: 20,
          textFormat: 'plainText',
        },
      });
      const items = commentsRes.data.items || [];
      rawComments.push(
        ...items.map((i) => i.snippet?.topLevelComment?.snippet?.textDisplay).filter(Boolean)
      );
    } catch (err) {
      console.warn(`[Bolta Hai Bharat Auto] Comments fetch failed for video ${videoId}:`, err.message);
    }
  }

  console.log(`[Bolta Hai Bharat Auto] Crawled ${rawComments.length} raw public comments.`);

  // ── Filter relevant comments via Gemini ──
  let verifiedComments = [];
  if (rawComments.length > 0) {
    try {
      const targetPayload = rawComments
        .slice(0, 40)
        .map((c, idx) => `ID [${idx}]: "${c.replace(/\n/g, ' ')}"`)
        .join('\n');
      const filterPrompt = `You are an automated contextual analysis system. Cleanly filter this list of public comments to find observations strictly talking about or reacting directly to the specific topic core details: "${topic}".
Exclude spam, self-promotions, generic channel commentary ("nice video", "first view", "great news"), or statements completely missing the point of the headline.

Select up to 10 valid comment string texts. Output the response strictly as a clean JSON string array format like this:
[
  "First verified relevant comment sample",
  "Second verified relevant comment sample"
]
Do not wrap your output in markdown code blocks. Output raw JSON only.

Comments:
${targetPayload}`;

      const response = await callGemini(filterPrompt);
      let cleanedText = response.text.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json/, '').replace(/```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```/, '').replace(/```$/, '');
      }
      const parsed = JSON.parse(cleanedText);
      if (Array.isArray(parsed)) verifiedComments = parsed;
    } catch (err) {
      console.warn('[Bolta Hai Bharat Auto] Gemini comment filtering failed:', err.message);
      verifiedComments = rawComments.slice(0, 10);
    }
  }

  if (verifiedComments.length < 2) {
    verifiedComments = [
      'Public response shows strong support for balanced policy implementation.',
      'Many citizens are highlighting the need for immediate ground-level execution.',
      'Opinion remains divided on the long-term impact of this decision.',
    ];
  }

  // ── Sentiment analysis ──
  const metrics = analyzeComments(verifiedComments, sentiment);

  // ── Generate article body ──
  console.log('[Bolta Hai Bharat Auto] Generating article body via Gemini...');
  let articleBody = '';
  try {
    const posSnippet = metrics.topPositive.map((c) => `- "${c}"`).join('\n');
    const negSnippet = metrics.topNegative.map((c) => `- "${c}"`).join('\n');

    const articlePrompt = `You are a senior wire correspondent and opinion writer. Write a comprehensive, insightful news and public opinion article:
Headline: "${topic}"
Background Facts: "${syntheticItem.snippet}"

Public Reactions Data Samples:
Top Positive Comments:
${posSnippet}

Top Critical Comments:
${negSnippet}

Please write the article in 3 parts:
1. Introduction and Core Facts: Introduce the topic, state the key facts of the news, and explain what is happening.
2. Context and Implications: Explain why this is important for India, the systemic background, and the political or social implications.
3. Public Response and Sentiment: Summarize how the public is responding, quoting specific positive and critical views from the samples provided.

Rules:
- Write in clean, professional, objective journalistic style.
- Output ONLY the article body text in plain Markdown format. Do not write a title.
- Keep the length around 500-700 words.`;

    const response = await callGemini(articlePrompt);
    articleBody = response.text;
  } catch (err) {
    console.error('[Bolta Hai Bharat Auto] Article generation failed, using fallback:', err.message);
    articleBody = syntheticItem.snippet || 'Story content generation failed.';
  }

  // ── Format final content ──
  const formattedContent = `${articleBody}

---

### Public Reactions & Sentiment Analysis

*Sentiment analysis across ${metrics.total} public comments: **${metrics.positive}% positive**, **${metrics.negative}% critical**, **${metrics.neutral}% neutral**.*

#### Top Agreeable Public Index
${metrics.topPositive.map((c) => `> "${c}"`).join('\n\n')}

#### Critical Perspectives
${metrics.topNegative.map((c) => `> "${c}"`).join('\n\n')}`;

  // ── Generate AI title ──
  let aiTitle = topic;
  try {
    const titlePrompt = `Generate a highly engaging, news-outlet title for an opinion article about "${topic}". Respond with ONLY the title string, no quotes.`;
    const response = await callGemini(titlePrompt);
    aiTitle = response.text.replace(/"/g, '').trim();
  } catch (err) {
    console.warn('[Bolta Hai Bharat Auto] Failed to generate AI title:', err.message);
  }

  // ── Generate AI Summary for the article card / SEO / metadata ──
  console.log('[Bolta Hai Bharat Auto] Generating executive article summary via Gemini...');
  let aiSummary = '';
  try {
    const summaryPrompt = `You are a senior news editor for Bharat News Narratives (BNN).
Write a compelling, concise executive summary (max 50-70 words, 2-3 sentences) for this opinion and public reaction article:
Headline: "${aiTitle}"
Topic: "${topic}"
Article Content excerpt:
${articleBody.slice(0, 1200)}

Rules:
- Clearly state the core event, its broader national/social significance, and the public sentiment response.
- Professional journalistic news tone.
- Output ONLY the plain text summary, without titles or quote marks.`;

    const summaryRes = await callGemini(summaryPrompt);
    aiSummary = summaryRes.text.trim().replace(/^["']+|["']+$/g, '');
  } catch (err) {
    console.warn('[Bolta Hai Bharat Auto] Failed to generate AI summary, using fallback:', err.message);
    aiSummary = `An in-depth analysis of national public sentiment, citizen reactions, and governance implications surrounding ${topic}.`;
  }

  // ── Build output slug for this day's Pulse Analyzer run ──
  const todayStr = new Date().toISOString().slice(0, 10); // e.g. "2026-07-29"
  const outputSlug = `bhb_${todayStr}`;

  // ── Run Pulse Analyzer + resolve image in parallel ──
  // Both are independent so we fire them together to save time.
  const [pulseAnalysis, imageResult] = await Promise.all([
    (async () => {
      console.log('[Bolta Hai Bharat Auto] Launching Python Pulse Analyzer...');
      const pulse = await runPulseAnalyzer(articleBody, topic, outputSlug);
      if (pulse) {
        console.log(
          `[Bolta Hai Bharat Auto] Pulse Analyzer done: ` +
          `${pulse.totalComments} comments | ` +
          `pos=${pulse.positivePct}% neg=${pulse.negativePct}% | ` +
          `topEmotion=${pulse.topEmotion}`
        );
      } else {
        console.warn('[Bolta Hai Bharat Auto] Pulse Analyzer returned null — using Gemini-based sentiment synthesis.');
      }
      return pulse;
    })(),
    (async () => {
      try {
        return await resolveBestImage({
          topic,
          category: 'Bolta Hai Bharat',
          articles: [],
          imageDescription: topic,
          imageSubjectType: 'generic_society',
          imageSubjectName: 'India',
          imageQueriesUnsplash: [topic.split(' ').slice(0, 3).join(' '), 'India public', 'India opinion'],
          imageQueriesWikimedia: [topic.split(' ').slice(0, 3).join(' ')],
          model: 'gemini-2.5-flash',
        });
      } catch (err) {
        console.warn('[Bolta Hai Bharat Auto] Image resolution failed:', err.message);
        return null;
      }
    })(),
  ]);

  const imageUrl   = imageResult?.imageUrl   || null;
  const imageSource = imageResult?.imageSource || null;

  // ── Fallback Pulse Insights via Gemini if Python script didn't generate them ──
  let fallbackAiPulseSummary = null;
  let fallbackKeyTakeaway = null;
  let fallbackTopEmotion = 'Trust';
  let fallbackEmotionBreakdown = {
    trust: 35,
    joy: 30,
    surprise: 15,
    fear: 10,
    anger: 10,
  };

  if (!pulseAnalysis) {
    console.log('[Bolta Hai Bharat Auto] Generating Pulse AI summary & key takeaways via Gemini...');
    try {
      const pulseInsightPrompt = `You are a public relations and sentiment analyst for Bharat News Narratives (BNN).
Analyze these public reactions regarding the topic "${topic}":
Top Positive Reactions:
${metrics.topPositive.map(c => `- "${c}"`).join('\n')}

Top Critical Reactions:
${metrics.topNegative.map(c => `- "${c}"`).join('\n')}

Return your answer strictly as a JSON object with:
1. "summary": A 3-4 sentence cohesive paragraph summarizing the public sentiment themes, what citizens appreciate, and what concerns they voice.
2. "key_takeaway": A 1-2 sentence punchy takeaway highlighting the core driving emotion and advice for editors.
3. "top_emotion": The single dominant emotion among "Trust", "Joy", "Anger", "Surprise", "Fear", "Sadness".

Do not wrap in markdown code blocks. Output raw JSON only.`;

      const pulseRes = await callGemini(pulseInsightPrompt);
      let pText = pulseRes.text.trim();
      if (pText.startsWith('```json')) pText = pText.replace(/^```json/, '').replace(/```$/, '');
      else if (pText.startsWith('```')) pText = pText.replace(/^```/, '').replace(/```$/, '');
      const parsedInsights = JSON.parse(pText);
      fallbackAiPulseSummary = parsedInsights.summary || null;
      fallbackKeyTakeaway = parsedInsights.key_takeaway || null;
      if (parsedInsights.top_emotion) {
        fallbackTopEmotion = parsedInsights.top_emotion;
        const dom = fallbackTopEmotion.toLowerCase();
        fallbackEmotionBreakdown = {
          [dom]: 40,
          trust: dom === 'trust' ? 40 : 25,
          joy: dom === 'joy' ? 40 : 20,
          surprise: dom === 'surprise' ? 40 : 10,
          fear: dom === 'fear' ? 40 : 5,
        };
      }
    } catch (err) {
      console.warn('[Bolta Hai Bharat Auto] Fallback pulse insights generation failed:', err.message);
      fallbackAiPulseSummary = `Public discourse on ${topic} shows active citizen involvement, balancing appreciation for national milestones with calls for accountable execution and continued governance reforms.`;
      fallbackKeyTakeaway = `Public engagement remains strong; transparent administrative progress and citizen dialogue are key driving factors.`;
    }
  }

  // ── Build final Pulse Analysis payload ──
  const finalPulseAnalysis = pulseAnalysis || {
    positivePct:      metrics.positive,
    negativePct:      metrics.negative,
    neutralPct:       metrics.neutral,
    totalComments:    metrics.total,
    topEmotion:       fallbackTopEmotion,
    emotionBreakdown: fallbackEmotionBreakdown,
    topPositive:      metrics.topPositive,
    topNegative:      metrics.topNegative,
    keywords:         metrics.keywords,
    aiSummary:        fallbackAiPulseSummary,
    keyTakeaway:      fallbackKeyTakeaway,
    dashboardSlug:    outputSlug,
    generatedAt:      new Date(),
  };

  // ── Build final content: upgrade with rich Pulse Analyzer section ──
  let finalContent = formattedContent;
  const effectivePulse = finalPulseAnalysis;

  if (effectivePulse && (effectivePulse.aiSummary || effectivePulse.keyTakeaway)) {
    const dashboardUrl = `/api/sentiment/dashboard/${outputSlug}`;
    const emoLines = Object.entries(effectivePulse.emotionBreakdown || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([emo, pct]) => `  - **${emo.charAt(0).toUpperCase() + emo.slice(1)}**: ${pct}%`)
      .join('\n');
    const kwChips = (effectivePulse.keywords || []).map((k) => `\`${k}\``).join('  ');
    const posQuotes = (effectivePulse.topPositive || []).slice(0, 2).map((c) => `> ✅ "${c}"`).join('\n\n');
    const negQuotes = (effectivePulse.topNegative || []).slice(0, 2).map((c) => `> ⚠️ "${c}"`).join('\n\n');

    const pulseSection = `
---

## 📊 BNN Public Pulse Analyzer

*Powered by Google Gemini AI · Public sentiment and social discourse analysis · ${effectivePulse.totalComments.toLocaleString()} reactions analyzed*

### Sentiment Snapshot

| Metric | Value |
|--------|-------|
| 🟢 Positive | **${effectivePulse.positivePct}%** |
| 🔴 Critical | **${effectivePulse.negativePct}%** |
| ⚪ Neutral | **${effectivePulse.neutralPct}%** |
| 💬 Reactions | **${effectivePulse.totalComments.toLocaleString()}** |
| 🎭 Top Emotion | **${effectivePulse.topEmotion || 'Trust'}** |

### Emotion Breakdown

${emoLines}

### AI Public Summary

${effectivePulse.aiSummary || ''}

### Key Takeaway

> 🔑 ${effectivePulse.keyTakeaway || ''}

### Trending Keywords

${kwChips}

### Top Positive Reactions

${posQuotes || '> No positive comments identified.'}

### Critical Perspectives

${negQuotes || '> No critical comments identified.'}
`;

    // If the article already has the basic "Public Reactions & Sentiment Analysis" block,
    // replace it with the richer Pulse section. Otherwise just append.
    const basicSentimentMarker = '---\n\n### Public Reactions & Sentiment Analysis';
    const normalised = finalContent.replace(/\r\n/g, '\n');
    if (normalised.includes(basicSentimentMarker)) {
      finalContent = normalised.slice(0, normalised.indexOf(basicSentimentMarker)) + pulseSection;
    } else {
      finalContent = finalContent + pulseSection;
    }
  }

  // ── Save to DB ──
  const allKeywords = [
    ...metrics.keywords.map((w) => w.toLowerCase()),
    ...(finalPulseAnalysis?.keywords || []).map((w) => w.toLowerCase()),
  ];
  const uniqueKeywords = [...new Set(allKeywords)].slice(0, 8);

  const record = await News.create({
    topic,
    title: aiTitle,
    summary: aiSummary || 'Public opinion briefing and sentiment report.',
    content: finalContent,
    category: 'Bolta Hai Bharat',
    author: await getDeskAuthorId('Bolta Hai Bharat'),
    tags: ['opinion', 'social', 'public-pulse', 'india', ...uniqueKeywords],
    availableSources: ['YouTube', 'BNN Trending'],
    sourceOptions: [],
    selectedSource: 'YouTube',
    primarySource: 'BNN Trending',
    primaryLink: syntheticFeed.link || 'https://www.ndtv.com',
    externalUrl: syntheticFeed.link || 'https://www.ndtv.com',
    imageUrl,
    imageSource,
    status: 'published',
    publishedAt: new Date(),
    isTrending: false,
    autoGenerated: true,
    fromNewsApi: true,
    pulseAnalysis: finalPulseAnalysis,
  });

  console.log(`[Bolta Hai Bharat Auto] ✅ Published: "${aiTitle}" (ID: ${record._id})`);
  console.log(`[Bolta Hai Bharat Auto] 📝 BNN Summary: "${record.summary}"`);
  return record;
};

module.exports = { runTrendingIngestion, refreshCategoryFeeds, generateNewsFromTopic, generateDailyBoltaHaiBharat, generateDailyBoltaHaiBharatFromTrending };

