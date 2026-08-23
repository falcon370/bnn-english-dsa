const { getJson } = require('serpapi');

async function checkTrending(apiKey) {
  try {
    const json = await getJson({ 
      api_key: apiKey, 
      engine: 'google',
      q: 'test'
    });
    console.log(`${apiKey.slice(0, 6)}... -> Success!`);
  } catch (error) {
    if (typeof error === 'string') {
      console.log(`${apiKey.slice(0, 6)}... -> String Exception: ${error}`);
    } else {
      console.log(`${apiKey.slice(0, 6)}... -> Exception: ${error.message || JSON.stringify(error)}`);
    }
  }
}

async function run() {
  const keys = [
    '34d8e35a522fd77ae1236fcd97b1fe40c3fbdbbd6b7c52ba1014157eeb773a0b',
    '4c94365ab511fcec551db5b29fd28e424b29099fbe97a98b426b23b0f6e7b2aa',
    '6761a9f9c4f619643d3b6701a0de4272748718329eda0240d9431c1ef9761b9b',
    '50db407ec006fd95295c0b5ada88204082d8719cd8fbddd0e74488e2e65c4576',
    '9eedcabbb95798a6276cbe2f0f214b8fc21bcd37fa7a733b098371001d4e9621',
    '95bd2e48d6f1fb7ff6e1277b4ede2969eeba7e828dc0f1879a5b89c0fba97e56'
  ];
  for (const k of keys) {
    await checkTrending(k);
  }
}
run();
