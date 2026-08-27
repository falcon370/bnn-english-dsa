/**
 * Category Page — Server Component (SSR)
 *
 * CRITICAL SEO FIX: This page was previously 'use client' with client-side data
 * fetching. That meant Google only saw a skeleton UI — no article links whatsoever.
 *
 * This version:
 *  1. Fetches articles server-side → article <a href> links appear in HTML source
 *  2. Exports generateMetadata() → per-category title, description, canonical URL
 *  3. Includes structured article list with headlines, summaries, and dates
 *  4. CategoryClient handles "Load More" interactivity only
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import TrendingIcon from '@/components/TrendingIcon';
import CategoryClient from './CategoryClient';
import { makeStorySlug } from '@/lib/slug';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bharatnewsnarratives.com';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

/* ---------- HELPERS ---------- */

const cleanTitle = (text = '') => text.replace(/^Trending:\s*/i, '');

const formatDate = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '';
  }
};

const CATEGORY_META = {
  telugu: {
    label: 'Telugu News',
    description: 'Latest Telugu news, Andhra Pradesh and Telangana politics, cinema updates, and regional headlines from BNN Telugu.',
  },
  business: {
    label: 'Business',
    description: 'Latest business and economy news from India and the world. Markets, companies, startups, and financial analysis.',
  },
  world: {
    label: 'World',
    description: 'Breaking international news and global affairs. Top stories from around the world.',
  },
  politics: {
    label: 'Politics',
    description: 'Indian political news, government policies, elections, and analysis from Bharat News Narratives.',
  },
  technology: {
    label: 'Technology',
    description: 'Technology news: AI, startups, gadgets, cybersecurity, and the latest from the tech industry.',
  },
  tech: {
    label: 'Technology',
    description: 'Technology news: AI, startups, gadgets, cybersecurity, and the latest from the tech industry.',
  },
  sports: {
    label: 'Sports',
    description: 'Latest sports news: cricket, football, kabaddi, and more from India and around the world.',
  },
  entertainment: {
    label: 'Entertainment',
    description: 'Bollywood, Hollywood, OTT, music, and celebrity entertainment news from India.',
  },
  celebrity: {
    label: 'Celebrity',
    description: 'Celebrity news, gossip, and lifestyle updates from Bollywood and beyond.',
  },
  udaan: {
    label: 'Udaan',
    description: 'Innovation, founder, and grit stories — constructive news about the people building India forward.',
  },
  'bolta-hai-bharat': {
    label: 'Bolta Hai Bharat',
    description: 'Opinion, ground-level reporting, and stories that reflect the voice of Bharat.',
  },
  editorial: {
    label: 'Editorial',
    description: 'Editorials, columns, and in-depth opinion pieces from Bharat News Narratives.',
  },
};

const CATEGORY_COLORS = {
  Telugu: 'text-[#D97706]',
  'Telugu News': 'text-[#D97706]',
  Business: 'text-[#1A56C4]',
  Tech: 'text-[#1A56C4]',
  Technology: 'text-[#1A56C4]',
  Politics: 'text-amber-600',
  Sports: 'text-emerald-600',
  World: 'text-violet-600',
  Udaan: 'text-rose-600',
  Celebrity: 'text-pink-600',
  'Bolta Hai Bharat': 'text-orange-600',
  Editorial: 'text-teal-600',
};

function getCategoryParam(slug) {
  if (!slug) return '';
  if (slug.toLowerCase() === 'tech') return 'technology';
  return slug.toLowerCase().replace(/-/g, ' ');
}

function getDisplayLabel(slug) {
  return (
    CATEGORY_META[slug.toLowerCase()]?.label ||
    slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  );
}

/* ---------- METADATA (SEO) ---------- */

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const meta = CATEGORY_META[slug?.toLowerCase()] || {};
  const label = getDisplayLabel(slug || '');
  const canonicalUrl = `${SITE_URL}/category/${slug}`;

  return {
    title: `${label} News — Bharat News Narratives`,
    description: meta.description || `Latest ${label} news and updates from Bharat News Narratives.`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${label} News — Bharat News Narratives`,
      description: meta.description || `Latest ${label} news from India and the world.`,
      url: canonicalUrl,
      siteName: 'Bharat News Narratives',
      locale: 'en_IN',
      type: 'website',
      images: [{ url: `${SITE_URL}/BNN_logonew.png`, width: 1200, height: 630, alt: `${label} — BNN` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${label} News — Bharat News Narratives`,
      description: meta.description || `Latest ${label} news from India.`,
      images: [`${SITE_URL}/BNN_logonew.png`],
    },
  };
}

/* ---------- SERVER DATA FETCH ---------- */

async function fetchCategoryNews(categoryParam, page = 1, limit = 15) {
  try {
    const url = new URL(`${API_BASE_URL}/api/news`);
    url.searchParams.set('category', categoryParam);
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', String(limit));

    const res = await fetch(url.toString(), {
      // Revalidate every 5 minutes — balances freshness vs. performance
      next: { revalidate: 300 },
    });
    if (!res.ok) return { news: [], pages: 1 };
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('[category page] Fetch failed:', err.message);
    return { news: [], pages: 1 };
  }
}

/* ---------- SUB-COMPONENTS ---------- */

const CategoryBadge = ({ category, isTrending }) => {
  if (!category) return null;
  const color = CATEGORY_COLORS[category] ?? 'text-[#1A56C4]';
  return (
    <span className={`inline-flex items-center gap-1 mb-1.5 text-[10px] font-black uppercase tracking-widest ${color}`}>
      {category}
      <TrendingIcon isTrending={isTrending} className="text-current" />
    </span>
  );
};

const SectionHeader = ({ title }) => (
  <div className="flex items-center gap-4 mb-8 pt-2">
    <div className="w-1.5 h-7 bg-[#1A56C4] rounded-full flex-shrink-0" />
    <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter italic text-[#121212]">
      {title} News
    </h1>
    <div className="flex-1 h-px bg-[#1A56C4] opacity-20" />
  </div>
);

/* ---------- MAIN PAGE (SERVER COMPONENT) ---------- */

export default async function CategoryPage({ params }) {
  const { slug } = await params;
  const categoryParam = getCategoryParam(slug || '');
  const displayCategory = getDisplayLabel(slug || '');
  const canonicalUrl = `${SITE_URL}/category/${slug}`;

  const data = await fetchCategoryNews(categoryParam, 1, 15);
  const news = data.news || [];
  const totalPages = data.pages || 1;
  const hasMore = totalPages > 1;

  // If the slug is not a recognised category AND the API returned nothing,
  // this is an unknown/misspelled slug — return a proper 404 (not a Soft 404).
  if (!news.length && !CATEGORY_META[slug?.toLowerCase()]) {
    notFound();
  }

  /* --- EMPTY STATE --- */
  if (!news.length) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-[#f8faff] text-[#121212] px-4 text-center">
        <h1 className="text-4xl font-black mb-4 italic" style={{ fontFamily: 'Georgia, serif' }}>
          No stories found for {displayCategory}.
        </h1>
        <p className="text-gray-500 mb-8 max-w-md">
          We couldn&apos;t find any recent articles in this category. Check back later as our systems are constantly updating.
        </p>
        <Link
          href="/"
          className="px-6 py-2 bg-[#1A56C4] text-white text-xs font-black uppercase tracking-widest hover:bg-[#1248A8] transition-colors"
        >
          Return Home
        </Link>
      </div>
    );
  }

  const hero = news[0];
  const sidebox = news.slice(1, 3);
  const gridItems = news.slice(3);

  return (
    <div className="bg-[#f8faff] min-h-screen text-[#121212] pb-24">

      {/* Canonical link is set via generateMetadata but also add WebPage JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: `${displayCategory} News — Bharat News Narratives`,
            description: CATEGORY_META[slug?.toLowerCase()]?.description || `Latest ${displayCategory} news`,
            url: canonicalUrl,
            publisher: {
              '@type': 'Organization',
              name: 'Bharat News Narratives',
              url: SITE_URL,
            },
          }),
        }}
      />

      <main className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-12">

        {/* Breadcrumb — semantic nav for crawlers */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <li>
              <Link href="/" className="text-[#1A56C4] hover:underline">Home</Link>
            </li>
            <li className="text-gray-400" aria-hidden="true">›</li>
            <li className="text-gray-600" aria-current="page">{displayCategory}</li>
          </ol>
        </nav>

        <SectionHeader title={displayCategory} />

        {/* ── HERO + SIDEBOX ── */}
        {/*
          These article links are rendered server-side, so Googlebot sees them
          in the HTML source without executing JavaScript.
        */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-16">

          {/* HERO */}
          <section className="col-span-1 md:col-span-8" aria-label="Featured article">
            <article itemScope itemType="https://schema.org/NewsArticle">
              {hero.imageUrl && (
                <div className="relative aspect-[16/9] overflow-hidden bg-blue-50 mb-6 shadow-sm">
                  <img
                    src={hero.imageUrl}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transition-all duration-700 hover:scale-105"
                    alt={cleanTitle(hero.title)}
                    itemProp="image"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#1A56C4]/30 pointer-events-none" />
                  {hero.imageSource && (
                    <span className="absolute bottom-1 right-2 text-[9px] text-white/80 bg-black/40 px-1.5 py-0.5 rounded">
                      Image: {hero.imageSource}
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-1 bg-[#1A56C4] rounded-full" />
                <CategoryBadge category={hero.category} isTrending={hero.isTrending} />
              </div>
              <Link href={makeStorySlug(hero)}>
                <h2
                  className="text-4xl md:text-5xl font-black leading-[1.1] mb-4 hover:text-[#1A56C4] transition-colors tracking-tight"
                  style={{ fontFamily: 'Georgia, serif' }}
                  itemProp="headline"
                >
                  {cleanTitle(hero.title)}
                </h2>
              </Link>
              {hero.summary && (
                <p className="text-lg leading-relaxed text-gray-700 font-medium mb-4" itemProp="description">
                  {hero.summary}
                </p>
              )}
              {(hero.publishedAt || hero.generatedAt) && (
                <time
                  dateTime={new Date(hero.publishedAt || hero.generatedAt).toISOString()}
                  className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-4"
                  itemProp="datePublished"
                >
                  {formatDate(hero.publishedAt || hero.generatedAt)}
                </time>
              )}
              <Link
                href={makeStorySlug(hero)}
                className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-white bg-[#1A56C4] px-5 py-2.5 hover:bg-[#1248A8] transition-colors shadow-sm"
                itemProp="url"
              >
                Read Full Story →
              </Link>
            </article>
          </section>

          {/* SIDEBOX */}
          <aside className="col-span-1 md:col-span-4 flex flex-col gap-6" aria-label="More stories">
            {sidebox.map((item) => (
              <article
                key={item._id}
                className="group border border-blue-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                itemScope
                itemType="https://schema.org/NewsArticle"
              >
                {item.imageUrl && (
                  <div className="w-full h-40 overflow-hidden mb-4 relative bg-gray-100">
                    <img
                      src={item.imageUrl}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                      alt={cleanTitle(item.title)}
                      itemProp="image"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-[#1A56C4] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                    {item.imageSource && (
                      <span className="absolute bottom-1 right-1 text-[8px] text-white/80 bg-black/40 px-1 py-0.5 rounded">
                        {item.imageSource}
                      </span>
                    )}
                  </div>
                )}
                <CategoryBadge category={item.category} isTrending={item.isTrending} />
                <Link href={makeStorySlug(item)} itemProp="url">
                  <h3
                    className="text-lg font-bold leading-tight hover:text-[#1A56C4] transition-colors mb-2"
                    itemProp="headline"
                  >
                    {cleanTitle(item.title)}
                  </h3>
                </Link>
                {item.summary && (
                  <p className="text-sm text-gray-500 line-clamp-2" itemProp="description">
                    {item.summary}
                  </p>
                )}
                {(item.publishedAt || item.generatedAt) && (
                  <time
                    dateTime={new Date(item.publishedAt || item.generatedAt).toISOString()}
                    className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mt-2 block"
                    itemProp="datePublished"
                  >
                    {formatDate(item.publishedAt || item.generatedAt)}
                  </time>
                )}
              </article>
            ))}
          </aside>
        </div>

        {/* ── GRID: Remaining articles (server-rendered) ── */}
        {gridItems.length > 0 && (
          <section
            aria-label="More articles"
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10 border-t border-blue-100 pt-12"
          >
            {gridItems.map((item) => (
              <article
                key={item._id}
                className="group flex flex-col h-full"
                itemScope
                itemType="https://schema.org/NewsArticle"
              >
                {item.imageUrl && (
                  <div className="w-full h-48 overflow-hidden mb-4 rounded-sm relative bg-gray-100">
                    <img
                      src={item.imageUrl}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover transition-all duration-500 group-hover:scale-[1.03]"
                      alt={cleanTitle(item.title)}
                      itemProp="image"
                    />
                    {item.imageSource && (
                      <span className="absolute bottom-1 right-1 text-[8px] text-white/80 bg-black/40 px-1 py-0.5 rounded">
                        {item.imageSource}
                      </span>
                    )}
                  </div>
                )}
                <CategoryBadge category={item.category} isTrending={item.isTrending} />
                <Link href={makeStorySlug(item)} className="flex-1" itemProp="url">
                  <h3
                    className="text-[15px] font-bold leading-snug hover:text-[#1A56C4] transition-colors mb-2"
                    itemProp="headline"
                  >
                    {cleanTitle(item.title)}
                  </h3>
                </Link>
                {item.summary && (
                  <p className="text-xs text-gray-500 line-clamp-2 mt-1" itemProp="description">
                    {item.summary}
                  </p>
                )}
                {(item.publishedAt || item.generatedAt) && (
                  <time
                    dateTime={new Date(item.publishedAt || item.generatedAt).toISOString()}
                    className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mt-2 block"
                    itemProp="datePublished"
                  >
                    {formatDate(item.publishedAt || item.generatedAt)}
                  </time>
                )}
                <div className="w-6 h-0.5 bg-blue-100 mt-4 group-hover:bg-[#1A56C4] transition-colors" />
              </article>
            ))}
          </section>
        )}

        {/* ── Pagination hint for crawlers ── */}
        {hasMore && (
          <div className="mt-4">
            {/* rel="next" link so crawlers discover paginated content */}
            <link rel="next" href={`${canonicalUrl}?page=2`} />
          </div>
        )}

        {/* ── Client-side Load More (interactive only) ── */}
        <CategoryClient
          categoryParam={categoryParam}
          initialPage={1}
          initialHasMore={hasMore}
        />

      </main>
    </div>
  );
}
