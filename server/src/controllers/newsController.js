const News = require('../models/News');
const mongoose = require('mongoose');
const { generateNewsFromTopic } = require('../services/trending');
const { runFactCheckPipeline } = require('../services/factCheckService');
const { EmbeddingClient } = require('../services/embeddingClient');

const NEWS_LIST_FIELDS = 'title summary category imageUrl imageSource publishedAt isTrending primarySource primaryLink selectedSource';
const NEWS_VECTOR_INDEX_NAME = process.env.NEWS_VECTOR_INDEX_NAME || 'news_embedding_vector_index';

const getPublishedNews = async (req, res) => {
  try {
    const { category, page: pageParam, limit: limitParam, q, mode } = req.query;

    const page = Math.max(1, parseInt(pageParam) || 1);
    const limit = Math.min(30, Math.max(1, parseInt(limitParam) || 15));
    const skip = (page - 1) * limit;

    let query = { status: 'published' };

    if (category) {
      // Capitalize each word to match DB values ("politics" → "Politics")
      const titleCase = s => s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const categoryFilter = category.toLowerCase() === 'technology'
        ? { $in: ['Tech', 'Technology'] }
        : titleCase(category);
      query.category = categoryFilter;
    }

    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { summary: { $regex: q, $options: 'i' } },
        { content: { $regex: q, $options: 'i' } }
      ];
    }

    const { days } = req.query;
    if (days) {
      const daysInt = parseInt(days, 10);
      if (!isNaN(daysInt) && daysInt > 0) {
        const dateThreshold = new Date();
        dateThreshold.setDate(dateThreshold.getDate() - daysInt);
        query.publishedAt = { $gte: dateThreshold };
      }
    }

    // Semantic search: embed the query and rank by meaning via the Atlas
    // vector index instead of substring matching. Not true skip-based
    // pagination (page/pages are fixed at 1) — a deliberate simplification.
    // Falls through to the regular keyword path below on any failure
    // (embedding service down, index not created yet), so this can never
    // break search.
    if (mode === 'semantic' && q) {
      try {
        const embeddingClient = new EmbeddingClient();
        const queryVector = await embeddingClient.embed(q);

        const matchStage = { status: 'published' };
        if (query.category) matchStage.category = query.category;

        const news = await News.aggregate([
          {
            $vectorSearch: {
              index: NEWS_VECTOR_INDEX_NAME,
              path: 'embedding',
              queryVector,
              numCandidates: Math.max(limit * 20, 100),
              limit,
            },
          },
          { $match: matchStage },
          {
            $project: {
              title: 1, summary: 1, category: 1, imageUrl: 1, imageSource: 1,
              publishedAt: 1, isTrending: 1, primarySource: 1, primaryLink: 1, selectedSource: 1,
            },
          },
        ]);

        return res.json({ news, total: news.length, page: 1, pages: 1 });
      } catch (semanticErr) {
        console.warn('[Search] Semantic mode failed, falling back to keyword search:', semanticErr.message);
      }
    }

    // Category page or search: paginated fetch filtered by category/search
    if (category || q) {
      const [news, total] = await Promise.all([
        News.find(query)
          .sort({ publishedAt: -1 })
          .skip(skip)
          .limit(limit)
          .select(NEWS_LIST_FIELDS)
          .lean(),
        News.countDocuments(query),
      ]);

      return res.json({ news, total, page, pages: Math.ceil(total / limit) });
    }

    // Homepage: fetch recent articles + guaranteed articles from special categories
    // so that "Bolta Hai Bharat" and "Editorial" sections always have content.
    const GUARANTEED_CATEGORIES = ['Bolta Hai Bharat', 'Editorial'];
    const GUARANTEED_PER_CAT = 10;

    const [mainFeed, ...guaranteedFeeds] = await Promise.all([
      News.find({ status: 'published' })
        .sort({ publishedAt: -1 })
        .limit(150)
        .select('title summary category imageUrl imageSource publishedAt isTrending')
        .lean(),
      ...GUARANTEED_CATEGORIES.map(cat =>
        News.find({ status: 'published', category: cat })
          .sort({ publishedAt: -1 })
          .limit(GUARANTEED_PER_CAT)
          .select('title summary category imageUrl imageSource publishedAt isTrending')
          .lean()
      ),
    ]);

    // Merge: start with main feed, then append guaranteed articles not already present
    const seenIds = new Set(mainFeed.map(n => n._id.toString()));
    const extra = guaranteedFeeds.flat().filter(n => {
      const id = n._id.toString();
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    const news = [...mainFeed, ...extra];

    res.json(news);
  } catch (err) {
    console.error('getPublishedNews error:', err.message);
    res.status(500).json({ message: 'Failed to fetch news' });
  }
};

const getDraftNews = async (req, res) => {
  try {
    const drafts = await News.find({ status: 'draft' }).sort({ createdAt: -1 });
    res.json(drafts);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch drafts', error: err.message });
  }
};


const getNewsDetail = async (req, res) => {
  // Support slug-suffixed IDs like "6a2e4b70bdeef7fcfba0306a-pm-modi-..."
  // The MongoDB ObjectId is always the first 24 hex characters.
  const rawParam = req.params.id || '';
  const objectId = rawParam.slice(0, 24);

  if (!mongoose.Types.ObjectId.isValid(objectId)) {
    return res.status(400).json({ message: 'Invalid news ID' });
  }
  const news = await News.findById(objectId)
    .populate('comments.user', 'name role')
    .populate('author', 'name photoUrl bio');
  if (!news) {
    return res.status(404).json({ message: 'News not found' });
  }
  res.json(news);
};

/**
 * Related stories for a given article. Prefers semantic proximity via the
 * Atlas vector index (News.embedding, populated at ingest time — see
 * server/src/services/udaan/index.js); falls back to a plain category
 * match — the same thing the client used to compute itself — if the story
 * has no embedding yet or the vector search fails for any reason. Never
 * errors out to an empty sidebar for a reason a reader would notice.
 */
const getRelatedNews = async (req, res) => {
  const rawParam = req.params.id || '';
  const objectId = rawParam.slice(0, 24);

  if (!mongoose.Types.ObjectId.isValid(objectId)) {
    return res.status(400).json({ message: 'Invalid news ID' });
  }

  const limit = Math.min(10, Math.max(1, parseInt(req.query.limit) || 5));

  try {
    const story = await News.findById(objectId).select('+embedding category tags').lean();
    if (!story) {
      return res.status(404).json({ message: 'News not found' });
    }

    const category = story.category || story.tags?.[0] || null;

    if (story.embedding && story.embedding.length) {
      try {
        const results = await News.aggregate([
          {
            $vectorSearch: {
              index: NEWS_VECTOR_INDEX_NAME,
              path: 'embedding',
              queryVector: story.embedding,
              numCandidates: Math.max(limit * 20, 100),
              limit: limit + 1, // +1 to absorb self-exclusion below
            },
          },
          { $match: { status: 'published' } },
          {
            $project: {
              title: 1, summary: 1, category: 1, imageUrl: 1, imageSource: 1,
              publishedAt: 1, isTrending: 1, primarySource: 1, primaryLink: 1, selectedSource: 1,
            },
          },
        ]);

        const related = results.filter((r) => String(r._id) !== objectId).slice(0, limit);
        if (related.length) {
          return res.json({ related });
        }
      } catch (vectorErr) {
        console.warn('[getRelatedNews] Vector search failed, falling back to category match:', vectorErr.message);
      }
    }

    const fallback = await News.find({ status: 'published', category, _id: { $ne: objectId } })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .select(NEWS_LIST_FIELDS)
      .lean();

    res.json({ related: fallback });
  } catch (err) {
    console.error('getRelatedNews error:', err.message);
    res.status(500).json({ message: 'Failed to fetch related news' });
  }
};

const publishNews = async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }
    news.status = 'published';
    news.publishedAt = new Date();
    await news.save();
    res.json(news);

    // ── Improvement 1: Auto fact-check on publish ──
    // Runs in background after HTTP response is sent — does not block the editor.
    const headline = news.title || news.topic;
    const isExcludedFromFactCheck = news.category === 'Editorial' || news.category === 'Bolta Hai Bharat';
    if (headline && !isExcludedFromFactCheck) {
      setImmediate(() => {
        runFactCheckPipeline(headline, {
          summary: news.summary,
          content: news.content,
          // Pass pre-fetched source articles so the fact-check pipeline
          // can skip its own SerpAPI call (saves one credit per publish).
          prebuiltContext: news.sourceOptions || [],
        }).then(() => {
          console.log(`[AutoFactCheck] Completed background fact-check for: "${headline}"`);
        }).catch((err) => {
          console.error(`[AutoFactCheck] Failed for "${headline}":`, err.message);
        });
      });
    }
  } catch (err) {
    res.status(500).json({ message: 'Failed to publish news', error: err.message });
  }
};

const addComment = async (req, res) => {
  try {
    const text = (req.body.text || '').trim();
    if (!text) {
      return res.status(400).json({ message: 'Comment text cannot be empty' });
    }
    if (text.length > 1000) {
      return res.status(400).json({ message: 'Comment must be 1000 characters or fewer' });
    }

    const news = await News.findById(req.params.id);
    if (!news || news.status !== 'published') {
      return res.status(404).json({ message: 'News not found' });
    }

    news.comments.push({ user: req.user.id, text });
    await news.save();

    await news.populate('comments.user', 'name role');
    res.status(201).json(news.comments.at(-1));
  } catch (err) {
    res.status(500).json({ message: 'Failed to post comment', error: err.message });
  }
};

const deleteNews = async (req, res) => {
  const news = await News.findByIdAndDelete(req.params.id);
  if (!news) {
    return res.status(404).json({ message: 'News not found' });
  }
  res.json({ message: 'News removed' });
};

const generateNews = async (req, res) => {
  try {
    const { topic, autoPublish = false, authorId } = req.body;
    if (!topic) {
      return res.status(400).json({ message: 'Topic is required' });
    }

    const article = await generateNewsFromTopic({
      topic,
      autoPublish: Boolean(autoPublish),
      authorId: req.user?.id || null,
    });

    // Attach author if provided
    if (authorId) {
      article.author = authorId;
      await article.save();
    }

    res.status(201).json({
      message: autoPublish ? 'News published to feed' : 'Draft ready for review',
      article,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate news', error: error.message });
  }
};

const createEditorial = async (req, res) => {
  try {
    const { title, content, category, imageUrl, authorId } = req.body;
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    const assignedCategory = category && category.trim() ? category : 'Editorial';

    const article = await News.create({
      topic: title.trim(),
      title: title.trim(),
      summary: content.trim().split(/\s+/).slice(0, 30).join(' ') + '…',
      content: content.trim(),
      category: assignedCategory,
      tags: [assignedCategory.toLowerCase(), 'manual'],
      imageUrl: imageUrl && imageUrl.trim() ? imageUrl.trim() : null,
      status: 'published',
      publishedAt: new Date(),
      isTrending: false,
      autoGenerated: false,
      fromNewsApi: false,
      createdBy: req.user?.id || null,
      author: authorId || null,
    });

    res.status(201).json({ message: 'Editorial published', article });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create editorial', error: error.message });
  }
};

const updateNews = async (req, res) => {
  try {
    const { category, title, content, summary, tags, status, imageUrl } = req.body;
    const news = await News.findById(req.params.id);
    if (!news) return res.status(404).json({ message: 'News not found' });

    if (category) news.category = category;
    if (title) news.title = title;
    if (content) news.content = content;
    if (summary) news.summary = summary;
    if (tags) news.tags = tags;
    if (status) news.status = status;
    if (imageUrl) news.imageUrl = imageUrl;

    await news.save();
    res.json({ message: 'News updated successfully', article: news });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update news', error: error.message });
  }
};

const toggleReaction = async (req, res) => {
  try {
    const { type } = req.body;
    const news = await News.findById(req.params.id);
    if (!news) return res.status(404).json({ message: 'News not found' });

    const existingIndex = news.reactions.findIndex(
      (r) => r.user.toString() === req.user.id
    );

    if (existingIndex > -1) {
      if (news.reactions[existingIndex].type === type) {
        // Remove reaction if already same
        news.reactions.splice(existingIndex, 1);
      } else {
        // Change reaction type
        news.reactions[existingIndex].type = type;
      }
    } else {
      // Add new reaction
      news.reactions.push({ user: req.user.id, type });
    }

    await news.save();
    res.json({ message: 'Reaction updated', reactions: news.reactions });
  } catch (error) {
    res.status(500).json({ message: 'Failed to toggle reaction', error: error.message });
  }
};

const getReactedNews = async (req, res) => {
  try {
    const news = await News.find({ 'reactions.user': req.user.id })
      .sort({ updatedAt: -1 })
      .select('title summary category imageUrl publishedAt');
    res.json(news);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch reacted news', error: error.message });
  }
};

const deleteComment = async (req, res) => {
  try {
    const { id: newsId, commentId } = req.params;
    const rawNewsId = (newsId || '').slice(0, 24);

    if (!mongoose.Types.ObjectId.isValid(rawNewsId)) {
      return res.status(400).json({ message: 'Invalid news ID' });
    }

    const news = await News.findById(rawNewsId);
    if (!news) return res.status(404).json({ message: 'News not found' });

    const comment = news.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    // Allow comment owner or admin to delete
    const isOwner = comment.user.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not allowed to delete this comment' });
    }

    comment.deleteOne();
    await news.save();
    res.json({ message: 'Comment deleted', commentId });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete comment', error: err.message });
  }
};

module.exports = {
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
  toggleReaction,
  getReactedNews,
};
