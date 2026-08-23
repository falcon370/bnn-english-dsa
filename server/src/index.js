const dotenv = require('dotenv');
dotenv.config();

if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const cron = require('node-cron');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const newsRoutes = require('./routes/newsRoutes');
const trendingRoutes = require('./routes/trendingRoutes');
const authorRoutes = require('./routes/authorRoutes');
const socialRoutes = require('./routes/socialRoutes');
const epaperRoutes = require('./routes/epaperRoutes');
const imageRoutes = require('./routes/imageRoutes');
const { processPendingSocialPosts } = require('./services/socialMediaService');
const { generateDailyBoltaHaiBharatFromTrending } = require('./services/trending');

const sentimentRoutes = require('./routes/sentimentRoutes');

const REQUIRED_ENV_VARS = ['JWT_SECRET'];
const missingOptional = [
  ...(!process.env.SERPAPI_KEYS && !process.env.SERPAPI_KEY ? ['SERPAPI_KEYS'] : []),
  ...(!process.env.GOOGLE_API_KEYS && !process.env.GOOGLE_API_KEY ? ['GOOGLE_API_KEYS'] : []),
];
const missing = [...REQUIRED_ENV_VARS.filter((k) => !process.env[k]), ...missingOptional];
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Serve default image fallbacks
app.use('/BNN_images', express.static(path.join(__dirname, '../BNN_images')));

// Serve e-paper files
app.use('/epaper-files', express.static(path.join(__dirname, '../epaper-files')));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/trending', trendingRoutes);
app.use('/api/authors', authorRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/epaper', epaperRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/timelines', require('./routes/timelineRoutes'));
app.use('/api/factcheck', require('./routes/factCheckRoutes'));
app.use('/api/sentiment', sentimentRoutes);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);

      // Initialize automatic 15-minute cron job for social media posting
      cron.schedule('*/15 * * * *', async () => {
        console.log('[Cron Job] Triggering automatic social media post check...');
        try {
          const result = await processPendingSocialPosts();
          console.log('[Cron Job] Run result:', JSON.stringify(result));
        } catch (err) {
          console.error('[Cron Job Error] Failed during automated social media posting:', err);
        }
      });
      console.log('[Cron Job] Social media poster cron job initialized (every 15 minutes).');

      // Weekly Bolta Hai Bharat — fires at 08:00 AM IST on Mondays regardless of server timezone
      cron.schedule('0 8 * * 1', async () => {
        console.log('[Cron Job] Triggering weekly Bolta Hai Bharat article generation (Monday)...');
        try {
          const record = await generateDailyBoltaHaiBharatFromTrending();
          console.log(`[Cron Job] Bolta Hai Bharat done. Article: "${record.title}" (ID: ${record._id})`);
        } catch (err) {
          console.error('[Cron Job] Bolta Hai Bharat generation failed:', err.message);
        }
      }, { timezone: 'Asia/Kolkata' });
      console.log('[Cron Job] Bolta Hai Bharat weekly cron initialized (08:00 AM IST on Mondays, Asia/Kolkata).');

    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
