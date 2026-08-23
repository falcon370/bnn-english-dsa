const mongoose = require('mongoose');
const News = require('./src/models/News');
const { postToFacebook, postToInstagram } = require('./src/services/socialMediaService');
require('dotenv').config();

async function triggerPost() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/news_final');
    console.log('[Manual Trigger] Connected to MongoDB.');

    // Find the latest published news item that needs posting to either platform
    const newsItem = await News.findOne({
      status: 'published',
      sociallyPosted: { $ne: true },
      $or: [
        { facebookPosted: { $ne: true } },
        { instagramPosted: { $ne: true } }
      ]
    }).sort({ createdAt: -1 });

    let targetItem = newsItem;

    if (!targetItem) {
      console.log('[Manual Trigger] No unposted news found. Checking most recent published item regardless of post status...');
      targetItem = await News.findOne({ status: 'published' }).sort({ createdAt: -1 });
      
      if (!targetItem) {
        console.log('[Manual Trigger] No published news found in DB.');
        await mongoose.connection.close();
        return;
      }
      console.log(`[Manual Trigger] Posting most recent published item: "${targetItem.title || targetItem.topic}"`);
    } else {
      console.log(`[Manual Trigger] Posting latest unposted item: "${targetItem.title || targetItem.topic}"`);
    }

    let fbSuccess = false;
    let igSuccess = false;

    // Only post to Facebook if not already posted (or if it's a fallback item)
    if (!targetItem.facebookPosted || !newsItem) {
      const fbResult = await postToFacebook(targetItem);
      fbSuccess = fbResult === true || (fbResult && fbResult.success === true);
      if (fbSuccess && newsItem) {
        targetItem.facebookPosted = true;
      }
    } else {
      console.log('[Manual Trigger] Already posted to Facebook. Skipping Facebook.');
      fbSuccess = true;
    }

    // Only post to Instagram if not already posted (or if it's a fallback item)
    if (!targetItem.instagramPosted || !newsItem) {
      const igResult = await postToInstagram(targetItem);
      igSuccess = igResult && igResult.success === true;
      if (igSuccess && newsItem) {
        targetItem.instagramPosted = true;
      }
    } else {
      console.log('[Manual Trigger] Already posted to Instagram. Skipping Instagram.');
      igSuccess = true;
    }

    if (newsItem && (fbSuccess || igSuccess)) {
      if (targetItem.facebookPosted && targetItem.instagramPosted) {
        targetItem.sociallyPosted = true;
      }
      await targetItem.save();
      console.log(`[Manual Trigger] Successfully updated status (facebookPosted=${targetItem.facebookPosted}, instagramPosted=${targetItem.instagramPosted}, sociallyPosted=${targetItem.sociallyPosted}).`);
    } else {
      console.log('[Manual Trigger] Did not update status.');
    }

    await mongoose.connection.close();
    console.log('[Manual Trigger] Done.');
  } catch (error) {
    console.error('[Manual Trigger Error]:', error);
    process.exit(1);
  }
}

triggerPost();
