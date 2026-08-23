const mongoose = require('mongoose');

async function check() {
  try {
    await mongoose.connect('mongodb+srv://bharatnewsnarratives_db_user:admin%401234@bnn.zzixrad.mongodb.net/?appName=BNN');
    const testDb = mongoose.connection.client.db('test');
    
    console.log("--- Latest News (Last 3) ---");
    const news = await testDb.collection('news').find().sort({ createdAt: -1 }).limit(3).toArray();
    news.forEach(n => console.log(`[${n.createdAt}] ${n.title} (Trending: ${n.isTrending})`));
    
    console.log("\n--- Latest Run Logs (Last 5) ---");
    const logs = await testDb.collection('runlogs').find().sort({ $natural: -1 }).limit(5).toArray();
    logs.forEach(l => console.log(l));

    console.log("\n--- System Status ---");
    const sys = await testDb.collection('systemstatuses').findOne({ _id: 'ingestion_status' });
    console.log(sys);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
