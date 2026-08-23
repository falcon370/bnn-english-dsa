const test = require('node:test');
const assert = require('node:assert/strict');

// 1. Mock SerpAPI and Gemini before requiring factCheckService
const serpApiClient = require('../src/services/trending/serpApiClient');
const geminiClient = require('../src/services/trending/geminiClient');

let serpRequestCalled = false;
let serpRequestQuery = '';
serpApiClient.serpRequest = async (params) => {
  serpRequestCalled = true;
  serpRequestQuery = params.q;
  return {
    organic_results: [
      {
        title: 'BJP wins West Bengal Election 2026',
        snippet: 'BJP secured a landslide victory in West Bengal winning 208 seats.',
        source: 'Wikipedia',
        date: 'May 4, 2026'
      }
    ]
  };
};

let callGeminiPrompt = '';
geminiClient.callGemini = async (prompt) => {
  callGeminiPrompt = prompt;
  return {
    text: JSON.stringify({
      aiScore: 90,
      verdict: 'Credible',
      aiVerdict: 'The search results confirm BJP won the 2026 West Bengal election.',
      aiSignals: {
        sensationalism: 10,
        attribution: 90,
        consistency: 95,
        credibility: 90,
        coherence: 95
      },
      aiFlags: ['Verifiable', 'Search matched']
    })
  };
};

// 2. Set environment variables to enable the SerpAPI path
process.env.SERPAPI_KEY = 'mock-key';
process.env.GOOGLE_API_KEY = 'mock-key';

// 3. Import factCheckService
const { runFactCheckPipeline } = require('../src/services/factCheckService');
const FactCheck = require('../src/models/FactCheck');

// Mock mongoose/MongoDB model to prevent db calls
const mongoose = require('mongoose');
FactCheck.findOne = async () => null;
FactCheck.prototype.save = async function() {
  return this;
};

test('runFactCheckPipeline calls SerpAPI and passes context to Gemini', async () => {
  const headline = 'BJP Secures Government in West Bengal and Assam, NDA Retains Puducherry';
  const result = await runFactCheckPipeline(headline);

  assert.equal(serpRequestCalled, true);
  assert.equal(serpRequestQuery, headline);
  
  // Verify that the prompt contains the real-time search context
  assert.match(callGeminiPrompt, /Real-Time Google Search Context/);
  assert.match(callGeminiPrompt, /BJP wins West Bengal Election 2026/);
  assert.match(callGeminiPrompt, /Wikipedia/);

  // Verify the returned result has our mocked values
  assert.equal(result.aiScore, 90);
  assert.equal(result.verdict, 'Credible');
});
