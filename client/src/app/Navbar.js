'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import SearchInput from '@/components/SearchInput';

const categories = [
  { label: 'Home', href: '/', exact: true, icon: true },
  { label: 'Business', href: '/category/business', exact: false },
  { label: 'World', href: '/category/world', exact: false },
  { label: 'Politics', href: '/category/politics', exact: false },
  { label: 'Technology', href: '/category/technology', exact: false },
  { label: 'Sports', href: '/category/sports', exact: false },
  { label: 'Entertainment', href: '/category/entertainment', exact: false },
  // { label: 'Celebrity', href: '/category/celebrity', exact: false },
  { label: 'Bolta Hai Bharat', href: '/category/bolta-hai-bharat', exact: false },
  { label: 'Editorial', href: '/category/editorial', exact: false },
  { label: 'E-Paper', href: '/epaper', exact: true },
  { label: 'Fact Check', href: '/factcheck', exact: true },
];

export default function NavBar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef(null);

  // Close mobile menu on route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll state for desktop horizontal scroll
  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true });
      window.addEventListener('resize', checkScroll);
    }
    return () => {
      if (el) el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  return (
    <nav className="bg-white sticky top-0 z-50 shadow-sm border-b border-gray-200">
      <div className="max-w-[1440px] mx-auto px-2 md:px-6 relative">
        
        {/* Desktop: Horizontally scrollable nav */}
        <div className="hidden md:block relative">
          {/* Left fade */}
          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
          )}

          <div
            ref={scrollRef}
            className="flex items-center h-11 overflow-x-auto scrollbar-hide gap-0"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {categories.map((cat) => {
              const currentPath = pathname || '';
              const isActive = cat.exact
                ? currentPath === cat.href
                : currentPath.startsWith(cat.href);

              return (
                <Link
                  key={cat.label}
                  href={cat.href}
                  className={`
                    cursor-pointer text-[13px] whitespace-nowrap
                    px-3 md:px-4 h-11 flex items-center gap-1.5 transition-all duration-200 select-none
                    border-b-2 -mb-px
                    ${isActive
                      ? 'text-[#1A56C4] font-semibold border-[#1A56C4]'
                      : 'text-gray-600 font-medium border-transparent hover:text-[#1A56C4] hover:border-[#1A56C4]/30'
                    }
                  `}
                >
                  {cat.icon && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
                      <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
                      <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
                    </svg>
                  )}
                  {cat.label}
                </Link>
              );
            })}
          </div>

          {/* Right fade */}
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
          )}
        </div>

        {/* Mobile: Dropdown Trigger */}
        <div className="md:hidden flex items-center justify-between h-11 px-2">
          <span className="text-gray-800 font-bold text-sm tracking-wide">Categories</span>
          <button
            className="text-gray-700 p-2 focus:outline-none"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-lg absolute w-full left-0">
          <div className="max-w-[1440px] mx-auto px-4 py-3 flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
            {/* Search Input for Mobile */}
            <div className="pb-3 pt-1 mb-2 border-b border-gray-100">
              <SearchInput mobile />
            </div>
            {categories.map((cat) => {
              const currentPath = pathname || '';
              const isActive = cat.exact
                ? currentPath === cat.href
                : currentPath.startsWith(cat.href);
              return (
                <Link
                  key={cat.label}
                  href={cat.href}
                  onClick={() => setMenuOpen(false)}
                  className={`
                    cursor-pointer text-[13px] font-medium tracking-wide
                    px-4 py-3 rounded-lg transition-all duration-200 select-none flex items-center gap-2
                    ${isActive
                      ? 'text-[#1A56C4] bg-blue-50 font-semibold'
                      : 'text-gray-700 hover:text-[#1A56C4] hover:bg-gray-50'
                    }
                  `}
                >
                  {cat.icon && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
                      <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
                    </svg>
                  )}
                  {cat.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Hide scrollbar via global style */}
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </nav>
  );
}