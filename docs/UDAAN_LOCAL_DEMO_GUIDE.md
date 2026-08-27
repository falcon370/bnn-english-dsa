# Udaan — Local Demo Guide

How to run the Udaan dedup + semantic search/related-stories implementation
locally, end to end, without touching production data.

---

## 1. Safety model — read this first

`server/.env`'s `MONGO_URI` points at the same Atlas cluster (`bnn.zzixrad.mongodb.net`)
that backs the live site. This demo instead runs against an **isolated database on
the same cluster**, `bnn_demo`, so nothing here ever touches real content.

- `server/.env.demo` — a local-only file (gitignored, matches the `.env.*` rule in
  `.gitignore`) containing just `MONGO_URI` rewritten to point at `bnn_demo`.
  **Never commit this file or paste its contents anywhere.**
- Every demo script (`seedDemoArticles.js`, `triggerUdaanIngestion.js`,
  `resetDemoDb.js`) refuses to run (hard exit) unless it detects `/bnn_demo` in the
  resolved `MONGO_URI`, as a guardrail against accidentally pointing at production.
- The server itself only connects to `bnn_demo` when started via `npm run dev:demo`
  (not the regular `npm run dev`, which uses the real `.env`/production DB).

If `.env.demo` doesn't exist yet, regenerate it once:

```powershell
cd server
node -e "
require('dotenv').config({ quiet: true });
const fs = require('fs');
const uri = process.env.MONGO_URI;
const demoUri = uri.replace(/mongodb\+srv:\/\/([^\/]+)\/?(\?.*)?$/, (m, h, q) => 'mongodb+srv://' + h + '/bnn_demo' + (q || ''));
fs.writeFileSync('.env.demo', 'MONGO_URI=' + demoUri + '\n');
console.log('.env.demo written.');
"
```

---

## 2. One-time setup

### Embedding service (Python)

```powershell
cd embedding-service
python -m venv venv
.\venv\Scripts\python.exe -m pip install --upgrade pip
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

### Node dependencies

```powershell
cd server
npm install
cd ../client
npm install
```

---

## 3. Running the three services

Each runs in its own terminal (or have me run them in the background).

**1 — Embedding service** (port 8000):
```powershell
cd embedding-service
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
> Don't use `--reload` with `python -m uvicorn` on Windows — its reload subprocess
> fails to see the venv's installed packages (`ModuleNotFoundError: No module named
> 'fastapi'`), a known Windows quirk, not a real install problem. If you want
> `--reload`, use the installed executable instead:
> `.\venv\Scripts\uvicorn.exe app.main:app --reload`.

**2 — Backend server, pinned to `bnn_demo`** (port 5000):
```powershell
cd server
npm run dev:demo
```
(`npm run dev` — no `:demo` — connects to production. Only ever use `dev:demo` for
this demo.)

**3 — Client** (port 3000):
```powershell
cd client
npm run dev
```

Open **http://localhost:3000**.

---

## 4. Getting content into `bnn_demo`

Pick one (or both — try the free option first):

### Option A — free synthetic seed (no API cost, instant)

```powershell
cd server
npm run demo:seed
```

Creates 4 articles by running hand-written raw "article" objects through the
**real** `udaan.filterDuplicates` / `attachAsSource` / `registerArticle` functions
(the same code `ingestCategoryFeeds` uses) — only the SerpApi fetch and Gemini
synthesis steps are skipped. Includes two near-duplicate Udaan articles
specifically to demonstrate dedup merging one into the other.

Embeds each article via the (already-running) embedding service. If the embedding
service wasn't up when you ran this, backfill afterwards:
```powershell
npm run demo:backfill-embeddings
```

Then create the vector index (one-time per fresh `bnn_demo`):
```powershell
npm run demo:index-news
```
Atlas takes ~10-30 seconds to finish building it after this returns.

### Option B — real ingestion (costs real SerpApi + Gemini API calls)

```powershell
cd server
npm run demo:trigger-udaan
```

Runs one real ingestion pass for **only** the Udaan feed (not all 8 categories) —
genuine SerpApi fetch → dedup → Gemini synthesis → image resolution → embedding.
Requires valid `SERPAPI_KEYS` and `GOOGLE_API_KEYS` in `server/.env`. Safe to
re-run repeatedly to test dedup catching real syndicated duplicates over time — it
still only ever writes to `bnn_demo`. Also picks up the widened 7-day fetch window
(§4.3 of the spec) automatically — no flag needed for that part.

#### With the RSS supplement turned on

Off by default. To also pull candidates from The Better India + YourStory's RSS
feeds for this one run, set the env var **in the same terminal session**, before
running the script:

```powershell
cd server
$env:UDAAN_RSS_ENABLED = "true"
node scripts/triggerUdaanIngestion.js
```

`$env:UDAAN_RSS_ENABLED` only lasts for that PowerShell session — close the
terminal, or run `Remove-Item Env:\UDAAN_RSS_ENABLED`, to go back to off. There's
no `npm run demo:trigger-udaan` variant with the flag pre-set — set the env var
first, then call the script directly as above.

### Starting over

```powershell
npm run demo:reset
```
Deletes all articles from `bnn_demo` (refuses to run against anything else). Re-run
option A and/or B afterwards.

---

## 5. End-user checklist

| # | Check | What to look for |
|---|---|---|
| 1 | **Udaan nav tab** | Shows up in the navbar; `/category/udaan` renders articles instead of a 404 or blank page. |
| 2 | **Related Stories sidebar** (the main new feature) | Open any Udaan article → sidebar should show semantically related articles **across categories** (e.g. other rural/farming/innovation stories), not just "same category, most recent." |
| 3 | **Dedup is invisible** | The merged duplicate article (e.g. the second "IIT Madras prosthetic" wire pickup) never appears as its own story anywhere — not in the category page, not in search. |
| 4 | **Search bar** | Type a query with no literal keyword overlap but related meaning (e.g. "helping farmers get money" instead of "funding") — should still surface the relevant article, since the search bar now sends `mode=semantic`. |
| 5 | **"More You Can Read"** (regression check) | Unchanged — still same-category + Politics-padding fallback logic. Should look and behave exactly as before. |
| 6 | **Story timeline widget** (regression check) | Politics-only feature, untouched — open a Politics article and confirm it still renders. |
| 7 | **Homepage** (regression check) | Renders fine; "Bolta Hai Bharat"/"Editorial" sections will be empty in the demo DB since no seeded articles are in those categories — expected, not a bug. |
| 8 | **Hydration warning in devtools** | If you see `fdprocessedid` attribute mismatches, that's a browser extension (form autofill) injecting attributes before React hydrates — unrelated to this implementation. Try an incognito window to confirm it disappears. |

---

## 6. Command reference

Run from `server/` unless noted.

| Command | What it does | API cost |
|---|---|---|
| `npm run dev:demo` | Start the backend against `bnn_demo` | — |
| `npm run demo:seed` | Seed 4 synthetic articles through the real dedup pipeline | Free (local embedding calls only) |
| `npm run demo:trigger-udaan` | Real ingestion, Udaan feed only | SerpApi + Gemini |
| `$env:UDAAN_RSS_ENABLED="true"; node scripts/triggerUdaanIngestion.js` | Same, plus The Better India + YourStory RSS | SerpApi + Gemini (RSS itself is free) |
| `npm run demo:backfill-embeddings` | Embed any `bnn_demo` articles missing one | Free (local) |
| `npm run demo:index-news` | Create/recreate the Atlas vector index on `bnn_demo` | — |
| `npm run demo:reset` | Delete all `bnn_demo` articles | — |
| `node scripts/demoDedup.js` | Read-only dedup demo against **production** data (safe — makes no writes) | — |

---

## 7. Troubleshooting

- **`Embedding request failed:` during seed/trigger** — the embedding service isn't
  running or crashed. Check its terminal / re-launch it (§3, step 1). Articles still
  get created (dedup/arc metadata is set), just without an embedding until you
  re-run `npm run demo:backfill-embeddings`.
- **`API key not valid` from Gemini** — `GOOGLE_API_KEYS` in `server/.env` is
  invalid/expired. Generate a fresh one at
  [aistudio.google.com/apikey](https://aistudio.google.com/apikey); the client
  supports comma-separated multiple keys for automatic rotation.
- **`503 ... high demand` from Gemini** — transient; `geminiClient.js` already
  falls back through the model chain (`gemini-3.5-flash` → `gemini-3.1-flash-lite`
  → `gemini-2.5-flash`) and retries automatically.
- **`Cannot find module '...\scripts\triggerUdaanIngestion.js'`** (or any other
  `scripts/*.js` command) — you're running the command from the repo root instead
  of `server/`. Every `npm run demo:*` / `node scripts/*.js` command in this guide
  assumes you've already run `cd server` in that terminal. Either `cd server` first,
  or prefix the path: `node server/scripts/triggerUdaanIngestion.js`.
- **Port already in use / stale data showing up** — an old `node` process from a
  previous run may still be bound to the port. Check with
  `netstat -ano | findstr :5000` (or `:3000`/`:8000`) and `taskkill /PID <pid> /F`
  the stale one, then restart.
- **`node bench/annBench.js` or `dedupBench.js` say no fixtures found** — these are
  separate from the demo flow above; they need
  `npm run udaan:fixtures` run first (against real data, read-only) to generate
  `server/bench/fixtures/`.
