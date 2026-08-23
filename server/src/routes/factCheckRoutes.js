const router = require('express').Router();
const mongoose = require('mongoose');
const News = require('../models/News');
const { runFactCheckPipeline } = require('../services/factCheckService');

/**
 * @route   POST /api/factcheck/check
 * @desc    Runs fact check pipeline on a custom headline input (no body — dashboard use)
 * @access  Public
 */
router.post('/check', async (req, res) => {
  try {
    const { headline } = req.body;
    if (!headline || !headline.trim()) {
      return res.status(400).json({ message: 'Headline is required' });
    }

    // Dashboard check: headline only, no body context
    const result = await runFactCheckPipeline(headline);
    res.json(result);
  } catch (err) {
    console.error('Fact check endpoint error:', err.message);
    res.status(500).json({ message: 'Failed to run fact check', error: err.message });
  }
});

/**
 * @route   GET /api/factcheck/story/:newsId
 * @desc    Retrieves or runs fact check for an existing news story, including body for mismatch detection
 * @access  Public
 */
router.get('/story/:newsId', async (req, res) => {
  try {
    const { newsId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(newsId)) {
      return res.status(400).json({ message: 'Invalid story ID format' });
    }

    const news = await News.findById(newsId).select('title topic summary content sourceOptions category');
    if (!news) {
      return res.status(404).json({ message: 'Story not found' });
    }

    if (news.category === 'Editorial' || news.category === 'Bolta Hai Bharat') {
      return res.status(404).json({ message: 'Fact check is disabled for Editorial and Bolta Hai Bharat stories' });
    }

    const headline = news.title || news.topic;
    if (!headline) {
      return res.status(400).json({ message: 'Story does not have a valid title to fact check' });
    }

    // Pass article body + pre-fetched sources so fact-check can skip its SerpAPI call
    const result = await runFactCheckPipeline(headline, {
      summary: news.summary,
      content: news.content,
      prebuiltContext: news.sourceOptions || [],
    });

    res.json(result);

  } catch (err) {
    console.error('Fact check story endpoint error:', err.message);
    res.status(500).json({ message: 'Failed to retrieve fact check for story', error: err.message });
  }
});

module.exports = router;
