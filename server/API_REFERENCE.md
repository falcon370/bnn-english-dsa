# Server API Reference

Base URL (local): `http://localhost:5000`  
Base path: `/api`  
Content-Type: `application/json`

**Authentication**: Protected endpoints require `Authorization: Bearer <token>`. Token is obtained from `/api/auth/login` or `/api/auth/register`.

**Roles**: `user` (authenticated reader) · `admin` (authenticated admin)

---

## Health

### GET /api/health
Public. Returns `{ status: "ok", timestamp: "<ISO>" }`.

---

## Auth

### POST /api/auth/register
Public. Body: `name`, `email`, `password`, `role` (optional, `admin` or defaults to `user`).  
Returns 201: `{ token, user: { id, name, role } }`. Error 400 if email already registered.

### POST /api/auth/login
Public. Body: `email`, `password`.  
Returns 200: `{ token, user: { id, name, role } }`. Error 400 on invalid credentials.

### GET /api/auth/me
Auth required. Returns current user profile (password excluded). Error 401 if token missing/invalid.

---

## News

### GET /api/news
Public. Returns array of published articles.

Homepage fetch (no query params): returns up to 150 recent articles merged with guaranteed articles from `Bolta Hai Bharat` and `Editorial` categories (up to 10 each) to ensure those sections always have content.

Category fetch (`?category=<slug>`): paginated, supports `?page=` and `?limit=` (max 30). Returns `{ news, total, page, pages }`. The slug `technology` maps to both `Tech` and `Technology` category values.

### GET /api/news/drafts
Auth required (admin). Returns all draft articles sorted by `createdAt` descending.

### GET /api/news/:id
Public. Returns single article with populated `comments.user` (name, role) and `author` (name, photoUrl, bio). Error 400 on invalid ID, 404 if not found.

### POST /api/news/generate
Auth required (admin). Triggers AI generation for a single topic.  
Body: `topic` (required), `autoPublish` (boolean, default false), `authorId` (optional).  
Returns 201: `{ message, article }`.

### POST /api/news/editorial
Auth required (admin). Creates and publishes a manual article.  
Body: `title` (required), `content` (required), `category` (optional, defaults to `Editorial`), `imageUrl` (optional), `authorId` (optional).  
Returns 201: `{ message, article }`.

### PATCH /api/news/:id
Auth required (admin). Update article fields.  
Body: any of `title`, `content`, `summary`, `category`, `tags`, `status`, `imageUrl`.  
Returns `{ message, article }`.

### PATCH /api/news/:id/publish
Auth required (admin). Sets status to `published` and stamps `publishedAt`.  
Returns updated article. Error 404 if not found.

### DELETE /api/news/:id
Auth required (admin). Permanently deletes the article. Returns `{ message }`.

### POST /api/news/:id/comments
Auth required (user or admin). Body: `text` (required).  
Returns 201: newly created comment with populated user. Error 404 if article not found or not published.

### POST /api/news/:id/reactions
Auth required (user or admin). Body: `type` (e.g., `like`, `love`, `haha`, `wow`, `sad`, `angry`).  
Toggles: if same reaction exists it is removed; if different type it is updated.  
Returns `{ message, reactions }`.

### GET /api/news/reacted
Auth required. Returns articles the current user has reacted to.

---

## Trending

### GET /api/trending
Public. Returns trending articles (recently generated within a time window, falls back to latest trending items).

### GET /api/trending/status
Public. Returns ingestion pipeline status from `SystemStatus` collection.

### POST /api/trending/refresh
Auth required (admin). Triggers a full trending refresh. Returns `{ refreshed, items, status }`.

### POST /api/trending/refresh-categories
Auth required (admin). Refreshes category feeds only (runs `CATEGORY_FEEDS` from `ingestionConfig.js`).

### POST /api/trending/scheduled-run
Requires `x-cron-secret` header matching `CRON_SECRET` env var. Used by Cloud Scheduler.  
Body: `type` — `regular` (default), `1am`, or `manual-5`. Triggers the corresponding ingestion profile in background and returns immediately.

---

## Authors

### GET /api/authors
Public. Returns all authors sorted by name.

### GET /api/authors/:id
Public. Returns author profile + published articles by that author. Error 400 on invalid ID, 404 if not found.

### POST /api/authors
Auth required (admin). Body: `name` (required), `bio`, `photoUrl`, `email` (optional, unique).  
Returns 201: `{ message, author }`.

### PATCH /api/authors/:id
Auth required (admin). Body: any of `name`, `bio`, `photoUrl`, `email`.  
Returns `{ message, author }`.

---

## ePaper

### GET /api/epaper
Public. Returns all completed ePaper editions sorted by date descending.

### GET /api/epaper/stats
Public. Returns aggregate stats: `totalEditions`, `completedEditions`, `failedEditions`, `totalArticles`, `avgGenerationTime`, `latestEdition`.

### GET /api/epaper/:id
Public. Returns a single edition by MongoDB ID. Error 404 if not found.

### GET /api/epaper/:id/download
Public. Streams the PDF file. If `filePath` is an HTTP URL (GCS public URL), redirects to it.

### GET /api/epaper/:id/thumbnail
Public. Streams the thumbnail JPEG. If `thumbnailPath` is an HTTP URL, redirects to it.

### POST /api/epaper/register
Called by the ePaper printer after generation. Body: `editionDate` (required), `filename` (required), `fileSize`, `thumbnailGenerated`.  
Upserts the edition record in MongoDB. Constructs GCS public URLs from `GCS_BUCKET` and `GCS_PREFIX` env vars.

### POST /api/epaper/trigger
Auth required (admin). Body: `editionDate` (optional YYYY-MM-DD), `force` (boolean — deletes existing record/files for that date before regenerating).  
Responds immediately; generation runs in background via Cloud Run Jobs API.

### POST /api/epaper/scheduled
Requires Cloud Scheduler invocation. Triggers today's generation via Cloud Run Jobs API.

### DELETE /api/epaper/:id
Auth required (admin). Deletes the MongoDB record and local files (if paths are on disk, not HTTP URLs).

---

## Images

### GET /api/images/search?q=<query>&limit=<n>
Public. Semantic search over `image_metadata` collection using vector embeddings. Returns matching image documents.

### GET /api/images
Public. Returns all image metadata documents.

---

## Social

### POST /api/social
Requires `x-cron-secret` header. Called by GitHub Actions every 15 minutes. Posts unpublished articles to Facebook.

---

## Common Error Shapes

- **400** — Invalid ID format, missing required field, or duplicate value.
- **401** — Missing or invalid JWT token.
- **403** — Valid token but insufficient role.
- **404** — Resource not found.
- **409** — Conflict (e.g., ePaper edition already exists for that date).
- **500** — Internal server error; `{ message, error }` where available.
