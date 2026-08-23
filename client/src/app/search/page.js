'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { searchNews } from '@/lib/api';
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

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!query) {
      setNews([]);
      setLoading(false);
      setTotalResults(0);
      return;
    }

    const fetchInitialSearch = async () => {
      setLoading(true);
      try {
        const { data } = await searchNews(query, 1, 12);
        setNews(data.news || []);
        setTotalPages(data.pages || 1);
        setTotalResults(data.total || 0);
        setPage(1);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialSearch();
  }, [query]);

  const loadMore = async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const { data } = await searchNews(query, nextPage, 12);
      setNews((prev) => [...prev, ...(data.news || [])]);
      setPage(nextPage);
    } catch (err) {
      console.error('Load more search failed:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 text-center min-h-[50vh] flex flex-col justify-center items-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 font-bold uppercase tracking-wider text-xs">Searching archives...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-12">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-8">
        <ol className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
          <li>
            <Link href="/" className="text-[#1A56C4] hover:underline">Home</Link>
          </li>
          <li className="text-gray-400" aria-hidden="true">›</li>
          <li className="text-gray-600" aria-current="page">Search</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8 pt-2">
        <div className="w-1.5 h-7 bg-[#1A56C4] rounded-full flex-shrink-0" />
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter italic text-[#121212]">
          Search Results
        </h1>
        <div className="flex-1 h-px bg-[#1A56C4] opacity-20" />
      </div>

      <p className="text-sm text-gray-500 mb-8">
        Found {totalResults} {totalResults === 1 ? 'result' : 'results'} for <span className="font-bold text-slate-800">&ldquo;{query}&rdquo;</span>
      </p>

      {news.length === 0 ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center text-[#121212] text-center">
          <h2 className="text-2xl font-black mb-4 italic" style={{ fontFamily: 'Georgia, serif' }}>
            No stories matched your search.
          </h2>
          <p className="text-gray-500 mb-8 max-w-md">
            Try checking spelling or using more general keywords.
          </p>
          <Link
            href="/"
            className="px-6 py-2 bg-[#1A56C4] text-white text-xs font-black uppercase tracking-widest hover:bg-[#1248A8] transition-colors"
          >
            Return Home
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
            {news.map((item) => (
              <article key={item._id} className="group flex flex-col h-full">
                {item.imageUrl && (
                  <div className="w-full h-48 overflow-hidden mb-4 rounded-sm relative bg-gray-100">
                    <img
                      src={item.imageUrl}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover transition-all duration-500 group-hover:scale-[1.03]"
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
                {item.summary && (
                  <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                    {item.summary}
                  </p>
                )}
                {(item.publishedAt || item.generatedAt) && (
                  <time
                    dateTime={new Date(item.publishedAt || item.generatedAt).toISOString()}
                    className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mt-2 block"
                  >
                    {formatDate(item.publishedAt || item.generatedAt)}
                  </time>
                )}
                <div className="w-6 h-0.5 bg-blue-100 mt-4 group-hover:bg-[#1A56C4] transition-colors" />
              </article>
            ))}
          </div>

          {page < totalPages && (
            <div className="flex justify-center mt-12">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-8 py-3 bg-[#1A56C4] hover:bg-[#1248A8] text-white text-[11px] font-black uppercase tracking-widest transition-colors shadow-sm disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : 'Load More Results'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <div className="bg-[#f8faff] min-h-screen text-[#121212] pb-24">
      <Suspense fallback={
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 text-center min-h-[50vh] flex flex-col justify-center items-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-500 font-bold uppercase tracking-wider text-xs">Loading Search...</p>
        </div>
      }>
        <SearchContent />
      </Suspense>
    </div>
  );
}
