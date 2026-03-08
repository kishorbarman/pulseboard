# PulseBoard

A personalized content dashboard that aggregates trending news, YouTube videos, and social topics into a single feed. Content is tailored to each user based on their stated interests and browsing behavior using vector-based personalization.

## What it does

- Users sign in with Google and complete a one-time onboarding to select their interests (e.g. Technology, Finance, Space).
- The dashboard fetches news articles, YouTube videos, and trending topics filtered to those interests.
- Every item a user clicks is logged. Over time, the app builds a vector profile from that history and surfaces a personalized "For You" feed using cosine similarity search in Firestore.
- Users can bookmark items, search for any topic on demand, and export their data.

## High-level design

```
Browser (React SPA)
    |
    |  HTTP (same origin)
    v
Express server (server.ts)
    |-- GET /api/news           --> NewsData.io API
    |-- GET /api/youtube        --> YouTube Data API v3
    |-- GET /api/x-trends       --> mock data (no live API)
    |-- POST /api/log-interaction --> Firestore (Admin SDK)
    |-- GET /api/personalized-feed --> Firestore vector search
    |
    |  Vite middleware (dev) / static dist/ (prod)
    v
Firebase
    |-- Auth (Google sign-in)
    |-- Firestore (client SDK: bookmarks, user profile)
    |-- Firestore (Admin SDK: items collection, vector profiles)
```

The Express server acts as a secure proxy for all third-party API keys and handles the personalization logic server-side. The React frontend communicates only with `/api/*` routes and the Firebase client SDK directly for auth and bookmarks.

### Personalization loop

1. User clicks an item — the dashboard calls `POST /api/log-interaction`.
2. The server appends the click to `users/{uid}/history` in Firestore.
3. If the item has an embedding stored in the `items` collection, the server recalculates the user's average interest vector from their last 10 interactions and saves it to `users/{uid}.vectorProfile`.
4. The "For You" feed queries `GET /api/personalized-feed`, which runs a Firestore `findNearest` (cosine similarity) against all stored item embeddings using the user's `vectorProfile`.
5. Results are blended 70% personalized / 30% fresh content from the user's top interest.

### Firestore schema

| Collection | Purpose |
|---|---|
| `items` | Cached content (news/video/trend) with optional embeddings and sentiment |
| `users/{uid}` | Profile, interests array, vectorProfile |
| `users/{uid}/history` | Click log (title, url, type, timestamp) |
| `users/{uid}/bookmarks` | Saved items with full item data |

## Running locally

**Prerequisites:** Node.js, a Firebase project with Auth (Google provider) and Firestore enabled.

```bash
npm install
cp .env.example .env.local
# Fill in all values in .env.local
npm run dev
```

The app runs on `http://localhost:3000`. See `.env.example` for all required environment variables.

## Deployment

The app deploys to **Cloud Run** (Express server) + **Firebase Hosting** (React frontend). Firebase Hosting rewrites all `/api/**` requests to the Cloud Run service.

### Prerequisites

```bash
# Install CLIs if needed
brew install --cask google-cloud-sdk
npm install -g firebase-tools

# Authenticate
gcloud auth login
firebase login

# Set your project
gcloud config set project YOUR_PROJECT_ID
firebase use YOUR_PROJECT_ID

# Enable Cloud Run API (one-time)
gcloud services enable run.googleapis.com
```

### Environment variables

Create `.env.cloudrun.yaml` from `.env.example` with your production values. This file is gitignored and read by Cloud Run at deploy time:

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
# Deploy Express server to Cloud Run
npm run deploy:server

# Build frontend and deploy to Firebase Hosting
npm run deploy:hosting

# Or both in sequence
npm run deploy
```

`deploy:server` builds a Docker image from `Dockerfile`, pushes it to Cloud Run, and sets env vars from `.env.cloudrun.yaml`. `deploy:hosting` runs `vite build` and uploads `dist/` to Firebase Hosting.

### First deploy note

After the first `deploy:server`, Cloud Run assigns a service URL. Firebase Hosting is already configured to route `/api/**` to the `pulseboard-server` service in `us-central1` via the native Cloud Run integration in `firebase.json` — no manual URL wiring needed.
