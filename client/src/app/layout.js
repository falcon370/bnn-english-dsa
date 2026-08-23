import Link from 'next/link';
import Script from 'next/script';
import { Merriweather, Inter } from 'next/font/google';
import NavBar from './Navbar';
import DateBar from './DateBar';
import HeaderActions from './HeaderActions';
import Footer from '@/components/Footer';
import { AuthProvider } from '@/context/AuthContext';
import ThemeToggle from '@/components/ThemeToggle';
import SearchInput from '@/components/SearchInput';
import CookieConsent from '@/components/CookieConsent';
import './globals.css';

// Professional Serif for the Brand and Headlines
const merriweather = Merriweather({
  subsets: ['latin'],
  weight: ['300', '400', '700', '900'],
  variable: '--font-serif'
});

// Clean Sans-Serif for UI and Meta data
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans'
});

const SITE_URL = 'https://bharatnewsnarratives.com';

export const metadata = {
  // metadataBase is REQUIRED for Next.js to resolve canonical, OG, and Twitter
  // image URLs to absolute URLs. Without this, they remain relative.
  metadataBase: new URL(SITE_URL),

  title: {
    default: 'Bharat News Narratives | Independent Journalism',
    template: '%s | Bharat News Narratives'
  },
  description: 'Independent journalism. Editorial clarity. Insightful news from India and the world.',
  keywords: [
    'news',
    'india',
    'journalism',
    'independent',
    'bharat',
    'narratives',
    'telugu news',
    'bnn telugu',
    'andhra pradesh news',
    'telangana news',
    'breaking news',
    'indian news portal',
  ],
  other: {
    'google-adsense-account': 'ca-pub-5612187899816278',
  },

  // Canonical URL for the homepage
  alternates: {
    canonical: SITE_URL,
  },

  openGraph: {
    title: 'Bharat News Narratives',
    description: 'Independent journalism. Editorial clarity. Latest news from India & Telugu regions.',
    url: SITE_URL,
    siteName: 'Bharat News Narratives',
    locale: 'en_IN',
    type: 'website',
    images: [
      {
        url: `${SITE_URL}/BNN_logonew.png`,
        width: 800,
        height: 600,
        alt: 'Bharat News Narratives',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bharat News Narratives',
    description: 'Independent journalism. Editorial clarity.',
    images: [`${SITE_URL}/BNN_logonew.png`],
  },
  icons: {
    icon: '/BNN_logo.png',
    shortcut: '/BNN_logo.png',
    apple: '/BNN_logo.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: "P5njfVrD9juei1WcJRoCUG24sNdLn_36wQr3NRZi2Oc",
  },
};

const siteJsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    name: 'Bharat News Narratives',
    alternateName: ['BNN', 'BNN News', 'BNN Telugu'],
    url: SITE_URL,
    logo: `${SITE_URL}/BNN_logonew.png`,
    sameAs: [],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Bharat News Narratives',
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  },
];

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${merriweather.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme');
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `
          }}
        />
        {siteJsonLd.map((schema, idx) => (
          <script
            key={idx}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        ))}
      </head>
      <body className="antialiased bg-[#fdfdfd] font-sans text-gray-900" suppressHydrationWarning>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5612187899816278"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <AuthProvider>

          <header className="w-full">

            {/* ================= TOP BRANDING BAR (with Navbar.png background) ================= */}
            <div
              className="relative text-white py-2.5 md:py-3 shadow-md overflow-hidden"
              style={{
                backgroundImage: 'url(/Navbar.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundColor: '#0e3a8a',
              }}
            >
              <div className="relative max-w-[1440px] mx-auto px-4 md:px-6 flex items-center justify-between gap-3">

                {/* LOGO + WORDMARK */}
                <Link
                  href="/"
                  className="flex items-center gap-2 md:gap-3 hover:opacity-90 transition-opacity min-w-0"
                >
                  <img
                    src="/BNN_logonew.png"
                    alt="BNN"
                    className="w-12 h-12 md:w-14 md:h-14 rounded-full object-contain"
                  />

                  {/* Text wordmark next to the logo */}
                  <div className="flex flex-col leading-tight min-w-0">
                    <span
                      className="text-lg md:text-2xl font-black tracking-tight text-white truncate"
                      style={{ fontFamily: 'Georgia, serif' }}
                    >
                      <span className="hidden sm:inline">Bharat News Narratives</span>
                      <span className="sm:hidden">BNN</span>
                    </span>
                    <span
                      className="hidden sm:block text-[9px] uppercase tracking-[0.25em] text-blue-200/80 font-semibold mt-0.5"
                      style={{ fontFamily: 'Georgia, serif' }}
                    >
                      Independent &bull; Insightful &bull; Indian
                    </span>
                  </div>
                </Link>

                {/* ACTIONS: SEARCH & SUBSCRIBE — desktop only */}
                <div className="hidden md:flex items-center gap-3 flex-shrink-0">
                  <SearchInput />

                  <ThemeToggle />
                  <HeaderActions />
                </div>

                {/* MOBILE: Theme toggle & Actions */}
                <div className="md:hidden flex items-center gap-2 flex-shrink-0">
                  <ThemeToggle className="h-8 w-8" />
                  <HeaderActions mobile />
                </div>
              </div>
            </div>

            {/* ================= MASTHEAD (DATE & LOCATION — integrated into blue zone) ================= */}
            <DateBar />

            {/* ================= CATEGORY NAVIGATION ================= */}
            <NavBar />

          </header>

          {/* ================= PAGE CONTENT ================= */}
          <main>
            {children}
          </main>

          <Footer />

          <CookieConsent />

        </AuthProvider>
      </body>
    </html>
  );
}
