const router = require('express').Router();
const {
  createAuthor,
  getAuthors,
  getAuthorById,
  updateAuthor,
} = require('../controllers/authorController');
const { requireAuth } = require('../middleware/auth');

router.post('/', requireAuth('admin'), createAuthor);
router.get('/', getAuthors);
router.get('/:id', getAuthorById);
router.patch('/:id', requireAuth('admin'), updateAuthor);

module.exports = router;
