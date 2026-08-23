import TimelineClient from './TimelineClient';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bharatnewsnarratives.com';

export const metadata = {
  title: 'Politics News Timeline — Bharat News Narratives',
  description: 'Chronological timeline of Indian politics updates, elections, and government policy decisions from the last 30 days.',
  alternates: {
    canonical: `${SITE_URL}/timelines`,
  },
  openGraph: {
    title: 'Politics News Timeline — Bharat News Narratives',
    description: 'Chronological timeline of Indian politics updates, elections, and government policy decisions from the last 30 days.',
    url: `${SITE_URL}/timelines`,
    siteName: 'Bharat News Narratives',
    locale: 'en_IN',
    type: 'website',
    images: [{ url: `${SITE_URL}/BNN_logonew.png`, width: 1200, height: 630, alt: 'Politics Timeline — BNN' }],
  },
};

async function fetchPoliticsNews30Days() {
  try {
    const url = new URL(`${API_BASE_URL}/api/news`);
    url.searchParams.set('category', 'politics');
    url.searchParams.set('days', '30'); // Limit strictly to the last 1 month (30 days)
    url.searchParams.set('limit', '25'); // Pull 25 items initially
    url.searchParams.set('page', '1');

    const res = await fetch(url.toString(), {
      // Revalidate every 5 minutes (300 seconds) to balance freshness and performance
      next: { revalidate: 300 },
    });
    if (!res.ok) return { news: [], pages: 1 };
    return await res.json();
  } catch (err) {
    console.error('[politics timeline] Fetch failed:', err.message);
    return { news: [], pages: 1 };
  }
}

export default async function NewsTimelinePage() {
  const data = await fetchPoliticsNews30Days();
  const news = data.news || [];
  const totalPages = data.pages || 1;
  const hasMore = totalPages > 1;

  return (
    <div className="bg-[#faf7f0] min-h-screen text-gray-900 pb-24 font-sans selection:bg-[#a75d34]/20">
      <main className="max-w-xl mx-auto px-6 py-12">
        {/* Minimalist header matched to reference image */}
        <header className="mb-10">
          <div className="flex items-center gap-4">
            <h1 className="text-xs font-bold uppercase tracking-[0.25em] text-[#8a7a5f]">
              Timeline
            </h1>
            <div className="flex-grow h-[1px] bg-[#e6e1d5]" />
          </div>
        </header>

        {news.length === 0 ? (
          <div className="text-center py-16 bg-white/40 border border-[#e6e1d5] rounded-sm px-4">
            <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="mt-4 text-sm font-bold text-gray-700 font-sans uppercase tracking-wider">No updates in the last 30 days</h3>
            <p className="mt-2 text-gray-500 font-sans text-xs max-w-xs mx-auto">There are no politics news articles published in the last month. Check back soon for new updates.</p>
          </div>
        ) : (
          <TimelineClient initialArticles={news} initialHasMore={hasMore} />
        )}
      </main>
    </div>
  );
}
