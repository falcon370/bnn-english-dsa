const { searchImagesByText } = require('../services/imageSearchService');

const searchImages = async (req, res) => {
  try {
    const query = req.query.q || req.body.query;
    const limit = req.query.limit || req.body.limit;
    const results = await searchImagesByText(query, { limit });
    res.json({ query, count: results.length, results });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      message: statusCode === 500 ? 'Image search failed' : error.message,
    });
  }
};

module.exports = {
  searchImages,
};
