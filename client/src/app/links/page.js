'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getPublishedNews } from '@/lib/api';
import TrendingIcon from '@/components/TrendingIcon';
import { makeStorySlug } from '@/lib/slug';

const cleanTitle = (text = '') => text.replace(/^Trending:\s*/i, '');

const CATEGORY_COLORS = {
  Business: 'bg-blue-50 text-blue-700 border-blue-200',
  Tech: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Technology: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Politics: 'bg-amber-50 text-amber-700 border-amber-200',
  Sports: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  World: 'bg-violet-50 text-violet-700 border-violet-200',
  Entertainment: 'bg-pink-50 text-pink-700 border-pink-200',
  Celebrity: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  'Bolta Hai Bharat': 'bg-orange-50 text-orange-700 border-orange-200',
  Editorial: 'bg-teal-50 text-teal-700 border-teal-200',
};

function CategoryBadge({ category, isTrending }) {
  if (!category) return null;
  const classes = CATEGORY_COLORS[category] ?? 'bg-gray-50 text-gray-700 border-gray-200';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${classes}`}>
      {category}
      {isTrending && <TrendingIcon isTrending className="w-2.5 h-2.5 text-current" />}
    </span>
  );
}

export default function LinksPage() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await getPublishedNews();
        setStories(data || []);
      } catch (err) {
        console.error('Failed to load published news for links page:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f4f7fc] to-[#ffffff] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        
        {/* Profile Header */}
        <div className="text-center mb-10 flex flex-col items-center">
          <div className="relative w-20 h-20 rounded-full border-4 border-white shadow-lg overflow-hidden bg-white mb-4 transition-transform duration-300 hover:scale-105">
            <img 
              src="/BNN_logonew.png" 
              alt="Bharat News Narratives Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-black text-gray-900 leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
            Bharat News Narratives
          </h1>
          <p className="text-sm text-gray-500 font-semibold tracking-wide uppercase mt-1">
            @bharatnewsnarratives
          </p>
          <p className="text-xs text-gray-400 max-w-sm mt-2 leading-relaxed">
            Independent journalism. Editorial clarity. Access all our latest Instagram stories and articles directly below.
          </p>
        </div>

        {/* Links Grid */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-4 p-3 bg-white border border-gray-100 rounded-xl shadow-sm animate-pulse">
                <div className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0" />
                <div className="flex-1 py-1 space-y-3">
                  <div className="h-3 bg-gray-200 rounded w-16" />
                  <div className="h-4 bg-gray-200 rounded w-5/6" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : stories.length === 0 ? (
          <div className="text-center p-8 bg-white border border-gray-100 rounded-xl shadow-sm">
            <p className="text-gray-500 font-medium">No published stories found.</p>
            <Link href="/" className="inline-block mt-4 text-sm font-bold text-[#1A56C4] hover:underline">
              Go to Home →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {stories.slice(0, 20).map((story) => (
              <Link 
                key={story._id}
                href={makeStorySlug(story)}
                className="group flex gap-4 p-3 bg-white hover:bg-blue-50/30 border border-gray-100 hover:border-blue-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 items-center"
              >
                {story.imageUrl && (
                  <div className="w-20 h-20 md:w-24 md:h-24 flex-shrink-0 overflow-hidden rounded-lg bg-gray-50 border border-gray-100">
                    <img 
                      src={story.imageUrl} 
                      alt="" 
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => { e.currentTarget.setAttribute('src', 'https://placehold.co/150x150/e2e8f0/64748b?text=BNN'); }}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0 pr-2">
                  <div className="mb-1.5">
                    <CategoryBadge category={story.category} isTrending={story.isTrending} />
                  </div>
                  <h2 
                    className="text-sm md:text-base font-bold text-gray-900 group-hover:text-[#1A56C4] leading-snug transition-colors line-clamp-2"
                    style={{ fontFamily: 'Georgia, serif' }}
                  >
                    {cleanTitle(story.title || story.topic)}
                  </h2>
                  <p className="text-xs text-gray-400 mt-1 font-semibold flex items-center gap-1 group-hover:text-blue-500/80 transition-colors">
                    Read Article 
                    <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Footer info */}
        <div className="text-center mt-12 mb-6">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-[#1A56C4] bg-blue-50 border border-blue-100 hover:bg-blue-100 px-4 py-2 rounded-full transition-all"
          >
            Visit Our Main Website
          </Link>
          <p className="text-[10px] text-gray-400 font-semibold tracking-wider uppercase mt-4">
            &copy; {new Date().getFullYear()} Bharat News Narratives
          </p>
        </div>

      </div>
    </div>
  );
}
