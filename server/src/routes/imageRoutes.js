const express = require('express');
const { searchImages } = require('../controllers/imageController');

const router = express.Router();

router.get('/search', searchImages);
router.post('/search', searchImages);

module.exports = router;
