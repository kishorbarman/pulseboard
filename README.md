# PulseBoard

PulseBoard is a personalized interest feed that combines **news**, **videos**, and **social posts** into one unified “For You” experience.

This README is the product spec + engineering reference for the current implementation.

## 1. Product Summary

### Vision
Give users a fast, low-clutter command center for what matters across their interests.

### Core promise
- Relevant content with strong source diversity
- Fast loading via server-side cache
- AI-assisted understanding (concise summaries + follow-up chat)
- Personalization that improves as users interact

### Primary user flow
1. User selects interests during onboarding (plus optional custom interests).
2. App fetches and caches per-interest feeds server-side.
3. “For You” merges interests into a diversified feed.
4. User clicks/saves content; interactions improve personalization.
5. AI Insights gives a compact cross-feed summary with drill-down by interest.

## 2. Feature Set

### Feed ingestion
- **RSS-first ingestion** for mapped interests (primary source).
- **NewsData fallback** when RSS is sparse or interest is not curated.
- **YouTube** ingestion for video candidates.
- **X posts** ingestion (API when configured; mock fallback behavior in some flows).

### Ranking and personalization
- Multi-stage ranking:
  - Deterministic score (freshness + importance + engagement)
  - Personalization score from user interests/history signals
  - Optional Gemini rerank on top-K (enabled by default)
- For You diversity controls prevent one interest/source from dominating.

### AI summary experience
- **For You**: compact cross-feed overview (5–6 bullets max) plus “Expand by interest”.
- **Card-level summary**: quick TL;DR with follow-up chat.

### UX features
- Unified card layout for News / YouTube / X.
- Source and save actions in the 3-dot menu across content types.
- Compact relative age labels (`10m`, `2h`, `1d`, etc.) at bottom-left.
- Load-more pagination via `loadMultiplier`.
- Light/dark theme support.

### Data and user controls
- Google sign-in via Firebase Auth.
- Bookmarks and click history in Firestore.
- Data export and profile reset controls.

## 3. System Architecture

## Frontend
- React 19 + Vite + Tailwind v4 + Motion.
- Main composition in `src/components/Dashboard.tsx`.
- Talks to backend via `/api/*` and Firebase client SDK for user data/bookmarks.

## Backend
- Single Express server (`server.ts`) handles:
  - API routes
  - RSS/NewsData/YouTube/X fetching
  - ranking and summary generation
  - Firestore caching and personalization signals
  - Vite middleware in dev / static serving in prod

## Hosting
- Cloud Run for backend.
- Firebase Hosting for frontend (rewrites `/api/**` to Cloud Run).

## 4. Feed Pipeline (Current)

### Single-interest feed (`/api/smart-feed`)
1. Generate smart queries (Gemini; cached).
2. Fetch RSS (primary) + NewsData fallback if needed.
3. Fetch YouTube and X in parallel.
4. Run relevance filter.
5. Rank candidates (deterministic, optional Gemini rerank, personalization at response time).
6. Persist processed items and write per-interest feed cache.
7. Return windowed response by `loadMultiplier`.

### For You feed (`/api/smart-feed-foryou`)
1. Resolve interests.
2. Read per-interest caches (fresh first, stale-while-revalidate fallback).
3. Merge and dedupe across interests.
4. Apply personalization ranking + diversity caps.
5. Generate compact For You overview.
6. Return:
   - `news`, `videos`, `posts`
   - `trendContext` (compact summary)
   - `interestSummaries` (expandable detail)
   - `pagination` metadata

## 5. Caching and Refresh

- Per-interest Firestore cache: `feedCache/{interest}`
- Cache TTL: **12 hours**
- Scheduled background refresh: **every 3 hours**
- Startup warm: delayed initial refresh after server boot
- Onboarding warm: fire-and-forget refresh for selected interests

## 6. Ranking Spec (Implemented)

Each item gets `_rank` fields:
- `freshness`
- `importance`
- `engagement`
- `personalization`
- `baseScore`
- `geminiImportance`
- `finalScore`

### Personalization signals
Built from Firestore user profile + recent history:
- selected interests
- title token overlap with clicked history
- per-type preference (`news`, `video`, `trend`)

### Gemini reranker
- Enabled by default.
- Disable with `ENABLE_GEMINI_RERANK=false`.
- Top-K controlled by `GEMINI_RERANK_TOP_K` (default 15, clamped).

### Ranking observability
- `GET /api/ranking-debug` (recent debug keys)
- `GET /api/ranking-debug?key=<debugKey>` (score breakdown snapshot)

## 7. API Surface (Key Routes)

- `GET /api/smart-feed`
  - Query: `q`, `userId`, `refresh`, `loadMultiplier`, `debugKey`
- `GET /api/smart-feed-foryou`
  - Query: `interests`, `userId`, `refresh`, `loadMultiplier`, `debugKey`
- `POST /api/refresh-feeds`
  - Body: `{ interests: string[] }`
- `POST /api/log-interaction`
- `GET /api/personalized-feed?userId=...`
- `GET /api/news-metrics`
- `GET /api/ranking-debug`

## 8. Data Model (Firestore)

- `items/{id}`: normalized stored content + sentiment + metadata
- `feedCache/{interest}`: cached feed bundles
- `users/{uid}`: profile, interests, vector/profile metadata
- `users/{uid}/history`: click history
- `users/{uid}/bookmarks`: saved items

## 9. Local Development

### Prerequisites
- Node.js
- Firebase project (Auth + Firestore)
- API keys as needed

### Setup
```bash
npm install
cp .env.example .env.local
# fill env values
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000).

### Useful commands
```bash
npm run dev       # server + Vite middleware
npm run lint      # TypeScript type-check
npm run build     # production frontend build
npm run deploy    # Cloud Run + Firebase Hosting
```

## 10. Environment Variables

Commonly used:
- `GEMINI_API_KEY`
- `NEWSDATA_API_KEY`
- `YOUTUBE_API_KEY`
- `TWITTER_BEARER_TOKEN` (if using real X API)
- `VITE_FIREBASE_*`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Ranking flags:
- `ENABLE_GEMINI_RERANK` (`false` to disable)
- `GEMINI_RERANK_TOP_K` (default `15`)

## 11. Deployment

```bash
npm run deploy:server   # Cloud Run backend
npm run deploy:hosting  # Firebase Hosting frontend
npm run deploy          # both
```

Production:
- Hosting: <https://pulse-board-2b7b7.web.app>
- Backend: <https://pulseboard-server-232983174887.us-central1.run.app>
