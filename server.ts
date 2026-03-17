import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { Firestore, FieldValue, FieldPath } from "@google-cloud/firestore";
import { GoogleGenAI } from "@google/genai";
import Parser from "rss-parser";
import { getRssFeedsForInterest } from "./rss-feeds.ts";

dotenv.config();

// Feed cache — stores fully-processed feed results per interest in Firestore
interface FeedCacheDocument {
  news: any[];
  videos: any[];
  posts: any[];
  summary: string;
  warnings: string[];
  queries: { newsQueries: string[]; youtubeQueries: string[]; twitterQueries: string[] };
  updatedAt: FirebaseFirestore.Timestamp;
}

function sanitizeForFirestore<T = any>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeForFirestore(item))
      .filter((item) => item !== undefined) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      const sanitized = sanitizeForFirestore(v);
      if (sanitized !== undefined) out[k] = sanitized;
    }
    return out as T;
  }
  return value;
}

const FEED_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const RSS_MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours
const RSS_MAX_FEEDS_PER_INTEREST = 4;
const RSS_MAX_ITEMS_PER_INTEREST = 30;
const RSS_MIN_RESULTS_BEFORE_NEWSDATA_FALLBACK = 3;
const FEED_MAX_LOAD_MULTIPLIER = 4;
const SINGLE_BASE_NEWS_LIMIT = 20;
const SINGLE_BASE_VIDEO_LIMIT = 12;
const SINGLE_BASE_POST_LIMIT = 12;
const FORYOU_BASE_NEWS_LIMIT = 24;
const FORYOU_BASE_VIDEO_LIMIT = 14;
const FORYOU_BASE_POST_LIMIT = 12;
const FORYOU_PER_INTEREST_NEWS_LIMIT = 6;
const FORYOU_PER_INTEREST_VIDEO_LIMIT = 4;
const FORYOU_PER_INTEREST_POST_LIMIT = 4;
const ENABLE_GEMINI_RERANK = process.env.ENABLE_GEMINI_RERANK !== 'false';
const GEMINI_RERANK_TOP_K = Math.max(5, Math.min(30, Number(process.env.GEMINI_RERANK_TOP_K || 15)));
const currentlyRefreshing = new Set<string>();
const rssParser = new Parser();

interface NewsIngestionStats {
  runs: number;
  rssItems: number;
  newsDataItems: number;
  finalItems: number;
  fallbackRuns: number;
  lastUpdatedAt: string;
}

const newsIngestionMetrics = new Map<string, NewsIngestionStats>();

function logNewsIngestionMetrics(
  topic: string,
  rssItems: number,
  newsDataItems: number,
  finalItems: number,
  usedFallback: boolean,
  context: string
): void {
  const key = topic.trim().toLowerCase();
  const current = newsIngestionMetrics.get(key) || {
    runs: 0,
    rssItems: 0,
    newsDataItems: 0,
    finalItems: 0,
    fallbackRuns: 0,
    lastUpdatedAt: new Date().toISOString(),
  };

  const updated: NewsIngestionStats = {
    runs: current.runs + 1,
    rssItems: current.rssItems + rssItems,
    newsDataItems: current.newsDataItems + newsDataItems,
    finalItems: current.finalItems + finalItems,
    fallbackRuns: current.fallbackRuns + (usedFallback ? 1 : 0),
    lastUpdatedAt: new Date().toISOString(),
  };
  newsIngestionMetrics.set(key, updated);

  console.log(
    `[NewsMetrics] context=${context} topic="${topic}" rss=${rssItems} newsdata=${newsDataItems} final=${finalItems} fallback=${usedFallback} runs=${updated.runs} cumulativeRss=${updated.rssItems} cumulativeNewsData=${updated.newsDataItems} cumulativeFinal=${updated.finalItems} cumulativeFallbackRuns=${updated.fallbackRuns}`
  );
}

function getFeedCacheKey(interest: string): string {
  return interest.toLowerCase().trim();
}

function parseLoadMultiplier(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(FEED_MAX_LOAD_MULTIPLIER, Math.floor(parsed)));
}

async function readFeedCache(interest: string): Promise<FeedCacheDocument | null> {
  if (!firestore) return null;
  const key = getFeedCacheKey(interest);
  try {
    const doc = await firestore.collection('feedCache').doc(key).get();
    if (!doc.exists) return null;
    const data = doc.data() as FeedCacheDocument;
    const updatedAt = data.updatedAt?.toMillis?.() || 0;
    if (Date.now() - updatedAt > FEED_CACHE_TTL_MS) return null;
    return data;
  } catch (e) {
    console.error(`[FeedCache] Error reading cache for "${interest}":`, e);
    return null;
  }
}

async function readFeedCacheEvenIfStale(interest: string): Promise<FeedCacheDocument | null> {
  if (!firestore) return null;
  const key = getFeedCacheKey(interest);
  try {
    const doc = await firestore.collection('feedCache').doc(key).get();
    if (!doc.exists) return null;
    return doc.data() as FeedCacheDocument;
  } catch (e) {
    console.error(`[FeedCache] Error reading stale cache for "${interest}":`, e);
    return null;
  }
}

async function writeFeedCache(interest: string, data: Omit<FeedCacheDocument, 'updatedAt'>): Promise<void> {
  if (!firestore) return;
  const key = getFeedCacheKey(interest);
  try {
    const safeData = sanitizeForFirestore(data);
    await firestore.collection('feedCache').doc(key).set({
      ...safeData,
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`[FeedCache] Wrote cache for "${interest}" (${safeData.news.length} news, ${safeData.videos.length} videos, ${safeData.posts.length} posts)`);
  } catch (e) {
    console.error(`[FeedCache] Error writing cache for "${interest}":`, e);
  }
}

// Smart query cache — stores Gemini-generated queries per topic for 30 minutes
interface SmartQueryCache {
  newsQueries: string[];
  youtubeQueries: string[];
  twitterQueries: string[];
  cachedAt: number;
}

const smartQueryCache = new Map<string, SmartQueryCache>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function getCachedSmartQueries(topic: string): SmartQueryCache | null {
  const key = topic.toLowerCase().trim();
  const cached = smartQueryCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
    smartQueryCache.delete(key);
    return null;
  }
  return cached;
}

function setCachedSmartQueries(topic: string, data: Omit<SmartQueryCache, 'cachedAt'>): SmartQueryCache {
  const key = topic.toLowerCase().trim();
  const entry = { ...data, cachedAt: Date.now() };
  smartQueryCache.set(key, entry);
  // Evict expired entries if cache grows large
  if (smartQueryCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of smartQueryCache) {
      if (now - v.cachedAt > CACHE_TTL_MS) smartQueryCache.delete(k);
    }
  }
  return entry;
}

// Topic-to-query and category mapping for better filtering
const TOPIC_CONFIG: Record<string, { query: string; category?: string; ytQuery?: string; xQuery?: string }> = {
  // Tech & Science
  "Artificial Intelligence": { query: '"artificial intelligence" OR "AI model" OR "generative AI"', category: "technology", ytQuery: "artificial intelligence AI news", xQuery: "(artificial intelligence OR AI OR generative AI) -is:retweet lang:en" },
  "Machine Learning": { query: '"machine learning" OR "deep learning" OR "neural network"', category: "technology", ytQuery: "machine learning tutorial news", xQuery: "(machine learning OR deep learning OR neural network) -is:retweet lang:en" },
  "Web Development": { query: '"web development" OR "frontend" OR "backend" OR "JavaScript"', category: "technology", ytQuery: "web development programming", xQuery: "(web development OR frontend OR JavaScript OR React) -is:retweet lang:en" },
  "Cybersecurity": { query: '"cybersecurity" OR "data breach" OR "hacking" OR "security vulnerability"', category: "technology", ytQuery: "cybersecurity news threats", xQuery: "(cybersecurity OR data breach OR infosec) -is:retweet lang:en" },
  "Space Exploration": { query: '"space exploration" OR "NASA" OR "SpaceX" OR "rocket launch"', category: "science", ytQuery: "space exploration NASA news", xQuery: "(space OR NASA OR SpaceX OR rocket launch) -is:retweet lang:en" },
  "Robotics": { query: '"robotics" OR "robot" OR "automation" OR "humanoid"', category: "technology", ytQuery: "robotics automation news", xQuery: "(robotics OR robot OR automation OR humanoid) -is:retweet lang:en" },
  "Data Science": { query: '"data science" OR "big data" OR "analytics" OR "data engineering"', category: "technology", ytQuery: "data science analytics", xQuery: "(data science OR big data OR analytics) -is:retweet lang:en" },
  "Gadgets": { query: '"gadgets" OR "tech review" OR "smartphone" OR "wearable"', category: "technology", ytQuery: "gadget review tech unboxing", xQuery: "(gadget OR tech review OR smartphone OR wearable) -is:retweet lang:en" },
  // News & Politics
  "World News": { query: '"world news" OR "international" OR "global affairs"', category: "world", ytQuery: "world news today international", xQuery: "(world news OR breaking news OR international) -is:retweet lang:en" },
  "US Politics": { query: '"US politics" OR "congress" OR "White House" OR "senate"', category: "politics", ytQuery: "US politics news congress", xQuery: "(US politics OR congress OR White House OR senate) -is:retweet lang:en" },
  "Global Politics": { query: '"global politics" OR "geopolitics" OR "diplomacy" OR "United Nations"', category: "politics", ytQuery: "global politics geopolitics", xQuery: "(geopolitics OR diplomacy OR United Nations) -is:retweet lang:en" },
  "Economics": { query: '"economics" OR "economy" OR "GDP" OR "inflation" OR "interest rates"', category: "business", ytQuery: "economics economy news", xQuery: "(economics OR economy OR inflation OR GDP) -is:retweet lang:en" },
  "Climate Change": { query: '"climate change" OR "global warming" OR "carbon emissions" OR "renewable energy"', category: "environment", ytQuery: "climate change environment news", xQuery: "(climate change OR global warming OR renewable energy) -is:retweet lang:en" },
  // Business & Finance
  "Startups": { query: '"startup" OR "venture funding" OR "tech startup" OR "founder"', category: "business", ytQuery: "startup funding founder story", xQuery: "(startup OR venture funding OR founder OR YC) -is:retweet lang:en" },
  "Cryptocurrency": { query: '"cryptocurrency" OR "bitcoin" OR "ethereum" OR "blockchain" OR "crypto"', category: "business", ytQuery: "cryptocurrency bitcoin crypto news", xQuery: "(crypto OR bitcoin OR ethereum OR blockchain) -is:retweet lang:en" },
  "Venture Capital": { query: '"venture capital" OR "VC funding" OR "seed round" OR "series A"', category: "business", ytQuery: "venture capital startup funding", xQuery: "(venture capital OR VC OR seed round OR series A) -is:retweet lang:en" },
  "Fintech": { query: '"fintech" OR "financial technology" OR "digital payments" OR "neobank"', category: "business", ytQuery: "fintech financial technology", xQuery: "(fintech OR digital payments OR neobank) -is:retweet lang:en" },
  "Stock Market": { query: '"stock market" OR "S&P 500" OR "Wall Street" OR "stocks" OR "investing"', category: "business", ytQuery: "stock market investing news", xQuery: "(stock market OR S&P 500 OR Wall Street OR investing) -is:retweet lang:en" },
  // Lifestyle
  "Cooking": { query: '"cooking" OR "recipe" OR "culinary" OR "chef" OR "food"', category: "food", ytQuery: "cooking recipes food", xQuery: "(cooking OR recipe OR chef OR #foodie) -is:retweet lang:en" },
  "Fitness & Health": { query: '"fitness" OR "workout" OR "health" OR "nutrition" OR "exercise"', category: "health", ytQuery: "fitness workout health tips", xQuery: "(fitness OR workout OR health OR nutrition) -is:retweet lang:en" },
  "Travel": { query: '"travel" OR "tourism" OR "destination" OR "vacation" OR "trip"', category: "tourism", ytQuery: "travel destination guide vlog", xQuery: "(travel OR destination OR vacation OR #travel) -is:retweet lang:en" },
  "Fashion": { query: '"fashion" OR "style" OR "clothing" OR "designer" OR "trends"', category: "lifestyle", ytQuery: "fashion style trends", xQuery: "(fashion OR style OR designer OR #fashion) -is:retweet lang:en" },
  "Photography": { query: '"photography" OR "camera" OR "photo editing" OR "photographer"', category: "lifestyle", ytQuery: "photography tips camera review", xQuery: "(photography OR camera OR #photography) -is:retweet lang:en" },
  // Entertainment
  "Gaming": { query: '"gaming" OR "video game" OR "esports" OR "game release"', category: "entertainment", ytQuery: "gaming video game review", xQuery: "(gaming OR video game OR esports OR #gaming) -is:retweet lang:en" },
  "Movies & TV": { query: '"movie" OR "film" OR "TV show" OR "streaming" OR "box office"', category: "entertainment", ytQuery: "movie review TV show trailer", xQuery: "(movie OR film OR TV show OR streaming OR box office) -is:retweet lang:en" },
  "Music": { query: '"music" OR "album" OR "concert" OR "artist" OR "song release"', category: "entertainment", ytQuery: "music new album artist", xQuery: "(music OR album OR concert OR #NewMusic) -is:retweet lang:en" },
  "Sports": { query: '"sports" OR "football" OR "basketball" OR "soccer" OR "championship"', category: "sports", ytQuery: "sports highlights game recap", xQuery: "(sports OR football OR basketball OR soccer) -is:retweet lang:en" },
  "Books & Literature": { query: '"books" OR "literature" OR "novel" OR "author" OR "book review"', category: "lifestyle", ytQuery: "book review literature recommendations", xQuery: "(books OR novel OR book review OR #BookTwitter) -is:retweet lang:en" },
  // Creative
  "Design": { query: '"design" OR "UI UX" OR "graphic design" OR "product design"', category: "technology", ytQuery: "design UI UX graphic design", xQuery: "(design OR UI UX OR graphic design) -is:retweet lang:en" },
  "Open Source": { query: '"open source" OR "GitHub" OR "open-source project" OR "OSS"', category: "technology", ytQuery: "open source project GitHub", xQuery: "(open source OR GitHub OR OSS) -is:retweet lang:en" },
  "Productivity": { query: '"productivity" OR "time management" OR "workflow" OR "efficiency"', category: "lifestyle", ytQuery: "productivity tips workflow", xQuery: "(productivity OR time management OR workflow) -is:retweet lang:en" },
};

function getTopicConfig(topic: string) {
  const config = TOPIC_CONFIG[topic];
  if (config) return config;
  // For custom topics, use the topic as-is
  return { query: topic };
}

// Gemini-powered smart query generation using Google Search grounding
async function generateSmartQueries(topic: string): Promise<SmartQueryCache> {
  const cached = getCachedSmartQueries(topic);
  if (cached) {
    console.log(`Smart queries cache hit for: ${topic}`);
    return cached;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const ai = new GoogleGenAI({ apiKey });
  const currentDate = new Date().toISOString().split('T')[0];
  const year = new Date().getFullYear();

  const prompt = `You are a content research assistant. Today is ${currentDate}.

Research what is currently happening about "${topic}" using web search.

Return a JSON object with 3 short search queries per platform:
{
  "newsQueries": ["query1", "query2", "query3"],
  "youtubeQueries": ["query1", "query2", "query3"],
  "twitterQueries": ["query1", "query2", "query3"]
}

Rules:
- Keep each query 2-5 words — short and specific
- newsQueries: specific names, events, or products currently in the news
- youtubeQueries: natural phrases people search on YouTube, include "${year}" where relevant
- twitterQueries: Twitter search syntax, append "-is:retweet lang:en" to each
- Focus on what is CURRENTLY trending, not evergreen terms
- Order from most specific/trending to broader

Return ONLY the JSON object, no markdown fences or extra text.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text || '';

  let parsed: any;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    parsed = JSON.parse(jsonMatch[0]);
  } catch (parseError) {
    console.warn('Failed to parse Gemini smart query response, falling back to TOPIC_CONFIG:', parseError);
    const config = getTopicConfig(topic);
    return setCachedSmartQueries(topic, {
      newsQueries: [config.query],
      youtubeQueries: [config.ytQuery || topic],
      twitterQueries: [config.xQuery || `${topic} -is:retweet lang:en`],
    });
  }

  return setCachedSmartQueries(topic, {
    newsQueries: Array.isArray(parsed.newsQueries) ? parsed.newsQueries.slice(0, 3) : [topic],
    youtubeQueries: Array.isArray(parsed.youtubeQueries) ? parsed.youtubeQueries.slice(0, 3) : [topic],
    twitterQueries: Array.isArray(parsed.twitterQueries) ? parsed.twitterQueries.slice(0, 3) : [`${topic} -is:retweet lang:en`],
  });
}

// --- Multi-interest "For You" smart query generation ---

interface ForYouQueryCache {
  perTopic: Record<string, {
    newsQueries: string[];
    youtubeQueries: string[];
    twitterQueries: string[];
  }>;
  cachedAt: number;
}

const forYouQueryCache = new Map<string, ForYouQueryCache>();

function getForYouCacheKey(interests: string[]): string {
  return interests.map(i => i.toLowerCase().trim()).sort().join('|');
}

function getCachedForYouQueries(interests: string[]): ForYouQueryCache | null {
  const key = getForYouCacheKey(interests);
  const cached = forYouQueryCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
    forYouQueryCache.delete(key);
    return null;
  }
  return cached;
}

function setCachedForYouQueries(interests: string[], data: Omit<ForYouQueryCache, 'cachedAt'>): ForYouQueryCache {
  const key = getForYouCacheKey(interests);
  const entry = { ...data, cachedAt: Date.now() };
  forYouQueryCache.set(key, entry);
  if (forYouQueryCache.size > 50) {
    const now = Date.now();
    for (const [k, v] of forYouQueryCache) {
      if (now - v.cachedAt > CACHE_TTL_MS) forYouQueryCache.delete(k);
    }
  }
  return entry;
}

async function generateSmartQueriesForYou(interests: string[]): Promise<ForYouQueryCache> {
  const cached = getCachedForYouQueries(interests);
  if (cached) {
    console.log(`For You queries cache hit for: ${interests.join(', ')}`);
    return cached;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const ai = new GoogleGenAI({ apiKey });
  const currentDate = new Date().toISOString().split('T')[0];

  const prompt = `You are a content research assistant. Today is ${currentDate}.

Research the latest trends for EACH of these topics: ${interests.join(', ')}

Return a JSON object where each key is the exact topic name, with 2 short queries per platform:
{
  "${interests[0]}": {
    "newsQueries": ["short query", "short query"],
    "youtubeQueries": ["short query", "short query"],
    "twitterQueries": ["query -is:retweet lang:en", "query -is:retweet lang:en"]
  }${interests.length > 1 ? `,
  "${interests[1]}": { ... }` : ''}
}

Rules:
- Keep each query 2-5 words (short and specific)
- newsQueries: specific names, events, products currently in the news
- youtubeQueries: natural phrases people search on YouTube
- twitterQueries: use Twitter search syntax, append -is:retweet lang:en
- Focus on what is CURRENTLY happening, not evergreen terms
- Return ONLY the JSON object, no markdown fences`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text || '';

  let parsed: any;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    parsed = JSON.parse(jsonMatch[0]);
  } catch (parseError) {
    console.warn('Failed to parse For You smart queries, falling back to TOPIC_CONFIG:', parseError);
    return buildForYouFallback(interests);
  }

  // Validate and normalize parsed result
  const perTopic: ForYouQueryCache['perTopic'] = {};
  for (const interest of interests) {
    // Try exact match first, then case-insensitive
    const topicData = parsed[interest] || Object.entries(parsed).find(
      ([k]) => k.toLowerCase() === interest.toLowerCase()
    )?.[1] as any;

    if (topicData && topicData.newsQueries) {
      perTopic[interest] = {
        newsQueries: Array.isArray(topicData.newsQueries) ? topicData.newsQueries.slice(0, 2) : [interest],
        youtubeQueries: Array.isArray(topicData.youtubeQueries) ? topicData.youtubeQueries.slice(0, 2) : [interest],
        twitterQueries: Array.isArray(topicData.twitterQueries) ? topicData.twitterQueries.slice(0, 2) : [`${interest} -is:retweet lang:en`],
      };
    } else {
      // Fallback for this specific interest
      const config = getTopicConfig(interest);
      perTopic[interest] = {
        newsQueries: [config.query],
        youtubeQueries: [config.ytQuery || interest],
        twitterQueries: [config.xQuery || `${interest} -is:retweet lang:en`],
      };
    }
  }

  return setCachedForYouQueries(interests, { perTopic });
}

function buildForYouFallback(interests: string[]): ForYouQueryCache {
  const perTopic: ForYouQueryCache['perTopic'] = {};
  for (const interest of interests) {
    const config = getTopicConfig(interest);
    perTopic[interest] = {
      newsQueries: [config.query],
      youtubeQueries: [config.ytQuery || interest],
      twitterQueries: [config.xQuery || `${interest} -is:retweet lang:en`],
    };
  }
  return setCachedForYouQueries(interests, { perTopic });
}

// Tag a result by its most likely interest based on keyword matching
function tagByInterest(title: string, interests: string[]): string {
  const lower = title.toLowerCase();
  for (const interest of interests) {
    const keywords = interest.toLowerCase().split(/\s+/);
    if (keywords.some(kw => kw.length > 2 && lower.includes(kw))) {
      return interest;
    }
  }
  // Check TOPIC_CONFIG query terms as secondary signal
  for (const interest of interests) {
    const config = TOPIC_CONFIG[interest];
    if (config?.query) {
      const terms = config.query.replace(/['"]/g, '').split(/\s+OR\s+/i);
      if (terms.some(t => t.trim().length > 2 && lower.includes(t.trim().toLowerCase()))) {
        return interest;
      }
    }
  }
  return interests[0];
}

// Round-robin diversity enforcement across interest buckets
function ensureDiversity<T>(
  items: T[],
  getTag: (item: T) => string,
  maxPerInterest: number,
  totalMax: number
): T[] {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const tag = getTag(item);
    if (!buckets.has(tag)) buckets.set(tag, []);
    buckets.get(tag)!.push(item);
  }

  const result: T[] = [];
  const keys = [...buckets.keys()];
  let round = 0;

  while (result.length < totalMax) {
    let added = false;
    for (const key of keys) {
      const bucket = buckets.get(key)!;
      if (round < bucket.length && round < maxPerInterest) {
        result.push(bucket[round]);
        added = true;
        if (result.length >= totalMax) break;
      }
    }
    if (!added) break;
    round++;
  }

  return result;
}

type ContentType = 'news' | 'video' | 'trend';

interface RankBreakdown {
  freshness: number;
  importance: number;
  engagement: number;
  personalization: number;
  baseScore: number;
  geminiImportance: number;
  finalScore: number;
}

interface PersonalizationSignals {
  userId: string;
  interests: string[];
  interestSet: Set<string>;
  historyTokens: Set<string>;
  typePreference: Record<ContentType, number>;
}

interface RankDebugEntry {
  key: string;
  generatedAt: string;
  userId?: string;
  topic?: string;
  mode: 'single' | 'foryou';
  counts: { news: number; videos: number; posts: number };
  top: {
    news: any[];
    videos: any[];
    posts: any[];
  };
}

const personalizationCache = new Map<string, { cachedAt: number; data: PersonalizationSignals }>();
const PERSONALIZATION_CACHE_TTL_MS = 5 * 60 * 1000;
const rankingDebugMap = new Map<string, RankDebugEntry>();
const RANK_DEBUG_MAX_KEYS = 80;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeWhitespace(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenizeForRanking(text: string): string[] {
  const stop = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'about', 'your', 'have', 'been', 'are', 'was', 'will', 'you', 'has']);
  return normalizeWhitespace(text)
    .split(' ')
    .filter(t => t.length >= 3 && !stop.has(t))
    .slice(0, 30);
}

function getItemType(item: any): ContentType {
  if (item?.text && item?.author) return 'trend';
  if (item?.snippet || item?.id?.videoId || item?._subscriberCount !== undefined) return 'video';
  return 'news';
}

function getItemTitle(item: any, type: ContentType): string {
  if (type === 'news') return String(item?.title || '');
  if (type === 'video') return String(item?.snippet?.title || item?.title || '');
  return String(item?.text || item?.name || '');
}

function getItemTimestampMs(item: any, type: ContentType): number | null {
  const raw = type === 'news'
    ? item?.pubDate
    : type === 'video'
      ? item?.snippet?.publishedAt
      : item?.created_at;
  if (!raw) return null;
  const ts = Date.parse(raw);
  return Number.isNaN(ts) ? null : ts;
}

function getSourcePrior(item: any, type: ContentType): number {
  if (type !== 'news') return 0.55;
  const source = String(item?.source_id || '').toLowerCase();
  const high = ['reuters', 'associated press', 'bloomberg', 'wall street journal', 'financial times', 'bbc', 'npr', 'economist'];
  const medium = ['the verge', 'ars technica', 'techcrunch', 'wired', 'cnbc', 'marketwatch', 'yahoo'];
  if (high.some(s => source.includes(s))) return 0.95;
  if (medium.some(s => source.includes(s))) return 0.8;
  return 0.62;
}

function computeFreshnessScore(item: any, type: ContentType): number {
  const ts = getItemTimestampMs(item, type);
  if (!ts) return 0.45;
  const ageHours = Math.max(0, (Date.now() - ts) / (1000 * 60 * 60));
  if (ageHours <= 6) return 1;
  if (ageHours <= 24) return 0.9;
  if (ageHours <= 48) return 0.76;
  if (ageHours <= 72) return 0.64;
  if (ageHours <= 168) return 0.45;
  return 0.3;
}

function computeImportanceScore(item: any, type: ContentType): number {
  const title = getItemTitle(item, type).toLowerCase();
  const highSignalWords = ['breaking', 'launch', 'earnings', 'acquires', 'acquisition', 'policy', 'regulation', 'crisis', 'war', 'security'];
  const keywordBoost = highSignalWords.some(w => title.includes(w)) ? 0.12 : 0;

  if (type === 'news') {
    return clamp01(0.48 + getSourcePrior(item, type) * 0.4 + keywordBoost);
  }
  if (type === 'video') {
    const subs = Number(item?._subscriberCount || 0);
    const normalizedSubs = clamp01(Math.log10(Math.max(1, subs)) / 7);
    return clamp01(0.4 + normalizedSubs * 0.45 + keywordBoost);
  }
  const metrics = item?.metrics || {};
  const engagement = (metrics.likes || 0) + (metrics.retweets || 0) * 2 + (metrics.replies || 0);
  const normalizedEngagement = clamp01(Math.log10(Math.max(1, engagement + 1)) / 5);
  return clamp01(0.38 + normalizedEngagement * 0.5 + keywordBoost);
}

function computeEngagementScore(item: any, type: ContentType): number {
  if (type === 'trend') {
    const metrics = item?.metrics || {};
    const eng = (metrics.likes || 0) + (metrics.retweets || 0) * 2 + (metrics.replies || 0);
    return clamp01(Math.log10(Math.max(1, eng + 1)) / 5);
  }
  if (type === 'video') {
    const subs = Number(item?._subscriberCount || 0);
    return clamp01(Math.log10(Math.max(1, subs + 1)) / 7);
  }
  return 0.45;
}

function baseRankScore(item: any, type: ContentType): RankBreakdown {
  const freshness = computeFreshnessScore(item, type);
  const importance = computeImportanceScore(item, type);
  const engagement = computeEngagementScore(item, type);
  const baseScore = clamp01(0.38 * freshness + 0.42 * importance + 0.2 * engagement);
  return {
    freshness,
    importance,
    engagement,
    personalization: 0,
    baseScore,
    geminiImportance: 0,
    finalScore: baseScore,
  };
}

function getInterestSignal(item: any): string {
  return String(item?._interest || '').toLowerCase().trim();
}

function computePersonalizationScore(item: any, type: ContentType, signals?: PersonalizationSignals | null): number {
  if (!signals) return 0;
  const itemInterest = getInterestSignal(item);
  const interestMatch = itemInterest && signals.interestSet.has(itemInterest) ? 1 : 0.35;
  const titleTokens = tokenizeForRanking(getItemTitle(item, type));
  const overlap = titleTokens.filter(t => signals.historyTokens.has(t)).length;
  const overlapScore = clamp01(overlap / 6);
  const typeScore = clamp01(signals.typePreference[type] || 0.33);
  return clamp01(0.45 * interestMatch + 0.35 * overlapScore + 0.2 * typeScore);
}

function attachBaseRank(items: any[], type: ContentType): any[] {
  return items.map(item => {
    const rank = baseRankScore(item, type);
    return { ...item, _rank: rank };
  });
}

function applyPersonalizationRank(items: any[], type: ContentType, signals?: PersonalizationSignals | null): any[] {
  return [...items]
    .map(item => {
      const prev = item?._rank || baseRankScore(item, type);
      const personalization = computePersonalizationScore(item, type, signals);
      const finalScore = clamp01(prev.baseScore * 0.72 + personalization * 0.28 + prev.geminiImportance * 0.12);
      return {
        ...item,
        _rank: {
          ...prev,
          personalization,
          finalScore,
        } as RankBreakdown,
      };
    })
    .sort((a, b) => (b?._rank?.finalScore || 0) - (a?._rank?.finalScore || 0));
}

async function maybeApplyGeminiRerank(items: any[], type: ContentType, topic: string): Promise<any[]> {
  if (!ENABLE_GEMINI_RERANK || items.length === 0) return items;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return items;
  const top = items.slice(0, GEMINI_RERANK_TOP_K);
  const lines = top.map((item, idx) => `${idx}. ${getItemTitle(item, type).slice(0, 180)}`).join('\n');
  const prompt = `You are ranking feed items by global importance for topic "${topic}".

Rate each item from 0 to 100 based on: impact, urgency, and user value right now.
Return ONLY JSON array objects like [{"index":0,"importance":78}] for all provided indices.

ITEMS:
${lines}`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });
    const text = response.text || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return items;
    const parsed = JSON.parse(jsonMatch[0]) as Array<{ index: number; importance: number }>;
    const byIndex = new Map<number, number>();
    for (const row of parsed) {
      if (Number.isInteger(row.index)) byIndex.set(row.index, clamp01((Number(row.importance) || 0) / 100));
    }
    return items.map((item, idx) => {
      const prev = item?._rank || baseRankScore(item, type);
      if (idx >= GEMINI_RERANK_TOP_K) return item;
      const gem = byIndex.get(idx) ?? 0;
      const finalScore = clamp01(prev.baseScore * 0.78 + gem * 0.22);
      return {
        ...item,
        _rank: {
          ...prev,
          geminiImportance: gem,
          finalScore,
        } as RankBreakdown,
      };
    }).sort((a, b) => (b?._rank?.finalScore || 0) - (a?._rank?.finalScore || 0));
  } catch (e) {
    console.warn(`[Rank] Gemini rerank failed (${type}, ${topic}):`, e);
    return items;
  }
}

async function getPersonalizationSignals(userId?: string | null): Promise<PersonalizationSignals | null> {
  if (!firestore || !userId) return null;
  const key = String(userId);
  const cached = personalizationCache.get(key);
  if (cached && (Date.now() - cached.cachedAt) <= PERSONALIZATION_CACHE_TTL_MS) return cached.data;

  try {
    const userDoc = await firestore.collection('users').doc(key).get();
    const interests = Array.isArray(userDoc.data()?.interests) ? userDoc.data()!.interests as string[] : [];
    const historySnap = await firestore.collection('users').doc(key).collection('history').orderBy('clickedAt', 'desc').limit(80).get();
    const typeCounts: Record<ContentType, number> = { news: 1, video: 1, trend: 1 };
    const tokens = new Set<string>();
    for (const doc of historySnap.docs) {
      const row: any = doc.data();
      const t = String(row?.type || '');
      if (t === 'news' || t === 'video' || t === 'trend') typeCounts[t] += 1;
      for (const token of tokenizeForRanking(String(row?.title || ''))) {
        tokens.add(token);
      }
    }
    const total = typeCounts.news + typeCounts.video + typeCounts.trend;
    const data: PersonalizationSignals = {
      userId: key,
      interests,
      interestSet: new Set(interests.map(i => i.toLowerCase().trim())),
      historyTokens: tokens,
      typePreference: {
        news: typeCounts.news / total,
        video: typeCounts.video / total,
        trend: typeCounts.trend / total,
      },
    };
    personalizationCache.set(key, { cachedAt: Date.now(), data });
    return data;
  } catch (e) {
    console.warn('[Rank] Failed to load personalization signals:', e);
    return null;
  }
}

function captureRankingDebug(entry: RankDebugEntry): void {
  rankingDebugMap.set(entry.key, entry);
  if (rankingDebugMap.size > RANK_DEBUG_MAX_KEYS) {
    const oldestKey = rankingDebugMap.keys().next().value;
    if (oldestKey) rankingDebugMap.delete(oldestKey);
  }
}

// Generate a detailed summary of the actual fetched content for the AI Insights panel
async function generateFeedSummary(
  topic: string,
  news: any[],
  videos: any[],
  posts: any[]
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return `Latest updates about ${topic}`;

  const parts: string[] = [];

  if (news.length > 0) {
    parts.push('NEWS:\n' + news.slice(0, 8).map(a =>
      `• ${a.title}${a.description ? ' — ' + a.description.slice(0, 120) : ''}`
    ).join('\n'));
  }
  if (videos.length > 0) {
    parts.push('VIDEOS:\n' + videos.slice(0, 6).map(v =>
      `• ${v.snippet?.title || ''}${v.snippet?.description ? ' — ' + v.snippet.description.slice(0, 120) : ''}`
    ).join('\n'));
  }
  if (posts.length > 0) {
    parts.push('POSTS:\n' + posts.slice(0, 6).map(p =>
      `• ${(p.text || '').slice(0, 150)}`
    ).join('\n'));
  }

  if (parts.length === 0) return `Latest updates about ${topic}`;

  const prompt = `You are a sharp, concise news briefing writer. Based on the content below about "${topic}", write a 3–5 bullet point briefing.

Rules:
- Each bullet starts with • and is one sentence (max 20 words)
- Cover the most important themes across news, videos, and social posts
- Be specific — use names, numbers, events, not vague statements
- Write in present tense, like a news ticker
- No intro line, no sign-off — just the bullets

CONTENT:
${parts.join('\n\n')}`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });
    return response.text || `Latest updates about ${topic}`;
  } catch (e) {
    console.warn('Feed summary generation failed:', e);
    return `Latest updates about ${topic}`;
  }
}

// Gemini-based relevance filtering
async function filterByRelevance(items: any[], topic: string, getTitleFn: (item: any) => string): Promise<any[]> {
  if (items.length < 5) return items; // Not worth filtering tiny sets

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return items;

  try {
    const titles = items.map((item, i) => `${i}. ${getTitleFn(item)}`).join('\n');
    const prompt = `You are a content relevance filter. Given the topic "${topic}", determine which items are relevant.

ITEMS:
${titles}

Return ONLY a JSON array of the index numbers that are relevant to "${topic}". Example: [0, 2, 5]
Be strict — only include items clearly related to the topic. Exclude tangential or unrelated items.`;

    const ai = new GoogleGenAI({ apiKey });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    clearTimeout(timeout);

    const text = response.text || '';
    const match = text.match(/\[[\d,\s]*\]/);
    if (!match) {
      console.warn('Gemini relevance filter: could not parse response, returning all items');
      return items;
    }

    const relevantIndices: number[] = JSON.parse(match[0]);
    const filtered = items.filter((_, i) => relevantIndices.includes(i));
    console.log(`Gemini filter: ${topic} — kept ${filtered.length}/${items.length} items`);
    return filtered.length > 0 ? filtered : items; // Fallback to all if filter is too aggressive
  } catch (e) {
    console.warn('Gemini relevance filter failed, returning unfiltered:', e);
    return items;
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize Firestore (Admin SDK) gracefully
let firestore: Firestore | null = null;

try {
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    // Handle case where user might have pasted the entire JSON into FIREBASE_CLIENT_EMAIL
    if (clientEmail.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(clientEmail);
        clientEmail = parsed.client_email || clientEmail;
        privateKey = parsed.private_key || privateKey;
      } catch (e) {
        console.error("Failed to parse FIREBASE_CLIENT_EMAIL as JSON");
      }
    }

    if (clientEmail && privateKey) {
      firestore = new Firestore({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        ignoreUndefinedProperties: true,
        credentials: {
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, '\n'),
        }
      });
      console.log("Firestore Admin initialized successfully.");
    } else {
      console.warn("Parsed Firebase credentials are empty.");
    }
  } else {
    console.warn("FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY is missing. Vector search features will be disabled.");
  }
} catch (error) {
  console.error("Failed to initialize Firestore Admin:", error);
}

async function processAndStoreItems(items: any[], type: string, getTitle: (item: any) => string, getUrl: (item: any) => string) {
  if (!firestore) return items.map(i => ({ ...i, sentiment: 'Neutral' })); // Skip vector processing if Firestore isn't configured
  
  const processedItems = [];
  
  for (const item of items) {
    const title = getTitle(item);
    const url = getUrl(item);
    
    if (!title || !url) continue;

    try {
      // Check if item already exists
      const existing = await firestore.collection('items').where('url', '==', url).limit(1).get();
      
      if (!existing.empty) {
        const data = existing.docs[0].data();
        processedItems.push({ ...item, firestoreId: existing.docs[0].id, sentiment: data.sentiment || 'Neutral' });
        continue;
      }

      // We removed backend Gemini calls, so default to Neutral and no embedding
      let sentiment = 'Neutral';
      const safeItem = sanitizeForFirestore(item);

      const docRef = firestore.collection('items').doc();
      await docRef.set({
        title,
        url,
        type,
        originalData: safeItem,
        sentiment,
        createdAt: FieldValue.serverTimestamp()
      });
      processedItems.push({ ...item, firestoreId: docRef.id, sentiment });
    } catch (e) {
      console.error("Error processing item:", e);
      processedItems.push({ ...item, sentiment: 'Neutral' });
    }
  }
  
  return processedItems;
}

// Reusable fetch helpers for each platform
interface FetchResult<T> {
  items: T[];
  error?: 'rate_limit' | 'quota_exceeded' | 'no_api_key' | 'network_error' | 'parse_error' | null;
}

async function fetchNewsForQuery(queryStr: string, category?: string): Promise<FetchResult<any>> {
  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) {
    console.warn('[News] No NEWSDATA_API_KEY configured');
    return { items: [], error: 'no_api_key' };
  }
  try {
    let url = `https://newsdata.io/api/1/news?apikey=${apiKey}&q=${encodeURIComponent(queryStr)}&language=en`;
    if (category) url += `&category=${category}`;
    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text();
      console.warn(`[News] query="${queryStr}" status=${response.status} body=${body.slice(0, 200)}`);
      const error = response.status === 429 ? 'rate_limit' as const : 'network_error' as const;
      return { items: [], error };
    }
    const data = await response.json();
    const normalized = (data.results || []).map((item: any) => ({
      ...item,
      _ingestionSource: 'newsdata',
    }));
    console.log(`[News] query="${queryStr}" → ${normalized.length} results`);
    return { items: normalized };
  } catch (e) {
    console.error('[News] fetchNewsForQuery error:', e);
    return { items: [], error: 'network_error' };
  }
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function derivePublisherFromTitle(title?: string): string | null {
  if (!title) return null;
  const match = title.match(/(?:\s[-–—]\s)([^–—-]{2,80})\s*$/u);
  const candidate = match?.[1]?.trim();
  if (!candidate) return null;
  if (/google news/i.test(candidate)) return null;
  if (/site:/i.test(candidate)) return null;
  if (candidate.length > 60) return null;
  return candidate;
}

function cleanRssFeedTitle(feedTitle?: string): string {
  if (!feedTitle) return '';
  return feedTitle
    .replace(/\s*-\s*Google News\s*$/i, '')
    .replace(/^"(.+)"$/, '$1')
    .trim();
}

function cleanGoogleNewsSuffix(text?: string): string {
  if (!text) return '';
  return text
    .replace(/\s*[-–—]\s*Google News\s*$/i, '')
    .trim();
}

function sanitizeSourceLabel(source?: string, title?: string): string {
  const cleaned = cleanGoogleNewsSuffix(cleanRssFeedTitle(source));
  const looksLikeSearchFeed =
    /google news/i.test(source || '') ||
    /site:/i.test(cleaned) ||
    /\bOR\b/i.test(cleaned) ||
    /[()"]/g.test(cleaned);
  const fromTitle = derivePublisherFromTitle(cleanGoogleNewsSuffix(title));
  if (looksLikeSearchFeed) return fromTitle || 'News';
  if (!cleaned) return fromTitle || 'News';
  if (cleaned.length > 80) return fromTitle || 'News';
  return cleaned;
}

function sanitizeNewsItemForResponse(item: any): any {
  const cleanedTitle = cleanGoogleNewsSuffix(item?.title || '');
  return {
    ...item,
    title: cleanedTitle || item?.title || '',
    source_id: sanitizeSourceLabel(item?.source_id, cleanedTitle || item?.title),
  };
}

function normalizeRssSourceId(item: any): any {
  const rawSource = String(item?.source_id || '');
  const shouldNormalize =
    item?._ingestionSource === 'rss' ||
    /google news/i.test(rawSource) ||
    /site:/i.test(rawSource);
  if (!shouldNormalize) return item;
  const fromTitle = derivePublisherFromTitle(item.title);
  const cleanedExisting = cleanRssFeedTitle(item.source_id);
  const existingLooksLikeQuery = /site:|\(|\)|\bOR\b/i.test(cleanedExisting);
  const safeExisting = existingLooksLikeQuery ? '' : cleanedExisting;
  const sourceId = sanitizeSourceLabel(fromTitle || safeExisting || item.source_id, item.title);
  return {
    ...item,
    title: cleanGoogleNewsSuffix(item.title || ''),
    source_id: sourceId || 'News',
  };
}

function dedupeNewsItems(items: any[]): any[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = (item.link || item.title || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRecentEnough(pubDate?: string): boolean {
  if (!pubDate) return true;
  const ts = Date.parse(pubDate);
  if (Number.isNaN(ts)) return true;
  return (Date.now() - ts) <= RSS_MAX_AGE_MS;
}

async function fetchRSSForInterest(topic: string): Promise<FetchResult<any> & { isCurated: boolean }> {
  const { feeds, isCurated } = getRssFeedsForInterest(topic);
  const selectedFeeds = feeds.slice(0, RSS_MAX_FEEDS_PER_INTEREST);
  const perFeed = await Promise.all(selectedFeeds.map(async (feed) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(feed.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'PulseBoard/1.0 (RSS Aggregator)',
          'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        },
      });

      if (!response.ok) {
        return { items: [], error: 'network_error' as const };
      }

      const xml = await response.text();
      const parsed = await rssParser.parseString(xml);

      const normalized = (parsed.items || []).map((item: any) => {
        const descriptionRaw = item.contentSnippet || item.content || item.summary || '';
        const imageUrl = item.enclosure?.url || item['media:thumbnail']?.$?.url || item['media:content']?.$?.url || '';
        const publisherFromTitle = derivePublisherFromTitle(item.title);
        const cleanedFeedTitle = cleanRssFeedTitle(parsed.title);
        const sourceId = publisherFromTitle || item.creator || cleanedFeedTitle || feed.name;
        return {
          title: item.title || '',
          link: item.link || '',
          description: stripHtml(descriptionRaw).slice(0, 400),
          pubDate: item.isoDate || item.pubDate || '',
          image_url: imageUrl,
          source_id: sourceId,
          creator: item.creator ? [item.creator] : [],
          _ingestionSource: 'rss',
        };
      }).filter((item: any) => item.title && item.link && isRecentEnough(item.pubDate));

      return { items: normalized };
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        return { items: [], error: 'network_error' as const };
      }
      console.warn(`[RSS] Failed for "${feed.name}" (${feed.url}):`, e);
      return { items: [], error: 'parse_error' as const };
    } finally {
      clearTimeout(timeout);
    }
  }));

  const errors = new Set(perFeed.map(r => r.error).filter(Boolean));
  const merged = dedupeNewsItems(
    perFeed
      .flatMap(r => r.items)
      .sort((a: any, b: any) => (Date.parse(b.pubDate || '') || 0) - (Date.parse(a.pubDate || '') || 0))
  ).slice(0, RSS_MAX_ITEMS_PER_INTEREST);
  const normalizedMerged = merged.map(normalizeRssSourceId);

  console.log(`[RSS] topic="${topic}" curated=${isCurated} feeds=${selectedFeeds.length} items=${normalizedMerged.length}`);

  return {
    items: normalizedMerged,
    error: normalizedMerged.length === 0 ? (errors.has('network_error') ? 'network_error' : errors.has('parse_error') ? 'parse_error' : null) : null,
    isCurated,
  };
}

async function fetchYouTubeForQuery(queryStr: string, minSubscribers = 100000): Promise<FetchResult<any>> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('[YouTube] No YOUTUBE_API_KEY configured');
    return { items: [], error: 'no_api_key' };
  }
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${encodeURIComponent(queryStr)}&type=video&order=relevance&key=${apiKey}`
    );
    const data = await response.json();
    if (!response.ok) {
      console.warn(`[YouTube] query="${queryStr}" status=${response.status} error=${JSON.stringify(data.error?.message || '').slice(0, 200)}`);
      const error = (response.status === 403 || response.status === 429) ? 'quota_exceeded' as const : 'network_error' as const;
      return { items: [], error };
    }

    let items = data.items || [];
    console.log(`[YouTube] query="${queryStr}" → ${items.length} raw results`);

    // Fetch channel subscriber counts for quality filtering
    const channelIds = [...new Set(items.map((v: any) => v.snippet?.channelId).filter(Boolean))];
    const channelSubMap = new Map<string, number>();
    if (channelIds.length > 0) {
      try {
        const channelRes = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelIds.join(',')}&key=${apiKey}`
        );
        const channelData = await channelRes.json();
        for (const ch of channelData.items || []) {
          channelSubMap.set(ch.id, parseInt(ch.statistics?.subscriberCount || '0', 10));
        }
      } catch (e) {
        console.error('[YouTube] Failed to fetch channel stats:', e);
      }
    }

    items = items
      .map((item: any) => ({ ...item, _subscriberCount: channelSubMap.get(item.snippet?.channelId) || 0 }))
      .filter((item: any) => item._subscriberCount >= minSubscribers);

    console.log(`[YouTube] query="${queryStr}" → ${items.length} after ${minSubscribers}+ sub filter`);
    return { items };
  } catch (e) {
    console.error('[YouTube] fetchYouTubeForQuery error:', e);
    return { items: [], error: 'network_error' };
  }
}

async function fetchXPostsForQuery(queryStr: string): Promise<FetchResult<any>> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  if (!bearerToken) {
    console.warn('[Twitter] No TWITTER_BEARER_TOKEN configured');
    return { items: [], error: 'no_api_key' };
  }
  try {
    const params = new URLSearchParams({
      query: queryStr,
      max_results: '30',
      'tweet.fields': 'created_at,public_metrics',
      expansions: 'author_id,attachments.media_keys',
      'user.fields': 'name,username,profile_image_url,public_metrics',
      'media.fields': 'url,preview_image_url,type',
      sort_order: 'relevancy',
    });

    const twitterRes = await fetch(
      `https://api.twitter.com/2/tweets/search/recent?${params}`,
      { headers: { Authorization: `Bearer ${bearerToken}` } }
    );
    if (!twitterRes.ok) {
      const body = await twitterRes.text();
      console.warn(`[Twitter] query="${queryStr}" status=${twitterRes.status} body=${body.slice(0, 200)}`);
      const error = (twitterRes.status === 429) ? 'rate_limit' as const : 'network_error' as const;
      return { items: [], error };
    }

    const twitterData = await twitterRes.json();
    const tweets = twitterData.data || [];
    console.log(`[Twitter] query="${queryStr}" → ${tweets.length} tweets`);
    const users = twitterData.includes?.users || [];
    const media = twitterData.includes?.media || [];

    const userMap = new Map(users.map((u: any) => [u.id, u]));
    const mediaMap = new Map(media.map((m: any) => [m.media_key, m]));

    let posts = tweets.map((tweet: any) => {
      const author: any = userMap.get(tweet.author_id) || { name: 'Unknown', username: 'unknown', profile_image_url: '' };
      const tweetMedia = (tweet.attachments?.media_keys || [])
        .map((key: string) => mediaMap.get(key))
        .filter(Boolean)
        .map((m: any) => {
          const obj: Record<string, string> = { type: m.type };
          if (m.url) obj.url = m.url;
          if (m.preview_image_url) obj.preview_image_url = m.preview_image_url;
          return obj;
        });

      const followers = author.public_metrics?.followers_count || 0;
      const post: Record<string, any> = {
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at,
        author: { name: author.name, username: author.username, profile_image_url: author.profile_image_url || '', followers },
        metrics: { likes: tweet.public_metrics?.like_count || 0, retweets: tweet.public_metrics?.retweet_count || 0, replies: tweet.public_metrics?.reply_count || 0 },
        url: `https://x.com/${author.username}/status/${tweet.id}`,
      };
      if (tweetMedia.length > 0) post.media = tweetMedia;
      return post;
    });

    posts = posts
      .filter((p: any) => p.author.followers >= 1000)
      .sort((a: any, b: any) => {
        const engA = a.metrics.likes + a.metrics.retweets * 2;
        const engB = b.metrics.likes + b.metrics.retweets * 2;
        return engB - engA;
      })
      .slice(0, 10);

    return { items: posts };
  } catch (e) {
    console.error('fetchXPostsForQuery error:', e);
    return { items: [], error: 'network_error' };
  }
}

// Helper to build a descriptive warning message from fetch errors
function buildWarning(source: string, errors: Set<string | undefined>): string {
  const reasons = [...errors].filter(Boolean);
  if (reasons.includes('rate_limit')) return `${source}: API rate limit reached — try again in a few minutes`;
  if (reasons.includes('quota_exceeded')) return `${source}: Daily API quota exceeded — resets tomorrow`;
  if (reasons.includes('no_api_key')) return `${source}: Not configured`;
  if (reasons.includes('network_error')) return `${source}: Failed to connect`;
  if (reasons.includes('parse_error')) return `${source}: Parsing failed`;
  return `${source}: No results found`;
}

// Extracted pipeline: fetch, filter, store, summarize, and cache a single interest
async function fetchAndCacheSingleInterest(topic: string): Promise<{
  news: any[]; videos: any[]; posts: any[]; summary: string; warnings: string[];
}> {
  const key = getFeedCacheKey(topic);
  if (currentlyRefreshing.has(key)) {
    console.log(`[FeedCache] Already refreshing "${topic}", returning stale`);
    const stale = await readFeedCacheEvenIfStale(topic);
    if (stale) return { news: stale.news, videos: stale.videos, posts: stale.posts, summary: stale.summary, warnings: stale.warnings || [] };
    throw new Error(`Already refreshing "${topic}" and no stale cache`);
  }
  currentlyRefreshing.add(key);
  try {
    const warnings: string[] = [];

    // Step 1: Generate smart queries
    let smartQueries: SmartQueryCache;
    try {
      smartQueries = await generateSmartQueries(topic);
    } catch (geminiError) {
      console.warn('Smart query generation failed, falling back to TOPIC_CONFIG:', geminiError);
      const config = getTopicConfig(topic);
      smartQueries = {
        newsQueries: [config.query],
        youtubeQueries: [config.ytQuery || topic],
        twitterQueries: [config.xQuery || `${topic} -is:retweet lang:en`],
        cachedAt: Date.now(),
      };
      warnings.push('AI query generation unavailable, using default queries');
    }

    // Step 2: Fetch ALL queries per platform in parallel, merge and dedupe
    const [newsResults, ytResults, xResults] = await Promise.all([
      (async () => {
        const errors = new Set<string | undefined>();
        const rssResult = await fetchRSSForInterest(topic);
        const rssCount = rssResult.items.length;
        let newsDataCount = 0;
        let merged = [...rssResult.items];
        if (rssResult.error) errors.add(rssResult.error);

        const shouldFallbackToNewsData =
          merged.length < RSS_MIN_RESULTS_BEFORE_NEWSDATA_FALLBACK || !rssResult.isCurated;

        if (shouldFallbackToNewsData) {
          const fallbackQueries = rssResult.isCurated
            ? smartQueries.newsQueries.slice(0, 1)
            : smartQueries.newsQueries;
          const allNewsDataResults = await Promise.all(
            fallbackQueries.map(q => fetchNewsForQuery(q))
          );
          allNewsDataResults.forEach(r => {
            if (r.error) errors.add(r.error);
          });
          const newsDataItems = allNewsDataResults.flatMap(r => r.items);
          newsDataCount = newsDataItems.length;
          merged = [...merged, ...newsDataItems];
          console.log(`[News Hybrid] topic="${topic}" rss=${rssResult.items.length} fallbackQueries=${fallbackQueries.length} total=${merged.length}`);
        }

        const deduped = dedupeNewsItems(merged);
        logNewsIngestionMetrics(topic, rssCount, newsDataCount, deduped.length, shouldFallbackToNewsData, 'smart-feed');
        if (deduped.length === 0) warnings.push(buildWarning('News', errors));
        return deduped;
      })(),
      (async () => {
        const allResults = await Promise.all(smartQueries.youtubeQueries.map(q => fetchYouTubeForQuery(q)));
        const errors = new Set(allResults.map(r => r.error));
        const merged = allResults.flatMap(r => r.items);
        const seen = new Set<string>();
        const deduped = merged.filter(item => {
          const k = item.id?.videoId || item.id;
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        if (deduped.length === 0) warnings.push(buildWarning('YouTube', errors));
        return deduped;
      })(),
      (async () => {
        const allResults = await Promise.all(smartQueries.twitterQueries.map(q => fetchXPostsForQuery(q)));
        const errors = new Set(allResults.map(r => r.error));
        const merged = allResults.flatMap(r => r.items);
        const seen = new Set<string>();
        const deduped = merged.filter(item => {
          if (!item.id || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
        if (deduped.length === 0) warnings.push(buildWarning('X Posts', errors));
        return deduped;
      })(),
    ]);

    // Step 3: Apply Gemini relevance filtering
    const [filteredNews, filteredVideos, filteredPosts] = await Promise.all([
      filterByRelevance(newsResults, topic, (item) => item.title),
      filterByRelevance(ytResults, topic, (item) => item.snippet?.title || ''),
      filterByRelevance(xResults, topic, (item) => item.text),
    ]);

    // Step 4: Deterministic ranking + optional Gemini rerank (importance layer)
    let rankedNews = attachBaseRank(filteredNews, 'news');
    let rankedVideos = attachBaseRank(filteredVideos, 'video');
    let rankedPosts = attachBaseRank(filteredPosts, 'trend');

    rankedNews = await maybeApplyGeminiRerank(rankedNews, 'news', topic);
    rankedVideos = await maybeApplyGeminiRerank(rankedVideos, 'video', topic);
    rankedPosts = await maybeApplyGeminiRerank(rankedPosts, 'trend', topic);

    // Step 5: Store in Firestore + generate summary (in parallel)
    const [processedNews, processedVideos, processedPosts, feedSummary] = await Promise.all([
      processAndStoreItems(rankedNews, 'news', (item) => item.title, (item) => item.link),
      processAndStoreItems(rankedVideos, 'video', (item) => item.snippet?.title, (item) => `https://youtube.com/watch?v=${item.id?.videoId || item.id}`),
      processAndStoreItems(rankedPosts, 'trend', (item) => item.text, (item) => item.url),
      generateFeedSummary(topic, rankedNews, rankedVideos, rankedPosts),
    ]);

    // Step 6: Write to Firestore feed cache
    await writeFeedCache(topic, {
      news: processedNews,
      videos: processedVideos,
      posts: processedPosts,
      summary: feedSummary,
      warnings,
      queries: {
        newsQueries: smartQueries.newsQueries,
        youtubeQueries: smartQueries.youtubeQueries,
        twitterQueries: smartQueries.twitterQueries,
      },
    });

    return { news: processedNews, videos: processedVideos, posts: processedPosts, summary: feedSummary, warnings };
  } finally {
    currentlyRefreshing.delete(key);
  }
}

// Fire-and-forget background refresh for a list of interests
function refreshInterestsInBackground(interests: string[]): void {
  (async () => {
    for (const interest of interests) {
      try {
        await fetchAndCacheSingleInterest(interest);
        console.log(`[bg-refresh] Refreshed "${interest}"`);
      } catch (e) {
        console.error(`[bg-refresh] Failed to refresh "${interest}":`, e);
      }
    }
  })();
}

// Merge per-interest feed caches into a combined "For You" response
function mergeInterestCaches(
  caches: { interest: string; data: FeedCacheDocument }[],
  interests: string[],
  loadMultiplier = 1,
  personalizationSignals: PersonalizationSignals | null = null,
  debugKey?: string,
  userId?: string
): any {
  const allNews: any[] = [];
  const allVideos: any[] = [];
  const allPosts: any[] = [];
  const allSummaries: string[] = [];
  const allWarnings: string[] = [];

  for (const { interest, data } of caches) {
    allNews.push(...data.news.map((i: any) => ({ ...sanitizeNewsItemForResponse(i), _interest: interest })));
    allVideos.push(...data.videos.map((i: any) => ({ ...i, _interest: interest })));
    allPosts.push(...data.posts.map((i: any) => ({ ...i, _interest: interest })));
    if (data.summary) allSummaries.push(data.summary);
    if (data.warnings) allWarnings.push(...data.warnings);
  }

  // Deduplicate
  const dedupeByKey = (items: any[], keyFn: (i: any) => string) => {
    const seen = new Set<string>();
    return items.filter(i => {
      const k = keyFn(i);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  const dedupedNews = dedupeByKey(allNews, i => i.link || i.title);
  const dedupedVideos = dedupeByKey(allVideos, i => i.id?.videoId || i.id);
  const dedupedPosts = dedupeByKey(allPosts, i => i.id || i.text);

  const rankedNews = applyPersonalizationRank(dedupedNews, 'news', personalizationSignals);
  const rankedVideos = applyPersonalizationRank(dedupedVideos, 'video', personalizationSignals);
  const rankedPosts = applyPersonalizationRank(dedupedPosts, 'trend', personalizationSignals);

  // Apply diversity enforcement
  const diverseNews = ensureDiversity(
    rankedNews,
    (i: any) => i._interest,
    FORYOU_PER_INTEREST_NEWS_LIMIT * loadMultiplier,
    FORYOU_BASE_NEWS_LIMIT * loadMultiplier
  );
  const diverseVideos = ensureDiversity(
    rankedVideos,
    (i: any) => i._interest,
    FORYOU_PER_INTEREST_VIDEO_LIMIT * loadMultiplier,
    FORYOU_BASE_VIDEO_LIMIT * loadMultiplier
  );
  const diversePosts = ensureDiversity(
    rankedPosts,
    (i: any) => i._interest,
    FORYOU_PER_INTEREST_POST_LIMIT * loadMultiplier,
    FORYOU_BASE_POST_LIMIT * loadMultiplier
  );

  const hasMore =
    rankedNews.length > diverseNews.length ||
    rankedVideos.length > diverseVideos.length ||
    rankedPosts.length > diversePosts.length;

  if (debugKey) {
    captureRankingDebug({
      key: debugKey,
      generatedAt: new Date().toISOString(),
      userId,
      mode: 'foryou',
      counts: { news: rankedNews.length, videos: rankedVideos.length, posts: rankedPosts.length },
      top: {
        news: rankedNews.slice(0, 8).map((i: any) => ({ title: i.title, link: i.link, interest: i._interest, rank: i._rank })),
        videos: rankedVideos.slice(0, 8).map((i: any) => ({ title: i.snippet?.title, id: i.id?.videoId || i.id, interest: i._interest, rank: i._rank })),
        posts: rankedPosts.slice(0, 8).map((i: any) => ({ text: String(i.text || '').slice(0, 140), id: i.id, interest: i._interest, rank: i._rank })),
      },
    });
  }

  return {
    news: { results: diverseNews },
    videos: { items: diverseVideos },
    posts: { posts: diversePosts },
    trendContext: allSummaries.join('\n\n'),
    warnings: [...new Set(allWarnings)],
    fromCache: true,
    pagination: {
      loadMultiplier,
      maxLoadMultiplier: FEED_MAX_LOAD_MULTIPLIER,
      hasMore,
      available: {
        news: rankedNews.length,
        videos: rankedVideos.length,
        posts: rankedPosts.length,
      },
      returned: {
        news: diverseNews.length,
        videos: diverseVideos.length,
        posts: diversePosts.length,
      },
    },
  };
}

function formatSingleInterestResponse(
  topic: string,
  data: { news: any[]; videos: any[]; posts: any[]; summary: string; warnings: string[] },
  loadMultiplier: number,
  fromCache: boolean,
  stale = false,
  personalizationSignals: PersonalizationSignals | null = null,
  debugKey?: string,
  userId?: string
) {
  const rankedNews = applyPersonalizationRank(
    data.news.map((item: any) => sanitizeNewsItemForResponse(item)),
    'news',
    personalizationSignals
  );
  const rankedVideos = applyPersonalizationRank(data.videos, 'video', personalizationSignals);
  const rankedPosts = applyPersonalizationRank(data.posts, 'trend', personalizationSignals);

  const available = {
    news: rankedNews.length,
    videos: rankedVideos.length,
    posts: rankedPosts.length,
  };
  const limitedNews = rankedNews.slice(0, SINGLE_BASE_NEWS_LIMIT * loadMultiplier);
  const limitedVideos = rankedVideos.slice(0, SINGLE_BASE_VIDEO_LIMIT * loadMultiplier);
  const limitedPosts = rankedPosts.slice(0, SINGLE_BASE_POST_LIMIT * loadMultiplier);
  const hasMore =
    available.news > limitedNews.length ||
    available.videos > limitedVideos.length ||
    available.posts > limitedPosts.length;

  if (debugKey) {
    captureRankingDebug({
      key: debugKey,
      generatedAt: new Date().toISOString(),
      userId,
      topic,
      mode: 'single',
      counts: { news: rankedNews.length, videos: rankedVideos.length, posts: rankedPosts.length },
      top: {
        news: rankedNews.slice(0, 8).map((i: any) => ({ title: i.title, link: i.link, rank: i._rank })),
        videos: rankedVideos.slice(0, 8).map((i: any) => ({ title: i.snippet?.title, id: i.id?.videoId || i.id, rank: i._rank })),
        posts: rankedPosts.slice(0, 8).map((i: any) => ({ text: String(i.text || '').slice(0, 140), id: i.id, rank: i._rank })),
      },
    });
  }

  return {
    news: { results: limitedNews.map((i: any) => ({ ...i, _interest: topic })) },
    videos: { items: limitedVideos.map((i: any) => ({ ...i, _interest: topic })) },
    posts: { posts: limitedPosts.map((i: any) => ({ ...i, _interest: topic })) },
    trendContext: data.summary,
    warnings: data.warnings || [],
    fromCache,
    stale,
    pagination: {
      loadMultiplier,
      maxLoadMultiplier: FEED_MAX_LOAD_MULTIPLIER,
      hasMore,
      available,
      returned: {
        news: limitedNews.length,
        videos: limitedVideos.length,
        posts: limitedPosts.length,
      },
    },
  };
}

// API Routes
app.get("/api/news", async (req, res) => {
  try {
    const rawTopic = (req.query.q as string) || "technology";
    const rssResult = await fetchRSSForInterest(rawTopic);
    const rssCount = rssResult.items.length;
    let newsDataCount = 0;
    let results = [...rssResult.items];

    const usedFallback = results.length < RSS_MIN_RESULTS_BEFORE_NEWSDATA_FALLBACK || !rssResult.isCurated;
    if (usedFallback) {
      const config = getTopicConfig(rawTopic);
      const fallback = await fetchNewsForQuery(config.query, config.category);
      newsDataCount = fallback.items.length;
      results = dedupeNewsItems([...results, ...fallback.items]);
    }

    // Gemini relevance filtering
    results = await filterByRelevance(results, rawTopic, (item) => item.title);
    logNewsIngestionMetrics(rawTopic, rssCount, newsDataCount, results.length, usedFallback, 'news-endpoint');

    const processed = await processAndStoreItems(
      results,
      'news',
      (item) => item.title,
      (item) => item.link
    );

    res.json({ results: processed.map((item: any) => sanitizeNewsItemForResponse(item)) });
  } catch (error) {
    console.error("Error fetching news:", error);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

app.get("/api/youtube", async (req, res) => {
  try {
    const rawTopic = (req.query.q as string) || "trending";
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) return res.status(500).json({ error: "YOUTUBE_API_KEY is not configured" });

    const config = getTopicConfig(rawTopic);
    const ytQuery = config.ytQuery || rawTopic;
    const year = new Date().getFullYear();
    const searchQuery = `${ytQuery} ${year}`;

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=25&q=${encodeURIComponent(searchQuery)}&type=video&order=relevance&key=${apiKey}`
    );

    const data = await response.json();

    if (!response.ok) {
      const reason = data?.error?.errors?.[0]?.reason;
      const message = reason === 'quotaExceeded'
        ? 'YouTube API daily quota exceeded. Resets at midnight Pacific Time.'
        : `YouTube API error: ${data?.error?.message || response.statusText}`;
      throw new Error(message);
    }

    let items = data.items || [];

    // Fetch channel subscriber counts to filter for established creators
    const channelIds = [...new Set(items.map((v: any) => v.snippet?.channelId).filter(Boolean))];
    const channelSubMap = new Map<string, number>();

    if (channelIds.length > 0) {
      try {
        const channelRes = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelIds.join(',')}&key=${apiKey}`
        );
        const channelData = await channelRes.json();
        for (const ch of channelData.items || []) {
          channelSubMap.set(ch.id, parseInt(ch.statistics?.subscriberCount || '0', 10));
        }
      } catch (e) {
        console.error("Failed to fetch channel stats:", e);
      }
    }

    // Filter to channels with 100K+ subscribers and attach subscriber count
    items = items
      .map((item: any) => {
        const subs = channelSubMap.get(item.snippet?.channelId) || 0;
        return { ...item, _subscriberCount: subs };
      })
      .filter((item: any) => item._subscriberCount >= 100000);

    // Gemini relevance filtering
    items = await filterByRelevance(items, rawTopic, (item) => item.snippet?.title || '');

    const processed = await processAndStoreItems(
      items,
      'video',
      (item) => item.snippet?.title,
      (item) => `https://youtube.com/watch?v=${item.id?.videoId || item.id}`
    );

    res.json({ items: processed });
  } catch (error) {
    console.error("Error fetching YouTube videos:", error);
    res.status(500).json({ error: "Failed to fetch YouTube videos" });
  }
});

app.get("/api/x-posts", async (req, res) => {
  try {
    const rawTopic = (req.query.q as string) || "technology";
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;

    if (!bearerToken) {
      return res.json({ posts: [] });
    }

    const config = getTopicConfig(rawTopic);
    const query = config.xQuery || `${rawTopic} -is:retweet lang:en`;

    const params = new URLSearchParams({
      query,
      max_results: "50",
      "tweet.fields": "created_at,public_metrics",
      expansions: "author_id,attachments.media_keys",
      "user.fields": "name,username,profile_image_url,public_metrics",
      "media.fields": "url,preview_image_url,type",
      sort_order: "relevancy",
    });

    const twitterRes = await fetch(
      `https://api.twitter.com/2/tweets/search/recent?${params}`,
      { headers: { Authorization: `Bearer ${bearerToken}` } }
    );

    if (!twitterRes.ok) {
      const errorBody = await twitterRes.text();
      console.error("Twitter API error:", twitterRes.status, errorBody);
      return res.json({ posts: [] });
    }

    const twitterData = await twitterRes.json();
    const tweets = twitterData.data || [];
    const users = twitterData.includes?.users || [];
    const media = twitterData.includes?.media || [];

    const userMap = new Map(users.map((u: any) => [u.id, u]));
    const mediaMap = new Map(media.map((m: any) => [m.media_key, m]));

    let posts = tweets.map((tweet: any) => {
      const author: any = userMap.get(tweet.author_id) || { name: "Unknown", username: "unknown", profile_image_url: "" };
      const tweetMedia = (tweet.attachments?.media_keys || [])
        .map((key: string) => mediaMap.get(key))
        .filter(Boolean)
        .map((m: any) => {
          const obj: Record<string, string> = { type: m.type };
          if (m.url) obj.url = m.url;
          if (m.preview_image_url) obj.preview_image_url = m.preview_image_url;
          return obj;
        });

      const followers = author.public_metrics?.followers_count || 0;
      const post: Record<string, any> = {
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at,
        author: {
          name: author.name,
          username: author.username,
          profile_image_url: author.profile_image_url || '',
          followers: followers,
        },
        metrics: {
          likes: tweet.public_metrics?.like_count || 0,
          retweets: tweet.public_metrics?.retweet_count || 0,
          replies: tweet.public_metrics?.reply_count || 0,
        },
        url: `https://x.com/${author.username}/status/${tweet.id}`,
      };
      if (tweetMedia.length > 0) post.media = tweetMedia;
      return post;
    });

    // Filter out low-follower accounts and sort by total engagement
    posts = posts
      .filter((p: any) => p.author.followers >= 1000)
      .sort((a: any, b: any) => {
        const engA = a.metrics.likes + a.metrics.retweets * 2;
        const engB = b.metrics.likes + b.metrics.retweets * 2;
        return engB - engA;
      })
      .slice(0, 10);

    // Apply Gemini relevance filtering
    posts = await filterByRelevance(posts, rawTopic, (item) => item.text);

    const processed = await processAndStoreItems(
      posts,
      'trend',
      (item) => item.text,
      (item) => item.url
    );

    res.json({ posts: processed });
  } catch (error) {
    console.error("Error fetching X posts:", error);
    res.json({ posts: [] });
  }
});

app.get("/api/smart-feed", async (req, res) => {
  try {
    const topic = (req.query.q as string) || "technology";
    const forceRefresh = req.query.refresh === 'true';
    const loadMultiplier = parseLoadMultiplier(req.query.loadMultiplier);
    const userId = (req.query.userId as string) || '';
    const debugKey = (req.query.debugKey as string) || '';
    const personalizationSignals = await getPersonalizationSignals(userId || null);

    // 1. If not forcing refresh, check cache first
    if (!forceRefresh) {
      const cached = await readFeedCache(topic);
      if (cached) {
        console.log(`[smart-feed] Cache hit for "${topic}"`);
        return res.json(formatSingleInterestResponse(
          topic,
          { news: cached.news, videos: cached.videos, posts: cached.posts, summary: cached.summary, warnings: cached.warnings || [] },
          loadMultiplier,
          true,
          false,
          personalizationSignals,
          debugKey || undefined,
          userId || undefined
        ));
      }

      // 2. Stale-while-revalidate: return stale data, refresh in background
      const stale = await readFeedCacheEvenIfStale(topic);
      if (stale) {
        console.log(`[smart-feed] Serving stale cache for "${topic}", refreshing in background`);
        fetchAndCacheSingleInterest(topic).catch(e =>
          console.error(`[smart-feed] Background refresh failed for "${topic}":`, e)
        );
        return res.json(formatSingleInterestResponse(
          topic,
          {
            news: stale.news,
            videos: stale.videos,
            posts: stale.posts,
            summary: stale.summary,
            warnings: [...(stale.warnings || []), 'Content may be slightly outdated, refreshing...'],
          },
          loadMultiplier,
          true,
          true,
          personalizationSignals,
          debugKey || undefined,
          userId || undefined
        ));
      }
    }

    // 3. No cache or forced refresh: run full pipeline
    console.log(`[smart-feed] ${forceRefresh ? 'Forced refresh' : 'Cache miss'} for "${topic}", fetching live`);
    const result = await fetchAndCacheSingleInterest(topic);

    res.json(formatSingleInterestResponse(topic, result, loadMultiplier, false, false, personalizationSignals, debugKey || undefined, userId || undefined));
  } catch (error) {
    console.error("Error in smart-feed:", error);
    res.status(500).json({ error: "Failed to fetch smart feed" });
  }
});

app.get("/api/smart-feed-foryou", async (req, res) => {
  try {
    const interestsParam = (req.query.interests as string) || '';
    const interests = interestsParam.split(',').map(i => i.trim()).filter(Boolean).slice(0, 10);
    if (interests.length === 0) {
      return res.status(400).json({ error: 'No interests provided' });
    }
    const forceRefresh = req.query.refresh === 'true';
    const loadMultiplier = parseLoadMultiplier(req.query.loadMultiplier);
    const userId = (req.query.userId as string) || '';
    const debugKey = (req.query.debugKey as string) || '';
    const personalizationSignals = await getPersonalizationSignals(userId || null);

    // 1. If not forcing refresh, try to serve from per-interest caches
    if (!forceRefresh) {
      const cacheResults = await Promise.all(
        interests.map(async (interest) => ({
          interest,
          cache: await readFeedCache(interest),
        }))
      );

      const allCached = cacheResults.every(r => r.cache !== null);
      if (allCached) {
        console.log(`[smart-feed-foryou] Full cache hit for [${interests.join(', ')}]`);
        return res.json(mergeInterestCaches(
          cacheResults.map(r => ({ interest: r.interest, data: r.cache! })),
          interests,
          loadMultiplier,
          personalizationSignals,
          debugKey || undefined,
          userId || undefined
        ));
      }

      // Stale-while-revalidate: try stale caches for uncached interests
      const staleResults = await Promise.all(
        cacheResults.map(async (r) => ({
          interest: r.interest,
          cache: r.cache,
          staleCache: r.cache ? null : await readFeedCacheEvenIfStale(r.interest),
        }))
      );

      const canServeStale = staleResults.every(r => r.cache || r.staleCache);
      if (canServeStale) {
        console.log(`[smart-feed-foryou] Serving stale caches, refreshing in background`);
        const staleInterests = staleResults.filter(r => !r.cache).map(r => r.interest);
        refreshInterestsInBackground(staleInterests);
        return res.json(mergeInterestCaches(
          staleResults.map(r => ({ interest: r.interest, data: (r.cache || r.staleCache)! })),
          interests,
          loadMultiplier,
          personalizationSignals,
          debugKey || undefined,
          userId || undefined
        ));
      }
    }

    // 2. Fall back to live fetch: refresh each interest individually and merge
    console.log(`[smart-feed-foryou] ${forceRefresh ? 'Forced refresh' : 'Cache miss'} for [${interests.join(', ')}], fetching live`);
    const liveResults = await Promise.all(
      interests.map(async (interest) => {
        try {
          const result = await fetchAndCacheSingleInterest(interest);
          return { interest, data: { ...result, queries: { newsQueries: [], youtubeQueries: [], twitterQueries: [] } } as FeedCacheDocument };
        } catch (e) {
          console.error(`[smart-feed-foryou] Failed to fetch "${interest}":`, e);
          return { interest, data: { news: [], videos: [], posts: [], summary: '', warnings: [`Failed to fetch ${interest}`], queries: { newsQueries: [], youtubeQueries: [], twitterQueries: [] } } as FeedCacheDocument };
        }
      })
    );

    res.json({
      ...mergeInterestCaches(liveResults, interests, loadMultiplier, personalizationSignals, debugKey || undefined, userId || undefined),
      fromCache: false,
    });
  } catch (error) {
    console.error("Error in smart-feed-foryou:", error);
    res.status(500).json({ error: "Failed to fetch For You feed" });
  }
});

app.post("/api/log-interaction", async (req, res) => {
  try {
    if (!firestore) return res.status(503).json({ error: "Firestore Admin not configured" });

    const { userId, firestoreId } = req.body;
    if (!userId || !firestoreId) return res.status(400).json({ error: "Missing parameters" });

    const itemDoc = await firestore.collection('items').doc(firestoreId).get();
    if (!itemDoc.exists) return res.status(404).json({ error: "Item not found" });

    const itemData = itemDoc.data();
    const vector = itemData?.embedding;

    // Log interaction
    await firestore.collection('users').doc(userId).collection('history').add({
      itemId: firestoreId,
      title: itemData?.title,
      type: itemData?.type,
      clickedAt: FieldValue.serverTimestamp()
    });

    if (vector) {
      // Fetch last 10 interactions with vectors
      const historySnap = await firestore.collection('users').doc(userId).collection('history')
        .orderBy('clickedAt', 'desc').limit(10).get();
      
      const recentItemIds = historySnap.docs.map(d => d.data().itemId);
      
      if (recentItemIds.length > 0) {
        // Get vectors for these items
        const itemsSnap = await firestore.collection('items').where(FieldPath.documentId(), 'in', recentItemIds).get();
        const vectors = itemsSnap.docs.map(d => d.data().embedding?.toArray() || d.data().embedding).filter(v => v);
        
        if (vectors.length > 0) {
          // Calculate average vector
          const numDimensions = vectors[0].length;
          const avgVector = new Array(numDimensions).fill(0);
          
          for (const v of vectors) {
            for (let i = 0; i < numDimensions; i++) {
              avgVector[i] += v[i];
            }
          }
          
          for (let i = 0; i < numDimensions; i++) {
            avgVector[i] /= vectors.length;
          }

          // Update user profile
          await firestore.collection('users').doc(userId).update({
            vectorProfile: FieldValue.vector(avgVector)
          });
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error logging interaction:", error);
    res.status(500).json({ error: "Failed to log interaction" });
  }
});

app.get("/api/personalized-feed", async (req, res) => {
  try {
    if (!firestore) return res.json({ items: [] });

    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const userDoc = await firestore.collection('users').doc(userId as string).get();
    const userVector = userDoc.data()?.vectorProfile;

    if (!userVector || (Array.isArray(userVector) && userVector.length === 0)) {
      return res.json({ items: [] });
    }

    // Perform Vector Search
    const vectorQuery = firestore.collection('items').findNearest('embedding', FieldValue.vector(userVector.toArray ? userVector.toArray() : userVector), {
      limit: 10,
      distanceMeasure: 'COSINE'
    });
    
    const snapshot = await vectorQuery.get();
    const items = snapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
    
    res.json({ items });
  } catch (error) {
    console.error("Error fetching personalized feed:", error);
    res.status(500).json({ error: "Failed to fetch personalized feed" });
  }
});

// Manual + scheduled feed refresh endpoint
app.post("/api/refresh-feeds", async (req, res) => {
  try {
    const { interests } = req.body;
    if (!Array.isArray(interests) || interests.length === 0) {
      return res.status(400).json({ error: 'interests array required' });
    }
    const toRefresh = interests.slice(0, 20);
    console.log(`[refresh-feeds] Starting refresh for: ${toRefresh.join(', ')}`);

    const results: { interest: string; success: boolean; error?: string }[] = [];
    for (const interest of toRefresh) {
      try {
        await fetchAndCacheSingleInterest(interest);
        results.push({ interest, success: true });
        console.log(`[refresh-feeds] Refreshed "${interest}"`);
      } catch (e: any) {
        console.error(`[refresh-feeds] Failed to refresh "${interest}":`, e);
        results.push({ interest, success: false, error: e.message });
      }
    }
    res.json({ results });
  } catch (error) {
    console.error("Error in refresh-feeds:", error);
    res.status(500).json({ error: "Failed to refresh feeds" });
  }
});

app.get("/api/news-metrics", async (_req, res) => {
  try {
    const interests = [...newsIngestionMetrics.entries()].map(([interestKey, stats]) => {
      const runs = Math.max(stats.runs, 1);
      return {
        interestKey,
        ...stats,
        avgRssPerRun: Number((stats.rssItems / runs).toFixed(2)),
        avgNewsDataPerRun: Number((stats.newsDataItems / runs).toFixed(2)),
        avgFinalPerRun: Number((stats.finalItems / runs).toFixed(2)),
        fallbackRate: Number((stats.fallbackRuns / runs).toFixed(3)),
      };
    }).sort((a, b) => b.runs - a.runs);

    const totals = interests.reduce((acc, item) => {
      acc.runs += item.runs;
      acc.rssItems += item.rssItems;
      acc.newsDataItems += item.newsDataItems;
      acc.finalItems += item.finalItems;
      acc.fallbackRuns += item.fallbackRuns;
      return acc;
    }, { runs: 0, rssItems: 0, newsDataItems: 0, finalItems: 0, fallbackRuns: 0 });

    const totalRuns = Math.max(totals.runs, 1);
    res.json({
      generatedAt: new Date().toISOString(),
      totals: {
        ...totals,
        avgRssPerRun: Number((totals.rssItems / totalRuns).toFixed(2)),
        avgNewsDataPerRun: Number((totals.newsDataItems / totalRuns).toFixed(2)),
        avgFinalPerRun: Number((totals.finalItems / totalRuns).toFixed(2)),
        fallbackRate: Number((totals.fallbackRuns / totalRuns).toFixed(3)),
      },
      interests,
    });
  } catch (error) {
    console.error("Error in news-metrics:", error);
    res.status(500).json({ error: "Failed to fetch news metrics" });
  }
});

app.get("/api/ranking-debug", async (req, res) => {
  try {
    const key = (req.query.key as string) || '';
    if (key) {
      const entry = rankingDebugMap.get(key);
      if (!entry) return res.status(404).json({ error: 'No ranking debug data for this key' });
      return res.json(entry);
    }
    return res.json({
      generatedAt: new Date().toISOString(),
      keys: [...rankingDebugMap.keys()].slice(-30),
      count: rankingDebugMap.size,
    });
  } catch (error) {
    console.error("Error in ranking-debug:", error);
    res.status(500).json({ error: "Failed to fetch ranking debug data" });
  }
});

// Background refresh: collect all unique interests from users and refresh caches
async function runBackgroundRefresh() {
  if (!firestore) {
    console.log('[bg-refresh] Firestore not configured, skipping');
    return;
  }
  try {
    const usersSnap = await firestore.collection('users').get();
    const allInterests = new Set<string>();
    for (const userDoc of usersSnap.docs) {
      const interests = userDoc.data().interests;
      if (Array.isArray(interests)) {
        interests.forEach((i: string) => allInterests.add(i));
      }
    }
    if (allInterests.size === 0) {
      console.log('[bg-refresh] No user interests found, skipping');
      return;
    }
    console.log(`[bg-refresh] Refreshing ${allInterests.size} interests: ${[...allInterests].join(', ')}`);
    for (const interest of allInterests) {
      try {
        await fetchAndCacheSingleInterest(interest);
        console.log(`[bg-refresh] Refreshed "${interest}"`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.error(`[bg-refresh] Failed "${interest}":`, e);
      }
    }
    console.log('[bg-refresh] Complete');
  } catch (e) {
    console.error('[bg-refresh] Error:', e);
  }
}

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Run initial cache warming after 10s startup delay, then every 3 hours
  setTimeout(() => runBackgroundRefresh(), 10_000);
  setInterval(() => runBackgroundRefresh(), 3 * 60 * 60 * 1000);
}

startServer();
