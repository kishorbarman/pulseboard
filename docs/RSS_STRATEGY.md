# RSS Strategy

This document explains how PulseBoard now supports RSS alongside NewsData.

## Goal

- Use RSS as the primary news source (no API quota pressure).
- Use NewsData only as fallback when RSS is sparse or when a topic is not in the curated interest map.

## Runtime Behavior

1. Resolve interest feeds from `rss-feeds.ts`.
2. Fetch and parse RSS (Google News RSS queries scoped to trusted publishers).
3. Normalize to existing news item shape (`title`, `link`, `description`, `pubDate`, `image_url`, `source_id`, `creator`).
4. Filter to recent items (last 48 hours).
5. If RSS returns fewer than `3` items, fallback to NewsData.
6. Continue through existing relevance filter, cache, and UI pipeline.
7. News cards display ingestion attribution (`RSS` or `NewsData`).

## Metrics Logging

The server now logs per-interest ingestion metrics on both smart-feed runs and direct `/api/news` calls:

- RSS item count
- NewsData item count
- Final merged count
- Whether fallback was used
- Cumulative totals by interest

Log prefix: `[NewsMetrics]`

## Curated Coverage (Built-in Interests)

| Interest | Publisher Set Used |
|---|---|
| Artificial Intelligence | MIT Tech Review, The Verge, Ars Technica, OpenAI Blog |
| Machine Learning | KDnuggets, Towards Data Science, VentureBeat, Google AI Blog |
| Web Development | web.dev, CSS-Tricks, Smashing Magazine, Dev.to |
| Cybersecurity | KrebsOnSecurity, BleepingComputer, The Hacker News, Dark Reading |
| Space Exploration | NASA, SpaceNews, ESA, Ars Technica |
| Robotics | IEEE Spectrum, The Robot Report, Robotics Business Review, TechCrunch |
| Data Science | KDnuggets, Towards Data Science, O’Reilly, Databricks |
| Gadgets | The Verge, Engadget, CNET, Ars Technica |
| World News | Reuters, AP, BBC, Al Jazeera |
| US Politics | Politico, The Hill, NPR, Reuters |
| Global Politics | Foreign Policy, Reuters, Al Jazeera, BBC |
| Economics | Reuters, Bloomberg, The Economist, WSJ |
| Climate Change | Carbon Brief, Climate Home News, The Guardian, Reuters |
| Startups | TechCrunch, Y Combinator, VentureBeat, Forbes |
| Cryptocurrency | CoinDesk, Cointelegraph, The Block, Decrypt |
| Venture Capital | TechCrunch, PitchBook, NVCA, Forbes |
| Fintech | Finextra, TechCrunch, CNBC, Forbes |
| Stock Market | MarketWatch, CNBC, Reuters, Yahoo Finance |
| Cooking | Serious Eats, NYT Cooking, Bon Appétit, Food52 |
| Fitness & Health | Healthline, Verywell Fit, WHO, NYT |
| Travel | Lonely Planet, Condé Nast Traveler, Travel + Leisure, The Points Guy |
| Fashion | Vogue, Fashionista, Business of Fashion, WWD |
| Photography | PetaPixel, Fstoppers, DPReview, Digital Camera World |
| Gaming | IGN, Polygon, GamesRadar, Kotaku |
| Movies & TV | Variety, The Hollywood Reporter, Deadline, IndieWire |
| Music | Billboard, Pitchfork, Rolling Stone, NME |
| Sports | ESPN, BBC Sport, Sky Sports, Reuters |
| Books & Literature | Book Riot, Literary Hub, Paris Review, NYT |
| Design | Creative Bloq, Smashing Magazine, UX Collective, Dezeen |
| Open Source | GitHub Blog, LWN, opensource.com, InfoQ |
| Productivity | Zapier Blog, Todoist Blog, Lifehacker, Notion |

## Graceful Handling for Unknown Interests

If a user picks an interest outside the curated table:

1. The server generates fallback RSS search feeds dynamically from the raw interest text.
2. It still applies relevance filtering and freshness checks.
3. NewsData is used as a fallback if results remain sparse.

This ensures custom topics continue to work without breaking the feed.
