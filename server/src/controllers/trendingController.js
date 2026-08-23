const News = require('../models/News');
const SystemStatus = require('../models/SystemStatus');
const { runTrendingIngestion, refreshCategoryFeeds, CONFIG_1AM, CONFIG_REGULAR, CONFIG_MANUAL_5, generateDailyBoltaHaiBharatFromTrending } = require('../services/trending');


const forceRefreshTrending = async (req, res) => {
  try {
    // Manual force refresh defaults to the regular targeted batch size
    const results = await runTrendingIngestion(CONFIG_REGULAR);
    const status = await SystemStatus.findOne({ key: 'ingestion' }).lean();
    res.json({ refreshed: results.length, items: results, status });
  } catch (error) {
    res.status(500).json({ message: 'Trending refresh failed', error: error.message });
  }
};

const runScheduledIngestion = async (req, res) => {
  try {
    const { type } = req.body;
    let configObj = CONFIG_REGULAR;
    if (type === '1am') {
      configObj = CONFIG_1AM;
    } else if (type === 'manual-5') {
      configObj = CONFIG_MANUAL_5;
    }

    console.log(`[Cloud Scheduler] Triggering ${configObj.runTime} ingestion...`);
    // Pass off ingestion process asynchronously so Cloud Scheduler doesn't timeout
    runTrendingIngestion(configObj)
      .then(() => console.log(`[Cloud Scheduler] ${configObj.runTime} ingestion finished.`))
      .catch((err) => console.error(`[Cloud Scheduler] Failed:`, err.message));

    res.json({ message: `Ingestion job for ${configObj.runTime} initiated in background.` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to initiate scheduled ingestion', error: error.message });
  }
};

const listTrending = async (req, res) => {
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
  let news = await News.find({
    isTrending: true,
    generatedAt: { $gte: fourHoursAgo }
  }).sort({ generatedAt: -1 });

  if (!news.length) {
    // Fallback: If no fresh news, return the latest available trending news
    news = await News.find({ isTrending: true })
      .sort({ generatedAt: -1 })
      .limit(10);
  }
  res.json(news);
};

const getTrendingStatus = async (req, res) => {
  const status =
    (await SystemStatus.findOne({ key: 'ingestion' }).lean()) || {
      lastRunStatus: 'idle',
    };
  res.json(status);
};

const refreshCategoriesOnly = async (req, res) => {
  try {
    const items = await refreshCategoryFeeds();
    res.json({ refreshed: items.length, items });
  } catch (error) {
    res.status(500).json({ message: 'Category refresh failed', error: error.message });
  }
};

const runBoltaHaiBharatJob = async (req, res) => {
  // Respond immediately — the pipeline can take 60–120 s
  res.json({ message: 'Bolta Hai Bharat job initiated in background. Check server logs for progress.' });

  setImmediate(async () => {
    try {
      const record = await generateDailyBoltaHaiBharatFromTrending({ force: true });
      console.log(`[BHB Job] ✅ Completed. Published article ID: ${record?._id}`);
    } catch (err) {
      console.error('[BHB Job] ❌ Failed:', err.message);
    }
  });
};

module.exports = { forceRefreshTrending, runScheduledIngestion, listTrending, getTrendingStatus, refreshCategoriesOnly, runBoltaHaiBharatJob };


