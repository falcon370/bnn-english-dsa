const axios = require('axios');
const Epaper = require('../models/Epaper');

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;
const GCP_REGION = process.env.GCP_REGION || 'asia-south1';
const EPAPER_JOB_NAME = process.env.EPAPER_JOB_NAME || 'epaper-service';

const getGcpAccessToken = async () => {
  const response = await axios.get(
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    { headers: { 'Metadata-Flavor': 'Google' }, timeout: 5000 }
  );
  return response.data.access_token;
};

const triggerEpaperGeneration = async (editionDate = null, opts = {}) => {
  if (!GCP_PROJECT_ID) {
    throw new Error('[ePaper] GCP_PROJECT_ID env var not set');
  }

  const accessToken = await getGcpAccessToken();

  // Pass env overrides only for the values explicitly requested.
  const env = [];
  if (editionDate) env.push({ name: 'EDITION_DATE', value: editionDate });
  if (opts.headerStoryId) env.push({ name: 'HEADER_STORY_ID', value: String(opts.headerStoryId) });
  if (opts.politicsStoryIds?.length) env.push({ name: 'POLITICS_STORY_IDS', value: opts.politicsStoryIds.join(',') });

  const body = env.length ? { overrides: { containerOverrides: [{ env }] } } : {};

  const url = `https://run.googleapis.com/v2/projects/${GCP_PROJECT_ID}/locations/${GCP_REGION}/jobs/${EPAPER_JOB_NAME}:run`;

  const response = await axios.post(url, body, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    timeout: 30000
  });

  console.log(`[ePaper] Cloud Run Job triggered: ${response.data.name}`);
  return { success: true, operation: response.data.name };
};

const getEpaperStatus = async () => {
  const latest = await Epaper.findLatest();
  const stats = await Epaper.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        generating: { $sum: { $cond: [{ $eq: ['$status', 'generating'] }, 1, 0] } }
      }
    }
  ]);

  return {
    latestEdition: latest,
    stats: stats[0] || { total: 0, completed: 0, failed: 0, generating: 0 }
  };
};

module.exports = { triggerEpaperGeneration, getEpaperStatus };
