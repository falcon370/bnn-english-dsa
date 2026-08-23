const router = require('express').Router();
const { register, login, me, updateProfile } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', requireAuth(), me);
router.put('/me', requireAuth(), updateProfile);

module.exports = router;

