# BNN Client

Next.js 16 (App Router) frontend for Bharat News Narratives.

## Stack

- Next.js 16 + React 19
- Tailwind CSS 3
- Axios (all calls go through `src/lib/api.js`)
- ESLint 9

## Setup

```bash
npm install
cp env.sample .env.local
```

`.env.local`:
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

```bash
npm run dev     # http://localhost:3000
npm run build
npm run start
npm run lint
```

## Pages

| Route | Description |
|---|---|
| `/` | Homepage — hero + category sections, hero rotates political stories every 20 min |
| `/category/[slug]` | Paginated category listing |
| `/story/[id]` | Article detail with comments and reactions |
| `/trending` | Trending articles |
| `/author/[id]` | Author profile + their articles |
| `/epaper` | Daily ePaper listing and PDF download |
| `/admin/login` | Admin login |
| `/admin/dashboard` | Content management (admin only) |
| `/auth/register` | Reader registration |
| `/profile` | Reader profile |

## Auth

JWT token is stored in `localStorage` under `news_token`. `AuthContext` (`src/context/AuthContext.js`) bootstraps the session via `GET /api/auth/me` on load and exposes `user`, `login`, `logout` to the rest of the app. The admin dashboard enforces role check client-side.

## API Client

`src/lib/api.js` exports an Axios instance with `baseURL = NEXT_PUBLIC_API_BASE_URL + '/api'`. All API wrappers live here — do not call `fetch` or create separate Axios instances elsewhere.

## Docker

The client Dockerfile accepts `NEXT_PUBLIC_API_BASE_URL` as a build arg (required for Cloud Build), bakes it into the Next.js static build, and serves on port 3000.
