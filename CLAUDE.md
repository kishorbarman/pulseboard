# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Development (starts Express + Vite dev server on port 3000)
npm run dev

# Type check (no test suite exists)
npm run lint

# Production build
npm run build

# Deploy to Firebase Hosting
npm run deploy
```

There is no test suite. `npm run lint` runs `tsc --noEmit` for type checking.

## Environment Setup

Copy `.env.example` to `.env.local` and fill in:

- `GEMINI_API_KEY` — Gemini AI (used client-side via Vite's `process.env` define)
- `VITE_FIREBASE_*` — Firebase client SDK config (Auth + Firestore)
- `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` — Firebase Admin SDK (server-side vector search; optional)
- `NEWSDATA_API_KEY` — NewsData.io for news articles
- `YOUTUBE_API_KEY` — YouTube Data API v3

Firebase Admin credentials are optional; without them, vector search and personalization are disabled but the app still works.

## Architecture

This is a full-stack TypeScript app with a unified dev server:

**`server.ts`** — Express server that:
- Serves the Vite SPA in dev (via Vite middleware) and `dist/` in production
- Proxies external APIs (NewsData.io, YouTube) to hide API keys
- Manages Firestore items collection and user interaction logging via Firebase Admin SDK
- Implements vector-based personalization: stores item embeddings, tracks user click history, computes average vector profile, runs `findNearest` (cosine similarity) for the "For You" feed

**`src/`** — React 19 SPA:
- `App.tsx` — Auth entry point: checks Firebase config, handles Google sign-in, routes to `Onboarding` or `Dashboard`
- `src/lib/firebase.ts` — Firebase client SDK wrapper: auth, Firestore CRUD, bookmarks, history, data export
- `src/components/Dashboard.tsx` — Main content view: fetches from Express API routes, interleaves news/video/trend cards in a mixed grid, logs interactions for vector learning
- `src/components/Sidebar.tsx` — Interest navigation (user-defined topics + "For You" + "Saved")
- `src/components/AIPulse.tsx` — Floating button indicating background AI personalization activity

**Data flow for personalization:**
1. User clicks an item → `handleItemClick` in Dashboard calls `POST /api/log-interaction`
2. Server logs to Firestore `users/{uid}/history` and updates `users/{uid}.vectorProfile` (average of recent embeddings)
3. "For You" feed fetches `GET /api/personalized-feed?userId=...` which runs Firestore vector search against `vectorProfile`

**Firestore collections:**
- `items` — cached content with embeddings, sentiment, type (`news`|`video`|`trend`)
- `users/{uid}` — profile, interests, vectorProfile
- `users/{uid}/history` — click history
- `users/{uid}/bookmarks` — saved items

## Key Conventions

- Tailwind CSS v4 via `@tailwindcss/vite` plugin (no `tailwind.config.js`)
- Animations use `motion/react` (Framer Motion v12+)
- `src/lib/utils.ts` exports `cn()` (clsx + tailwind-merge)
- `@` path alias resolves to the project root (not `src/`)
- X/Twitter trends are currently mocked in `server.ts` (no real API integration)
