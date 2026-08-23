require('dotenv').config();
const mongoose = require('mongoose');
const { runTrendingIngestion } = require('./src/services/trending/ingestionOrchestrator');
const { CONFIG_MANUAL } = require('./src/services/trending/ingestionConfig');

async function test() {
  try {
    await mongoose.connect('mongodb+srv://bharatnewsnarratives_db_user:admin%401234@bnn.zzixrad.mongodb.net/?appName=BNN');
    const testDb = mongoose.connection.client.db('test');
    mongoose.connection.db = testDb;
    
    console.log("Starting ingestion...");
    // Just run a small regular config
    const smallConfig = {
      ...CONFIG_MANUAL,
      trendingCategories: [{ id: 14, count: 2, timeRange: 'qdr:h24' }],
      manualPolitics: { count: 1 },
      manualWorld: { count: 0 }
    };
    
    const results = await runTrendingIngestion(smallConfig);
    console.log("Ingestion results:", results.length);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

test();
