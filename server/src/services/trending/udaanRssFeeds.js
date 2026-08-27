/**
 * Optional RSS supplement for the Udaan feed. SerpApi's Google News search
 * for a niche "innovation/founder/grit" query returns a thin candidate pool
 * (see docs/UDAAN_VERTICAL_SPEC.md §4.3). This pulls additional candidates
 * directly from niche startup/impact publications' RSS feeds, normalized to
 * the same shape fetchCategoryArticles() returns, so they flow through the
 * exact same dedup -> Gemini -> publish pipeline unchanged.
 *
 * Off by default — set UDAAN_RSS_ENABLED=true to turn on. These
 * publications are themselves the incumbents named in the vertical's own
 * business case (spec §2.1), so this is closer to aggregating their
 * coverage than independent discovery; that tradeoff is why it's
 * flag-gated rather than always-on.
 */

const Parser = require('rss-parser');
const { isFresh } = require('../../utils/textHelpers');

const RSS_FEEDS = [
  { url: 'https://www.thebetterindia.com/feed/', source: 'The Better India' },
  { url: 'https://yourstory.com/feed', source: 'YourStory' },
];

const FRESHNESS_HOURS = 168; // 7 days — matches the widened Udaan SerpApi window

const extractThumbnail = (item) => {
  const html = item['content:encoded'] || item.content || '';
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
};

const fetchOneFeed = async (parser, feedConfig) => {
  try {
    const feed = await parser.parseURL(feedConfig.url);
    return (feed.items || [])
      .map((item) => ({
        source: feedConfig.source,
        title: item.title || '',
        snippet: item.contentSnippet || item.summary || '',
        link: item.link || item.guid || null,
        thumbnail: extractThumbnail(item),
        publishedAt: item.pubDate || item.isoDate || null,
      }))
      .filter((a) => Boolean(a.link) && Boolean(a.title) && isFresh(a.publishedAt, FRESHNESS_HOURS));
  } catch (err) {
    console.warn(`[Udaan RSS] Failed to fetch "${feedConfig.source}": ${err.message}`);
    return [];
  }
};

/**
 * Returns [] immediately (no network calls) unless UDAAN_RSS_ENABLED=true.
 */
const fetchUdaanRssArticles = async () => {
  if (process.env.UDAAN_RSS_ENABLED !== 'true') return [];

  const parser = new Parser();
  const results = await Promise.all(RSS_FEEDS.map((f) => fetchOneFeed(parser, f)));
  const articles = results.flat();
  console.log(`[Udaan RSS] Fetched ${articles.length} article(s) from ${RSS_FEEDS.length} RSS feed(s).`);
  return articles;
};

module.exports = { fetchUdaanRssArticles, RSS_FEEDS };
