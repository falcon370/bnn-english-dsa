const Epaper = require('../models/Epaper');
const path = require('path');
const fs = require('fs').promises;
const { triggerEpaperGeneration } = require('../services/epaperService');

const isHttpUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);

// Get all e-paper editions
const getEpaperList = async (req, res) => {
  try {
    const editions = await Epaper.find({ status: 'completed' })
      .sort({ editionDate: -1 })
      .select('editionDate filename filePath thumbnailPath gcsUri fileSize articleCount categoryCount categories status createdAt')
      .lean();

    res.json(editions);
  } catch (error) {
    console.error('Error fetching e-paper list:', error);
    res.status(500).json({ message: 'Failed to fetch e-paper editions' });
  }
};

// Get specific e-paper edition details
const getEpaperById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid e-paper ID' });
    }

    const edition = await Epaper.findById(id).lean();

    if (!edition) {
      return res.status(404).json({ message: 'E-paper edition not found' });
    }

    res.json(edition);
  } catch (error) {
    console.error('Error fetching e-paper by ID:', error);
    res.status(500).json({ message: 'Failed to fetch e-paper edition' });
  }
};

// Download e-paper PDF file
const downloadEpaper = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid e-paper ID' });
    }

    const edition = await Epaper.findById(id);

    if (!edition) {
      return res.status(404).json({ message: 'E-paper edition not found' });
    }

    if (edition.status !== 'completed') {
      return res.status(400).json({ message: 'E-paper edition is not ready for download' });
    }

    if (isHttpUrl(edition.filePath)) {
      return res.redirect(302, edition.filePath);
    }

    // Check if file exists
    try {
      await fs.access(edition.filePath);
    } catch (error) {
      console.error('E-paper file not found on disk:', edition.filePath);
      return res.status(404).json({ message: 'E-paper file not found' });
    }

    // Set appropriate headers for PDF download
    const filename = `epaper-${edition.editionDate.toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', edition.fileSize);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    // Stream the file
    const fileStream = require('fs').createReadStream(edition.filePath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('Error streaming e-paper file:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error streaming file' });
      }
    });

  } catch (error) {
    console.error('Error downloading e-paper:', error);
    res.status(500).json({ message: 'Failed to download e-paper' });
  }
};

// Get e-paper thumbnail
const getEpaperThumbnail = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid e-paper ID' });
    }

    const edition = await Epaper.findById(id);

    if (!edition) {
      return res.status(404).json({ message: 'E-paper edition not found' });
    }

    if (!edition.thumbnailPath) {
      return res.status(404).json({ message: 'Thumbnail not available' });
    }

    if (isHttpUrl(edition.thumbnailPath)) {
      return res.redirect(302, edition.thumbnailPath);
    }

    // Check if thumbnail file exists
    try {
      await fs.access(edition.thumbnailPath);
    } catch (error) {
      console.error('E-paper thumbnail not found on disk:', edition.thumbnailPath);
      return res.status(404).json({ message: 'Thumbnail file not found' });
    }

    // Stream the thumbnail
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const fileStream = require('fs').createReadStream(edition.thumbnailPath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('Error streaming thumbnail:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error streaming thumbnail' });
      }
    });

  } catch (error) {
    console.error('Error fetching thumbnail:', error);
    res.status(500).json({ message: 'Failed to fetch thumbnail' });
  }
};

// Create new e-paper edition (for internal use by generator)
const createEpaperEdition = async (req, res) => {
  try {
    const {
      editionDate,
      filename,
      filePath,
      thumbnailPath,
      fileSize,
      articleCount,
      categoryCount,
      categories,
      gcsUri,
      gcsBucket,
      gcsPrefix,
      generationTime
    } = req.body;

    // Validate required fields
    if (!editionDate || !filename || !filePath || !articleCount || !categoryCount) {
      return res.status(400).json({
        message: 'Missing required fields: editionDate, filename, filePath, articleCount, categoryCount'
      });
    }

    // Check if edition already exists
    const existingEdition = await Epaper.findOne({ editionDate: new Date(editionDate) });
    if (existingEdition) {
      return res.status(409).json({ message: 'E-paper edition already exists for this date' });
    }

    // Create new edition
    const edition = new Epaper({
      editionDate: new Date(editionDate),
      filename,
      filePath,
      thumbnailPath,
      fileSize: fileSize || 0,
      articleCount,
      categoryCount,
      categories: categories || [],
      status: 'completed',
      gcsUri,
      gcsBucket,
      gcsPrefix,
      generationTime: generationTime || 0
    });

    await edition.save();

    res.status(201).json({
      message: 'E-paper edition created successfully',
      edition
    });

  } catch (error) {
    console.error('Error creating e-paper edition:', error);
    res.status(500).json({ message: 'Failed to create e-paper edition' });
  }
};

// Update e-paper edition status (for internal use)
const updateEpaperStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, errorMessage } = req.body;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid e-paper ID' });
    }

    const edition = await Epaper.findById(id);
    if (!edition) {
      return res.status(404).json({ message: 'E-paper edition not found' });
    }

    edition.status = status;
    if (errorMessage) {
      edition.errorMessage = errorMessage;
    }

    await edition.save();

    res.json({
      message: 'E-paper status updated successfully',
      edition
    });

  } catch (error) {
    console.error('Error updating e-paper status:', error);
    res.status(500).json({ message: 'Failed to update e-paper status' });
  }
};

// Get e-paper statistics
const getEpaperStats = async (req, res) => {
  try {
    const stats = await Epaper.aggregate([
      {
        $group: {
          _id: null,
          totalEditions: { $sum: 1 },
          completedEditions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          failedEditions: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          totalArticles: { $sum: '$articleCount' },
          avgGenerationTime: { $avg: '$generationTime' },
          latestEdition: { $max: '$editionDate' }
        }
      }
    ]);

    const result = stats[0] || {
      totalEditions: 0,
      completedEditions: 0,
      failedEditions: 0,
      totalArticles: 0,
      avgGenerationTime: 0,
      latestEdition: null
    };

    res.json(result);

  } catch (error) {
    console.error('Error fetching e-paper stats:', error);
    res.status(500).json({ message: 'Failed to fetch e-paper statistics' });
  }
};

const registerEpaper = async (req, res) => {
  try {
    const { editionDate, filename, fileSize, thumbnailGenerated } = req.body;

    if (!editionDate || !filename) {
      return res.status(400).json({
        success: false,
        message: 'editionDate and filename are required'
      });
    }

    const dateObj = new Date(editionDate + 'T00:00:00.000Z');
    const GCS_BUCKET = process.env.GCS_BUCKET || 'bnn-epaper';
    const GCS_PREFIX = process.env.GCS_PREFIX || 'epaper';
    const filePath = `https://storage.googleapis.com/${GCS_BUCKET}/${GCS_PREFIX}/${filename}`;
    const thumbnailFilename = filename.replace('.pdf', '-thumb.jpg');
    const thumbnailPath = thumbnailGenerated
      ? `https://storage.googleapis.com/${GCS_BUCKET}/${GCS_PREFIX}/${thumbnailFilename}`
      : null;

    const articleCount = 50;
    const categoryCount = 6;

    const recordData = {
      editionDate: dateObj,
      filename,
      filePath,
      thumbnailPath,
      gcsUri: `gs://${GCS_BUCKET}/${GCS_PREFIX}/${filename}`,
      gcsBucket: GCS_BUCKET,
      gcsPrefix: GCS_PREFIX,
      fileSize: fileSize || 0,
      articleCount,
      categoryCount,
      categories: ['Politics', 'Sports', 'Tech', 'Business', 'Entertainment', 'General'],
      status: 'completed',
      generationTime: 0 // Will be updated by the service
    };

    // Upsert the record
    const existingRecord = await Epaper.findOneAndUpdate(
      { editionDate: dateObj },
      recordData,
      { upsert: true, new: true }
    );

    console.log(`[ePaper] Registered new edition: ${editionDate}`);

    res.json({
      success: true,
      data: existingRecord,
      message: 'e-paper registered successfully'
    });

  } catch (error) {
    console.error('Error registering e-paper:', error);
    res.status(500).json({ success: false, message: 'Failed to register e-paper' });
  }
};

// Manually trigger e-paper generation
const triggerGeneration = async (req, res) => {
  try {
    const { editionDate, force, headerStoryId, politicsStoryIds } = req.body;

    // Validate picks — they become Cloud Run Job env values, so only allow
    // well-formed 24-hex MongoDB ObjectIds through.
    const isObjId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);
    const safeHeader = isObjId(headerStoryId) ? headerStoryId : null;
    const safePolitics = Array.isArray(politicsStoryIds) ? politicsStoryIds.filter(isObjId) : [];

    // If force=true, delete existing record and files for that date
    if (force) {
      const targetDate = editionDate
        ? new Date(editionDate + 'T00:00:00.000Z')
        : new Date(new Date().toISOString().split('T')[0] + 'T00:00:00.000Z');

      const existing = await Epaper.findOne({ editionDate: targetDate });
      if (existing) {
        // Delete PDF file
        try { await fs.unlink(existing.filePath); } catch (_) {}
        // Delete thumbnail
        if (existing.thumbnailPath) {
          try { await fs.unlink(existing.thumbnailPath); } catch (_) {}
        }
        await Epaper.deleteOne({ _id: existing._id });
        console.log(`[ePaper] Removed existing edition for ${targetDate.toISOString().split('T')[0]}`);
      }
    }

    // Respond immediately — generation runs in background
    res.json({ message: 'E-paper generation started', editionDate: editionDate || 'today' });

    triggerEpaperGeneration(editionDate || null, {
      headerStoryId: safeHeader,
      politicsStoryIds: safePolitics,
    }).catch((err) => {
      console.error('[ePaper] Background generation failed:', err.message);
    });
  } catch (error) {
    console.error('Error triggering e-paper generation:', error);
    res.status(500).json({ message: 'Failed to trigger generation' });
  }
};

// Delete an e-paper edition (record + files)
const deleteEpaper = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid e-paper ID' });
    }

    const edition = await Epaper.findById(id);
    if (!edition) {
      return res.status(404).json({ message: 'E-paper edition not found' });
    }

    // Delete local files if paths are on disk
    if (!isHttpUrl(edition.filePath)) {
      try { await fs.unlink(edition.filePath); } catch (_) {}
    }
    if (edition.thumbnailPath && !isHttpUrl(edition.thumbnailPath)) {
      try { await fs.unlink(edition.thumbnailPath); } catch (_) {}
    }

    await Epaper.deleteOne({ _id: id });

    res.json({ message: 'E-paper edition deleted successfully' });
  } catch (error) {
    console.error('Error deleting e-paper:', error);
    res.status(500).json({ message: 'Failed to delete e-paper edition' });
  }
};

const runScheduledEpaper = async (req, res) => {
  try {
    console.log(`[ePaper Scheduled] Triggered by Cloud Scheduler at ${new Date().toISOString()}`);
    const result = await triggerEpaperGeneration();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[ePaper Scheduled] Generation failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
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
  runScheduledEpaper,
};