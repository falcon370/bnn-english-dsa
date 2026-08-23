'use client';

import { useState, useEffect } from 'react';

/**
 * CredibilityMeter — A gauge-style speedometer meter that visualizes a score.
 * It animates with a spring-like sweep and overshoot on mount or score change.
 *
 * Props:
 *  score    {number} - 0 to 100
 *  verdict  {string} - 'Credible' | 'Needs Context' | 'Questionable' | 'Likely False' | 'Opinion'
 *  size     {string} - 'sm' | 'md' | 'lg' (default: 'md')
 *  className {string} - optional override for wrapper classes
 */
export default function CredibilityMeter({ score = 0, verdict = 'Questionable', size = 'md', className = '' }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const targetScore = verdict === 'Opinion' ? 60 : score;

  useEffect(() => {
    // Tiny delay to ensure browser transition registers after mounting
    const timer = setTimeout(() => {
      setAnimatedScore(targetScore);
    }, 150);
    return () => clearTimeout(timer);
  }, [targetScore]);

  // Calculate rotation angle for the needle:
  // -90deg is 0% (far left), 0deg is 50% (straight up), +90deg is 100% (far right)
  const angle = -90 + (animatedScore / 100) * 180;

  // Arc length of a semi-circle with r = 40 is pi * r = 125.66
  const arcLength = 125.66;
  const strokeDashoffset = arcLength - (animatedScore / 100) * arcLength;

  const sizeClasses = {
    sm: 'w-24 h-16',
    md: 'w-32 h-20',
    lg: 'w-44 h-28',
  };

  const containerClass = className || sizeClasses[size] || sizeClasses.md;

  return (
    <div className={`relative ${containerClass} flex-shrink-0 select-none`}>
      <svg
        className="w-full h-full overflow-visible"
        viewBox="0 5 100 60"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Continuous premium credibility gradient */}
          <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" /> {/* Red */}
            <stop offset="35%" stopColor="#f59e0b" /> {/* Amber */}
            <stop offset="70%" stopColor="#eab308" /> {/* Yellow */}
            <stop offset="100%" stopColor="#10b981" /> {/* Emerald */}
          </linearGradient>
        </defs>

        {/* Background gauge track */}
        <path
          d="M 10 54 A 40 40 0 0 1 90 54"
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Colored active gauge track */}
        <path
          d="M 10 54 A 40 40 0 0 1 90 54"
          fill="none"
          stroke="url(#gauge-gradient)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 1.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />

        {/* Pointer/needle */}
        <g
          style={{
            transform: `rotate(${angle}deg)`,
            transformOrigin: '50px 54px',
            transition: 'transform 1.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* Tapered speedometer-style needle */}
          <polygon
            points="48.5,54 51.5,54 50,18"
            fill="#334155"
            className="drop-shadow-[0_2px_3px_rgba(0,0,0,0.18)]"
          />
          {/* Premium white detail line on the needle */}
          <line x1="50" y1="24" x2="50" y2="40" stroke="#ffffff" strokeWidth="0.8" opacity="0.6" strokeLinecap="round" />
        </g>

        {/* Center Cap layering */}
        <circle cx="50" cy="54" r="6" fill="#1e293b" />
        <circle cx="50" cy="54" r="3.5" fill="#475569" />
        <circle cx="50" cy="54" r="1.5" fill="#94a3b8" />

        {/* Center Score Text */}
        <text
          x="50"
          y={verdict === 'Opinion' ? 48 : 46}
          textAnchor="middle"
          className={`font-black font-sans tracking-tight ${
            verdict === 'Opinion' ? 'fill-purple-600 text-[22px]' : 'fill-slate-800 text-[17px]'
          }`}
        >
          {verdict === 'Opinion' ? '✎' : Math.round(animatedScore)}
        </text>
      </svg>
    </div>
  );
}
