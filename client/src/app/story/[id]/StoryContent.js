'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getNewsById, getPublishedNews, addComment, deleteComment, getStoryFactCheck } from '@/lib/api';
import { makeStorySlug, extractIdFromParam } from '@/lib/slug';
import { useAuthContext } from '@/context/AuthContext';
import Reactions from '@/components/Reactions';
import TrendingIcon from '@/components/TrendingIcon';
import ArticleActions from '@/components/ArticleActions';
import VerdictBadge, { getVerdictRingColor } from '@/components/VerdictBadge';
import CredibilityMeter from '@/components/CredibilityMeter';
import PulseAnalyzerDashboard from '@/components/PulseAnalyzerDashboard';

/* ---------- HELPERS ---------- */

const cleanTitle = (text = '') => text.replace(/^Trending:\s*/i, '');

const formatDate = (value) => {
  if (!value) return 'Just now';
  try {
    return new Date(value).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Just now';
  }
};

const formatCommentDate = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

const CATEGORY_COLORS = {
  Business: 'text-[#1A56C4] bg-blue-50',
  Tech: 'text-[#1A56C4] bg-blue-50',
  Technology: 'text-[#1A56C4] bg-blue-50',
  Politics: 'text-amber-700 bg-amber-50',
  Sports: 'text-emerald-700 bg-emerald-50',
  World: 'text-violet-700 bg-violet-50',
  'Bolta Hai Bharat': 'text-orange-700 bg-orange-50',
  Editorial: 'text-teal-700 bg-teal-50',
};

const CategoryPill = ({ category, isTrending }) => {
  if (!category) return null;
  const colors = CATEGORY_COLORS[category] ?? 'text-[#1A56C4] bg-blue-50';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-3 py-1 ${colors}`}>
      {category}
      <TrendingIcon isTrending={isTrending} className="text-current" />
    </span>
  );
};

/* ---------- COMMENTS SECTION ---------- */

function CommentsSection({ storyId, initialComments }) {
  const { user } = useAuthContext();
  const [comments, setComments] = useState(initialComments || []);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const textareaRef = useRef(null);

  // Resolve the raw objectId from a potentially slug-suffixed param
  const rawId = storyId || '';
  const objectId = extractIdFromParam(rawId);

  const handlePost = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setPosting(true);
    setPostError('');
    try {
      const { data: newComment } = await addComment(objectId, trimmed);
      setComments((prev) => [...prev, newComment]);
      setText('');
    } catch (err) {
      setPostError(err?.response?.data?.message || 'Failed to post comment. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    setDeletingId(commentId);
    try {
      await deleteComment(objectId, commentId);
      setComments((prev) => prev.filter((c) => c._id !== commentId));
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to delete comment.');
    } finally {
      setDeletingId(null);
    }
  };

  const canDelete = (comment) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    // comment.user may be a populated object or just an ID string
    const commentUserId =
      typeof comment.user === 'object' ? comment.user?._id : comment.user;
    return commentUserId === user._id || commentUserId === user.id;
  };

  return (
    <section className="mt-10 pt-8 border-t border-blue-100" id="comments">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1.5 h-6 bg-[#1A56C4] rounded-full" />
        <h2 className="text-lg font-black uppercase tracking-tight text-[#121212]">
          Discussion
          {comments.length > 0 && (
            <span className="ml-2 text-sm font-bold text-gray-400 normal-case">
              ({comments.length} {comments.length === 1 ? 'comment' : 'comments'})
            </span>
          )}
        </h2>
      </div>

      {/* Comment list */}
      {comments.length === 0 ? (
        <p className="text-sm text-gray-400 italic mb-6">
          No comments yet. Be the first to share your thoughts.
        </p>
      ) : (
        <div className="space-y-4 mb-8">
          {comments.map((comment) => {
            const name = comment.user?.name || 'Reader';
            const initial = name.charAt(0).toUpperCase();
            const isOwn = canDelete(comment);

            return (
              <div
                key={comment._id}
                className="group flex gap-3 bg-white border border-blue-50 p-4 shadow-sm hover:shadow transition-shadow duration-200"
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1A56C4] to-[#3b82f6] flex items-center justify-center text-white font-black text-sm shrink-0 select-none">
                  {initial}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-black text-[#121212]">{name}</span>
                      {comment.user?.role === 'admin' && (
                        <span className="text-[9px] font-black uppercase tracking-widest bg-[#1A56C4] text-white px-1.5 py-0.5">
                          Staff
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <time className="text-[10px] text-gray-400 font-medium">
                        {formatCommentDate(comment.createdAt)}
                      </time>
                      {isOwn && (
                        <button
                          onClick={() => handleDelete(comment._id)}
                          disabled={deletingId === comment._id}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-widest disabled:opacity-40"
                          title="Delete comment"
                        >
                          {deletingId === comment._id ? 'Deleting…' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed break-words">
                    {comment.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Post form / Login prompt */}
      {user ? (
        <form onSubmit={handlePost} className="bg-white border border-blue-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1A56C4] to-[#3b82f6] flex items-center justify-center text-white font-black text-xs shrink-0">
              {(user.name || 'U').charAt(0).toUpperCase()}
            </div>
            <span className="text-[12px] font-black text-[#121212]">
              Commenting as <span className="text-[#1A56C4]">{user.name}</span>
            </span>
          </div>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share your thoughts on this story…"
            rows={3}
            maxLength={1000}
            className="w-full border border-blue-100 focus:border-[#1A56C4] focus:outline-none focus:ring-1 focus:ring-[#1A56C4] text-sm text-gray-700 p-3 resize-none transition-colors placeholder:text-gray-300"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-gray-300 font-medium">
              {text.length}/1000
            </span>
            <div className="flex items-center gap-3">
              {postError && (
                <p className="text-[11px] text-red-500 font-medium">{postError}</p>
              )}
              <button
                type="submit"
                disabled={posting || !text.trim()}
                className="px-5 py-2 bg-[#1A56C4] text-white text-[11px] font-black uppercase tracking-widest hover:bg-[#1248A8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {posting ? 'Posting…' : 'Post Comment'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="bg-gradient-to-r from-[#f0f5ff] to-white border border-blue-100 p-6 flex flex-col sm:flex-row items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-[#1A56C4]">
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-5.5-2.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM10 12a5.99 5.99 0 0 0-4.793 2.39A6.483 6.483 0 0 0 10 16.5a6.483 6.483 0 0 0 4.793-2.11A5.99 5.99 0 0 0 10 12Z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-sm font-bold text-[#121212] mb-0.5">Join the discussion</p>
            <p className="text-[11px] text-gray-500">Sign in to share your thoughts on this story.</p>
          </div>
          <Link
            href="/admin/login"
            className="px-6 py-2.5 bg-[#1A56C4] text-white text-[11px] font-black uppercase tracking-widest hover:bg-[#1248A8] transition-colors shrink-0"
          >
            Sign In
          </Link>
        </div>
      )}
    </section>
  );
}





/* ---------- MAIN STORY CONTENT ---------- */

export default function StoryContent({ initialStory, allPublishedNews }) {
  const params = useParams();
  const router = useRouter();



  const [story, setStory] = useState(initialStory);
  const [allNews, setAllNews] = useState(allPublishedNews || []);
  const [loading, setLoading] = useState(!initialStory);
  const [error, setError] = useState('');

  const [factCheck, setFactCheck] = useState(null);
  const [factCheckLoading, setFactCheckLoading] = useState(false);

  // Scroll reveal state for the contextual timeline
  const [inViewport, setInViewport] = useState(false);

  // The route param may be a slug like "6a2e4b70bdeef7fcfba0306a-pm-modi-..."
  // Extract the clean ObjectId for API calls
  const rawParam = useMemo(() => params?.id || '', [params]);
  const storyId = useMemo(() => extractIdFromParam(rawParam), [rawParam]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [storyId]);

  const [mounted, setMounted] = useState(false);
  const [visibleTimelineCount, setVisibleTimelineCount] = useState(1);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!storyId) return;
    // Don't run the fact-check until we know the story's category.
    // On SSR / initialStory path, story is populated immediately.
    // On client-side nav, story loads asynchronously — we wait for it.
    if (!story) return;
    if (story.category === 'Editorial' || story.category === 'Bolta Hai Bharat') {
      setFactCheck(null);
      return;
    }
    let cancelled = false;
    const fetchFactCheckData = async () => {
      try {
        setFactCheckLoading(true);
        const res = await getStoryFactCheck(storyId);
        if (!cancelled) {
          setFactCheck(res.data);
        }
      } catch (err) {
        console.error('Failed to load fact check for story:', err);
      } finally {
        if (!cancelled) setFactCheckLoading(false);
      }
    };
    fetchFactCheckData();
    return () => { cancelled = true; };
  }, [storyId, story?.category]);

  useEffect(() => {
    if (initialStory && initialStory._id === storyId) {
        setStory(initialStory);
        setLoading(false);
        return;
    }
    
    if (!storyId) return;
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        const [storyRes, newsRes] = await Promise.all([
          getNewsById(storyId),
          getPublishedNews(),
        ]);
        if (!cancelled) {
          setStory(storyRes.data);
          setAllNews(newsRes.data || []);
        }
      } catch {
        if (!cancelled) setError('Unable to load story.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [storyId, initialStory]);

  const relatedNews = useMemo(() => {
    if (!story) return [];
    const category = story.category || story.tags?.[0] || '';
    return allNews
      .filter(n => n._id !== story._id && (n.category || n.tags?.[0] || '').toLowerCase() === category.toLowerCase())
      .slice(0, 5);
  }, [story, allNews]);

  const moreYouCanRead = useMemo(() => {
    if (!story || !allNews.length) return [];
    const currentCategory = story.category || story.tags?.[0] || '';
    
    // 1. Same category
    let matches = allNews.filter(n => 
      n._id !== story._id && 
      (n.category || n.tags?.[0] || '').toLowerCase() === currentCategory.toLowerCase()
    );
    
    // 2. Fallback to Politics if not enough
    if (matches.length < 6) {
      const politicsMatches = allNews.filter(n => 
        n._id !== story._id && 
        (n.category || n.tags?.[0] || '').toLowerCase() === 'politics' &&
        !matches.some(m => m._id === n._id)
      );
      matches = [...matches, ...politicsMatches];
    }
    
    return matches.slice(0, 6);
  }, [story, allNews]);

  const storyTimeline = useMemo(() => {
    if (!story || (story.category || '').toLowerCase() !== 'politics') {
      return null;
    }

    const extractCapitals = (text) => {
      if (!text) return [];
      const matches = text.match(/\b[A-Z][a-zA-Z0-9']+(?:\s+[A-Z][a-zA-Z0-9']+)*\b/g) || [];
      return matches.filter(m => !['The', 'A', 'An', 'And', 'In', 'On', 'At', 'To', 'For', 'With', 'By', 'Of', 'Is', 'Are', 'Was', 'Were', 'Trending'].includes(m));
    };

    const cleanWords = (text) => text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !['with', 'about', 'from', 'that', 'this', 'their', 'they', 'them', 'after', 'before', 'says', 'will', 'over', 'trending'].includes(w));

    const genericTerms = new Set([
      'politics', 'political', 'news', 'india', 'indian', 'government', 'state', 'centre', 'central', 
      'minister', 'ministry', 'pm', 'prime', 'mp', 'mla', 'assembly', 'election', 'elections', 'poll', 
      'polls', 'vote', 'votes', 'voting', 'party', 'parties', 'bjp', 'congress', 'tmc', 'dmk', 'aap', 
      'cpi', 'cpim', 'ncp', 'sp', 'bsp', 'rjd', 'jdu', 'nda', 'upa', 'modi', 'gandhi', 'rahul', 
      'amit', 'shah', 'kejriwal', 'mamata', 'banerjee', 'stalin', 'bihar', 'delhi', 'kerala', 'bengal', 
      'maharashtra', 'up', 'tamil', 'nadu', 'karnataka', 'punjab', 'haryana', 'gujarat', 'rajasthan', 
      'madhya', 'pradesh', 'andhra', 'telangana', 'odisha', 'assam', 'kashmir', 'srinagar', 'jammu', 
      'court', 'supreme', 'high', 'police', 'chief', 'leader', 'leadership', 'seat', 'seats', 
      'constituency', 'constituencies', 'candidate', 'candidates', 'union', 'territory', 'national',
      'president', 'governor', 'speaker', 'house', 'parliament', 'parliamentary', 'lok', 'sabha', 'rajya'
    ]);

    const sEntities = extractCapitals(story.title + ' ' + story.summary);
    const sWords = cleanWords(story.title + ' ' + story.summary);
    const sTags = (story.tags || []).map(t => t.toLowerCase()).filter(t => t !== 'politics');

    const scored = allNews
      .filter(n => n._id !== story._id && (n.category || '').toLowerCase() === 'politics')
      .map(article => {
        let score = 0;
        
        // 1. Tag match (excluding politics)
        const aTags = (article.tags || []).map(t => t.toLowerCase()).filter(t => t !== 'politics');
        const sharedTags = aTags.filter(t => sTags.includes(t));
        if (sharedTags.length > 0) {
          score += sharedTags.length * 5.0;
        }

        // 2. Keyword match using Jaccard similarity
        const aWords = cleanWords(article.title || '');
        const sharedWords = aWords.filter(w => sWords.includes(w));
        const unionWords = Array.from(new Set([...sWords, ...aWords]));
        const wordJaccard = unionWords.length > 0 ? sharedWords.length / unionWords.length : 0;

        // 3. Entity match using Jaccard similarity
        const aEntities = extractCapitals(article.title + ' ' + (article.summary || ''));
        const sharedEntities = aEntities.filter(e => sEntities.includes(e));
        const unionEntities = Array.from(new Set([...sEntities, ...aEntities]));
        const entityJaccard = unionEntities.length > 0 ? sharedEntities.length / unionEntities.length : 0;

        // Ensure we only group if there is at least one overlapping non-generic term
        const allSharedLower = [...sharedWords, ...sharedEntities.map(e => e.toLowerCase())];
        const hasSpecific = allSharedLower.some(w => !genericTerms.has(w));

        if (hasSpecific) {
          score += wordJaccard * 4.0;
          score += entityJaccard * 4.0;
          
          // Bonus for matching specific terms
          const specificSharedCount = allSharedLower.filter(w => !genericTerms.has(w)).length;
          score += specificSharedCount * 1.0;
        }

        return { article, score };
      })
      .filter(item => item.score >= 3.0) // Strong semantic/event similarity threshold
      .sort((a, b) => b.score - a.score) // Sort by relevance first
      .slice(0, 4) // Keep up to 4 most relevant related articles
      .map(item => item.article);

    if (scored.length === 0) {
      return null;
    }

    // Add current story and sort chronologically (oldest first)
    return [...scored, story].sort((a, b) => {
      return new Date(a.publishedAt || a.createdAt) - new Date(b.publishedAt || b.createdAt);
    });
  }, [story, allNews]);

  useEffect(() => {
    if (!mounted || !storyTimeline || storyTimeline.length === 0) {
      setVisibleTimelineCount(1);
      return;
    }

    setVisibleTimelineCount(1);

    const interval = setInterval(() => {
      setVisibleTimelineCount((prev) => {
        if (prev < storyTimeline.length) {
          return prev + 1;
        } else {
          clearInterval(interval);
          return prev;
        }
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [mounted, storyTimeline]);

  const heroImage = story?.imageUrl || story?.sourceOptions?.[0]?.imageUrl || null;

  /* --- LOADING --- */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-[#f0f5ff]">
        <div className="w-10 h-10 border-4 border-[#1A56C4] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-black uppercase tracking-widest text-[#1A56C4]">Loading Story…</p>
      </div>
    );
  }

  /* --- ERROR --- */
  if (error || !story) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-[#f8faff] px-6">
        <div className="w-1 h-16 bg-[#1A56C4]" />
        <p className="text-lg font-bold text-gray-700">{error || 'Story not found.'}</p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2 bg-[#1A56C4] text-white text-xs font-black uppercase tracking-widest hover:bg-[#1248A8] transition-colors"
        >
          ← Back to Home
        </button>
      </div>
    );
  }

  /* --- STORY --- */
  return (
    <div className="bg-[#f8faff] min-h-screen text-[#121212]">

      {/* ── Breadcrumb bar ── */}
      <div className="bg-white border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <Link href="/" className="hover:text-[#1A56C4] transition-colors">Home</Link>
          <span className="text-blue-200">›</span>
          {story.category && (
            <>
              <span className="text-[#1A56C4]">{story.category}</span>
              <span className="text-blue-200">›</span>
            </>
          )}
          <span className="text-gray-400 truncate max-w-xs">{cleanTitle(story.title || story.topic)}</span>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-3 md:px-6 py-6 md:py-10">
        <div className="grid grid-cols-12 gap-6 md:gap-10">

          {/* ── ARTICLE HEADER ── */}
          <header className="col-span-12 mb-0">
            <CategoryPill category={story.category || 'Latest'} isTrending={story.isTrending} />

            <h1
              className="text-2xl sm:text-3xl md:text-5xl font-black leading-[1.1] mt-4 mb-4 tracking-tight"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              {cleanTitle(story?.title || story?.topic)}
            </h1>

            {/* Author & Date Row */}
            <div className="flex flex-wrap items-center gap-4 mb-6 mt-6">
              {/* Left: author + divider + date */}
              <div className="flex items-center gap-4 flex-1 min-w-0">

                {story.author ? (
                  <>
                    <Link
                      href={`/author/${story.author._id}`}
                      className="flex items-center gap-3 group"
                    >
                      {story.author.photoUrl ? (
                        <img
                          src={story.author.photoUrl}
                          alt={story.author.name}
                          className="w-10 h-10 rounded-full object-cover border border-blue-100 group-hover:border-[#1A56C4] transition-colors"
                          onError={(e) => { e.currentTarget.setAttribute('src', 'https://placehold.co/80x80/eff6ff/1A56C4?text=' + encodeURIComponent(story.author.name?.charAt(0) || 'A')); }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1A56C4] font-black text-sm group-hover:bg-blue-100 transition-colors shrink-0">
                          {story.author.name?.charAt(0)?.toLowerCase() || 'a'}
                        </div>
                      )}
                      <div className="flex flex-col justify-center">
                        <span className="text-[9px] font-black tracking-widest text-[#1A56C4] uppercase leading-none mb-1">Written By</span>
                        <span className="text-[14px] font-black text-[#121212] leading-none group-hover:text-[#1A56C4] transition-colors tracking-tight">
                          {story.author.name}
                        </span>
                      </div>
                    </Link>
                    <div className="w-[1px] h-8 bg-gray-300" />
                  </>
                ) : (
                  <>
                    <img
                      src="/BNN_logonew.png"
                      alt="BNN"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="w-[1px] h-8 bg-gray-300" />
                  </>
                )}

                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {formatDate(story.publishedAt || story.generatedAt)}
                </p>
                {factCheck && story?.category !== 'Editorial' && story?.category !== 'Bolta Hai Bharat' && (
                  <VerdictBadge verdict={factCheck.verdict} size="xs" />
                )}
              </div>

              {/* Right: action buttons */}
              <ArticleActions story={story} />
            </div>

            {/* AI Disclosure */}
            <Link
              href="/ethics-policy"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 transition-colors text-[10px] font-semibold uppercase tracking-widest text-gray-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-gray-400">
                <path fillRule="evenodd" d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0Zm-6 3.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7.293 5.293a1 1 0 1 1 1.414 1.414L8 7.414V9.5a.5.5 0 0 1-1 0V7a1 1 0 0 1 .293-.707Z" clipRule="evenodd" />
              </svg>
              AI-Assisted Reporting · Reviewed by our Editorial Team
            </Link>
          </header>

          {/* LEFT COLUMN: Hero Image and Article Body */}
          <article className="col-span-12 md:col-span-9">

            {/* ── HERO IMAGE ── */}
            {heroImage && (
              <div className="w-full mb-6 md:mb-10">
                <div className="relative w-full h-auto max-h-[280px] md:max-h-[480px] overflow-hidden shadow-md">
                  <img
                    src={heroImage}
                    alt={story.title || story.topic}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => { e.currentTarget.setAttribute('src', 'https://placehold.co/800x450/e2e8f0/64748b?text=Image+Unavailable'); }}
                    className="w-full h-auto max-h-[280px] md:max-h-[480px] object-cover object-[center_10%]"
                  />
                </div>
                {story.imageSource && (
                  <p className="mt-2 text-[10px] text-gray-500 italic text-right">
                    Image: {story.imageSource}
                  </p>
                )}
              </div>
            )}

            {/* Summary block */}
            <div className="border-l-4 border-[#1A56C4] pl-5 mb-8 bg-white py-4 pr-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#1A56C4] mb-2">BNN Summary</p>
              <p className="text-lg leading-relaxed text-gray-800 font-medium">
                {story.summary}
              </p>
            </div>

            {/* Full content */}
            {story.content && (() => {
              // For BHB articles with a Pulse dashboard, strip the duplicate
              // markdown sentiment block so it doesn't appear alongside the
              // interactive React panel below.
              let displayContent = story.content;
              if (story.category === 'Bolta Hai Bharat' && story.pulseAnalysis) {
                // Strip from the first separator before the sentiment section
                const markers = [
                  '---\n\n### Public Reactions & Sentiment Analysis',
                  '---\r\n\r\n### Public Reactions & Sentiment Analysis',
                  '---\n\n## 📊 BNN Public Pulse Analyzer',
                  '---\r\n\r\n## 📊 BNN Public Pulse Analyzer',
                ];
                for (const m of markers) {
                  const idx = displayContent.indexOf(m);
                  if (idx !== -1) { displayContent = displayContent.slice(0, idx); break; }
                }
              }
              return (
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-1.5 h-6 bg-[#1A56C4] rounded-full" />
                    <h2 className="text-lg font-black uppercase tracking-tight text-[#121212]">
                      In-Depth Analysis
                    </h2>
                  </div>
                  <div className="text-base leading-[1.85] text-gray-700 text-justify">
                    {displayContent.includes('<') && displayContent.includes('>') ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: displayContent }}
                        className="rich-content"
                      />
                    ) : (
                      <div className="rich-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {displayContent}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Pulse Analyzer Dashboard (Bolta Hai Bharat only) ── */}
            {story.category === 'Bolta Hai Bharat' && story.pulseAnalysis && (
              <PulseAnalyzerDashboard
                data={story.pulseAnalysis}
                topic={story.title || story.topic}
                articleId={story._id}
              />
            )}

            <Reactions storyId={story._id} initialReactions={story.reactions} />



            {/* ── COMMENTS ── */}
            <CommentsSection storyId={story._id} initialComments={story.comments || []} />
          </article>

          {/* RIGHT COLUMN: Sidebar */}
          <aside className="col-span-12 md:col-span-3">

            {/* Headline Credibility Widget */}
            {factCheck && story?.category !== 'Editorial' && story?.category !== 'Bolta Hai Bharat' && (
              <div className="bg-white border border-blue-100 p-5 shadow-sm mb-6">
                <div className="flex items-center gap-2 pb-3 mb-4 border-b border-gray-100">
                  <div className="w-1.5 h-4 bg-[#1A56C4] rounded-full" />
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-[#1A56C4]">
                    Credibility Score
                  </h3>
                </div>

                {/* Score ring + verdict */}
                <div className="flex items-center gap-4 mb-4">
                  <CredibilityMeter score={factCheck.finalScore} verdict={factCheck.verdict} size="sm" />
                  <div>
                    <VerdictBadge verdict={factCheck.verdict} size="xs" />
                    <p className="text-[10px] text-gray-500 mt-1">Linguistic & cross-referenced index</p>
                  </div>
                </div>

                {/* Headline Accuracy (Mismatch Detection) */}
                {factCheck.mismatchVerdict && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-[9px] font-black uppercase tracking-wider text-gray-400 mb-1.5">Headline Accuracy</p>
                    <div className="flex items-start gap-2">
                      <span className={`shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border ${
                        factCheck.mismatchVerdict === 'Accurate' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                        factCheck.mismatchVerdict === 'Slightly Misleading' ? 'text-amber-700 bg-amber-50 border-amber-200' :
                        factCheck.mismatchVerdict === 'Clickbait' ? 'text-orange-700 bg-orange-50 border-orange-200' :
                        'text-red-700 bg-red-50 border-red-200'
                      }`}>
                        {factCheck.mismatchVerdict}
                      </span>
                    </div>
                    {factCheck.mismatchReason && (
                      <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed italic">
                        {factCheck.mismatchReason}
                      </p>
                    )}
                  </div>
                )}

                {/* AI Analysis Signals */}
                {factCheck.aiFlags && factCheck.aiFlags.length > 0 && (
                  <div className="space-y-1 mt-3 pt-3 border-t border-gray-100">
                    <p className="text-[9px] font-black uppercase tracking-wider text-gray-400">Analysis Signals</p>
                    <div className="flex flex-wrap gap-1">
                      {factCheck.aiFlags.slice(0, 3).map((flag, idx) => (
                        <span key={idx} className="text-[9px] bg-blue-50 text-[#1A56C4] font-semibold px-2 py-0.5">
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* PIB Fact Check Matches */}
                {factCheck.pibMatches && factCheck.pibMatches.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[8px] font-black uppercase tracking-widest bg-orange-100 text-orange-700 px-1.5 py-0.5">PIB</span>
                      <p className="text-[9px] font-black uppercase tracking-wider text-gray-400">Govt. Fact Check</p>
                    </div>
                    <div className="space-y-2">
                      {factCheck.pibMatches.slice(0, 2).map((match, idx) => (
                        <div key={idx} className="text-[10px] bg-orange-50 border border-orange-100 p-2">
                          {match.link ? (
                            <a
                              href={match.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-orange-800 font-semibold line-clamp-2 hover:underline"
                            >
                              {match.title}
                            </a>
                          ) : (
                            <p className="text-orange-800 font-semibold line-clamp-2">{match.title}</p>
                          )}
                          {match.date && (
                            <p className="text-orange-500 text-[9px] mt-0.5">{match.date}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Google Fact Check Cross-Reference Matches */}
                {factCheck.matches && factCheck.matches.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <p className="text-[9px] font-black uppercase tracking-wider text-gray-400 mb-2">Cross-Reference Matches</p>
                    <div className="space-y-2">
                      {factCheck.matches.slice(0, 2).map((match, idx) => (
                        <div key={idx} className="text-[11px] bg-gray-50 p-2 border border-gray-100">
                          <div className="flex justify-between font-bold text-gray-500 uppercase text-[8px] mb-1">
                            <span>{match.publisher}</span>
                          </div>
                          <p className="text-gray-600 italic line-clamp-2">&quot;{match.claim}&quot;</p>
                          <p className="text-red-600 font-bold mt-1 text-[9px] uppercase">Verdict: {match.verdict}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Politics Contextual Story Timeline */}
            {storyTimeline && (
              <div className="bg-[#faf7f0] border border-[#e6e1d5] p-5 shadow-sm mb-6 rounded-sm">
                <div className="flex items-center gap-3 mb-5 pb-2 border-b border-[#e6e1d5]">
                  <div className="w-1.5 h-4 bg-[#a75d34] rounded-full" />
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-[#a75d34] font-sans">
                    Story Timeline
                  </h3>
                </div>
                
                <div className="relative border-l border-[#e6e1d5] ml-2 pl-5 space-y-6 pb-2">
                  {(mounted ? storyTimeline.slice(0, visibleTimelineCount) : storyTimeline).map((article) => {
                    const isCurrent = article._id === story._id;
                    const dotColorClass = isCurrent ? 'bg-[#1b7a43]' : 'bg-[#a75d34]';
                    const textColorClass = isCurrent ? 'text-[#1b7a43]' : 'text-[#a75d34]';
                    
                    const d = new Date(article.publishedAt || article.createdAt);
                    const correctMonths = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                    const formattedDate = `${String(d.getDate()).padStart(2, '0')} ${correctMonths[d.getMonth()]} ${d.getFullYear()}`;

                    return (
                      <div
                        key={article._id}
                        className="relative animate-timeline-item"
                      >
                        {/* Circle dot centered on the line */}
                        <span className={`absolute -left-[25px] top-[4px] w-2.5 h-2.5 rounded-full ${dotColorClass} z-10`} />
                        
                        {/* Compact Date heading */}
                        <time className={`block text-[10px] font-bold uppercase tracking-wider ${textColorClass} font-sans mb-1`}>
                          {formattedDate} {isCurrent && '(READING NOW)'}
                        </time>
                        
                        {/* Title link */}
                        {isCurrent ? (
                          <span className="text-xs font-bold text-gray-800 font-sans block leading-snug">
                            {article.title}
                          </span>
                        ) : (
                          <Link
                            href={makeStorySlug(article)}
                            className="text-xs font-semibold text-gray-700 hover:text-[#a80c14] transition-colors font-sans block leading-snug"
                          >
                            {article.title}
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Related News */}
            <div className="bg-white border border-blue-100 shadow-sm mb-6">
              <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-[#1A56C4] bg-[#f8faff]">
                <div className="w-1 h-5 bg-[#1A56C4] rounded-full" />
                <h3 className="text-[11px] font-black uppercase tracking-widest text-[#1A56C4]">
                  Related Stories
                </h3>
              </div>

              <div className="divide-y divide-blue-50">
                {relatedNews.length > 0 ? relatedNews.map((item) => (
                  <Link
                    key={item._id}
                    href={makeStorySlug(item)}
                    className="flex gap-3 items-start p-4 group hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-[#1A56C4] mb-1">
                        {item.category || 'Latest'}
                        <TrendingIcon isTrending={item.isTrending} className="ml-1 inline-flex" />
                      </p>
                      <p className="text-sm font-bold leading-snug group-hover:text-[#1A56C4] transition-colors line-clamp-2">
                        {cleanTitle(item?.title || item?.topic)}
                      </p>
                    </div>
                  </Link>
                )) : (
                  <p className="text-sm text-gray-400 p-4">No related stories found.</p>
                )}
              </div>
            </div>

            {/* Back to Home CTA */}
            <Link
              href="/"
              className="flex items-center justify-center gap-2 w-full py-3 bg-[#1A56C4] text-white text-[11px] font-black uppercase tracking-widest hover:bg-[#1248A8] transition-colors"
            >
              ← Back to Home
            </Link>
          </aside>

        </div>
      </main>

      {/* ── MORE YOU CAN READ ── */}
      {moreYouCanRead.length > 0 && (
        <section className="max-w-7xl mx-auto px-3 md:px-6 py-12 border-t border-blue-100 mt-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-2 h-8 bg-[#1A56C4]" />
            <h2 className="text-2xl font-black uppercase tracking-tight text-[#121212]" style={{ fontFamily: 'Georgia, serif' }}>
              More You Can Read
            </h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {moreYouCanRead.map((item) => (
              <Link
                key={item._id}
                href={makeStorySlug(item)}
                className="group flex flex-col bg-white border border-blue-50 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
              >
                <div className="aspect-video overflow-hidden relative">
                  <img
                    src={item.imageUrl || item.sourceOptions?.[0]?.imageUrl || 'https://placehold.co/600x400/e2e8f0/64748b?text=No+Image'}
                    alt={item.title || item.topic}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    onError={(e) => { e.currentTarget.setAttribute('src', 'https://placehold.co/600x400/e2e8f0/64748b?text=Image+Unavailable'); }}
                  />
                  <div className="absolute top-3 left-3">
                    <CategoryPill category={item.category || 'Latest'} isTrending={item.isTrending} />
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="text-base font-bold leading-snug group-hover:text-[#1A56C4] transition-colors line-clamp-2 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                    {cleanTitle(item.title || item.topic)}
                  </h3>
                  <p className="text-xs text-gray-500 line-clamp-2 mt-auto">
                    {item.summary}
                  </p>
                  <div className="mt-4 pt-3 border-t border-blue-50 flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-gray-400">
                    <span>{formatDate(item.publishedAt || item.generatedAt).split(',')[1]?.trim() || 'Today'}</span>
                    <span className="text-[#1A56C4] group-hover:translate-x-1 transition-transform">Read Story →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
