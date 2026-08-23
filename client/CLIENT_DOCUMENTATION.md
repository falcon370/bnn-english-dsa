# Client Documentation

## Overview

Next.js 16 (App Router) frontend for Bharat News Narratives. Renders public news pages, category listings, story detail, ePaper, author profiles, and an admin dashboard.

## Requirements

- Node.js 18+
- Backend API running (default: `http://localhost:5000`)

## Stack

- Next.js 16 + React 19
- Tailwind CSS 3 + PostCSS + Autoprefixer
- Axios for API calls
- ESLint 9 + eslint-config-next

## Project Structure

```
src/
├── app/
│   ├── page.js                  # Homepage — hero + category sections
│   ├── category/[slug]/page.js  # Paginated category listing
│   ├── story/[id]/              # Article detail + SEO metadata
│   ├── trending/page.js
│   ├── author/[id]/page.js
│   ├── epaper/page.js           # ePaper edition listing + download
│   ├── admin/
│   │   ├── login/page.js
│   │   └── dashboard/page.js    # Content management (admin only)
│   ├── auth/register/page.js
│   ├── profile/page.js
│   ├── api/epaper/[id]/download/route.js  # Proxies PDF from backend
│   ├── Navbar.js
│   ├── DateBar.js
│   ├── HeaderActions.js
│   └── layout.js                # Root layout — Merriweather + Inter fonts
├── components/
│   ├── Reactions.js
│   ├── RichTextEditor.js
│   └── Footer.js
├── context/AuthContext.js       # Global auth state, bootstrapped from /api/auth/me
├── hooks/useAuth.js
└── lib/
    ├── api.js                   # All API calls — single Axios instance
    └── legal.js
```

## Runtime Configuration

Create `client/.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`NEXT_PUBLIC_SITE_URL` is used for canonical and OpenGraph URLs in story metadata. Falls back to `https://bharatnewsnarratives.com` if not set.

## Build and Run

```bash
npm install
npm run dev      # Turbopack dev server → http://localhost:3000
npm run build
npm run start
npm run lint
```

## Authentication Flow

1. `AuthContext` calls `GET /api/auth/me` on mount using the token from `localStorage` (`news_token`).
2. On login/register, the returned JWT is stored in `localStorage` and the Axios default header is set to `Authorization: Bearer <token>`.
3. Admin dashboard enforces role check client-side; the backend also enforces it server-side on protected routes.

## API Integration

All API calls go through `src/lib/api.js`. Base URL: `${NEXT_PUBLIC_API_BASE_URL}/api`.

Endpoints consumed:
- `/auth` — register, login, me
- `/news` — published list (with category filter), detail, drafts, generate, editorial, publish, update, delete, comments, reactions
- `/trending` — list, status, refresh, refresh-categories
- `/authors` — create, list, detail, update
- `/epaper` — list, stats, download, thumbnail, trigger
- `/images` — search

## Homepage Architecture

`app/page.js` fetches all published articles in a single call and slices them into sections client-side:
- Hero: top political story, rotates every 20 minutes
- Trending strip: articles where `isTrending === true`
- Category sections: Politics, Sports, Tech, Business, Entertainment, Bolta Hai Bharat, Editorial

## SEO

Story route (`app/story/[id]/page.js`) generates `generateMetadata()` server-side per article with `cache: 'no-store'` to avoid stale social cards on republished articles.

## Docker

The Dockerfile accepts `NEXT_PUBLIC_API_BASE_URL` as a build arg, bakes it into the static Next.js build, and serves on port 3000. Keep `NEXT_PUBLIC_SITE_URL` aligned with the deployed domain for correct social metadata.
