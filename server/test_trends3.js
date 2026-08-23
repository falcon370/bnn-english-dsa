const { getJson } = require('serpapi');

async function checkTrending(apiKey) {
  try {
    const json = await getJson({ 
      api_key: apiKey, 
      engine: 'google_trends_trending_now',
      geo: 'IN',
      hours: '24',
      category_id: 14 // Politics
    });
    console.log(`Success! Found ${json.trending_searches ? json.trending_searches.length : 0} trending topics`);
    if (json.trending_searches && json.trending_searches.length > 0) {
      console.log('Sample:', json.trending_searches[0].query);
    } else {
      console.log('Full JSON:', JSON.stringify(json, null, 2));
    }
  } catch (error) {
    console.log(`Exception: ${error.message || JSON.stringify(error)}`);
  }
}

// using a known working telugu key
checkTrending('4c94365ab511fcec551db5b29fd28e424b29099fbe97a98b426b23b0f6e7b2aa');
