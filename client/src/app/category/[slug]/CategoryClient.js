'use client';

/**
 * CategoryClient — Handles interactive "Load More" pagination on category pages.
 *
 * This is intentionally a thin client component. The initial page of articles
 * is server-rendered in page.js so crawlers can see all article links in the
 * HTML source. This component only manages appending additional pages on demand.
 */

import { useState } from 'react';
import Link from 'next/link';
import { getCategoryNews } from '@/lib/api';
import TrendingIcon from '@/components/TrendingIcon';
import { makeStorySlug } from '@/lib/slug';

const cleanTitle = (text = '') => text.replace(/^Trending:\s*/i, '');

const CATEGORY_COLORS = {
  Business: 'text-[#1A56C4]',
  Tech: 'text-[#1A56C4]',
  Technology: 'text-[#1A56C4]',
  Politics: 'text-amber-600',
  Sports: 'text-emerald-600',
  World: 'text-violet-600',
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

export default function CategoryClient({ categoryParam, initialPage, initialHasMore }) {
  const [extraItems, setExtraItems] = useState([]);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const { data } = await getCategoryNews(categoryParam, nextPage, 15);
      setExtraItems((prev) => [...prev, ...(data.news || [])]);
      setPage(nextPage);
      setHasMore(nextPage < data.pages);
    } catch (err) {
      console.error('Failed to load more:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <>
      {/* Extra pages loaded via "Load More" — client-side */}
      {extraItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10 mt-10 border-t border-blue-100 pt-10">
          {extraItems.map((item) => (
            <article key={item._id} className="group flex flex-col h-full">
              {item.imageUrl && (
                <div className="w-full h-48 overflow-hidden mb-4 rounded-sm relative bg-gray-100">
                  <img
                    src={item.imageUrl}
                    loading="lazy"
                    decoding="async"
                    onLoad={(e) => e.currentTarget.classList.remove('opacity-0')}
                    onError={(e) => {
                      e.currentTarget.setAttribute('src', 'https://placehold.co/400x300/e2e8f0/64748b?text=Image+Unavailable');
                      e.currentTarget.classList.remove('opacity-0');
                    }}
                    className="w-full h-full object-cover transition-all duration-500 group-hover:scale-[1.03] opacity-0"
                    alt={cleanTitle(item.title)}
                  />
                  {item.imageSource && (
                    <span className="absolute bottom-1 right-1 text-[8px] text-white/80 bg-black/40 px-1 py-0.5 rounded">
                      {item.imageSource}
                    </span>
                  )}
                </div>
              )}
              <CategoryBadge category={item.category} isTrending={item.isTrending} />
              <Link href={makeStorySlug(item)} className="flex-1">
                <h3 className="text-[15px] font-bold leading-snug hover:text-[#1A56C4] transition-colors mb-2">
                  {cleanTitle(item.title)}
                </h3>
              </Link>
              <div className="w-6 h-0.5 bg-blue-100 mt-4 group-hover:bg-[#1A56C4] transition-colors" />
            </article>
          ))}
        </div>
      )}

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center mt-14">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-8 py-3 bg-[#1A56C4] text-white text-xs font-black uppercase tracking-widest hover:bg-[#1248A8] transition-colors disabled:opacity-60"
          >
            {loadingMore ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Loading…
              </>
            ) : (
              'Load More Stories →'
            )}
          </button>
        </div>
      )}
    </>
  );
}
