const mongoose = require('mongoose');
const Author = require('../models/Author');
const News = require('../models/News');

const createAuthor = async (req, res) => {
  try {
    const { name, bio, photoUrl, email } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: 'Author name is required' });
    }

    if (email) {
      const existing = await Author.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(400).json({ message: 'An author with this email already exists' });
      }
    }

    const author = await Author.create({
      name: name.trim(),
      bio: bio?.trim() || '',
      photoUrl: photoUrl?.trim() || '',
      email: email?.trim().toLowerCase() || undefined,
      createdBy: req.user?.id || null,
    });

    res.status(201).json({ message: 'Author created', author });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create author', error: error.message });
  }
};

const getAuthors = async (_req, res) => {
  try {
    const authors = await Author.find().sort({ name: 1 }).select('-createdBy');
    res.json(authors);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch authors', error: error.message });
  }
};

const getAuthorById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid author ID' });
    }

    const author = await Author.findById(req.params.id).select('-createdBy');
    if (!author) {
      return res.status(404).json({ message: 'Author not found' });
    }

    const articles = await News.find({ author: author._id, status: 'published' })
      .sort({ publishedAt: -1 })
      .select('title topic summary imageUrl imageSource category tags publishedAt');

    res.json({ author, articles });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch author', error: error.message });
  }
};

const updateAuthor = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid author ID' });
    }

    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    if (req.body.bio !== undefined) updates.bio = req.body.bio.trim();
    if (req.body.photoUrl !== undefined) updates.photoUrl = req.body.photoUrl.trim();
    if (req.body.email !== undefined) updates.email = req.body.email.trim().toLowerCase() || undefined;

    const author = await Author.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!author) {
      return res.status(404).json({ message: 'Author not found' });
    }

    res.json({ message: 'Author updated', author });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update author', error: error.message });
  }
};

module.exports = { createAuthor, getAuthors, getAuthorById, updateAuthor };
