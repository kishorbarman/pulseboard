# PulseBoard Project Map

This document is a practical map of the current codebase so we can move quickly on new features.

## 1) What this app is today

PulseBoard is a full-stack TypeScript app:

- Backend: `server.ts` (Express)
- Frontend: `src/` (React 19 + Tailwind v4 + motion/react)
- Data/Auth: Firebase Auth + Firestore (client + optional Admin SDK)
- AI: Gemini query generation + feed summaries on server (`gemini-2.0-flash`), plus per-card summaries/chat on client (`gemini-3-flash-preview`)

Core UX:

- Onboarding -> select 3-10 interests
- Dashboard -> mixed cards (news, videos, X posts)
- For You -> blend of cached smart feed + vector nearest-neighbor feed
- Saved -> bookmark-based local view
- AI Insights -> feed summary + follow-up chat

## 2) Runtime architecture and flow

### Frontend entry

- `src/main.tsx`: mounts app, registers service worker (`/sw.js`), wraps in `ErrorBoundary` and `ThemeProvider`.
- `src/App.tsx`: auth and app gating -> no Firebase config: setup screen; signed out: Google sign-in; signed in without onboarding: onboarding; signed in with onboarding: dashboard.

### Dashboard data flow (`src/components/Dashboard.tsx`)

- For You mode: calls `GET /api/personalized-feed` + `GET /api/smart-feed-foryou`, then merges and dedupes both sources.
- Topic mode: calls `GET /api/smart-feed?q=...`.
- Saved mode: renders data from Firestore bookmarks (no backend feed call).
- On card click: always logs client history (`logClickHistory`), and also calls `POST /api/log-interaction` if the card has `firestoreId`.

### Backend feed pipeline (`server.ts`)

`/api/smart-feed` and `/api/smart-feed-foryou` run the main pipeline:

1. Check per-interest Firestore cache (`feedCache/{interest}`), TTL 12h.
2. If stale cache exists, return stale quickly and refresh in background.
3. Generate smart per-platform queries with Gemini (30-min in-memory cache).
4. Fetch from NewsData, YouTube, X in parallel.
5. Relevance filter each source with Gemini.
6. Store items in `items` collection and build feed summary.
7. Persist final feed payload back to `feedCache`.

Background refresh:

- Startup warm after 10 seconds.
- Recurring 12-hour refresh (`setInterval`).
- Onboarding also triggers `POST /api/refresh-feeds`.

## 3) API routes (actual implementation)

- `GET /api/news?q=topic`
- `GET /api/youtube?q=topic`
- `GET /api/x-posts?q=topic`
- `GET /api/smart-feed?q=topic[&refresh=true]`
- `GET /api/smart-feed-foryou?interests=a,b,c[&refresh=true]`
- `POST /api/log-interaction` body: `{ userId, firestoreId }`
- `GET /api/personalized-feed?userId=...`
- `POST /api/refresh-feeds` body: `{ interests: string[] }`

## 4) Firestore model currently used

- `items/{id}` -> `title`, `url`, `type`, `originalData`, `sentiment`, `createdAt`; embeddings may exist only on legacy/imported items.
- `feedCache/{interestKey}` -> `news[]`, `videos[]`, `posts[]`, `summary`, `warnings[]`, `queries{...}`, `updatedAt`.
- `users/{uid}` -> profile fields, `interests[]`, `hasCompletedOnboarding`, optional `vectorProfile`.
- `users/{uid}/history` -> click history entries (both client and server write here).
- `users/{uid}/bookmarks` -> saved items.

## 5) Important “current state vs expected state” notes

### A) Vector personalization is partially degraded right now

In `processAndStoreItems`, backend embedding generation was removed and new items are saved without embeddings.

Effect:

- `POST /api/log-interaction` updates `vectorProfile` only when clicked items contain embeddings.
- `GET /api/personalized-feed` can return empty/weak results when item embeddings are absent.

This means For You still works, but mostly from smart cached feeds, not strong vector personalization.

### B) X integration is real, but optional

`server.ts` uses Twitter/X recent search API when `TWITTER_BEARER_TOKEN` is present.
If not present, X results degrade gracefully to empty with warnings.

### C) Gemini key usage split

- Server Gemini uses `process.env.GEMINI_API_KEY` (secure on server side).
- Client Gemini calls in `HoverSummary` and `AIPulse` rely on Vite define; `process.env.GEMINI_API_KEY` is injected into client bundle via `vite.config.ts`.

### D) “Trend” shape inconsistency in one UI helper

`TrendCard` expects X-post-like data (`text`, `metrics`, `author`), which backend provides.
`AIPulse.buildContentString()` still references `trend.name`/`trend.volume` (legacy trend shape), so trend lines in that helper can be low quality.
Main Insights still works because it primarily uses server-provided `trendContext`.

## 6) Frontend component map

- `src/components/Onboarding.tsx` -> topic selection, custom topics, cache pre-warm trigger.
- `src/components/Sidebar.tsx` -> interest navigation, theme toggle, export/reset, about, signout.
- `src/components/Dashboard.tsx` -> feed orchestration, dedupe, refresh, interaction logging.
- `src/components/NewsCard.tsx`, `VideoCard.tsx`, `TrendCard.tsx` -> card rendering, bookmarking, hover summary entrypoint.
- `src/components/HoverSummary.tsx` -> per-card Gemini tl;dr and follow-up mini chat.
- `src/components/AIPulse.tsx` -> feed-level insights panel and follow-up chat.
- `src/lib/firebase.ts` -> auth helpers, bookmarks, user export/reset, click history logging.

## 7) Where to plug in your next feature ideas

From `next_page.md`, likely implementation entry points:

- Better subtopic relevance: improve server logic in `generateSmartQueries*` and `filterByRelevance`, and optionally add deterministic scoring around Gemini decisions.
- “Popular tweets directly”: strengthen `fetchXPostsForQuery` ranking (engagement + recency + source quality).
- Connect user X/YouTube accounts: add OAuth + token storage first (`users/{uid}/connections/...`), then feed ranking by followed creators/channels.
- Natural-language feed curation: parse user intent into weighted interests/query overrides and apply in `/api/smart-feed-foryou` merge/ranking.

## 8) Dev and ops quick reference

- Install: `npm install`
- Dev: `npm run dev` (Express + Vite on port 3000)
- Typecheck: `npm run lint` (tsc only, no tests)
- Build: `npm run build`
- Deploy: `npm run deploy:server` (Cloud Run), `npm run deploy:hosting` (Firebase Hosting), `npm run deploy` (both).

Environment variables are in `.env.example`.
Critical ones for full functionality:

- `GEMINI_API_KEY`
- `NEWSDATA_API_KEY`
- `YOUTUBE_API_KEY`
- `TWITTER_BEARER_TOKEN` (for X data)
- `VITE_FIREBASE_*`
- `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` (for Admin SDK features)
