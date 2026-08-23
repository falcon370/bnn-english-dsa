'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { getPublishedNews } from '@/lib/api';
import TrendingIcon from '@/components/TrendingIcon';
import { makeStorySlug } from '@/lib/slug';
import FactCheckBadge from '@/components/FactCheckBadge';

/* ---------- HELPERS ---------- */

const cleanTitle = (text = '') => text.replace(/^Trending:\s*/i, '');

const CATEGORY_COLORS = {
  Business: 'text-[#1A56C4]',
  Tech: 'text-[#1A56C4]',
  Technology: 'text-[#1A56C4]',
  Politics: 'text-amber-600',
  Sports: 'text-emerald-600',
  World: 'text-violet-600',
  Entertainment: 'text-indigo-600',
  Celebrity: 'text-pink-600',
  'Bolta Hai Bharat': 'text-orange-600',
  Editorial: 'text-teal-600',
};

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


/* ---------- TICKER ---------- */

const LatestTicker = ({ items = [] }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const tickerRef = useRef(null);

  if (!items.length) return null;
  const feed = [...items, ...items];

  const handleArrow = (direction) => {
    const el = tickerRef.current;
    if (!el) return;
    const step = 320;
    const maxScroll = el.scrollWidth / 2;

    setIsPaused(true);

    setScrollOffset((prev) => {
      let next = prev + (direction === 'left' ? -step : step);
      // Wrap around
      if (next < 0) next = maxScroll + next;
      if (next >= maxScroll) next = next - maxScroll;
      return next;
    });

    // Resume auto-scroll after 4 seconds
    setTimeout(() => setIsPaused(false), 4000);
  };

  return (
    <div className="w-full overflow-hidden bg-[#e8f0fe] border-b border-blue-200">
      <style jsx global>{`
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      <div className="max-w-[1440px] mx-auto flex items-center">
        {/* Blue arrow-shaped LATEST badge — shifted right with ml */}
        <div className="flex-shrink-0 z-10 relative flex items-center ml-2 md:ml-4">
          <div
            className="bg-[#1A56C4] text-white text-[8px] font-semibold uppercase tracking-wide px-3 pr-4 py-1.5"
            style={{
              clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)',
            }}
          >
            Latest
          </div>
        </div>
        <div className="relative overflow-hidden flex-1">
          <div
            ref={tickerRef}
            className="inline-flex gap-8 items-center py-2 px-4 whitespace-nowrap"
            style={{
              animation: isPaused ? 'none' : 'ticker 60s linear infinite',
              transform: isPaused ? `translateX(-${scrollOffset}px)` : undefined,
              transition: isPaused ? 'transform 0.4s ease' : 'none',
            }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => { setIsPaused(false); setScrollOffset(0); }}
          >
            {feed.map((item, idx) => (
              <Link
                key={`${item?._id}-${idx}`}
                href={makeStorySlug(item)}
                className="inline-flex items-center gap-2 text-[11px] font-medium text-[#1a3c6e] hover:text-[#1A56C4] transition-colors"
              >
                <span className="text-gray-400">•</span>
                {cleanTitle(item?.title || item?.topic)}
                <TrendingIcon isTrending={item?.isTrending} className="text-[#1A56C4]" />
              </Link>
            ))}
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-0.5 px-2 md:px-3">
          <button
            onClick={() => handleArrow('left')}
            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-[#1A56C4] hover:bg-blue-100 transition-colors rounded-full"
            aria-label="Scroll left"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => handleArrow('right')}
            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-[#1A56C4] hover:bg-blue-100 transition-colors rounded-full"
            aria-label="Scroll right"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------- SECTION HEADER ---------- */

const SectionHeader = ({ title, id }) => (
  <div id={id} className="flex items-center gap-4 mb-6 pt-2 scroll-mt-14">
    <div className="w-1.5 h-7 bg-[#1A56C4] rounded-full flex-shrink-0" />
    <h2 className="text-xl font-black uppercase tracking-tighter italic text-[#121212]">
      {title}
    </h2>
    <div className="flex-1 h-px bg-gray-200" />
  </div>
);

const toSlug = (title) => {
  if (!title) return '';
  const slug = title.toLowerCase().trim().replace(/\s+/g, '-');
  return slug === 'tech' ? 'technology' : slug;
};

/* ---------- CATEGORY SECTION ---------- */

const CategorySection = ({ title, items }) => {
  if (!items?.length) return null;
  const lead = items[0];
  const side = items.slice(1, 5);

  return (
    <section className="mt-10 md:mt-16">
      <SectionHeader title={title} id={title.toLowerCase()} />
      <div className="grid grid-cols-12 gap-4 md:gap-8">
        <div className="col-span-12 md:col-span-7 group">
          {lead?.imageUrl && (
            <div className="overflow-hidden mb-4 relative bg-gray-100">
              <img
                src={lead.imageUrl}
                loading="lazy"
                decoding="async"
                onLoad={(e) => e.currentTarget.classList.remove('opacity-0')}
                onError={(e) => { e.currentTarget.setAttribute('src', 'https://placehold.co/800x450/e2e8f0/64748b?text=Image+Unavailable'); e.currentTarget.classList.remove('opacity-0'); }}
                className="w-full h-52 md:h-80 object-cover transition-all duration-500 group-hover:scale-[1.02] opacity-0"
                alt=""
              />
              {lead.imageSource && (
                <span className="absolute bottom-1 right-2 text-[9px] text-white/80 bg-black/40 px-1.5 py-0.5 rounded">
                  Image: {lead.imageSource}
                </span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 mb-1">
            <CategoryBadge category={lead?.category} isTrending={lead?.isTrending} />
            {/* OPTION A + D */}
            {lead?._id && <FactCheckBadge newsId={String(lead._id)} category={lead?.category} size="xs" side="left" />}
          </div>
          <Link href={makeStorySlug(lead)} className="block text-xl md:text-2xl font-bold hover:text-[#1A56C4] leading-tight transition-colors">
            {cleanTitle(lead?.title)}
          </Link>
          <p className="text-sm text-gray-500 mt-2 line-clamp-3 leading-relaxed">{lead?.summary}</p>
          <Link href={makeStorySlug(lead)} className="inline-flex items-center gap-1 mt-3 text-[11px] font-black uppercase tracking-widest text-[#1A56C4] border-b-2 border-[#1A56C4] pb-0.5 hover:opacity-70 transition-opacity">
            Read More →
          </Link>
        </div>
        <div className="col-span-12 md:col-span-5 space-y-4 md:space-y-5">
          {side.map((item) => (
            <div key={item._id} className="flex gap-3 md:gap-4 border-b border-gray-100 pb-4 last:border-0 items-start group">
              {item.imageUrl && (
                <div className="w-20 h-14 md:w-24 md:h-16 flex-shrink-0 overflow-hidden relative">
                  <img src={item.imageUrl} loading="lazy" decoding="async" onLoad={(e) => e.currentTarget.classList.remove('opacity-0')} onError={(e) => { e.currentTarget.setAttribute('src', 'https://placehold.co/200x150/e2e8f0/64748b?text=Image+Unavailable'); e.currentTarget.classList.remove('opacity-0'); }} className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110 opacity-0" alt="" />
                  {item.imageSource && (
                    <span className="absolute bottom-0 right-0 text-[7px] text-white/70 bg-black/40 px-0.5 rounded-tl">
                      {item.imageSource}
                    </span>
                  )}
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <CategoryBadge category={item.category} isTrending={item.isTrending} />
                  {/* OPTION A + D */}
                  {item._id && <FactCheckBadge newsId={String(item._id)} category={item.category} size="xs" />}
                </div>
                <Link href={makeStorySlug(item)} className="text-sm font-bold hover:text-[#1A56C4] leading-snug block line-clamp-2 transition-colors">
                  {cleanTitle(item.title)}
                </Link>
              </div>
            </div>
          ))}

          {/* Added category-wide Read More button */}
          <div className="pt-4">
            <Link
              href={`/category/${toSlug(title)}`}
              className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#1A56C4] hover:bg-[#1A56C4] hover:text-white border-2 border-[#1A56C4] px-4 py-2 transition-all"
            >
              Read More from {title} →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ---------- SKELETON ---------- */

const Bone = ({ className = '' }) => (
  <div className={`bg-gray-200 animate-pulse rounded ${className}`} />
);

const HomeSkeleton = () => (
  <div className="bg-[#f8faff] min-h-screen">
    <div className="w-full h-9 bg-blue-50 border-b border-blue-200" />
    <main className="max-w-[1440px] mx-auto px-3 md:px-8 py-4 md:py-8">
      <div className="grid grid-cols-12 gap-4 md:gap-8 mb-8 md:mb-12">

        <aside className="hidden md:block md:col-span-2 space-y-5 border-r pr-6 border-blue-100">
          <Bone className="h-3 w-20 mb-4" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2 pb-4 border-b border-blue-50">
              <Bone className="h-3 w-full" /><Bone className="h-3 w-3/4" />
            </div>
          ))}
        </aside>

        <section className="col-span-12 md:col-span-7 px-0 md:px-2">
          <div className="mb-6 md:mb-10 border-b border-blue-100 pb-6 md:pb-10">
            <Bone className="h-3 w-24 mb-4" />
            <Bone className="h-10 w-full mb-2" /><Bone className="h-10 w-4/5 mb-6" />
            <Bone className="w-full aspect-[16/9] mb-4" />
            <Bone className="h-4 w-full mb-2" /><Bone className="h-4 w-2/3" />
          </div>
          <div className="grid grid-cols-2 gap-4 md:gap-8">
            {[0, 1].map(i => (
              <div key={i}>
                <Bone className="w-full h-36 md:h-40 mb-3" />
                <Bone className="h-3 w-16 mb-2" /><Bone className="h-4 w-full" />
              </div>
            ))}
          </div>
        </section>

        <aside className="col-span-12 md:col-span-3 md:border-l md:pl-6 border-blue-100">
          <Bone className="h-3 w-20 mb-4" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2 pb-4 border-b border-blue-50">
              <Bone className="h-3 w-full" /><Bone className="h-3 w-3/4" />
            </div>
          ))}
        </aside>
      </div>

      {[...Array(3)].map((_, i) => (
        <div key={i} className="mt-10 md:mt-16">
          <Bone className="h-5 w-32 mb-6" />
          <div className="grid grid-cols-12 gap-4 md:gap-8">
            <div className="col-span-12 md:col-span-7">
              <Bone className="w-full h-52 md:h-80 mb-4" />
              <Bone className="h-5 w-full mb-2" /><Bone className="h-5 w-3/4" />
            </div>
            <div className="col-span-12 md:col-span-5 space-y-4">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex gap-3 pb-4 border-b border-gray-100">
                  <Bone className="w-20 h-14 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Bone className="h-3 w-full" /><Bone className="h-3 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </main>
  </div>
);

/* ---------- MAIN PAGE ---------- */

export default function Home() {
  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await getPublishedNews();
        setLatest(data || []);
      } catch (err) {
        console.error('Failed to load published news:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /* ---------- LOGIC: PRIORITIZE POLITICS ---------- */

  // 1. Find all Political stories (limited to latest 15 from recent ingestion)
  const filterByCategory = (list, cat) => {
    if (!cat) return [];
    const target = cat.toLowerCase();
    return list.filter(n => n.category?.toLowerCase() === target);
  };

  const politicalStories = filterByCategory(latest, 'Politics').slice(0, 5);

  // 2. Rotating Hero (Client-side to avoid hydration mismatch on timestamps)
  useEffect(() => {
    if (politicalStories.length === 0) return;

    const updateHero = () => {
      // Rotate every 15 minutes (15 * 60 * 1000 = 900,000 ms)
      const fifteenMinutes = 15 * 60 * 1000;
      const currentInterval = Math.floor(Date.now() / fifteenMinutes);
      const index = currentInterval % politicalStories.length;
      setHeroIndex(index);
    };

    // Run initially
    updateHero();

    // Check every minute to see if we've crossed the 20-minute boundary
    const intervalId = setInterval(updateHero, 60000);
    return () => clearInterval(intervalId);
  }, [politicalStories.length]);

  if (loading) return <HomeSkeleton />;

  // 3. Select the hero and filter it out of the general pool
  const politicalHero = politicalStories.length > 0 ? politicalStories[heroIndex] : null;

  // 4. Reconstruct the remaining list (Hero removed)
  const remaining = latest.filter(n => n._id !== politicalHero?._id);
  const leadStory = politicalHero || remaining[0];

  // 5. Slice the Sidebar from the general list (remaining)
  const sidebarSource = politicalHero ? remaining : remaining.slice(1);
  const leftSidebar = sidebarSource.slice(6, 12);
  const rightSidebar = sidebarSource.slice(0, 6);

  // 6. Ensure Sub-Hero ONLY contains Political stories
  const politicalRemaining = politicalStories.filter(n => n._id !== politicalHero?._id);

  // Requirement: Only sub-hero sections should be politics
  const subHero = politicalRemaining.length >= 2
    ? politicalRemaining.slice(0, 2)
    : (politicalRemaining.length > 0
      ? [...politicalRemaining, ...sidebarSource.filter(n => !politicalRemaining.find(p => p._id === n._id)).slice(0, 2 - politicalRemaining.length)]
      : sidebarSource.slice(12, 14));

  return (
    <div className="bg-[#f8faff] min-h-screen text-[#121212]">

      <LatestTicker items={latest.slice(0, 10)} />

      <main className="max-w-[1440px] mx-auto px-3 md:px-8 py-4 md:py-8">

        {/* ===== TOP TRIPLE-COLUMN GRID ===== */}
        <div className="grid grid-cols-12 gap-4 md:gap-8 mb-8 md:mb-12">

          {/* LEFT: LATEST UPDATES — hidden on mobile, shown on md+ */}
          <aside className="hidden md:block md:col-span-2 space-y-5 border-r pr-6 border-blue-100 order-2 md:order-1">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-[#1A56C4] border-b-2 border-[#1A56C4] pb-1 mb-4">
              Latest Updates
            </h3>
            {leftSidebar.map((item) => (
              <article key={item._id} className="group pb-4 border-b last:border-0 border-blue-50">
                <Link href={makeStorySlug(item)} className="block">
                  <p className="text-sm font-bold leading-snug group-hover:text-[#1A56C4] transition-colors">
                    {cleanTitle(item.title)}
                  </p>
                  <span className="text-[10px] text-[#1A56C4] font-bold uppercase tracking-widest mt-1 inline-block opacity-70">
                    {item.category}
                    <TrendingIcon isTrending={item.isTrending} className="ml-1 inline-flex" />
                  </span>
                </Link>
              </article>
            ))}
          </aside>

          {/* CENTER: MAIN FEATURE */}
          <section className="col-span-12 md:col-span-7 px-0 md:px-2 order-1 md:order-2">
            {leadStory && (
              <article className="mb-6 md:mb-10 border-b border-blue-100 pb-6 md:pb-10">
                <div className="flex items-center gap-3 mb-3 md:mb-4">
                  <div className="w-8 h-1 bg-[#1A56C4] rounded-full" />
                  <CategoryBadge category={leadStory.category} isTrending={leadStory.isTrending} />
                </div>
                <Link href={makeStorySlug(leadStory)}>
                  <h1
                    className="text-2xl sm:text-4xl md:text-5xl font-black leading-[1.1] mb-3 md:mb-4 hover:text-[#1A56C4] transition-colors tracking-tight"
                    style={{ fontFamily: 'Georgia, serif' }}
                  >
                    {cleanTitle(leadStory.title)}
                  </h1>
                </Link>
                {/* OPTION A + D: Fact-check badge with hover tooltip */}
                {leadStory._id && (
                  <div className="mb-4 md:mb-6">
                    <FactCheckBadge newsId={String(leadStory._id)} category={leadStory.category} size="sm" side="left" />
                  </div>
                )}
                <div className="relative aspect-[16/9] overflow-hidden bg-blue-50 mb-4 md:mb-6 shadow-sm">
                  {leadStory.imageUrl && (
                    <img src={leadStory.imageUrl} loading="lazy" decoding="async" onLoad={(e) => e.currentTarget.classList.remove('opacity-0')} onError={(e) => { e.currentTarget.setAttribute('src', 'https://placehold.co/800x450/e2e8f0/64748b?text=Image+Unavailable'); e.currentTarget.classList.remove('opacity-0'); }} className="w-full h-full object-cover transition-opacity duration-500 opacity-0" alt="" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#1A56C4] opacity-20 pointer-events-none" />
                  {leadStory.imageSource && (
                    <span className="absolute bottom-1 right-2 text-[9px] text-white/80 bg-black/40 px-1.5 py-0.5 rounded">
                      Image: {leadStory.imageSource}
                    </span>
                  )}
                </div>
                <p className="text-base md:text-lg leading-relaxed text-gray-700 font-medium">{leadStory.summary}</p>
                <Link
                  href={makeStorySlug(leadStory)}
                  className="inline-flex items-center gap-2 mt-4 text-[11px] font-black uppercase tracking-widest text-white bg-[#1A56C4] px-4 py-2 hover:bg-[#1248A8] transition-colors"
                >
                  Read Full Story →
                </Link>
              </article>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
              {subHero.map((item) => (
                <div key={item._id} className="group">
                  <div className="w-full h-36 md:h-40 overflow-hidden mb-3 relative bg-gray-100">
                    <img
                      src={item.imageUrl}
                      loading="lazy"
                      decoding="async"
                      onLoad={(e) => e.currentTarget.classList.remove('opacity-0')}
                      onError={(e) => { e.currentTarget.setAttribute('src', 'https://placehold.co/400x300/e2e8f0/64748b?text=Image+Unavailable'); e.currentTarget.classList.remove('opacity-0'); }}
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 opacity-0"
                      alt=""
                    />
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-[#1A56C4] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                    {item.imageSource && (
                      <span className="absolute bottom-1 right-1 text-[8px] text-white/80 bg-black/40 px-1 py-0.5 rounded">
                        {item.imageSource}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <CategoryBadge category={item.category} isTrending={item.isTrending} />
                    {/* OPTION A + D */}
                    {item._id && <FactCheckBadge newsId={String(item._id)} category={item.category} size="xs" />}
                  </div>
                  <Link href={makeStorySlug(item)} className="text-base font-bold leading-tight hover:text-[#1A56C4] transition-colors">
                    {cleanTitle(item.title)}
                  </Link>
                </div>
              ))}
            </div>
          </section>

          {/* RIGHT: TOP STORIES */}
          <aside className="col-span-12 md:col-span-3 md:border-l md:pl-6 border-blue-100 order-3">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-[#1A56C4] border-b-2 border-[#1A56C4] pb-1 mb-4">
              Top Stories
            </h3>
            {/* On mobile: horizontal scroll list; on md+: vertical list */}
            <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0 md:flex-col md:space-y-4 md:overflow-x-visible snap-x snap-mandatory">
              {rightSidebar.map((item) => (
                <article key={item._id} className="group flex-shrink-0 w-52 md:w-auto md:flex-shrink snap-start pb-4 border-b last:border-0 border-blue-50">
                  <div className="flex items-center gap-2 mb-1">
                    <CategoryBadge category={item.category} isTrending={item.isTrending} />
                    {/* OPTION A + D */}
                    {item._id && <FactCheckBadge newsId={String(item._id)} category={item.category} size="xs" side="left" />}
                  </div>
                  <Link
                    href={makeStorySlug(item)}
                    className="block text-sm font-bold leading-snug group-hover:text-[#1A56C4] transition-colors"
                  >
                    {cleanTitle(item.title)}
                  </Link>
                </article>
              ))}
            </div>
          </aside>
        </div>

        {/* ===== CATEGORY SECTIONS ===== */}
        <CategorySection title="Business" items={filterByCategory(latest, 'Business')} />
        <CategorySection title="World" items={filterByCategory(latest, 'World')} />
        <CategorySection title="Politics" items={filterByCategory(latest, 'Politics')} />
        <CategorySection title="Technology" items={latest.filter(n => {
          const cat = n.category?.toLowerCase();
          return cat === 'tech' || cat === 'technology';
        })} />
        <CategorySection title="Sports" items={filterByCategory(latest, 'Sports')} />
        <CategorySection title="Entertainment" items={filterByCategory(latest, 'Entertainment')} />
        {/* <CategorySection title="Celebrity" items={filterByCategory(latest, 'Celebrity')} /> */}
        <CategorySection title="Bolta Hai Bharat" items={filterByCategory(latest, 'Bolta Hai Bharat')} />
        <CategorySection title="Editorial" items={filterByCategory(latest, 'Editorial')} />

      </main>
    </div>
  );
}