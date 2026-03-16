import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { Firestore, FieldValue, FieldPath } from "@google-cloud/firestore";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

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

      const docRef = firestore.collection('items').doc();
      await docRef.set({
        title,
        url,
        type,
        originalData: item,
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

// API Routes
app.get("/api/news", async (req, res) => {
  try {
    const rawTopic = (req.query.q as string) || "technology";
    const apiKey = process.env.NEWSDATA_API_KEY;

    if (!apiKey) return res.status(500).json({ error: "NEWSDATA_API_KEY is not configured" });

    const config = getTopicConfig(rawTopic);
    let url = `https://newsdata.io/api/1/news?apikey=${apiKey}&q=${encodeURIComponent(config.query)}&language=en`;
    if (config.category) {
      url += `&category=${config.category}`;
    }

    const response = await fetch(url);

    if (!response.ok) throw new Error(`NewsData API error: ${response.statusText}`);

    const data = await response.json();
    let results = data.results || [];

    // Gemini relevance filtering
    results = await filterByRelevance(results, rawTopic, (item) => item.title);

    const processed = await processAndStoreItems(
      results,
      'news',
      (item) => item.title,
      (item) => item.link
    );

    res.json({ results: processed });
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
}

startServer();
