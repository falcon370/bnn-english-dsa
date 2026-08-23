const express = require('express');
const { execFile } = require('child_process');
const path = require('path');

const router = express.Router();

// Simple in-memory cache: { "topic_days": { data: {}, timestamp: Date.now() } }
const cache = {};
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

router.get('/', (req, res) => {
  let { topic, days } = req.query;
  topic = topic || "";

  const daysInt = parseInt(days, 10) || 5;
  const cacheKey = `${topic}_${daysInt}`.toLowerCase();

  // Check cache
  if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < CACHE_TTL)) {
    console.log(`[Timeline] Serving from cache for key: ${cacheKey}`);
    return res.json(cache[cacheKey].data);
  }

  console.log(`[Timeline] Processing new timeline for topic: ${topic}, days: ${daysInt}`);
  
  const scriptPath = path.join(__dirname, '../../scripts/news_timeline_pipeline.py');
  
  // Pass env to child process to ensure SERPAPI_KEY is available if needed
  execFile('python', [scriptPath, '--topic', topic, '--days', daysInt], { maxBuffer: 1024 * 1024 * 5, env: process.env }, (error, stdout, stderr) => {
    if (error) {
      console.error(`[Timeline] Execution error: ${error.message}`);
      return res.status(500).json({ error: 'Failed to process timeline', details: stderr || error.message });
    }
    
    if (stderr) {
      console.warn(`[Timeline] Script stderr: ${stderr}`);
    }
    
    try {
      const result = JSON.parse(stdout);
      
      if (result.error) {
        return res.status(500).json({ error: result.error });
      }
      
      // Update cache
      cache[cacheKey] = {
        data: result,
        timestamp: Date.now()
      };
      
      res.json(result);
    } catch (parseError) {
      console.error(`[Timeline] JSON parse error: ${parseError.message}`);
      res.status(500).json({ error: 'Invalid response from pipeline' });
    }
  });
});

module.exports = router;
