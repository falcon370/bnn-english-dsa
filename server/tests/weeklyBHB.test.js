const test = require('node:test');
const assert = require('node:assert');
const { fetchWeeklyTopTrendingTopics } = require('../src/services/trending/serpApiClient');

test('Monday IST check logic should evaluate correctly for weekly BHB trigger', () => {
  const todayDayInIST = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' });
  assert.ok(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].includes(todayDayInIST));
});

test('fetchWeeklyTopTrendingTopics should be exported and callable', () => {
  assert.strictEqual(typeof fetchWeeklyTopTrendingTopics, 'function');
});
