const mongoose = require('mongoose');
require('dotenv').config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const News = mongoose.model('News', new mongoose.Schema({}, { strict: false }));

        const result = await News.updateMany(
            { status: 'draft' },
            { $set: { status: 'published', publishedAt: new Date() } }
        );

        console.log(`Updated ${result.modifiedCount} news items to published.`);
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

run();
