/**
 * Google News Sitemap — /news-sitemap.xml
 *
 * Returns a valid Google News Sitemap XML document containing articles
 * published in the LAST 48 HOURS. Google News Sitemaps must follow the
 * Google News Sitemap specification:
 * https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
 *
 * RULES:
 *  - MUST return HTTP 200 always — a 404 causes "General HTTP error" in Search Console.
 *  - MUST have at least one <url> inside <urlset> — an empty urlset causes
 *    "Missing XML tag: url" in Search Console.
 *  - Fallback: when no recent articles exist, include the homepage URL (no news tags)
 *    to keep the XML valid.
 *
 * Revalidates every hour via Cache-Control.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bharatnewsnarratives.com';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

// Inline slug helper (this is a route handler — not a React module — so we
// replicate the tiny helper rather than importing from @/lib/slug to keep
// the route handler dependency-free of client-only module resolution quirks)
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

function toW3CDate(dateValue) {
  if (!dateValue) return new Date().toISOString();
  try {
    return new Date(dateValue).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

async function fetchRecentArticles() {
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  // Try the primary API endpoint
  const endpoints = [
    `${API_BASE_URL}/api/news`,
    `${API_BASE_URL}/api/news/published`,
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        next: { revalidate: 3600 },
        // Abort after 8 seconds to avoid hanging the sitemap request
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;

      const data = await res.json();
      const all = Array.isArray(data) ? data : (data.news ?? data.articles ?? []);

      const recent = all.filter((a) => {
        if (a.status !== 'published') return false;
        const pubDate = new Date(a.publishedAt || a.generatedAt || 0);
        return pubDate >= fortyEightHoursAgo;
      });

      // Return as soon as we get a non-empty result from any endpoint
      if (recent.length > 0) return recent;
    } catch (err) {
      console.error(`[news-sitemap] Fetch failed for ${endpoint}:`, err.message);
    }
  }

  return [];
}

export async function GET() {
  const articles = await fetchRecentArticles();
  const now = new Date().toISOString();

  // Google requires:
  //   1. HTTP 200 (not 404 — that causes "General HTTP error" in Search Console)
  //   2. At least one <url> inside <urlset> (empty urlset = "Missing XML tag: url")
  // Solution: fall back to a minimal homepage entry when no recent articles exist.
  let urlEntries;

  if (articles.length === 0) {
    // Minimal valid fallback — homepage URL without news-specific tags.
    urlEntries = `
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${now}</lastmod>
  </url>`;
  } else {
    urlEntries = articles
      .map((a) => {
        const title = escapeXml((a.title || a.topic || 'Untitled').replace(/^Trending:\s*/i, ''));
        const pubDate = toW3CDate(a.publishedAt || a.generatedAt);
        const articleUrl = `${SITE_URL}${makeStorySlugInline(a)}`;
        const imageUrl = a.imageUrl ? escapeXml(a.imageUrl) : null;
        const isTelugu = a.category?.toLowerCase() === 'telugu' || a.language === 'te' || /[\u0C00-\u0C7F]/.test(a.title || '');
        const lang = isTelugu ? 'te' : 'en';

        return `
  <url>
    <loc>${escapeXml(articleUrl)}</loc>
    <lastmod>${pubDate}</lastmod>
    <news:news>
      <news:publication>
        <news:name>Bharat News Narratives</news:name>
        <news:language>${lang}</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${title}</news:title>
      ${a.keywords ? `<news:keywords>${escapeXml(a.keywords)}</news:keywords>` : ''}
    </news:news>${imageUrl ? `
    <image:image>
      <image:loc>${imageUrl}</image:loc>
      <image:title>${title}</image:title>
    </image:image>` : ''}
  </url>`;
      })
      .join('');
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
>
${urlEntries}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
    },
  });
}
