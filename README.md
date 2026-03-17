# PulseBoard

Your personalized command center for what's happening now — news, videos, and trending topics, all in one place. PulseBoard learns what you care about and surfaces the content that matters most to you.

## Features

- **Diverse interest selection** — Choose from 30+ topics across tech, politics, lifestyle, entertainment, finance, and more. Add your own custom topics too.
- **AI-powered personalization** — Every click teaches PulseBoard what you like. A vector-based "For You" feed uses cosine similarity to surface content tailored to your behavior.
- **AI summaries & chat** — Get instant Gemini-powered summaries of your entire feed or individual articles, then ask follow-up questions in a conversational thread.
- **Light & dark mode** — Full theme support with system preference detection and manual toggle.
- **Bookmarks & data export** — Save articles for later. Export your full history and profile as JSON anytime.
- **Server-side feed caching** — Feeds are cached per-interest in Firestore with a 12-hour TTL, dropping page loads from ~10s to ~200ms on repeat visits.
- **Background refresh** — A scheduled job refreshes all cached interests every 12 hours. Stale caches are served instantly while a background refresh runs.
- **Pull-to-refresh** — Manual refresh button bypasses the cache, fetches live data, and updates the cache for future visits.
- **Responsive design** — Edge-to-edge mobile layout with a collapsible sidebar and adaptive card grid.

## How it works

```
Browser (React 19 SPA)
    |
    |  HTTP (same origin)
    v
Express server (server.ts)
    |-- GET /api/smart-feed          --> Gemini + News/YouTube/X (cached in Firestore)
    |-- GET /api/smart-feed-foryou   --> merges per-interest caches for "For You"
    |-- POST /api/refresh-feeds      --> manual/scheduled cache refresh
    |-- POST /api/log-interaction    --> Firestore (Admin SDK)
    |-- GET /api/personalized-feed   --> Firestore vector search
    |
    |  Background: 12h interval refreshes all user interests
    |
    |  Vite middleware (dev) / static dist/ (prod)
    v
Firebase
    |-- Auth (Google sign-in)
    |-- Firestore: feedCache/{interest}  — cached feed results (12h TTL)
    |-- Firestore: items/{id}            — content with embeddings
    |-- Firestore: users/{uid}           — profile, interests, vectorProfile
    |-- Firestore: users/{uid}/history   — click history
    |-- Firestore: users/{uid}/bookmarks — saved items
```

The Express server proxies all third-party API keys and handles personalization server-side. The React frontend communicates with `/api/*` routes and the Firebase client SDK for auth and bookmarks.

### Feed caching strategy

Feeds are cached **per individual interest** in Firestore (`feedCache/{interest}`), so users with overlapping interests share the same cache. The "For You" feed merges multiple per-interest caches server-side.

| Scenario | Response time | Behavior |
|----------|--------------|----------|
| Fresh cache (< 12h) | ~200–500ms | Served directly from Firestore |
| Stale cache (> 12h) | ~200–500ms | Served immediately, background refresh fires |
| No cache (first visit) | ~8–12s | Full live fetch, result cached for next time |
| Pull-to-refresh | ~8–12s | Content stays visible, progress bar shows, cache updated |

The background scheduler collects all unique interests from the `users` collection and refreshes each cache serially every 12 hours. On server startup, an initial cache warm runs after a 10-second delay. Onboarding also triggers a fire-and-forget cache warm for newly selected interests.

### Personalization loop

1. User clicks an item → dashboard calls `POST /api/log-interaction`.
2. Server appends the click to `users/{uid}/history` in Firestore.
3. If the item has an embedding, the server recalculates the user's average interest vector from their last 10 interactions and saves it to `users/{uid}.vectorProfile`.
4. "For You" feed queries `GET /api/personalized-feed` → Firestore `findNearest` (cosine similarity) against stored item embeddings.
5. Results blend personalized items with fresh cached content from all of the user's interests.

## Tech stack

- **Frontend:** React 19, Tailwind CSS v4, Framer Motion (`motion/react`)
- **Backend:** Express, Firebase Admin SDK
- **AI:** Google Gemini (`@google/genai`, `gemini-3-flash-preview`)
- **Auth & data:** Firebase Auth (Google), Firestore
- **Hosting:** Firebase Hosting + Cloud Run

## Running locally

**Prerequisites:** Node.js, a Firebase project with Auth (Google provider) and Firestore enabled.

```bash
npm install
cp .env.example .env.local
# Fill in all values in .env.local
npm run dev
```

The app runs on `http://localhost:3000`. See `.env.example` for required environment variables.

## Deployment

Deploys to **Cloud Run** (Express server) + **Firebase Hosting** (React frontend). Firebase Hosting rewrites `/api/**` requests to the Cloud Run service.

### Prerequisites

```bash
brew install --cask google-cloud-sdk
npm install -g firebase-tools

gcloud auth login
firebase login

gcloud config set project YOUR_PROJECT_ID
firebase use YOUR_PROJECT_ID
gcloud services enable run.googleapis.com
```

### Environment variables

Create `.env.cloudrun.yaml` from `.env.example` with production values:

```yaml
GEMINI_API_KEY: "..."
NEWSDATA_API_KEY: "..."
YOUTUBE_API_KEY: "..."
VITE_FIREBASE_PROJECT_ID: "..."
FIREBASE_CLIENT_EMAIL: "..."
FIREBASE_PRIVATE_KEY: "..."
```

### Deploy

```bash
npm run deploy:server   # Express → Cloud Run
npm run deploy:hosting  # React → Firebase Hosting
npm run deploy          # Both in sequence
```

### First deploy note

After the first `deploy:server`, Cloud Run assigns a service URL. Firebase Hosting routes `/api/**` to the `pulseboard-server` service in `us-central1` via the native Cloud Run integration in `firebase.json`.
