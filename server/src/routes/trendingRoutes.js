const router = require('express').Router();
const {
  forceRefreshTrending,
  listTrending,
  getTrendingStatus,
  refreshCategoriesOnly,
  runScheduledIngestion,
  runBoltaHaiBharatJob,
} = require('../controllers/trendingController');
const { runScheduledEpaper } = require('../controllers/epaperController');
const { requireAuth } = require('../middleware/auth');

// Simple middleware to protect the cron endpoint
const cronAuth = (req, res, next) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return res.status(500).json({ error: 'CRON_SECRET not configured on server' });
  }
  const providedSecret = req.headers['x-cron-secret'];
  if (providedSecret !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized: Invalid cron secret' });
  }
  next();
};

router.get('/', listTrending);
router.get('/status', getTrendingStatus);
router.post('/refresh', requireAuth('admin'), forceRefreshTrending);
router.post('/refresh-categories', requireAuth('admin'), refreshCategoriesOnly);

// Endpoint for Google Cloud Scheduler
router.post('/scheduled-run', cronAuth, runScheduledIngestion);
router.post('/scheduled-epaper', cronAuth, runScheduledEpaper);

// Bolta Hai Bharat — automated daily article generation
// Cloud Scheduler endpoint (cron-secret protected)
router.post('/bolta-hai-bharat-run', cronAuth, runBoltaHaiBharatJob);
// Admin manual trigger (JWT admin protected)
router.post('/bolta-hai-bharat-manual', requireAuth('admin'), runBoltaHaiBharatJob);

module.exports = router;

