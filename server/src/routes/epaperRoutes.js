const router = require('express').Router();
const {
  getEpaperList,
  getEpaperById,
  downloadEpaper,
  getEpaperThumbnail,
  createEpaperEdition,
  updateEpaperStatus,
  getEpaperStats,
  registerEpaper,
  triggerGeneration,
  deleteEpaper,
} = require('../controllers/epaperController');
const { requireAuth } = require('../middleware/auth');

// Public routes
router.get('/', getEpaperList);
router.get('/:id', getEpaperById);
router.get('/:id/download', downloadEpaper);
router.get('/:id/thumbnail', getEpaperThumbnail);
router.post('/register', registerEpaper); // Called by epaper-printer service

// Admin-only routes for managing editions
router.post('/', requireAuth(['admin']), createEpaperEdition);
router.post('/trigger', requireAuth(['admin']), triggerGeneration);
router.patch('/:id/status', requireAuth(['admin']), updateEpaperStatus);
router.delete('/:id', requireAuth(['admin']), deleteEpaper);

// Stats endpoint (public for now, could be admin-only)
router.get('/stats/summary', getEpaperStats);

module.exports = router;