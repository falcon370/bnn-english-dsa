# Architecture and Deployment Diagrams

## 1. Application Architecture

```mermaid
flowchart LR
    user[Reader or Admin]
    browser[Browser]

    subgraph frontend[Client — Next.js App Router]
        pages[Pages and Layouts]
        authctx[Auth Context]
        apiclient[Axios API Client]
    end

    subgraph backend[Server — Express.js]
        routes[API Routes]
        controllers[Controllers]
        middleware[JWT Auth Middleware]
        ingestion[Trending Ingestion Pipeline\nnode-cron scheduled]
        epaperSvc[ePaper Service]
        imgRepo[Image Repository Service]
    end

    subgraph epaper[ePaper Printer — Cloud Run Job]
        layout[Layout Engine\nTableland 5-column CSS Grid]
        playwright[Playwright Chromium\nPDF Generation]
        gcs[Google Cloud Storage]
    end

    subgraph embedding[Embedding Service — FastAPI]
        model[MiniLM-L6-v2\n384-dim vectors]
    end

    subgraph data[Data Layer — MongoDB]
        news[(News)]
        users[(Users / Authors)]
        epaperDb[(Epaper)]
        imgMeta[(ImageMetadata\nAtlas Vector Search)]
        sysStatus[(SystemStatus / RunLog)]
    end

    subgraph external[External APIs]
        serpapi[SerpApi / Google Trends]
        gemini[Google Gemini AI]
        wiki[Wikimedia Commons]
        unsplash[Unsplash]
        facebook[Facebook Graph API]
    end

    user --> browser --> pages
    pages --> authctx --> apiclient --> routes
    routes --> middleware --> controllers
    controllers --> news & users & epaperDb
    ingestion --> news & sysStatus
    ingestion --> serpapi & gemini & wiki & unsplash
    imgRepo --> imgMeta
    imgRepo --> embedding
    embedding --> model
    epaperSvc --> epaper

    layout --> routes
    layout --> playwright --> gcs
    epaperDb --> epaperSvc

    controllers --> facebook
```

## 2. Ingestion Pipeline

```mermaid
flowchart TD
    trigger[Cron / Admin API / Cloud Scheduler]
    serp[SerpApi\nfetchTrendingTopics]
    refiner[preGeminiRefiner\nfilter + deduplicate]
    gemini[Gemini AI\nsummarizeWithGemini\nmodel fallback chain]
    classifier[politicsClassifier\nassign category]
    imgResolver[imageResolver\nroute by imageSubjectType]
    imgRepo[imageRepositoryService\nvector search → Wikimedia → Unsplash → local]
    mongo[(MongoDB\nNews collection)]

    trigger --> serp --> refiner --> gemini --> classifier --> imgResolver --> imgRepo --> mongo
```

## 3. Deployment

```mermaid
flowchart TB
    dev[Developer]
    repo[Git Repository]
    cb[Google Cloud Build\ncloudbuild.yaml]

    subgraph ar[Artifact Registry — asia-south1]
        beimg[mern-repo/backend]
        feimg[mern-repo/frontend]
        epimg[mern-repo/epaper-printer]
        embimg[mern-repo/embedding-service]
    end

    subgraph cr[Cloud Run Services — asia-south1]
        besvc[backend-service :5000]
        fesvc[frontend-service :3000]
        embsvc[bnn-embedding-service :8080]
    end

    subgraph crj[Cloud Run Jobs]
        epjob[epaper-printer]
    end

    scheduler[Cloud Scheduler\n6:00 AM IST daily]
    gh[GitHub Actions\nevery 15 minutes]
    mongo[(MongoDB Atlas)]
    gcsbucket[(Google Cloud Storage\nePaper PDFs)]

    dev --> repo --> cb
    cb -->|server Dockerfile| beimg -->|deploy| besvc
    cb -->|client Dockerfile| feimg -->|deploy| fesvc
    cb -->|epaper-printer Dockerfile| epimg -->|deploy| epjob
    cb -->|embedding-service Dockerfile| embimg -->|deploy| embsvc

    fesvc -->|HTTPS API calls| besvc
    epjob -->|HTTPS API calls| besvc
    besvc --> mongo & embsvc
    epjob --> gcsbucket
    scheduler -->|trigger job| epjob
    gh -->|POST /api/social\nCRON_SECRET| besvc
```

## Notes

- The ePaper printer runs as a Cloud Run **Job** (batch, not a service). It is triggered by Cloud Scheduler daily or manually via `POST /api/epaper/trigger` from the admin dashboard.
- The embedding service is kept separate from Express to isolate Python ML dependencies and allow independent CPU scaling.
- Cloud Build injects `NEXT_PUBLIC_API_BASE_URL` as a Docker build arg into the client image.
- The backend fetches a GCP metadata service token when triggering Cloud Run Jobs — this only works when the server itself runs on GCP.
