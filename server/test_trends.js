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

checkTrending('34d8e35a522fd77ae1236fcd97b1fe40c3fbdbbd6b7c52ba1014157eeb773a0b');
