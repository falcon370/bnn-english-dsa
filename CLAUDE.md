# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Bharat News Narratives (BNN)** — an AI-powered Indian news platform. Trending topics are fetched via SerpApi, articles synthesized by Google Gemini, stored in MongoDB, and served through a Next.js frontend. A daily ePaper PDF edition is generated as a separate Cloud Run job.

## Repository Structure

Four independent services:

- `client/` — Next.js 16 frontend (App Router, Tailwind CSS)
- `server/` — Express.js backend (MongoDB, JWT auth, cron jobs)
- `epaper-printer/` — Node.js Cloud Run job that generates a Tabloid PDF newspaper
- `embedding-service/` — Python FastAPI service (sentence-transformers) for image vector search

## Commands

### Client (from `client/`)
```bash
npm run dev      # Start dev server (Turbopack)
npm run build    # Production build
npm run lint     # ESLint
```

### Server (from `server/`)
```bash
npm run dev                    # Start with nodemon on port 5000
npm run dev:demo               # Start pinned to the isolated bnn_demo database (see .env.demo)
npm run start                  # Start production server
npm test                       # Run tests
npm run udaan:backfill:embeddings  # One-time backfill of News.embedding for pre-existing articles
npm run udaan:index:news       # Create the Atlas $vectorSearch index on News.embedding
npm run bench                  # Run ANN + dedup sanity-check benchmarks (server/bench/)
```

### ePaper Printer (from `epaper-printer/`)
```bash
# Run against local server
NEWS_API_BASE_URL=http://localhost:5000 OUTPUT_DIR=./output_local SAVE_HTML=1 node src/index.js

# Run against fixture data (no server needed)
FIXTURE_FILE=./fixtures/stories.json OUTPUT_DIR=./output_local SAVE_HTML=1 node src/index.js

# After upgrading Playwright, download the new browser binary
npx playwright install chromium
```

### Embedding Service (from `embedding-service/`)
```bash
uvicorn app.main:app --reload   # Dev server on port 8000
```

## Environment Variables

**Server `.env`:**
- `MONGO_URI` — MongoDB connection string
- `JWT_SECRET` — JWT signing secret (required)
- `GOOGLE_API_KEYS` — Comma-separated Gemini API keys (rotated automatically)
- `SERPAPI_KEYS` — Comma-separated SerpApi keys (rotated automatically)
- `PORT` — Server port (default: 5000)
- `TRENDING_REFRESH_CRON` — Cron schedule for content refresh
- `GCS_BUCKET`, `GCS_PREFIX` — Google Cloud Storage bucket for ePaper files
- `EMBEDDING_SERVICE_URL` — URL of the embedding service (default: `http://localhost:8000`)
- `FACEBOOK_PAGE_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID` — Social posting credentials
- `CRON_SECRET` — Secret for GitHub Actions social poster webhook

**Server `.env.demo`** (optional, used only by `npm run dev:demo`):
- `MONGO_URI` — points at an isolated `bnn_demo` database (same Atlas cluster, separate DB) so demos/tests don't touch production data. `dotenv` never overwrites an already-set var, so loading `.env.demo` first means `src/index.js`'s own `dotenv.config()` fills in every other variable (`JWT_SECRET`, API keys, etc.) from the regular `.env`.

**Client `.env.local`:**
- `NEXT_PUBLIC_API_BASE_URL` — Backend API URL

**ePaper Printer env:**
- `NEWS_API_BASE_URL` — Backend API URL (required unless using `FIXTURE_FILE`)
- `FIXTURE_FILE` — Path to a JSON fixture; bypasses the API entirely
- `OUTPUT_DIR` — Where to write the PDF (default: `/tmp/epaper`)
- `SAVE_HTML=1` — Also writes the rendered HTML alongside the PDF (useful for debugging layout)
- `EDITION_DATE` — Override date in `YYYY-MM-DD` format
- `MAX_STORIES` — Cap total articles (default: 100)
- `MAX_STORIES_PER_CATEGORY` — Cap per category (default: 20)

## Architecture

### Content Ingestion Pipeline (`server/src/services/trending/`)

The core automated pipeline runs on a node-cron schedule and has three entry points exported from `index.js`:

1. **`runTrendingIngestion(config)`** — scheduled pipeline. Config profiles (`CONFIG_1AM`, `CONFIG_REGULAR`, `CONFIG_MANUAL_5`) are defined in `ingestionConfig.js` and control which SerpApi category IDs to query and how many articles to fetch per run.
2. **`refreshCategoryFeeds()`** — fetches articles for editorial category feeds defined in `CATEGORY_FEEDS` in `ingestionConfig.js`.
3. **`generateNewsFromTopic(opts)`** — on-demand single-topic generation triggered by the admin UI.

Each pipeline call flows through: `serpApiClient` → `preGeminiRefiner` → `geminiClient` → `politicsClassifier` → `imageResolver` → MongoDB.

**Gemini client** (`geminiClient.js`): Rotates across multiple API keys and a model fallback chain (`gemini-3.5-flash` → `gemini-3-flash-preview` → `gemini-3.1-flash-lite` → `gemini-2.5-flash`). Enforces a 15-second minimum interval between calls. Gemini output contains raw Markdown — callers must strip it before rendering.

**Image resolution** (`imageResolver.js`): Routes image lookups by `imageSubjectType` returned by Gemini:
- `specific_person` / `political_party` / `specific_place` → self-hosted image repository first (vector similarity search via embedding service), then Wikimedia
- `generic_society` / `generic` → Unsplash, then Wikimedia
- Falls back to category-matched local images in `server/BNN_images/<category>/`

**Image repository** (`imageRepositoryService.js`): Searches `ImageMetadata` collection using both text scoring and 384-dimension vector embeddings (generated by the embedding service). Requires a MongoDB Atlas vector index named `image_embedding_vector_index`.

### Udaan: dedup + semantic search (`server/src/services/udaan/`)

Udaan is a ninth editorial vertical (innovation/founder/grit stories, registered as a `CATEGORY_FEEDS` entry in `ingestionConfig.js`) and the infrastructure that makes it viable is reused sitewide. Full spec: `docs/UDAAN_VERTICAL_SPEC.md`.

- **Near-duplicate detection at ingest** (`minhash.js`, `lshIndex.js`, `unionFind.js`, `index.js`): innovation/motivation stories get syndicated far more heavily than breaking news, so every category feed is deduplicated before hitting Gemini. MinHash (128 permutations over 5-word shingles) signs each article; banded LSH (32 bands × 4 rows) buckets signatures so only likely-duplicate pairs get compared; Union-Find merges verified duplicates (`VERIFY_THRESHOLD = 0.5`) into a "story arc" — the first article becomes the Gemini-published representative, later duplicates merge into its `sourceOptions` instead of triggering a new Gemini call. Wired into `ingestCategoryFeeds` (`ingestionOrchestrator.js`) for every category feed, not just Udaan.
- **Semantic search & related stories**: reuses the image-search pattern (`EmbeddingClient` + Atlas `$vectorSearch`) instead of a hand-rolled ANN index. `udaan.registerArticle()` embeds each published article's `title + summary` (MiniLM 384-dim) into `News.embedding` for every category feed, sitewide. `GET /api/news?mode=semantic&q=...` embeds the query and ranks via `$vectorSearch`, falling back to the existing keyword regex search on any failure (embedding service down, index missing) — semantic mode can never make search worse. `GET /api/news/:id/related` does the same against the story's own embedding, falling back to plain category match.
- **One-time setup scripts**: `npm run udaan:index:news` creates the `$vectorSearch` index on `News.embedding` (same shape as `image:index`); `npm run udaan:backfill:embeddings` backfills embeddings for pre-existing articles.
- **Sanity-check benchmarks** (`server/bench/dedupBench.js`, `annBench.js`, run via `npm run bench`): informal true-pairwise ground truth checks against the LSH candidate generation, useful if `VERIFY_THRESHOLD` or the band config ever need re-tuning. Not a formal benchmark deliverable.

### Server Routes (`/api/`)

| Route | Purpose |
|---|---|
| `/auth` | JWT login/register |
| `/news` | Article CRUD; homepage feed merges main feed + guaranteed `Bolta Hai Bharat` + `Editorial` articles; supports `?mode=semantic&q=...` (Atlas `$vectorSearch`, falls back to regex search) and `GET /news/:id/related` (semantic related-stories, falls back to category match) |
| `/trending` | Pipeline triggers and status |
| `/authors` | Author profiles |
| `/social` | Facebook posting (triggered by GitHub Actions every 15 min) |
| `/epaper` | ePaper CRUD, download, thumbnail, register, trigger generation |
| `/images` | Image metadata and repository search |
| `/health` | Health check |

Static files: `server/BNN_images/` served at `/BNN_images`, `server/epaper-files/` served at `/epaper-files`.

Auth middleware (`middleware/auth.js`) verifies JWT from `Authorization: Bearer` header.

### ePaper Printer (`epaper-printer/src/`)

A standalone Node.js script (not a server) that runs as a Cloud Run job:

1. Fetches stories from `/api/news` and `/api/trending`, merges and ranks by recency + image presence + trending boost
2. Caps stories per category (`MAX_STORIES_PER_CATEGORY`) then globally (`MAX_STORIES`)
3. `buildEditionLayout()` in `layout.js` packs stories into a front page + one page per category. Categories with fewer than `MIN_CATEGORY_STORIES` articles are excluded to avoid sparse pages.
4. `renderHtml()` produces a self-contained HTML string with all CSS inlined
5. Playwright/Chromium renders it to a Tabloid (11×17") PDF
6. Calls `POST /api/epaper/register` to record the edition in MongoDB
7. Optionally uploads to GCS

**Layout constants to know** (`layout.js`):
- `PAGE_CAPACITY = 150`, `HEADER_TOP = 7` — controls how many story "cost units" fit per category page
- Lead story costs `heightWeight`, each additional story costs `heightWeight/5` (spread across 5 CSS columns)
- `MIN_CATEGORY_STORIES = 20` — categories below this threshold are skipped

### Frontend (`client/src/`)

- All API calls go through `src/lib/api.js` (Axios instance with `NEXT_PUBLIC_API_BASE_URL` base)
- JWT is stored in localStorage and exposed via `AuthContext`
- Homepage (`app/page.js`) fetches all published articles and carves out category sections client-side; the hero rotates political stories every 20 minutes
- Categories are defined in `Navbar.js` and `app/category/[slug]/page.js` (`CATEGORY_META`/`CATEGORY_COLORS`) — nine total, including `Udaan`
- ePaper download route `app/api/epaper/[id]/download/route.js` proxies the PDF from the backend

### Embedding Service (`embedding-service/`)

FastAPI service using `sentence-transformers/all-MiniLM-L6-v2` producing 384-dimensional embeddings. Used exclusively by `imageRepositoryService.js` to find the best matching image for an article. Endpoints: `POST /embed` (single) and `POST /embed/batch`.

## Deployment

Google Cloud Run via `cloudbuild.yaml`. Each service has its own Dockerfile. Region: `asia-south1`.

A GitHub Actions workflow (`.github/workflows/social-poster.yml`) hits `POST /api/social` every 15 minutes using `CRON_SECRET`.

The ePaper printer runs as a Cloud Run Job triggered by `epaperService.js` via the Cloud Run Jobs API, passing `EDITION_DATE` as an env override when needed.
