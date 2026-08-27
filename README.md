# Bharat News Narratives (BNN) - AI-Powered Trending News Platform

![Next.js](https://img.shields.io/badge/Next.js-black?style=for-the-badge&logo=next.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![Google Cloud](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white)
![Gemini AI](https://img.shields.io/badge/Gemini_AI-8E75B2?style=for-the-badge&logo=googlebard&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-45ba4b?style=for-the-badge&logo=playwright&logoColor=white)

**Bharat News Narratives** is a full-stack AI-powered news platform that fetches trending Indian topics via SerpApi, synthesizes publisher-ready articles using Google Gemini, and presents them through a modern Next.js frontend. A daily Tabloid-format PDF ePaper is generated automatically via a Cloud Run job. A semantic image search pipeline matches articles to a curated political image repository using vector embeddings.

## Key Features

- **Automated Content Pipeline**: Fetches top trending topics via SerpApi and Google Trends on a configurable cron schedule with multiple schedule profiles (1AM, regular, manual).
- **AI News Synthesis**: Uses Google Gemini (with model fallback chain and multi-key rotation) to digest sources and generate unbiased summaries.
- **Nine Editorial Verticals**: Politics, Business, Sports, Tech, World, Entertainment, Bolta Hai Bharat, Editorial, and **Udaan** — a constructive-news vertical for innovation/founder/grit stories. See [`docs/UDAAN_VERTICAL_SPEC.md`](docs/UDAAN_VERTICAL_SPEC.md).
- **Ingest-Time Deduplication**: MinHash + banded LSH + Union-Find clustering catches syndicated near-duplicate stories before they reach Gemini, merging them into "story arcs" instead of wasting paid API calls.
- **Semantic Search & Related Stories**: MongoDB Atlas `$vectorSearch` over article embeddings powers `?mode=semantic` search and per-article related-stories, falling back to keyword/category matching if the vector index or embedding service is unavailable.
- **Semantic Image Matching**: Vector search on a curated politician/place image repository using sentence-transformers embeddings (384-dim, MiniLM-L6-v2).
- **Daily ePaper**: Standalone Cloud Run job generates a Tabloid (11×17") PDF newspaper from live content with a newspaper-style 5-column layout.
- **Social Posting**: GitHub Actions posts articles to Facebook every 15 minutes.
- **Role-Based Access**: Admin dashboard for curation and publishing; authenticated readers can comment and react.
- **Cloud-Ready**: Containerized deployment to Google Cloud Run via `cloudbuild.yaml`.

## Services

| Service | Tech | Port |
|---|---|---|
| `client/` | Next.js 16 (App Router, Tailwind CSS) | 3000 |
| `server/` | Express.js, MongoDB, node-cron | 5000 |
| `embedding-service/` | Python FastAPI, sentence-transformers | 8000 |
| `epaper-printer/` | Node.js Cloud Run Job, Playwright | — |

## Local Development Setup

### Prerequisites
- Node.js 18+
- Python 3.10+ (for embedding service)
- MongoDB (local or Atlas)
- API Keys: [Google Gemini](https://aistudio.google.com/app/apikey), [SerpApi](https://serpapi.com/)

### Installation

```bash
# Backend
cd server && npm install

# Frontend
cd ../client && npm install

# ePaper printer
cd ../epaper-printer && npm install && npx playwright install chromium

# Embedding service
cd ../embedding-service
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Environment Configuration

**Server** (`server/.env`):
```
MONGO_URI=mongodb://localhost:27017/bnn
JWT_SECRET=your_secret
GOOGLE_API_KEYS=key1,key2
SERPAPI_KEYS=key1,key2
PORT=5000
EMBEDDING_SERVICE_URL=http://localhost:8000
GCS_BUCKET=your-bucket
```

**Client** (`client/.env.local`):
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Running Locally

```bash
# Terminal 1 — Backend
cd server && npm run dev

# Terminal 2 — Frontend
cd client && npm run dev

# Terminal 3 — Embedding service (optional, only needed for image search)
cd embedding-service && uvicorn app.main:app --reload

# Terminal 4 — ePaper (one-shot, run when needed)
cd epaper-printer
NEWS_API_BASE_URL=http://localhost:5000 OUTPUT_DIR=./output_local SAVE_HTML=1 node src/index.js
```

To run the backend against an isolated database instead of your main one, add a `server/.env.demo` with just `MONGO_URI` pointing at a separate database, then use `npm run dev:demo` instead of `npm run dev`.

### Udaan setup (semantic search)

Semantic search and related-stories require an Atlas vector index and populated embeddings — one-time setup, from `server/`:

```bash
npm run udaan:index:news            # creates the $vectorSearch index on News.embedding
npm run udaan:backfill:embeddings   # backfills embeddings for pre-existing articles
```

New articles are embedded automatically at ingest. See [`docs/UDAAN_VERTICAL_SPEC.md`](docs/UDAAN_VERTICAL_SPEC.md) for the full architecture.

## Deployment

Google Cloud Run via `cloudbuild.yaml`. All three long-running services (server, client, embedding-service) deploy as Cloud Run services. The ePaper printer deploys as a Cloud Run **Job** triggered daily by Cloud Scheduler.

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud builds submit --config cloudbuild.yaml .
```

A GitHub Actions workflow (`.github/workflows/social-poster.yml`) hits `POST /api/social` every 15 minutes using `CRON_SECRET`.

## License

[ISC](https://choosealicense.com/licenses/isc/)
