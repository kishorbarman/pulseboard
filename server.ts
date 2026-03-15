import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { Firestore, FieldValue, FieldPath } from "@google-cloud/firestore";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Topic-to-query and category mapping for better filtering
const TOPIC_CONFIG: Record<string, { query: string; category?: string; ytQuery?: string }> = {
  // Tech & Science
  "Artificial Intelligence": { query: '"artificial intelligence" OR "AI model" OR "generative AI"', category: "technology", ytQuery: "artificial intelligence AI news" },
  "Machine Learning": { query: '"machine learning" OR "deep learning" OR "neural network"', category: "technology", ytQuery: "machine learning tutorial news" },
  "Web Development": { query: '"web development" OR "frontend" OR "backend" OR "JavaScript"', category: "technology", ytQuery: "web development programming" },
  "Cybersecurity": { query: '"cybersecurity" OR "data breach" OR "hacking" OR "security vulnerability"', category: "technology", ytQuery: "cybersecurity news threats" },
  "Space Exploration": { query: '"space exploration" OR "NASA" OR "SpaceX" OR "rocket launch"', category: "science", ytQuery: "space exploration NASA news" },
  "Robotics": { query: '"robotics" OR "robot" OR "automation" OR "humanoid"', category: "technology", ytQuery: "robotics automation news" },
  "Data Science": { query: '"data science" OR "big data" OR "analytics" OR "data engineering"', category: "technology", ytQuery: "data science analytics" },
  "Gadgets": { query: '"gadgets" OR "tech review" OR "smartphone" OR "wearable"', category: "technology", ytQuery: "gadget review tech unboxing" },
  // News & Politics
  "World News": { query: '"world news" OR "international" OR "global affairs"', category: "world", ytQuery: "world news today international" },
  "US Politics": { query: '"US politics" OR "congress" OR "White House" OR "senate"', category: "politics", ytQuery: "US politics news congress" },
  "Global Politics": { query: '"global politics" OR "geopolitics" OR "diplomacy" OR "United Nations"', category: "politics", ytQuery: "global politics geopolitics" },
  "Economics": { query: '"economics" OR "economy" OR "GDP" OR "inflation" OR "interest rates"', category: "business", ytQuery: "economics economy news" },
  "Climate Change": { query: '"climate change" OR "global warming" OR "carbon emissions" OR "renewable energy"', category: "environment", ytQuery: "climate change environment news" },
  // Business & Finance
  "Startups": { query: '"startup" OR "venture funding" OR "tech startup" OR "founder"', category: "business", ytQuery: "startup funding founder story" },
  "Cryptocurrency": { query: '"cryptocurrency" OR "bitcoin" OR "ethereum" OR "blockchain" OR "crypto"', category: "business", ytQuery: "cryptocurrency bitcoin crypto news" },
  "Venture Capital": { query: '"venture capital" OR "VC funding" OR "seed round" OR "series A"', category: "business", ytQuery: "venture capital startup funding" },
  "Fintech": { query: '"fintech" OR "financial technology" OR "digital payments" OR "neobank"', category: "business", ytQuery: "fintech financial technology" },
  "Stock Market": { query: '"stock market" OR "S&P 500" OR "Wall Street" OR "stocks" OR "investing"', category: "business", ytQuery: "stock market investing news" },
  // Lifestyle
  "Cooking": { query: '"cooking" OR "recipe" OR "culinary" OR "chef" OR "food"', category: "food", ytQuery: "cooking recipes food" },
  "Fitness & Health": { query: '"fitness" OR "workout" OR "health" OR "nutrition" OR "exercise"', category: "health", ytQuery: "fitness workout health tips" },
  "Travel": { query: '"travel" OR "tourism" OR "destination" OR "vacation" OR "trip"', category: "tourism", ytQuery: "travel destination guide vlog" },
  "Fashion": { query: '"fashion" OR "style" OR "clothing" OR "designer" OR "trends"', category: "lifestyle", ytQuery: "fashion style trends" },
  "Photography": { query: '"photography" OR "camera" OR "photo editing" OR "photographer"', category: "lifestyle", ytQuery: "photography tips camera review" },
  // Entertainment
  "Gaming": { query: '"gaming" OR "video game" OR "esports" OR "game release"', category: "entertainment", ytQuery: "gaming video game review" },
  "Movies & TV": { query: '"movie" OR "film" OR "TV show" OR "streaming" OR "box office"', category: "entertainment", ytQuery: "movie review TV show trailer" },
  "Music": { query: '"music" OR "album" OR "concert" OR "artist" OR "song release"', category: "entertainment", ytQuery: "music new album artist" },
  "Sports": { query: '"sports" OR "football" OR "basketball" OR "soccer" OR "championship"', category: "sports", ytQuery: "sports highlights game recap" },
  "Books & Literature": { query: '"books" OR "literature" OR "novel" OR "author" OR "book review"', category: "lifestyle", ytQuery: "book review literature recommendations" },
  // Creative
  "Design": { query: '"design" OR "UI UX" OR "graphic design" OR "product design"', category: "technology", ytQuery: "design UI UX graphic design" },
  "Open Source": { query: '"open source" OR "GitHub" OR "open-source project" OR "OSS"', category: "technology", ytQuery: "open source project GitHub" },
  "Productivity": { query: '"productivity" OR "time management" OR "workflow" OR "efficiency"', category: "lifestyle", ytQuery: "productivity tips workflow" },
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
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${encodeURIComponent(searchQuery)}&type=video&order=relevance&key=${apiKey}`
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

app.get("/api/x-trends", async (req, res) => {
  const mockTrends = [
    { name: "#AIRevolution", volume: "125K tweets", url: "https://twitter.com/search?q=%23AIRevolution" },
    { name: "Next.js 15", volume: "85K tweets", url: "https://twitter.com/search?q=Next.js" },
    { name: "#TechNews", volume: "45K tweets", url: "https://twitter.com/search?q=%23TechNews" },
    { name: "SpaceX Launch", volume: "210K tweets", url: "https://twitter.com/search?q=SpaceX" },
    { name: "#OpenSource", volume: "67K tweets", url: "https://twitter.com/search?q=%23OpenSource" },
    { name: "Rust Language", volume: "38K tweets", url: "https://twitter.com/search?q=Rust%20Language" },
    { name: "#ClimateAction", volume: "92K tweets", url: "https://twitter.com/search?q=%23ClimateAction" },
    { name: "GPT-5 Release", volume: "310K tweets", url: "https://twitter.com/search?q=GPT-5" },
    { name: "#CyberSecurity", volume: "54K tweets", url: "https://twitter.com/search?q=%23CyberSecurity" },
    { name: "Bitcoin ETF", volume: "178K tweets", url: "https://twitter.com/search?q=Bitcoin%20ETF" },
  ];
  
  const processed = await processAndStoreItems(
    mockTrends,
    'trend',
    (item) => item.name,
    (item) => item.url
  );
  
  res.json({ trends: processed });
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
