/**
 * sitemap.js — Auto-generates /sitemap.xml via Next.js App Router.
 *
 * Covers:
 *  - Static pages (home, categories, epaper, etc.)
 *  - Every published article at /story/[id]-[slug]
 *
 * Google will discover and index all URLs from here.
 */

import { makeStorySlug } from '@/lib/slug';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bharatnewsnarratives.com';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

/** Category slugs that have dedicated listing pages */
const CATEGORY_SLUGS = [
  'telugu',
  'business',
  'world',
  'politics',
  'technology',
  'sports',
  'entertainment',
  // 'celebrity',
  'bolta-hai-bharat',
  'editorial',
];

async function fetchAllPublishedArticles() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/news`, {
      // Revalidate every hour so the sitemap stays fresh without hammering the DB
      next: { revalidate: 3600 },
      // Abort after 8 seconds to prevent hanging the sitemap generation in production
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    // API returns an array directly, { news: [] }, or { articles: [] }
    return Array.isArray(data) ? data : (data.news ?? data.articles ?? []);
  } catch (err) {
    console.error('[sitemap] Failed to fetch articles:', err.message);
    return [];
  }
}

export default async function sitemap() {
  const now = new Date().toISOString();

  /* ── STATIC PAGES ── */
  const staticRoutes = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/epaper`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/trending`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/timelines`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.6,
    },
  ];

  /* ── CATEGORY PAGES ── */
  const categoryRoutes = CATEGORY_SLUGS.map((slug) => ({
    url: `${SITE_URL}/category/${slug}`,
    lastModified: now,
    changeFrequency: 'hourly',
    priority: 0.9,
  }));

  /* ── ARTICLE PAGES ── */
  const articles = await fetchAllPublishedArticles();
  const articleRoutes = articles
    // Include published articles; also include where status is absent (older API responses)
    .filter((a) => a._id && (a.status === 'published' || !a.status))
    .map((a) => ({
      url: `${SITE_URL}${makeStorySlug(a)}`,
      // lastModified must be a valid ISO 8601 string for Next.js sitemap spec
      lastModified: new Date(a.publishedAt || a.updatedAt || a.generatedAt || now).toISOString(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }));

  return [...staticRoutes, ...categoryRoutes, ...articleRoutes];
}
