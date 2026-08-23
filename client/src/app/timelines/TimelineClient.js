'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { makeStorySlug } from '@/lib/slug';

const formatTimelineDate = (dateString) => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = months[d.getMonth()];
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = String(hours % 12 || 12).padStart(2, '0');
    return `${day} ${month} ${year}, ${formattedHours}:${minutes} ${ampm}`;
  } catch {
    return '';
  }
};

export default function TimelineClient({ initialArticles, initialHasMore }) {
  const [articles, setArticles] = useState(initialArticles);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  const [mounted, setMounted] = useState(false);
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !articles || articles.length === 0) return;

    setVisibleCount(1);

    const interval = setInterval(() => {
      setVisibleCount((prev) => {
        if (prev < articles.length) {
          return prev + 1;
        } else {
          clearInterval(interval);
          return prev;
        }
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [mounted, articles]);

  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const nextPage = page + 1;
      const response = await api.get('/news', {
        params: {
          category: 'politics',
          days: 30,
          limit: 25,
          page: nextPage
        }
      });
      const data = response.data || {};
      const newArticles = data.news || [];
      setArticles((prev) => [...prev, ...newArticles]);
      setPage(nextPage);
      setHasMore(nextPage < data.pages);
    } catch (err) {
      console.error('Failed to load more timeline articles:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="relative border-l border-[#e6e1d5] ml-3 pl-6 space-y-8 pb-4">
        {(mounted ? articles.slice(0, visibleCount) : articles).map((article, index) => {
          const isLatest = index === 0;
          
          // Colors matching the reference image: green for latest, orange/brown for past
          const dotColorClass = isLatest ? 'bg-[#1b7a43]' : 'bg-[#a75d34]';
          const textColorClass = isLatest ? 'text-[#1b7a43]' : 'text-[#a75d34]';

          return (
            <div
              key={article._id}
              className="relative animate-timeline-item"
            >
              {/* Solid circle dot centered on the line */}
              <span className={`absolute -left-[30px] top-[5px] w-3 h-3 rounded-full ${dotColorClass} z-10`} />
              
              {/* Date/Time above the headline */}
              <time className={`block text-[11px] font-bold uppercase tracking-wider ${textColorClass} font-sans mb-1`}>
                {formatTimelineDate(article.publishedAt || article.createdAt)}
              </time>
              
              {/* Headline */}
              <h2 className="text-[15px] md:text-[16px] font-bold text-gray-800 leading-snug hover:text-[#a80c14] transition-colors font-sans">
                <Link href={makeStorySlug(article)}>
                  {article.title}
                </Link>
              </h2>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-12 pl-6">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-5 py-2 border border-[#a75d34] text-[#a75d34] hover:bg-[#a75d34] hover:text-white transition-colors duration-200 text-xs font-bold font-sans tracking-wider disabled:opacity-50"
          >
            {loading ? 'LOADING STORIES...' : 'LOAD MORE STORIES'}
          </button>
        </div>
      )}
    </div>
  );
}
