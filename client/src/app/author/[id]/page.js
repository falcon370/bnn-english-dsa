'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getAuthorById } from '@/lib/api';
import { makeStorySlug } from '@/lib/slug';

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

export default function AuthorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [author, setAuthor] = useState(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params?.id) return;
    let cancelled = false;

    const load = async () => {
      try {
        const { data } = await getAuthorById(params.id);
        if (!cancelled) {
          setAuthor(data.author);
          setArticles(data.articles || []);
        }
      } catch {
        if (!cancelled) setError('Unable to load author profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [params?.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-[#f0f5ff]">
        <div className="w-10 h-10 border-4 border-[#1A56C4] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-black uppercase tracking-widest text-[#1A56C4]">Loading Author…</p>
      </div>
    );
  }

  if (error || !author) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-[#f8faff] px-6">
        <div className="w-1 h-16 bg-[#1A56C4]" />
        <p className="text-lg font-bold text-gray-700">{error || 'Author not found.'}</p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2 bg-[#1A56C4] text-white text-xs font-black uppercase tracking-widest hover:bg-[#1248A8] transition-colors"
        >
          ← Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#f8faff] min-h-screen text-[#121212]">

      {/* Breadcrumb */}
      <div className="bg-white border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <Link href="/" className="hover:text-[#1A56C4] transition-colors">Home</Link>
          <span className="text-blue-200">›</span>
          <span className="text-[#1A56C4]">Authors</span>
          <span className="text-blue-200">›</span>
          <span className="text-gray-400 truncate max-w-xs">{author.name}</span>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-10">

        {/* Author Profile Card */}
        <div className="bg-white border-t-4 border-[#1A56C4] shadow-sm p-8 md:p-12 mb-12">
          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-8 md:gap-12">
            {/* Photo */}
            {author.photoUrl ? (
              <img
                src={author.photoUrl}
                alt={author.name}
                className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-2 border-blue-50 shadow-sm flex-shrink-0"
                onError={(e) => { e.currentTarget.setAttribute('src', 'https://placehold.co/200x200/eff6ff/1A56C4?text=' + encodeURIComponent(author.name?.charAt(0) || 'A')); }}
              />
            ) : (
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-blue-50 border-2 border-blue-100 flex items-center justify-center text-[#1A56C4] font-black text-5xl flex-shrink-0 shadow-sm">
                {author.name?.charAt(0)?.toLowerCase() || 'a'}
              </div>
            )}

            {/* Info */}
            <div className="text-center sm:text-left">
              <h1
                className="text-3xl md:text-5xl font-black tracking-tight"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                {author.name}
              </h1>
              <div className="w-12 h-[3px] bg-[#1A56C4] mt-4 mb-5 mx-auto sm:mx-0"></div>
              {author.bio && (
                <p className="text-gray-500 italic text-lg">{author.bio}</p>
              )}
            </div>
          </div>
        </div>

        {/* Articles List */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1.5 h-6 bg-[#1A56C4] rounded-sm" />
            <h2 
              className="text-xl font-black uppercase tracking-tight text-[#121212]"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Articles by {author.name}
            </h2>
          </div>

          {articles.length === 0 ? (
            <p className="text-sm text-gray-400">No articles published yet.</p>
          ) : (
            <div className="space-y-6">
              {articles.map((item) => (
                <Link
                  key={item._id}
                  href={makeStorySlug(item)}
                  className="block p-6 bg-white shadow-sm hover:shadow-md transition-shadow group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#1A56C4] mb-2">
                      {item.category || 'Latest'}
                    </p>
                    <h3 
                      className="text-2xl font-black leading-snug group-hover:text-[#1A56C4] transition-colors mb-2 text-[#121212]"
                      style={{ fontFamily: 'Georgia, serif' }}
                    >
                      {cleanTitle(item.title || item.topic)}
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">{item.summary}</p>
                    {item.publishedAt && (
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                        {formatDate(item.publishedAt)}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Back to Home */}
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#1A56C4] text-white text-[11px] font-black uppercase tracking-widest hover:bg-[#1248A8] transition-colors"
        >
          ← Back to Home
        </Link>
      </main>
    </div>
  );
}
