'use client';

/**
 * PulseAnalyzerDashboard
 * ──────────────────────
 * Renders the BNN Public Pulse Analyzer panel inside a Bolta Hai Bharat article.
 * Visually mirrors the Python matplotlib dashboard:
 *   - BNN masthead strip
 *   - Top emotion hero + sentiment bar
 *   - AI summary card (left)
 *   - Emotion breakdown donut chart (SVG, right-top)
 *   - Key takeaway card (right-bottom)
 *   - Keyword chips row
 *   - Top positive / critical comment cards
 *   - Footer
 *
 * Props:
 *   data {object}  — pulseAnalysis subdocument from the News model
 *   topic {string} — article topic label
 *   articleId {string} — MongoDB article _id (used to build dashboard PNG URL)
 */

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

// ── BNN Brand tokens ───────────────────────────────────────────────────────
const BNN_BLUE   = '#1A56C4';
const BNN_RED    = '#d32f2f';
const BNN_BG     = '#0b0f19';
const BNN_CARD   = '#0e3a8a';
const BNN_MUTED  = '#60a5fa';
const BNN_BODY   = '#cbd5e1';
const BNN_SUB    = '#94a3b8';

const EMOTION_COLORS = {
  joy:      '#1A56C4',
  trust:    '#22c55e',
  surprise: '#f59e0b',
  fear:     '#60a5fa',
  anger:    '#d32f2f',
  sadness:  '#94a3b8',
};

// ── Tiny SVG donut chart ───────────────────────────────────────────────────
function DonutChart({ breakdown }) {
  const r = 70;
  const cx = 90;
  const cy = 90;
  const strokeWidth = 28;
  const circumference = 2 * Math.PI * r;

  const entries = Object.entries(breakdown || {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;

  let offset = 0;
  const segments = entries.map(([emo, pct]) => {
    const frac = pct / total;
    const dash = frac * circumference;
    const gap  = circumference - dash;
    const seg  = { emo, pct, dash, gap, offset };
    offset += dash;
    return seg;
  });

  return (
    <svg viewBox="0 0 180 180" className="w-full max-w-[180px] mx-auto">
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke={BNN_CARD} strokeWidth={strokeWidth} />
      {/* Segments */}
      {segments.map(({ emo, dash, gap, offset: off }) => (
        <circle
          key={emo}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={EMOTION_COLORS[emo] || BNN_MUTED}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${gap}`}
          strokeDashoffset={-off}
          style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
        />
      ))}
      {/* Centre hole */}
      <circle cx={cx} cy={cy} r={r - strokeWidth / 2 - 1} fill={BNN_BG} />
      {/* Centre label */}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="white"
        fontSize="11" fontWeight="bold" fontFamily="sans-serif">
        EMOTION
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill={BNN_MUTED}
        fontSize="10" fontFamily="sans-serif">
        BREAKDOWN
      </text>
    </svg>
  );
}

// ── Sentiment bar (Pos / Neu / Neg) ────────────────────────────────────────
function SentimentBar({ pos, neu, neg }) {
  const segments = [
    { label: `Pos ${pos}%`, pct: pos,  color: '#22c55e' },
    { label: `Neu ${neu}%`, pct: neu,  color: BNN_MUTED  },
    { label: `Neg ${neg}%`, pct: neg,  color: BNN_RED    },
  ];
  return (
    <div className="flex h-5 w-full overflow-hidden rounded-sm mt-2">
      {segments.map(({ label, pct, color }) =>
        pct > 0 ? (
          <div
            key={label}
            style={{ width: `${pct}%`, background: color }}
            className="flex items-center justify-center text-white text-[9px] font-bold truncate px-1"
            title={label}
          >
            {pct >= 8 ? label : ''}
          </div>
        ) : null
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function PulseAnalyzerDashboard({ data, topic, articleId }) {
  const [imgError, setImgError]   = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  if (!data) return null;

  const {
    positivePct   = 0,
    negativePct   = 0,
    neutralPct    = 0,
    totalComments = 0,
    topEmotion    = 'Joy',
    emotionBreakdown = {},
    aiSummary     = '',
    keyTakeaway   = '',
    keywords      = [],
    topPositive   = [],
    topNegative   = [],
    dashboardSlug = null,
    generatedAt   = null,
  } = data;

  const slug       = dashboardSlug || (articleId ? `bhb_${new Date(generatedAt || Date.now()).toISOString().slice(0, 10)}` : null);
  const dashPngUrl = slug ? `${API_BASE}/api/sentiment/dashboard/${slug}` : null;

  const emoColor   = EMOTION_COLORS[topEmotion?.toLowerCase()] || BNN_BLUE;
  const generatedTs = generatedAt
    ? new Date(generatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <section
      className="my-10 overflow-hidden shadow-2xl"
      style={{ background: BNN_BG, fontFamily: 'sans-serif' }}
      aria-label="BNN Public Pulse Analyzer"
      id="pulse-analyzer-dashboard"
    >
      {/* ── Masthead ───────────────────────────────────────────── */}
      <div style={{ background: BNN_CARD }} className="px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-white font-serif font-black text-xl tracking-tight">BNN</span>
          <div className="w-px h-5" style={{ background: BNN_MUTED, opacity: 0.5 }} />
          <span style={{ color: BNN_MUTED }} className="text-[10px] font-black uppercase tracking-widest">
            Bharat News Narratives
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white font-serif font-black text-base tracking-widest uppercase">
            Public Pulse
          </span>
          <span style={{ color: BNN_SUB }} className="text-[9px]">
            {generatedTs}
          </span>
        </div>
      </div>

      {/* Red accent line */}
      <div style={{ background: BNN_RED, height: '2.5px' }} />

      {/* ── Page header ───────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-white font-serif font-black text-2xl mb-1">Public Reaction Summary</h2>
        {topic && (
          <p style={{ color: BNN_BODY }} className="text-sm italic truncate">
            &ldquo;{topic}&rdquo;
          </p>
        )}
        <span
          className="inline-block mt-2 text-[10px] font-semibold px-3 py-1 rounded-full"
          style={{ color: BNN_MUTED, background: BNN_CARD, border: `1px solid ${BNN_BLUE}` }}
        >
          Analysis based on {totalComments.toLocaleString('en-IN')} comments
        </span>
      </div>

      {/* ── Two-column body ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-5 pb-5">

        {/* LEFT: Top emotion + summary */}
        <div
          className="rounded-lg p-5 flex flex-col gap-4"
          style={{ background: BNN_CARD, border: `1px solid ${BNN_BLUE}22` }}
        >
          {/* Top emotion label */}
          <div>
            <span
              className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5"
              style={{ color: BNN_MUTED, background: BNN_BG }}
            >
              Top Emotion
            </span>
            <p
              className="text-6xl font-serif font-black mt-2 leading-none"
              style={{ color: emoColor }}
            >
              {topEmotion || 'Joy'}
            </p>
          </div>

          {/* Sentiment bar */}
          <div>
            <SentimentBar pos={positivePct} neu={neutralPct} neg={negativePct} />
          </div>

          {/* Divider */}
          <div style={{ borderTop: `1px solid ${BNN_MUTED}33` }} />

          {/* Summary */}
          {aiSummary && (
            <div>
              <p
                className="text-[9px] font-black uppercase tracking-widest mb-2"
                style={{ color: BNN_MUTED }}
              >
                Summary
              </p>
              <p className="text-sm leading-relaxed" style={{ color: BNN_BODY }}>
                {aiSummary}
              </p>
            </div>
          )}

          {/* Total comments pill */}
          <div className="mt-auto">
            <span
              className="inline-block text-sm font-black px-4 py-2 rounded-md text-white"
              style={{ background: BNN_BLUE }}
            >
              Total Comments Analyzed: {totalComments.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* RIGHT: Donut + Key Takeaway */}
        <div className="flex flex-col gap-4">

          {/* Emotion breakdown donut */}
          <div
            className="rounded-lg p-5"
            style={{ background: BNN_CARD, border: `1px solid ${BNN_BLUE}22` }}
          >
            <span
              className="text-[9px] font-black uppercase tracking-widest"
              style={{ color: BNN_MUTED, background: BNN_BG, padding: '2px 6px' }}
            >
              Emotion Breakdown
            </span>
            <p className="text-xs mt-1 mb-3" style={{ color: BNN_BODY }}>
              Breakdown of emotional tone across all comments
            </p>
            <div className="flex items-center gap-4">
              {/* Donut */}
              <div className="w-[140px] shrink-0">
                <DonutChart breakdown={emotionBreakdown} />
              </div>
              {/* Legend */}
              <div className="flex flex-col gap-1.5 text-xs">
                {Object.entries(emotionBreakdown)
                  .filter(([, v]) => v > 0)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([emo, pct]) => (
                    <div key={emo} className="flex items-center gap-2">
                      <span style={{ color: EMOTION_COLORS[emo] || BNN_MUTED }}>●</span>
                      <span className="text-white capitalize w-16">{emo}</span>
                      <span className="font-bold text-white ml-auto">{pct.toFixed(0)}%</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Key Takeaway */}
          {keyTakeaway && (
            <div
              className="rounded-lg p-5 flex gap-3"
              style={{ background: BNN_CARD, border: `1px solid ${BNN_BLUE}22` }}
            >
              {/* Red accent bar */}
              <div className="w-1 shrink-0 rounded-full" style={{ background: BNN_RED }} />
              <div>
                <p
                  className="text-[9px] font-black uppercase tracking-widest mb-2"
                  style={{ color: BNN_RED }}
                >
                  Key Takeaway
                </p>
                <p className="text-sm leading-relaxed" style={{ color: BNN_BODY }}>
                  {keyTakeaway}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Dashboard PNG (if available) ──────────────────────── */}
      {dashPngUrl && !imgError && (
        <div className="px-5 pb-2">
          <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: BNN_MUTED }}>
            Full Dashboard
          </p>
          <div className="relative overflow-hidden rounded-lg" style={{ background: BNN_CARD }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dashPngUrl}
              alt="BNN Public Pulse Dashboard"
              className={`w-full transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span style={{ color: BNN_MUTED }} className="text-xs animate-pulse">
                  Loading dashboard image…
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Keyword chips ─────────────────────────────────────── */}
      {keywords.length > 0 && (
        <div className="px-5 pb-5">
          <p
            className="text-[9px] font-black uppercase tracking-widest mb-2"
            style={{ color: BNN_MUTED }}
          >
            Trending Keywords
          </p>
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw) => (
              <span
                key={kw}
                className="text-[11px] font-semibold px-3 py-1 rounded-full"
                style={{ background: `${BNN_BLUE}22`, color: BNN_MUTED, border: `1px solid ${BNN_BLUE}44` }}
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Comment cards ─────────────────────────────────────── */}
      {(topPositive.length > 0 || topNegative.length > 0) && (
        <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Positive */}
          {topPositive.length > 0 && (
            <div>
              <p
                className="text-[9px] font-black uppercase tracking-widest mb-2"
                style={{ color: '#22c55e' }}
              >
                ✅ Top Positive Reactions
              </p>
              <div className="flex flex-col gap-3">
                {topPositive.slice(0, 2).map((c, i) => (
                  <blockquote
                    key={i}
                    className="rounded-lg p-3 text-sm leading-relaxed"
                    style={{
                      background: `#22c55e11`,
                      borderLeft: '3px solid #22c55e',
                      color: BNN_BODY,
                    }}
                  >
                    &ldquo;{c}&rdquo;
                  </blockquote>
                ))}
              </div>
            </div>
          )}

          {/* Critical */}
          {topNegative.length > 0 && (
            <div>
              <p
                className="text-[9px] font-black uppercase tracking-widest mb-2"
                style={{ color: BNN_RED }}
              >
                ⚠️ Critical Perspectives
              </p>
              <div className="flex flex-col gap-3">
                {topNegative.slice(0, 2).map((c, i) => (
                  <blockquote
                    key={i}
                    className="rounded-lg p-3 text-sm leading-relaxed"
                    style={{
                      background: `${BNN_RED}11`,
                      borderLeft: `3px solid ${BNN_RED}`,
                      color: BNN_BODY,
                    }}
                  >
                    &ldquo;{c}&rdquo;
                  </blockquote>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────── */}
      <div
        className="px-5 py-3 flex items-center justify-between flex-wrap gap-2"
        style={{ borderTop: `1px solid ${BNN_CARD}`, background: `${BNN_BG}cc` }}
      >
        <span className="text-[9px]" style={{ color: BNN_SUB }}>
          BNN Public Pulse &nbsp;|&nbsp; Powered by Google Gemini AI &nbsp;|&nbsp; Data: YouTube + Mastodon
        </span>
        <span className="text-[9px] italic" style={{ color: BNN_MUTED }}>
          bharatnewsnarratives.com
        </span>
      </div>
    </section>
  );
}
