/**
 * Barrel file for the trending ingestion service.
 * Re-exports the public API so consumers can simply:
 *    const { runTrendingIngestion, ... } = require('../services/trending');
 */

const { runTrendingIngestion, refreshCategoryFeeds, generateNewsFromTopic, generateDailyBoltaHaiBharat, generateDailyBoltaHaiBharatFromTrending } = require('./ingestionOrchestrator');
const { CONFIG_1AM, CONFIG_REGULAR, CONFIG_MANUAL_5 } = require('./ingestionConfig');

module.exports = {
  runTrendingIngestion,
  refreshCategoryFeeds,
  generateNewsFromTopic,
  generateDailyBoltaHaiBharat,
  generateDailyBoltaHaiBharatFromTrending,
  CONFIG_1AM,
  CONFIG_REGULAR,
  CONFIG_MANUAL_5,
};

