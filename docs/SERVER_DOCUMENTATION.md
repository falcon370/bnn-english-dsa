# Server Documentation

## Overview

Express + MongoDB backend powering authentication, article CRUD, AI-assisted ingestion, image semantic search, ePaper management, and social posting for Bharat News Narratives.

## Requirements

- Node.js 18+
- MongoDB (local or Atlas — Atlas required for vector search)
- Google Gemini API key(s)
- SerpApi key(s)
- Python FastAPI embedding service (optional but required for image vector search)

## Stack

- Express 5 + Mongoose 9
- JWT (`jsonwebtoken` + `bcryptjs`)
- `node-cron` for scheduled ingestion
- `@google/genai` for Gemini
- `axios` for external API calls

## Project Structure

```
server/src/
├── index.js                     # App bootstrap, env validation, route mount
├── config/db.js                 # MongoDB connection
├── middleware/auth.js            # JWT verification + role enforcement
├── models/                      # Mongoose schemas
│   ├── News.js                  # Core article model
│   ├── User.js
│   ├── Author.js
│   ├── Epaper.js                # ePaper edition records
│   ├── ImageMetadata.js         # Image repository (vector search)
│   ├── SystemStatus.js          # Ingestion pipeline status
│   └── RunLog.js                # Ingestion run history
├── controllers/                 # Request handlers
├── routes/                      # Express route groups
├── services/
│   ├── trending/                # AI ingestion pipeline
│   │   ├── index.js             # Exports: runTrendingIngestion, refreshCategoryFeeds, generateNewsFromTopic
│   │   ├── ingestionConfig.js   # Schedule profiles (CONFIG_1AM, CONFIG_REGULAR, CONFIG_MANUAL_5) and CATEGORY_FEEDS
│   │   ├── ingestionOrchestrator.js  # Main pipeline logic
│   │   ├── serpApiClient.js     # SerpApi trending topic fetch
│   │   ├── geminiClient.js      # Gemini AI with key rotation + model fallback chain
│   │   ├── imageResolver.js     # Image selection by subject type
│   │   └── politicsClassifier.js
│   ├── imageRepositoryService.js  # Vector + text search over image_metadata
│   ├── embeddingClient.js         # HTTP client for the Python embedding service
│   ├── epaperService.js           # Cloud Run Jobs API trigger
│   └── socialMediaService.js      # Facebook posting
├── refiners/preGeminiRefiner.js
└── utils/
    ├── textHelpers.js
    └── imageSearchText.js
BNN_images/                       # Local image fallbacks by category
epaper-files/                     # Local ePaper PDF storage
```

## Environment Configuration

Create `server/.env`. The server requires `JWT_SECRET` at startup and warns (but does not exit) if `SERPAPI_KEYS` or `GOOGLE_API_KEYS` are missing.

Use the plural forms even for a single key:
```
SERPAPI_KEYS=your_key
GOOGLE_API_KEYS=your_key
```

Full variable reference:

| Variable | Required | Default | Notes |
|---|---|---|---|
| `MONGO_URI` | Yes | — | MongoDB connection string |
| `JWT_SECRET` | Yes | — | Token signing secret |
| `GOOGLE_API_KEYS` | Recommended | — | Comma-separated; rotated automatically |
| `SERPAPI_KEYS` | Recommended | — | Comma-separated; rotated automatically |
| `PORT` | No | `5000` | |
| `TRENDING_REFRESH_CRON` | No | `0 */12 * * *` | node-cron expression |
| `EMBEDDING_SERVICE_URL` | No | `http://localhost:8000` | Python FastAPI service |
| `EMBEDDING_TIMEOUT_MS` | No | `30000` | |
| `EMBEDDING_RETRIES` | No | `3` | |
| `GCS_BUCKET` | No | `bnn-epaper` | GCS bucket for ePaper files |
| `GCS_PREFIX` | No | `epaper` | GCS path prefix |
| `GCP_PROJECT_ID` | No | — | Required to trigger ePaper Cloud Run Jobs |
| `GCP_REGION` | No | `asia-south1` | |
| `EPAPER_JOB_NAME` | No | `epaper-printer` | Cloud Run Job name |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | No | — | Social posting |
| `FACEBOOK_PAGE_ID` | No | — | Social posting |
| `CRON_SECRET` | No | — | Shared secret for Cloud Scheduler + GitHub Actions |
| `IMAGE_VECTOR_INDEX_NAME` | No | `image_embedding_vector_index` | Atlas Search index name |
| `IMAGE_COLLECTION_NAME` | No | `image_metadata` | |
| `IMAGE_REPOSITORY_BASE_URL` | No | — | GCS public URL prefix for repository images |

## Running

```bash
npm run dev      # nodemon, hot reload
npm run start    # production
npm test         # test suite
```

## Ingestion Pipeline

Three entry points exported from `services/trending/index.js`:

| Function | Trigger | Description |
|---|---|---|
| `runTrendingIngestion(config)` | Cron / `POST /api/trending/scheduled-run` | Full pipeline: SerpApi → Gemini → image → MongoDB |
| `refreshCategoryFeeds()` | `POST /api/trending/refresh-categories` | Fetches articles for each entry in `CATEGORY_FEEDS` |
| `generateNewsFromTopic(opts)` | `POST /api/news/generate` | Single-topic on-demand generation |

Schedule profiles in `ingestionConfig.js`:
- `CONFIG_1AM` — runs at 1AM, fetches Sports/Entertainment/Tech/Politics/Business + manual politics/world topics
- `CONFIG_REGULAR` — runs 7AM/1PM/7PM, focused on Politics/Business + manual politics
- `CONFIG_MANUAL_5` — fetches only 5 manual political topics

## Image Resolution

`imageResolver.js` routes image lookup based on `imageSubjectType` returned by Gemini:

1. `specific_person` / `political_party` / `specific_place` → image repository (vector search) → Wikimedia → local fallback
2. `generic_society` / `generic` → Unsplash → Wikimedia → local fallback
3. `data_analytical` → Wikimedia maps/charts → local fallback

Local fallbacks live in `server/BNN_images/<category>/`. The server serves this directory at `/BNN_images`.

## Static File Serving

- `/BNN_images` → `server/BNN_images/` (category image fallbacks)
- `/epaper-files` → `server/epaper-files/` (local ePaper PDF storage)

## ePaper Integration

The ePaper printer is a separate process/job. After generating a PDF it calls `POST /api/epaper/register` which upserts an `Epaper` document. The server can also trigger the Cloud Run Job via `epaperService.js` which calls the Cloud Run Jobs API using the GCP metadata server for auth (only works when running on GCP).
