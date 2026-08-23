const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const News = require('../src/models/News');

const runTest = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected successfully!');

    // 1. Fetch some existing published politics articles to understand what's in the DB
    console.log('\nFetching some existing published politics articles...');
    const existingPolitics = await News.find({
      category: /politics/i,
      status: 'published'
    }).limit(5).select('title summary tags').lean();

    if (existingPolitics.length === 0) {
      console.log('No published politics articles found in the database. Please publish some first.');
      process.exit(1);
    }

    console.log('Found existing articles:');
    existingPolitics.forEach((art, idx) => {
      console.log(`[${idx}] Title: "${art.title}"`);
      console.log(`    Tags: ${JSON.stringify(art.tags)}`);
    });

    // We will use the first existing article as a reference to create a matching article
    const refArticle = existingPolitics[0];
    console.log(`\nSelected Reference Article: "${refArticle.title}"`);
    console.log(`Reference Tags: ${JSON.stringify(refArticle.tags)}`);

    // Extract some key entities from the reference article to construct our test article
    // Let's create a test article that is clearly related to the reference article
    // We'll copy some words and entities from its title/summary
    const relatedTitle = `Updates on: ${refArticle.title}`;
    const relatedSummary = `This is a follow-up story regarding: ${refArticle.summary || refArticle.title}. More details are emerging.`;

    console.log(`\n--- Test 1: Creating a RELATED Politics Article ---`);
    console.log(`Title: "${relatedTitle}"`);
    console.log(`Summary: "${relatedSummary}"`);

    const relatedNews = new News({
      topic: 'Test Related News',
      title: relatedTitle,
      summary: relatedSummary,
      content: 'Detailed analysis content for the related news item.',
      category: 'Politics',
      status: 'published',
      publishedAt: new Date(),
    });

    await relatedNews.save();
    console.log('Saved related article!');
    console.log('Assigned Tags:', JSON.stringify(relatedNews.tags));

    // Check if the related article copied the reference article's event tag
    const refEventTag = refArticle.tags && refArticle.tags.length > 0 ? refArticle.tags[0] : null;
    const assignedEventTag = relatedNews.tags[0];

    console.log(`Expected Event Tag: "${refEventTag}"`);
    console.log(`Assigned Event Tag: "${assignedEventTag}"`);

    if (refEventTag && assignedEventTag === refEventTag) {
      console.log('SUCCESS: Related article was correctly associated with the existing timeline!');
    } else {
      console.log('WARNING: Event tag did not match. This might happen if the reference article had no tags or similarity score was below threshold.');
    }

    // 2. Create an UNRELATED Politics article
    console.log(`\n--- Test 2: Creating an UNRELATED Politics Article ---`);
    const unrelatedTitle = 'PM Modi Announces New Technology Subsidy in Bihar for Farmers';
    const unrelatedSummary = 'A new scheme targeting technology adoption for small farmers was launched today in Bihar.';
    console.log(`Title: "${unrelatedTitle}"`);
    console.log(`Summary: "${unrelatedSummary}"`);

    const unrelatedNews = new News({
      topic: 'Test Unrelated News',
      title: unrelatedTitle,
      summary: unrelatedSummary,
      content: 'Detailed description of the technology subsidy scheme for farmers in Bihar.',
      category: 'Politics',
      status: 'published',
      publishedAt: new Date(),
    });

    await unrelatedNews.save();
    console.log('Saved unrelated article!');
    console.log('Assigned Tags:', JSON.stringify(unrelatedNews.tags));

    const expectedNewSlug = unrelatedTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50)
      .replace(/-+$/, '');

    console.log(`Expected New Event Tag (slug): "${expectedNewSlug}"`);
    console.log(`Assigned Event Tag: "${unrelatedNews.tags[0]}"`);

    if (unrelatedNews.tags[0].includes(expectedNewSlug.slice(0, 20))) {
      console.log('SUCCESS: Unrelated article correctly started a new timeline with a slugified tag!');
    } else {
      console.log('ERROR: Unrelated article was incorrectly grouped or did not generate a correct slug!');
    }

    // Cleanup: Delete the test articles
    console.log('\nCleaning up test articles from database...');
    await News.deleteOne({ _id: relatedNews._id });
    await News.deleteOne({ _id: unrelatedNews._id });
    console.log('Cleanup completed successfully.');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB. Test complete.');
  } catch (err) {
    console.error('Test execution failed:', err);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
};

runTest();
