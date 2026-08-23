'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/* ── Icon SVGs ── */
const ShareIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);

const BookmarkIcon = ({ filled }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>
);

const PrintIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
    <rect x="6" y="14" width="12" height="8"/>
  </svg>
);

const ListenIcon = ({ active }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    {active ? (
      // Pause icon when playing
      <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>
    ) : (
      // Headphones icon
      <>
        <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
      </>
    )}
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

/* ── Share platform data ── */
const getSharePlatforms = (url, title) => [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    color: '#25D366',
    bg: '#f0fdf4',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
      </svg>
    ),
    getUrl: (u, t) => `https://wa.me/?text=${encodeURIComponent(t + '\n' + u)}`,
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    color: '#000000',
    bg: '#f9fafb',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.254 5.622 5.91-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117Z"/>
      </svg>
    ),
    getUrl: (u, t) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}`,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    color: '#1877F2',
    bg: '#eff6ff',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    getUrl: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    color: '#0A66C2',
    bg: '#eff6ff',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
    getUrl: (u, t) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}&title=${encodeURIComponent(t)}`,
  },
  {
    id: 'copy',
    label: 'Copy Link',
    color: '#1A56C4',
    bg: '#eff6ff',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
    ),
    getUrl: null, // handled separately
  },
];

/* ── Main Component ── */
export default function ArticleActions({ story }) {
  const [showShare, setShowShare]     = useState(false);
  const [bookmarked, setBookmarked]   = useState(false);
  const [copied, setCopied]           = useState(false);
  const [isReading, setIsReading]     = useState(false);
  const [readingPaused, setReadingPaused] = useState(false);
  const [readingToast, setReadingToast]   = useState('');

  const shareRef   = useRef(null);
  const utterRef   = useRef(null);

  const articleUrl   = typeof window !== 'undefined' ? window.location.href : '';
  const articleTitle = story?.title || story?.topic || 'BNN Article';

  /* Load bookmark state from localStorage */
  useEffect(() => {
    if (!story?._id) return;
    const saved = JSON.parse(localStorage.getItem('bnn_bookmarks') || '[]');
    setBookmarked(saved.includes(story._id));
  }, [story?._id]);

  /* Close share panel on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (shareRef.current && !shareRef.current.contains(e.target)) {
        setShowShare(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* Stop speech on unmount */
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  /* ── Handlers ── */

  const handleShare = useCallback((platform) => {
    const url   = typeof window !== 'undefined' ? window.location.href : '';
    const title = articleTitle;

    if (platform.id === 'copy') {
      navigator.clipboard?.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        // fallback
        const el = document.createElement('textarea');
        el.value = url;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
      return;
    }

    const shareUrl = platform.getUrl(url, title);
    window.open(shareUrl, '_blank', 'noopener,noreferrer,width=600,height=500');
    setShowShare(false);
  }, [articleTitle]);

  const handleBookmark = useCallback(() => {
    if (!story?._id) return;
    const saved = JSON.parse(localStorage.getItem('bnn_bookmarks') || '[]');
    let updated;
    if (bookmarked) {
      updated = saved.filter(id => id !== story._id);
    } else {
      updated = [...saved, story._id];
    }
    localStorage.setItem('bnn_bookmarks', JSON.stringify(updated));
    setBookmarked(!bookmarked);
  }, [bookmarked, story?._id]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleListen = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      alert('Text-to-speech is not supported in your browser.');
      return;
    }
    const synth = window.speechSynthesis;

    if (isReading && !readingPaused) {
      // Currently reading → pause
      synth.pause();
      setReadingPaused(true);
      setReadingToast('Paused');
      return;
    }

    if (readingPaused) {
      // Paused → resume
      synth.resume();
      setReadingPaused(false);
      setReadingToast('Resuming…');
      setTimeout(() => setReadingToast(''), 1500);
      return;
    }

    // Fresh start
    synth.cancel();

    // Build plain text from the story
    const parts = [
      articleTitle,
      story?.summary || '',
      story?.content
        ? story.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        : '',
    ].filter(Boolean).join('. ');

    const utter = new window.SpeechSynthesisUtterance(parts);
    utter.lang  = 'en-IN';
    utter.rate  = 0.92;
    utter.pitch = 1;

    utter.onstart = () => {
      setIsReading(true);
      setReadingPaused(false);
      setReadingToast('Listening…');
      setTimeout(() => setReadingToast(''), 1800);
    };
    utter.onend = () => {
      setIsReading(false);
      setReadingPaused(false);
      utterRef.current = null;
    };
    utter.onerror = () => {
      setIsReading(false);
      setReadingPaused(false);
    };

    utterRef.current = utter;
    synth.speak(utter);
  }, [isReading, readingPaused, articleTitle, story]);

  const platforms = getSharePlatforms(articleUrl, articleTitle);

  /* ── Render ── */
  return (
    <div className="article-actions-wrap" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>

      {/* Reading toast */}
      {readingToast && (
        <div className="aa-toast" aria-live="polite">{readingToast}</div>
      )}

      {/* ── Listen ── */}
      <button
        id="article-action-listen"
        onClick={handleListen}
        title={isReading && !readingPaused ? 'Pause narration' : readingPaused ? 'Resume narration' : 'Listen to article'}
        aria-label={isReading && !readingPaused ? 'Pause narration' : 'Listen to article'}
        className={`aa-btn${isReading ? ' aa-btn--active' : ''}`}
      >
        <ListenIcon active={isReading && !readingPaused} />
        <span className="aa-btn-label">{isReading && !readingPaused ? 'Pause' : readingPaused ? 'Resume' : 'Listen'}</span>
      </button>

      {/* ── Bookmark ── */}
      <button
        id="article-action-bookmark"
        onClick={handleBookmark}
        title={bookmarked ? 'Remove bookmark' : 'Save for later'}
        aria-label={bookmarked ? 'Remove bookmark' : 'Save for later'}
        className={`aa-btn${bookmarked ? ' aa-btn--active' : ''}`}
      >
        <BookmarkIcon filled={bookmarked} />
        <span className="aa-btn-label">{bookmarked ? 'Saved' : 'Save'}</span>
      </button>

      {/* ── Print ── */}
      <button
        id="article-action-print"
        onClick={handlePrint}
        title="Print article"
        aria-label="Print article"
        className="aa-btn"
      >
        <PrintIcon />
        <span className="aa-btn-label">Print</span>
      </button>

      {/* ── Share ── */}
      <div ref={shareRef} style={{ position: 'relative' }}>
        <button
          id="article-action-share"
          onClick={() => setShowShare(v => !v)}
          title="Share article"
          aria-label="Share article"
          aria-expanded={showShare}
          className={`aa-btn aa-btn--share${showShare ? ' aa-btn--active' : ''}`}
        >
          <ShareIcon />
          <span className="aa-btn-label">Share</span>
        </button>

        {/* Share dropdown */}
        {showShare && (
          <div className="aa-share-panel" role="menu" aria-label="Share options">
            <p className="aa-share-title">Share this story</p>
            {platforms.map(platform => (
              <button
                key={platform.id}
                id={`article-share-${platform.id}`}
                role="menuitem"
                onClick={() => handleShare(platform)}
                className="aa-share-item"
                style={{ '--platform-color': platform.color, '--platform-bg': platform.bg }}
              >
                <span className="aa-share-icon" style={{ color: platform.color }}>
                  {platform.id === 'copy' && copied ? <CheckIcon /> : platform.icon}
                </span>
                <span className="aa-share-label">
                  {platform.id === 'copy' && copied ? 'Copied!' : platform.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        /* ── Article Actions ── */
        .article-actions-wrap {
          flex-shrink: 0;
        }

        .aa-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 10px;
          border: 1.5px solid #e2e8f0;
          border-radius: 6px;
          background: #fff;
          color: #4b5563;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.18s ease;
          white-space: nowrap;
          line-height: 1;
        }
        .aa-btn:hover {
          background: #eff6ff;
          border-color: #1A56C4;
          color: #1A56C4;
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(26,86,196,0.12);
        }
        .aa-btn--active {
          background: #eff6ff;
          border-color: #1A56C4;
          color: #1A56C4;
        }
        .aa-btn--share.aa-btn--active {
          background: #1A56C4;
          color: #fff;
          border-color: #1A56C4;
        }
        .aa-btn-label {
          display: none;
        }

        /* Show labels on wider screens */
        @media (min-width: 640px) {
          .aa-btn-label {
            display: inline;
          }
        }

        /* Share panel */
        .aa-share-panel {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 200px;
          background: #fff;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          box-shadow: 0 12px 32px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.06);
          z-index: 200;
          overflow: hidden;
          animation: aa-pop 0.18s cubic-bezier(0.34,1.56,0.64,1) both;
        }

        @keyframes aa-pop {
          from { opacity: 0; transform: scale(0.9) translateY(-6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        .aa-share-title {
          padding: 10px 14px 6px;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #9ca3af;
          border-bottom: 1px solid #f1f5f9;
          margin: 0;
        }

        .aa-share-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 14px;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
          transition: background 0.14s ease;
        }
        .aa-share-item:hover {
          background: var(--platform-bg, #f9fafb);
        }

        .aa-share-icon {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: var(--platform-bg, #f9fafb);
          flex-shrink: 0;
        }

        .aa-share-label {
          font-size: 12px;
          font-weight: 700;
          color: #1f2937;
        }

        /* Toast */
        .aa-toast {
          position: fixed;
          bottom: 28px;
          left: 50%;
          transform: translateX(-50%);
          background: #1A56C4;
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 8px 20px;
          border-radius: 100px;
          z-index: 9999;
          box-shadow: 0 4px 16px rgba(26,86,196,0.3);
          animation: aa-toast-in 0.2s ease both;
          pointer-events: none;
        }
        @keyframes aa-toast-in {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        /* Print styles */
        @media print {
          .article-actions-wrap { display: none !important; }
        }
      `}</style>
    </div>
  );
}
