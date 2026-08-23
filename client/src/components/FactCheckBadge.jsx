'use client';

import { useState, useCallback, useRef } from 'react';
import VerdictBadge from '@/components/VerdictBadge';
import { getStoryFactCheck } from '@/lib/api';

/**
 * FactCheckBadge — Option A + D combined
 *
 * • Option A: Renders a compact VerdictBadge inline beside the headline.
 * • Option D: On hover / focus of the badge, opens a dark tooltip with the
 *             full fact-check breakdown (score bar, AI signals, flags, PIB match).
 *
 * Fact-check data is fetched lazily on first hover and cached in a module-level
 * Map so the same article is never fetched twice in the same page session.
 *
 * Props:
 *   newsId  {string}  - MongoDB _id of the news article
 *   size    {string}  - 'xs' | 'sm' | 'md'  (passed through to VerdictBadge)
 *   side    {string}  - 'right' | 'left'  — which side the tooltip opens on (default: 'right')
 */

// Module-level cache: newsId → fact-check result
const fcCache = new Map();

/* ── colour helpers ─────────────────────────────────────────── */
const VERDICT_COLORS = {
  Credible:       { bar: '#10b981', text: '#34d399' },
  'Needs Context':{ bar: '#f59e0b', text: '#fcd34d' },
  Questionable:   { bar: '#f97316', text: '#fb923c' },
  'Likely False': { bar: '#ef4444', text: '#f87171' },
  Opinion:        { bar: '#9333ea', text: '#c084fc' },
};

const FLAG_COLORS = {
  Credible:       { bg: '#1e293b', border: '#334155', text: '#34d399' },
  'Needs Context':{ bg: '#1e293b', border: '#78350f', text: '#fcd34d' },
  Questionable:   { bg: '#1e293b', border: '#7c2d12', text: '#fb923c' },
  'Likely False': { bg: '#1e293b', border: '#7f1d1d', text: '#f87171' },
  Opinion:        { bg: '#1e293b', border: '#581c87', text: '#c084fc' },
};

/* ── signal dots ─────────────────────────────────────────────── */
function SignalDots({ value = 0, color = '#38bdf8' }) {
  const filled = Math.round((value / 10) * 5);
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: i < filled ? color : '#334155',
          }}
        />
      ))}
    </div>
  );
}

/* ── score gauge bar ─────────────────────────────────────────── */
function GaugeBar({ score, color }) {
  return (
    <div style={{ flex: 1, background: '#1e293b', borderRadius: 99, height: 5, overflow: 'hidden', margin: '0 8px' }}>
      <div style={{ height: '100%', borderRadius: 99, width: `${score}%`, background: color, transition: 'width .8s cubic-bezier(.34,1.56,.64,1)' }} />
    </div>
  );
}

/* ── loading skeleton ────────────────────────────────────────── */
function TooltipSkeleton() {
  const bar = (w) => (
    <div style={{ height: 8, borderRadius: 4, background: '#1e293b', width: w, marginBottom: 6 }} />
  );
  return (
    <div style={{ animation: 'pulse 1.4s ease-in-out infinite' }}>
      {bar('60%')}{bar('80%')}{bar('50%')}
      <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
    </div>
  );
}

/* ── main component ──────────────────────────────────────────── */
export default function FactCheckBadge({ newsId, category, size = 'xs', side = 'right' }) {
  const isExcluded = category === 'Editorial' || category === 'Bolta Hai Bharat';

  // All hooks must be called unconditionally (React Rules of Hooks).
  // We gate the actual fetch and tooltip via isExcluded below.
  const [fc, setFc]           = useState(fcCache.get(newsId) ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);
  const [open, setOpen]       = useState(false);
  const fetchedRef            = useRef(fcCache.has(newsId));
  const hoverTimerRef         = useRef(null);

  const fetchFactCheck = useCallback(async () => {
    if (isExcluded || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    try {
      const { data } = await getStoryFactCheck(newsId);
      fcCache.set(newsId, data);
      setFc(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [newsId, isExcluded]);

  const handleMouseEnter = () => {
    if (isExcluded) return;
    hoverTimerRef.current = setTimeout(() => {
      setOpen(true);
      fetchFactCheck();
    }, 120);
  };

  const handleMouseLeave = () => {
    clearTimeout(hoverTimerRef.current);
    setOpen(false);
  };

  // Early exit after all hooks — safe per React Rules of Hooks
  if (isExcluded) return null;

  const verdict       = fc?.verdict ?? null;
  const colors        = VERDICT_COLORS[verdict] ?? VERDICT_COLORS['Questionable'];
  const flagColors    = FLAG_COLORS[verdict]    ?? FLAG_COLORS['Questionable'];
  const signals       = fc?.aiSignals ?? {};
  const flags         = fc?.aiFlags ?? [];
  const pibMatches    = fc?.pibMatches ?? [];
  const mismatch      = fc?.mismatchVerdict;
  const score         = fc?.finalScore ?? 0;

  const tooltipStyle = {
    position: 'absolute',
    bottom: 'calc(100% + 10px)',
    [side === 'left' ? 'left' : 'right']: 0,
    width: 248,
    background: '#0f172a',
    borderRadius: 10,
    padding: '12px 13px',
    boxShadow: '0 20px 60px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.05)',
    opacity: open ? 1 : 0,
    pointerEvents: open ? 'auto' : 'none',
    transform: open ? 'translateY(0) scale(1)' : 'translateY(6px) scale(.97)',
    transition: 'opacity .18s, transform .18s',
    zIndex: 9999,
  };

  const arrowStyle = {
    position: 'absolute',
    bottom: -5,
    [side === 'left' ? 'left' : 'right']: 12,
    width: 10,
    height: 10,
    background: '#0f172a',
    transform: 'rotate(45deg)',
    borderRadius: 2,
  };

  const row = (label, val, valColor) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
      <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 9, color: valColor ?? '#e2e8f0', fontWeight: 700 }}>{val}</span>
    </div>
  );

  const divider = () => <div style={{ borderTop: '1px solid #1e293b', margin: '7px 0' }} />;

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── OPTION A: Inline badge (or loading/placeholder state) ── */}
      {fc ? (
        <VerdictBadge verdict={verdict} size={size} />
      ) : (
        /* Subtle skeleton pill while data hasn't loaded yet */
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 8,
            fontWeight: 800,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            border: '1px solid #e2e8f0',
            color: '#94a3b8',
            background: '#f8fafc',
            cursor: 'default',
            userSelect: 'none',
          }}
        >
          {/* Mini shield icon */}
          <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M9.661 2.237a.531.531 0 0 1 .678 0 11.947 11.947 0 0 0 7.078 2.749.5.5 0 0 1 .479.425c.069.52.104 1.05.104 1.589 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 0 1-.332 0C5.26 16.563 2 12.162 2 7c0-.538.035-1.069.104-1.589a.5.5 0 0 1 .48-.425 11.947 11.947 0 0 0 7.077-2.749Z" clipRule="evenodd" />
          </svg>
          Fact Check
        </span>
      )}

      {/* ── OPTION D: Hover tooltip ── */}
      <div style={tooltipStyle} role="tooltip" aria-live="polite">
        {/* Arrow */}
        <div style={arrowStyle} />

        {/* Header */}
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#64748b', marginBottom: 9 }}>
          🛡 Fact-Check Analysis
        </div>

        {loading && <TooltipSkeleton />}

        {error && (
          <p style={{ fontSize: 10, color: '#64748b' }}>Could not load fact-check data.</p>
        )}

        {fc && !loading && (
          <>
            {/* Score bar */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>Score</span>
              <GaugeBar score={score} color={colors.bar} />
              <span style={{ fontSize: 10, color: colors.text, fontWeight: 700, flexShrink: 0 }}>{Math.round(score)}</span>
            </div>

            {row('AI Verdict',   verdict,   colors.text)}
            {fc.aiVerdict && fc.aiVerdict !== verdict && row('AI Analysis', fc.aiVerdict, colors.text)}
            {mismatch && row('Headline Match', mismatch,
              mismatch === 'Accurate' ? '#34d399' : mismatch === 'Slightly Misleading' ? '#fcd34d' : '#f87171'
            )}

            {/* AI Signals */}
            {Object.keys(signals).length > 0 && (
              <>
                {divider()}
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#64748b', marginBottom: 6 }}>
                  AI Signals
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {Object.entries(signals).map(([key, val]) => (
                    <div key={key} style={{ background: '#1e293b', borderRadius: 5, padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 8, color: '#64748b', fontWeight: 600, textTransform: 'capitalize' }}>{key}</span>
                      <SignalDots value={val} color={colors.bar} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Flags */}
            {flags.length > 0 && (
              <>
                {divider()}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {flags.slice(0, 4).map((f, i) => (
                    <span
                      key={i}
                      style={{
                        background: flagColors.bg,
                        border: `1px solid ${flagColors.border}`,
                        color: flagColors.text,
                        fontSize: 8,
                        fontWeight: 700,
                        padding: '2px 5px',
                        borderRadius: 4,
                        textTransform: 'uppercase',
                        letterSpacing: '.05em',
                      }}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </>
            )}

            {/* PIB matches */}
            {pibMatches.length > 0 && (
              <>
                {divider()}
                <div
                  style={{
                    background: '#1e293b',
                    borderLeft: '2px solid #f59e0b',
                    borderRadius: 4,
                    padding: '5px 8px',
                    fontSize: 9,
                    color: '#cbd5e1',
                    lineHeight: 1.4,
                  }}
                >
                  📢 PIB Fact Check: {pibMatches[0].title}
                </div>
              </>
            )}

            {/* Google Fact Check matches */}
            {fc.matches?.length > 0 && (
              <>
                {divider()}
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#64748b', marginBottom: 4 }}>
                  Fact-Checked By
                </div>
                {fc.matches.slice(0, 2).map((m, i) => (
                  <div key={i} style={{ background: '#1e293b', borderRadius: 4, padding: '4px 7px', marginBottom: 3 }}>
                    <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>{m.publisher}</div>
                    <div style={{ fontSize: 9, color: '#64748b' }}>{m.verdict}</div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
