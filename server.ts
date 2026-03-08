import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { Firestore, FieldValue, FieldPath } from "@google-cloud/firestore";

dotenv.config();

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
    const query = req.query.q || "technology";
    const apiKey = process.env.NEWSDATA_API_KEY;
    
    if (!apiKey) return res.status(500).json({ error: "NEWSDATA_API_KEY is not configured" });

    const response = await fetch(
      `https://newsdata.io/api/1/news?apikey=${apiKey}&q=${encodeURIComponent(query as string)}&language=en`
    );
    
    if (!response.ok) throw new Error(`NewsData API error: ${response.statusText}`);
    
    const data = await response.json();
    const results = data.results || [];
    
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
    const query = req.query.q || "trending";
    const apiKey = process.env.YOUTUBE_API_KEY;
    
    if (!apiKey) return res.status(500).json({ error: "YOUTUBE_API_KEY is not configured" });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${encodeURIComponent(query as string)}&type=video&key=${apiKey}`
    );
    
    const data = await response.json();

    if (!response.ok) {
      const reason = data?.error?.errors?.[0]?.reason;
      const message = reason === 'quotaExceeded'
        ? 'YouTube API daily quota exceeded. Resets at midnight Pacific Time.'
        : `YouTube API error: ${data?.error?.message || response.statusText}`;
      throw new Error(message);
    }

    const items = data.items || [];
    
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
