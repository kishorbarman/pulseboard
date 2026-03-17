# Ranking Pipeline (Importance + P13N)

## Overview
The feed ranking now has three layers:

1. Deterministic scoring (always on)
2. Gemini rerank (feature-flagged)
3. User personalization rerank at response time

## 1) Deterministic scoring
Each item gets a `_rank` object with:

- `freshness`
- `importance`
- `engagement`
- `personalization` (filled in at response time)
- `baseScore`
- `geminiImportance` (filled only when Gemini rerank is enabled)
- `finalScore`

Signals include recency, source priors (news), engagement metrics (X/YouTube), and content heuristics.

## 2) Gemini rerank (optional)
Gemini can rerank top-K candidates by global importance per topic.

Environment flags:

- `ENABLE_GEMINI_RERANK=false` to disable (default is enabled)
- `GEMINI_RERANK_TOP_K=15` (default 15, clamped to 5..30)

When off, deterministic ranking + personalization still run.

## 3) Personalization rerank
For `/api/smart-feed` and `/api/smart-feed-foryou`, pass `userId`.

The server loads lightweight personalization signals from Firestore:

- user interests
- recent click-history title tokens
- type preference (`news`/`video`/`trend`)

Then it reranks each content type with a personalized final score.

## Observability endpoint
Use ranking debug keys to inspect score breakdowns.

- Request feeds with `debugKey=<your-key>`
- Inspect at:
  - `GET /api/ranking-debug?key=<your-key>`
  - `GET /api/ranking-debug` (lists recent keys)

Example:

- `/api/smart-feed-foryou?interests=AI,Economics&userId=abc&debugKey=dev-1`
- `/api/ranking-debug?key=dev-1`
