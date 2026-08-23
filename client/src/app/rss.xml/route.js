/**
 * RSS 2.0 Feed Generator — /rss.xml
 *
 * Generates an RSS 2.0 feed for news aggregators, Google News, and feed readers.
 * Returns HTTP 200 XML with Cache-Control headers for performance.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bharatnewsnarratives.com';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

function makeStorySlugInline(article) {
  if (!article?._id) return '/';
  const raw = (article.title || article.topic || '').replace(/^Trending:\s*/i, '');
  const slug = raw
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/-+$/, '');
  return slug ? `/story/${article._id}-${slug}` : `/story/${article._id}`;
}

function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function fetchPublishedArticles() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/news`, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const all = Array.isArray(data) ? data : (data.news ?? data.articles ?? []);
    return all.filter((a) => a._id && (a.status === 'published' || !a.status));
  } catch (err) {
    console.error('[rss.xml] Fetch error:', err.message);
    return [];
  }
}

export async function GET() {
  const articles = await fetchPublishedArticles();
  const now = new Date().toUTCString();

  const itemsXml = articles
    .slice(0, 50)
    .map((a) => {
      const title = escapeXml((a.title || a.topic || 'Untitled').replace(/^Trending:\s*/i, ''));
      const description = escapeXml((a.summary || a.content || '').slice(0, 300));
      const link = `${SITE_URL}${makeStorySlugInline(a)}`;
      const pubDate = new Date(a.publishedAt || a.generatedAt || Date.now()).toUTCString();
      const category = escapeXml(a.category || 'News');
      const author = escapeXml(a.author?.name || 'Bharat News Narratives Editorial');

      return `
    <item>
      <title>${title}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>${author}</dc:creator>
      <category>${category}</category>
      <description>${description}</description>
      ${a.imageUrl ? `<media:content url="${escapeXml(a.imageUrl)}" medium="image" />` : ''}
    </item>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Bharat News Narratives | Independent Journalism</title>
    <link>${SITE_URL}</link>
    <description>Independent journalism. Editorial clarity. Insightful news from India and Telugu regions.</description>
    <language>en-IN</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    ${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=900',
    },
  });
}
