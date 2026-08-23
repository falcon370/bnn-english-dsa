'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle({ className = "" }) {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    // Sync React state with the class present on the document element
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setTheme('dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setTheme('light');
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className={`h-9 w-9 flex items-center justify-center rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all focus:outline-none shadow-sm shrink-0 ${className}`}
      title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      aria-label="Toggle dark mode"
    >
      {theme === 'light' ? (
        // Moon Icon (shown in light mode, switch to dark)
        <svg className="w-4 h-4 text-blue-200 hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ) : (
        // Sun Icon (shown in dark mode, switch to light)
        <svg className="w-4 h-4 text-amber-300 hover:text-amber-100 transition-colors animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="5" fill="currentColor" opacity="0.2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.022 12.022l.707-.707M12 7a5 5 0 100 10 5 5 0 000-10z" />
        </svg>
      )}
    </button>
  );
}
