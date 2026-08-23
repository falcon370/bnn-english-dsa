/**
 * Sentiment Analysis API Routes
 * POST /api/sentiment/analyze  — Runs the Python pipeline and returns results.
 * GET  /api/sentiment/dashboard — Serves the generated PNG dashboard image.
 */

const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { requireAuth } = require('../middleware/auth');
const News = require('../models/News');

// Absolute path to the sentiment_analysis2 directory (sibling of /server)
// __dirname = BNN/server/src/routes  →  ../../../ = BNN/
const SENTIMENT_DIR = path.resolve(__dirname, '../../../sentiment_analysis2');
const SCRIPT_PATH = path.join(SENTIMENT_DIR, 'combined_sentiment_analysis.py');
const OUTPUT_DIR = path.join(SENTIMENT_DIR, 'output');
const DASHBOARD_PATH = path.join(OUTPUT_DIR, '0_public_reaction_summary.png');
const SUMMARY_PATH = path.join(OUTPUT_DIR, 'summary.txt');
const SUMMARY_JSON_PATH = path.join(OUTPUT_DIR, 'summary.json');

/**
 * Reads the summary.json (extended) or legacy summary.txt file produced by the Python script.
 * Returns the full pulse analysis payload.
 */
function readSummaryFile() {
  try {
    // Prefer the new extended summary.json
    const jsonPath = SUMMARY_JSON_PATH;
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, 'utf-8').trim();
      const parsed = JSON.parse(raw);
      return {
        summary:          parsed.summary          || null,
        keyTakeaway:      parsed.key_takeaway      || null,
        positivePct:      parsed.positive_pct      ?? 0,
        negativePct:      parsed.negative_pct      ?? 0,
        neutralPct:       parsed.neutral_pct       ?? 0,
        totalComments:    parsed.total_comments     ?? 0,
        topEmotion:       parsed.top_emotion        || null,
        emotionBreakdown: parsed.emotion_breakdown  || {},
        topPositive:      parsed.top_positive       || [],
        topNegative:      parsed.top_negative       || [],
        keywords:         parsed.keywords           || [],
        dashboardPng:     parsed.dashboard_png      || null,
      };
    }
    // Fallback to legacy summary.txt
    if (!fs.existsSync(SUMMARY_PATH)) return null;
    const raw = fs.readFileSync(SUMMARY_PATH, 'utf-8').trim();
    const parsed = JSON.parse(raw);
    return {
      summary:     parsed.summary      || null,
      keyTakeaway: parsed.key_takeaway || null,
    };
  } catch {
    return null;
  }
}

/**
 * POST /api/sentiment/analyze
 * Body: { articleText: string, topic?: string }
 * Requires admin auth.
 */
router.post('/analyze', requireAuth(['admin']), (req, res) => {
  const { articleText, topic } = req.body;

  if (!articleText || articleText.trim().length < 30) {
    return res.status(400).json({ message: 'articleText must be at least 30 characters.' });
  }

  // Write article text to a temp file so Python can read it cleanly
  const tmpFile = path.join(SENTIMENT_DIR, '_bnn_article_tmp.txt');
  try {
    fs.writeFileSync(tmpFile, articleText.trim(), 'utf-8');
  } catch (err) {
    return res.status(500).json({ message: 'Failed to write temp article file.', error: err.message });
  }

  // Detect Python executable (venv preferred, then known system Python, then bare 'python')
  const venvPython = path.join(SENTIMENT_DIR, 'venv_new', 'Scripts', 'python.exe');
  const venvPythonUnix = path.join(SENTIMENT_DIR, 'venv_new', 'bin', 'python');
  const sysPython310 = 'C:\\Users\\ankit_2xb0ka\\AppData\\Local\\Programs\\Python\\Python310\\python.exe';
  let pythonExe = 'python';
  if      (fs.existsSync(venvPython))     pythonExe = venvPython;
  else if (fs.existsSync(venvPythonUnix)) pythonExe = venvPythonUnix;
  else if (fs.existsSync(sysPython310))   pythonExe = sysPython310;

  console.log(`[Sentiment] Running: ${pythonExe} ${SCRIPT_PATH}`);
  console.log(`[Sentiment] Article excerpt: "${articleText.trim().slice(0, 80)}..."`);

  const env = {
    ...process.env,
    BNN_ARTICLE_FILE: tmpFile,
    BNN_TOPIC_OVERRIDE: topic || '',
    // Forward the server's Gemini key so Python doesn't need its own .env entry
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEYS?.split(',')[0]?.trim() || '',
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEYS?.split(',')[0]?.trim() || '',
  };

  const child = spawn(pythonExe, [SCRIPT_PATH], {
    cwd: SENTIMENT_DIR,
    env,
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (data) => {
    stdout += data.toString();
    console.log('[Sentiment stdout]', data.toString().trim());
  });

  child.stderr.on('data', (data) => {
    stderr += data.toString();
    console.error('[Sentiment stderr]', data.toString().trim());
  });

  child.on('close', (code) => {
    // Clean up temp file
    try { fs.unlinkSync(tmpFile); } catch (_) {}

    if (code !== 0) {
      console.error(`[Sentiment] Python exited with code ${code}`);
      return res.status(500).json({
        message: 'Sentiment analysis script failed.',
        error: stderr.slice(-800),
      });
    }

    const summaryData = readSummaryFile();

    return res.json({
      success: true,
      dashboardUrl: '/api/sentiment/dashboard',
      summary:       summaryData?.summary      || null,
      keyTakeaway:   summaryData?.keyTakeaway  || null,
      positivePct:   summaryData?.positivePct  ?? null,
      negativePct:   summaryData?.negativePct  ?? null,
      neutralPct:    summaryData?.neutralPct   ?? null,
      totalComments: summaryData?.totalComments ?? null,
      topEmotion:    summaryData?.topEmotion   || null,
      emotionBreakdown: summaryData?.emotionBreakdown || {},
      topPositive:   summaryData?.topPositive  || [],
      topNegative:   summaryData?.topNegative  || [],
      keywords:      summaryData?.keywords     || [],
      stdout: stdout.slice(-500),
    });
  });

  child.on('error', (err) => {
    console.error('[Sentiment] Failed to start process:', err);
    try { fs.unlinkSync(tmpFile); } catch (_) {}
    return res.status(500).json({ message: 'Failed to start sentiment analysis.', error: err.message });
  });
});

/**
 * GET /api/sentiment/dashboard
 * Serves the shared (last-run) generated PNG file. No auth required.
 */
router.get('/dashboard', (req, res) => {
  if (!fs.existsSync(DASHBOARD_PATH)) {
    return res.status(404).json({ message: 'Dashboard image not found. Run an analysis first.' });
  }
  // Explicit content-type + cache-busting so browser always fetches the latest image
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(DASHBOARD_PATH);
});

/**
 * GET /api/sentiment/dashboard/:slug
 * Serves a per-article dashboard PNG by slug (e.g. bhb_2026-07-29).
 * The slug matches the BNN_OUTPUT_SLUG used when Python saved the file.
 */
router.get('/dashboard/:slug', (req, res) => {
  const { slug } = req.params;
  // Basic safety: slug must be alphanumeric + underscores + hyphens only
  if (!/^[a-z0-9_-]+$/i.test(slug)) {
    return res.status(400).json({ message: 'Invalid slug.' });
  }
  const filePath = path.join(OUTPUT_DIR, `${slug}_dashboard.png`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: `Dashboard for slug "${slug}" not found.` });
  }
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400'); // 24-hour cache OK — daily articles
  res.sendFile(filePath);
});

/**
 * GET /api/sentiment/data/:articleId
 * Returns the pulseAnalysis JSON stored in the News document.
 * No auth required — this data is public (shown in article view).
 */
router.get('/data/:articleId', async (req, res) => {
  try {
    const article = await News.findById(req.params.articleId)
      .select('pulseAnalysis title topic category')
      .lean();
    if (!article) {
      return res.status(404).json({ message: 'Article not found.' });
    }
    if (!article.pulseAnalysis) {
      return res.status(404).json({ message: 'No Pulse Analysis data for this article.' });
    }
    return res.json({ pulseAnalysis: article.pulseAnalysis, title: article.title, topic: article.topic });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch pulse analysis.', error: err.message });
  }
});

module.exports = router;
