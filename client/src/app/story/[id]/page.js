import { notFound, permanentRedirect } from 'next/navigation';
import { getNewsById, getPublishedNews } from '@/lib/api';
import { extractIdFromParam, hasSlug, makeStorySlug } from '@/lib/slug';
import StoryContent from './StoryContent';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bharatnewsnarratives.com';

/**
 * Generates dynamic SEO metadata for each story page.
 * Next.js App Router reads this on the server to populate <head> tags
 * for Googlebot and social media crawlers (WhatsApp, Twitter, Facebook).
 */
export async function generateMetadata({ params }) {
  const { id: rawParam } = await params;
  const id = extractIdFromParam(rawParam);

  try {
    const res = await getNewsById(id);
    const story = res?.data;

    if (!story) {
      return {
        title: 'Story Not Found | Bharat News Narratives',
      };
    }

    const title = (story.title || story.topic || 'Untitled').replace(/^Trending:\s*/i, '');
    const description = (story.summary || story.content || '').slice(0, 160).replace(/\s+/g, ' ').trim();
    const canonicalUrl = `${SITE_URL}${makeStorySlug(story)}`;
    const imageUrl =
      story.imageUrl ||
      story.sourceOptions?.[0]?.imageUrl ||
      `${SITE_URL}/BNN_logonew.png`;

    const publishedAt = story.publishedAt || story.generatedAt || new Date().toISOString();
    const modifiedAt = story.updatedAt || publishedAt;
    const isTelugu = story.category?.toLowerCase() === 'telugu' || story.language === 'te' || /[\u0C00-\u0C7F]/.test(title);

    return {
      title: `${title} | Bharat News Narratives`,
      description: description || `Read ${title} on Bharat News Narratives.`,
      keywords: [
        story.category,
        ...(story.tags || []),
        'bharat news narratives',
        'news',
        'india news',
        ...(isTelugu ? ['telugu news', 'bnn telugu', 'telugu samachar', 'andhra pradesh news', 'telangana news'] : []),
      ].filter(Boolean),
      alternates: {
        canonical: canonicalUrl,
      },
      openGraph: {
        title: `${title} | Bharat News Narratives`,
        description,
        url: canonicalUrl,
        siteName: 'Bharat News Narratives',
        locale: isTelugu ? 'te_IN' : 'en_IN',
        type: 'article',
        publishedTime: new Date(publishedAt).toISOString(),
        modifiedTime: new Date(modifiedAt).toISOString(),
        authors: story.author?.name ? [story.author.name] : ['Bharat News Narratives Editorial'],
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
        title: `${title} | Bharat News Narratives`,
        description,
        images: [imageUrl],
      },
    };
  } catch (err) {
    console.error('Failed to generate metadata for story:', err);
    return {
      title: 'Bharat News Narratives',
    };
  }
}

/**
 * Builds Google-recommended NewsArticle and BreadcrumbList JSON-LD objects.
 * Rendered server-side so it appears in the HTML source for crawlers.
 */
function buildArticleJsonLd(story, slugParam) {
  if (!story) return null;

  const title = (story.title || story.topic || 'Untitled').replace(/^Trending:\s*/i, '');
  const description = (story.summary || '').slice(0, 200);
  const articleUrl = `${SITE_URL}${makeStorySlug(story)}`;
  const imageUrl =
    story.imageUrl ||
    story.sourceOptions?.[0]?.imageUrl ||
    `${SITE_URL}/BNN_logonew.png`;

  const publishedAt = story.publishedAt || story.generatedAt || new Date().toISOString();
  const modifiedAt = story.updatedAt || publishedAt;
  const isTelugu = story.category?.toLowerCase() === 'telugu' || story.language === 'te' || /[\u0C00-\u0C7F]/.test(title);

  const newsArticleSchema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
    headline: title,
    description,
    image: imageUrl ? [imageUrl] : [],
    datePublished: new Date(publishedAt).toISOString(),
    dateModified: new Date(modifiedAt).toISOString(),
    author: story.author
      ? {
          '@type': 'Person',
          name: story.author.name || 'BNN Editorial',
          url: story.author._id
            ? `${SITE_URL}/author/${story.author._id}`
            : undefined,
        }
      : {
          '@type': 'Organization',
          name: 'Bharat News Narratives Editorial',
          url: SITE_URL,
        },
    publisher: {
      '@type': 'Organization',
      name: 'Bharat News Narratives',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/BNN_logonew.png`,
        width: 600,
        height: 60,
      },
    },
    articleSection: story.category || 'News',
    keywords: story.tags?.join(', ') || story.category || '',
    inLanguage: isTelugu ? 'te-IN' : 'en-IN',
    isAccessibleForFree: true,
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: story.category || 'News',
        item: `${SITE_URL}/category/${(story.category || 'news').toLowerCase().replace(/\s+/g, '-')}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: title,
        item: articleUrl,
      },
    ],
  };

  return [newsArticleSchema, breadcrumbSchema];
}

export default async function StoryPage({ params }) {
  const { id: rawParam } = await params;

  // Extract the clean MongoDB ObjectId from the URL param
  // (param may look like "6a2e4b70bdeef7fcfba0306a-pm-modi-addresses-parliament")
  const id = extractIdFromParam(rawParam);

  let story = null;
  let allPublishedNews = [];

  try {
    const [storyRes, newsRes] = await Promise.all([
      getNewsById(id),
      getPublishedNews(),
    ]);
    story = storyRes.data;
    allPublishedNews = newsRes.data || [];
  } catch (error) {
    console.error('Failed to fetch story on server:', error);
  }

  // Story doesn't exist or was deleted — return a proper HTTP 404.
  // This prevents Googlebot from treating it as a Soft 404 (200 with error UI).
  if (!story) notFound();

  // If the visitor landed on a bare-ID URL (e.g. /story/6a2e4b70bdeef7fcfba0306a),
  // 301-redirect them to the canonical pretty slug URL so search engines index the
  // correct, descriptive URL going forward.
  if (!hasSlug(rawParam)) {
    permanentRedirect(makeStorySlug(story));
  }

  const jsonLdSchemas = buildArticleJsonLd(story, rawParam);

  return (
    <>
      {/* JSON-LD structured data — visible to crawlers in HTML source */}
      {jsonLdSchemas && jsonLdSchemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <StoryContent initialStory={story} allPublishedNews={allPublishedNews} />
    </>
  );
}

