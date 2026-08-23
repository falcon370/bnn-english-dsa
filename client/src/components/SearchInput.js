'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SearchInput({ mobile = false }) {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className={`relative group ${mobile ? 'w-full' : 'w-52'}`}>
      <input
        type="text"
        placeholder="Search news..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={`h-9 w-full pl-4 pr-9 rounded-md text-sm outline-none transition-all ${
          mobile
            ? 'bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:bg-white'
            : 'bg-white/10 border border-white/20 text-white placeholder-blue-300/70 focus:ring-2 focus:ring-white/40 focus:bg-white/15 backdrop-blur-sm'
        }`}
      />
      <button type="submit" className={`absolute right-3 top-2.5 transition-colors ${mobile ? 'text-gray-400 hover:text-gray-600' : 'text-blue-300/70 hover:text-white'}`}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M16.65 11a5.65 5.65 0 11-11.3 0 5.65 5.65 0 0111.3 0z" />
        </svg>
      </button>
    </form>
  );
}
