require('dotenv').config();
process.env.SERPAPI_KEYS = '4c94365ab511fcec551db5b29fd28e424b29099fbe97a98b426b23b0f6e7b2aa';

const mongoose = require('mongoose');
const { runTrendingIngestion } = require('./src/services/trending/ingestionOrchestrator');
const { CONFIG_REGULAR } = require('./src/services/trending/ingestionConfig');

async function test() {
  try {
    await mongoose.connect('mongodb+srv://bharatnewsnarratives_db_user:admin%401234@bnn.zzixrad.mongodb.net/?appName=BNN');
    const testDb = mongoose.connection.client.db('test');
    mongoose.connection.db = testDb;
    
    console.log("Starting ingestion with CONFIG_REGULAR...");
    const results = await runTrendingIngestion(CONFIG_REGULAR);
    console.log("Ingestion results:", results.length);
    process.exit(0);
  } catch (err) {
    console.error("FATAL ERROR:", err);
    process.exit(1);
  }
}

test();
