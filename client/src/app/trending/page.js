'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getTrendingNews } from '@/lib/api';
import TrendingIcon from '@/components/TrendingIcon';
import { makeStorySlug } from '@/lib/slug';

const TrendingPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await getTrendingNews();
        setItems(data || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return <p className="px-6 py-10">Loading trending topics…</p>;
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-6">
      {/* PAGE HEADER */}
      <header className="border-b pb-4 mb-6">
        <h1 className="text-2xl font-semibold">Trending</h1>
        <p className="text-sm text-gray-600 mt-1">
          Auto-generated summaries refreshed every 30 minutes.
        </p>
      </header>

      {/* TRENDING FEED */}
      <section className="divide-y">
        {items.map((item) => (
          <article key={item._id} className="py-4">
            <Link href={makeStorySlug(item)} className="block hover:underline">
              <p className="text-xs uppercase text-gray-500">
                {item.category || item.tags?.[0] || 'Latest'}
                <TrendingIcon isTrending={item.isTrending} className="ml-1 inline-flex" />
              </p>

              <h2 className="text-lg font-medium leading-snug mt-1">
                {item.title || item.topic}
              </h2>

              {item.summary && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {item.summary}
                </p>
              )}
            </Link>
          </article>
        ))}
      </section>

      {items.length === 0 && (
        <p className="text-sm text-gray-500 mt-6">
          No trending drafts available right now.
        </p>
      )}
    </main>
  );
};

export default TrendingPage;


