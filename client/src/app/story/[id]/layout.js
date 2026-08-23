import { extractIdFromParam, makeStorySlug } from '@/lib/slug';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bharatnewsnarratives.com';

async function getArticle(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/news/${id}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Ensures an image URL is fully qualified (absolute) for social media crawlers.
 * Facebook, Twitter/X, LinkedIn, and WhatsApp bots CANNOT resolve relative URLs
 * or localhost addresses — they need a complete https:// URL.
 */
function toAbsoluteImageUrl(rawUrl) {
  if (!rawUrl) return null;

  // Already a full URL (http or https)
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;

  // Relative path — prepend the public site origin
  if (rawUrl.startsWith('/')) return `${SITE_URL}${rawUrl}`;

  // Anything else — treat as relative
  return `${SITE_URL}/${rawUrl}`;
}

export async function generateMetadata({ params }) {
  const { id: rawParam } = await params;
  // Extract pure ObjectId from a potentially slug-suffixed param
  const id = extractIdFromParam(rawParam);
  const article = await getArticle(id);

  // The canonical URL always points to the pretty slug URL
  const canonicalUrl = article
    ? `${SITE_URL}${makeStorySlug(article)}`
    : `${SITE_URL}/story/${rawParam}`;

  if (!article) {
    return {
      title: 'Story Not Found — Bharat News Narratives',
      alternates: { canonical: canonicalUrl },
    };
  }

  const title = (article.title || article.topic || 'Story').replace(/^Trending:\s*/i, '');
  const description = (article.summary || '').slice(0, 160);

  // Resolve the best available image and guarantee it is an absolute URL
  const rawImageUrl =
    article.imageUrl ||
    article.sourceOptions?.[0]?.imageUrl ||
    null;
  const imageUrl = toAbsoluteImageUrl(rawImageUrl) || `${SITE_URL}/BNN_logonew.png`;

  return {
    title: `${title} — Bharat News Narratives`,
    description,
    // Canonical URL — prevents duplicate content issues
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Bharat News Narratives',
      locale: 'en_IN',
      type: 'article',
      publishedTime: article.publishedAt || article.generatedAt,
      modifiedTime: article.updatedAt || article.publishedAt || article.generatedAt,
      authors: article.author?.name ? [article.author.name] : ['Bharat News Narratives'],
      section: article.category || 'News',
      tags: article.tags || [],
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function StoryLayout({ children }) {
  return children;
}
