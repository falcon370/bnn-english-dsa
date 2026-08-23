require('dotenv').config();
const axios = require('axios');

async function getIgId() {
  try {
    const isInstagramLogin = !!process.env.INSTAGRAM_ACCESS_TOKEN;
    const token = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

    if (isInstagramLogin) {
        console.log("Using Instagram Login Access Token...");
        const url = `https://graph.instagram.com/v19.0/me?fields=user_id,username&access_token=${token}`;
        const res = await axios.get(url);
        
        if (res.data.user_id) {
            console.log("Found your Instagram User ID:");
            console.log(res.data.user_id);
            console.log(`Username: ${res.data.username}`);
            console.log("\nAdd this to your .env file as:");
            console.log(`INSTAGRAM_BUSINESS_ACCOUNT_ID=${res.data.user_id}`);
        } else {
            console.log("Could not find Instagram User ID from token response:", res.data);
        }
    } else {
        console.log("Using Facebook Page Access Token...");
        const pageId = process.env.FACEBOOK_PAGE_ID;
        if (!pageId || !token) {
            console.error("Missing FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN in .env");
            return;
        }
        const url = `https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${token}`;
        const res = await axios.get(url);
        
        if (res.data.instagram_business_account) {
            console.log("Found your Instagram Business Account ID:");
            console.log(res.data.instagram_business_account.id);
            console.log("\nAdd this to your .env file as:");
            console.log(`INSTAGRAM_BUSINESS_ACCOUNT_ID=${res.data.instagram_business_account.id}`);
        } else {
            console.log("No Instagram Business Account is currently linked to this Facebook Page.");
        }
    }
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}
getIgId();
