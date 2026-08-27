const router = require('express').Router();
const {
  getPublishedNews,
  getDraftNews,
  getNewsDetail,
  getRelatedNews,
  publishNews,
  addComment,
  deleteComment,
  deleteNews,
  generateNews,
  createEditorial,
  updateNews,
  getReactedNews,
  toggleReaction,
} = require('../controllers/newsController');
const { requireAuth } = require('../middleware/auth');
const { runTrendingIngestion, refreshCategoryFeeds } = require('../services/trending');

// Manual ingestion trigger
router.post('/trigger-ingestion', requireAuth(['admin']), async (req, res) => {
  try {
    res.json({ message: 'Ingestion started' });
    await runTrendingIngestion();
    await refreshCategoryFeeds();
  } catch (err) {
    console.error('Manual ingestion failed:', err.message);
  }
});

router.get('/my-reactions', requireAuth(), getReactedNews);
router.get('/', getPublishedNews);
router.get('/drafts', requireAuth(['admin']), getDraftNews);
router.post('/generate', requireAuth(['admin']), generateNews);
router.post('/editorial', requireAuth(['admin']), createEditorial);
router.get('/:id', getNewsDetail);
router.get('/:id/related', getRelatedNews);
router.patch('/:id/publish', requireAuth(['admin']), publishNews);
router.patch('/:id', requireAuth(['admin']), updateNews);
router.post('/:id/react', requireAuth(), toggleReaction);
router.post('/:id/comments', requireAuth(), addComment);
router.delete('/:id/comments/:commentId', requireAuth(), deleteComment);
router.delete('/:id', requireAuth(['admin']), deleteNews);

module.exports = router;
