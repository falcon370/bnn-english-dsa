const express = require('express');
const router = express.Router();
const { processPendingSocialPosts } = require('../services/socialMediaService');

// Secure endpoint to trigger one social media post
router.post('/trigger', async (req, res) => {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.authorization;

    if (!cronSecret) {
        console.error('[Social Media API] CRON_SECRET is not configured on the server.');
        return res.status(500).json({ error: 'Server misconfiguration: CRON_SECRET missing' });
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        console.warn(`[Social Media API] Unauthorized access attempt detected.`);
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        console.log('[Social Media API] Trigger received, running poster...');
        // processPendingSocialPosts handles finding exactly 1 item and posting it
        const result = await processPendingSocialPosts();
        
        const hasPublishingError = result.fbError || result.igError;

        if (!hasPublishingError) {
            return res.status(200).json({ 
                status: 'success', 
                message: result.message, 
                itemId: result.itemId
            });
        } else {
            console.error('[Social Media API] Posting failed:', result.message, {
                fbError: result.fbError,
                igError: result.igError
            });
            return res.status(500).json({ 
                status: 'error', 
                message: result.message, 
                fbError: result.fbError,
                igError: result.igError
            });
        }
    } catch (err) {
        console.error('[Social Media API] Internal Server Error:', err);
        return res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

module.exports = router;
