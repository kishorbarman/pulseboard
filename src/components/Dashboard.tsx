import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { NewsCard } from './NewsCard';
import { VideoCard } from './VideoCard';
import { TrendCard } from './TrendCard';
import { VideoModal } from './VideoModal';
import { logClickHistory, subscribeToBookmarks, toggleBookmark } from '../lib/firebase';
import { AlertCircle, Search, Menu, X } from 'lucide-react';
import { motion } from 'motion/react';
import { MeshGradient } from './MeshGradient';
import { PulseTicker } from './PulseTicker';
import { AIPulse } from './AIPulse';
import { cn } from '../lib/utils';

interface DashboardProps {
  user: any;
  userData: any;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

const SkeletonLoader = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="h-[400px] rounded-3xl bg-stone-900/50 animate-pulse border border-white/5" />
    ))}
  </div>
);

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function getItemUrl(item: any, type: string): string {
  if (type === 'news') return item.link || '';
  if (type === 'video') return `https://youtube.com/watch?v=${item.id?.videoId || item.id}`;
  return item.url || '';
}

function dedupeItems<T>(items: T[], getTitle: (item: T) => string, getUrl: (item: T) => string): T[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  return items.filter(item => {
    const url = getUrl(item);
    const normalized = normalizeTitle(getTitle(item) || '');
    if (!normalized) return true;
    if (url && seenUrls.has(url)) return false;
    if (seenTitles.has(normalized)) return false;
    if (url) seenUrls.add(url);
    seenTitles.add(normalized);
    return true;
  });
}

export function Dashboard({ user, userData }: DashboardProps) {
  const [activeInterest, setActiveInterest] = useState<string>('For You');
  const [searchQuery, setSearchQuery] = useState('');
  const [news, setNews] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceWarnings, setSourceWarnings] = useState<string[]>([]);
  
  // Initialize sidebar state based on window width
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return false;
  });
  
  // Video Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  const interests = userData?.interests || ['Technology', 'AI', 'Global News'];

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeToBookmarks(user.uid, setBookmarks);
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    document.title = `${activeInterest} | PulseBoard`;
  }, [activeInterest]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setSourceWarnings([]);
      try {
        let fetchedNews: any[] = [];
        let fetchedVideos: any[] = [];
        let fetchedTrends: any[] = [];

        const collectWarnings = (newsData: any, ytData: any, xData: any) => {
          const warnings: string[] = [];
          if (!newsData.results) warnings.push(`News: ${newsData.error || 'Failed to load'}`);
          if (!ytData.items) warnings.push(`YouTube: ${ytData.error || 'Failed to load'}`);
          if (!xData.trends) warnings.push(`Trends: ${xData.error || 'Failed to load'}`);
          setSourceWarnings(warnings);
        };

        if (activeInterest === 'Saved') {
          fetchedNews = bookmarks.filter(b => b.type === 'news').map(b => b.item);
          fetchedVideos = bookmarks.filter(b => b.type === 'video').map(b => b.item);
          fetchedTrends = bookmarks.filter(b => b.type === 'trend').map(b => b.item);
        } else if (activeInterest === 'For You') {
          // Fetch personalized feed (70%)
          const personalizedRes = await fetch(`/api/personalized-feed?userId=${user.uid}`);
          const personalizedData = await personalizedRes.json();
          const pItems = personalizedData.items || [];

          // Fetch fresh content from first interest (30%)
          const freshInterest = interests[0] || 'Technology';
          const [newsRes, ytRes, xRes] = await Promise.all([
            fetch(`/api/news?q=${encodeURIComponent(freshInterest)}`),
            fetch(`/api/youtube?q=${encodeURIComponent(freshInterest)}`),
            fetch(`/api/x-trends`)
          ]);

          const [newsData, ytData, xData] = await Promise.all([
            newsRes.json().catch(() => ({})),
            ytRes.json().catch(() => ({})),
            xRes.json().catch(() => ({})),
          ]);

          collectWarnings(newsData, ytData, xData);

          // Separate personalized items by type
          const pNews = pItems.filter((i: any) => i.type === 'news').map((i: any) => ({ ...i.originalData, firestoreId: i.firestoreId, sentiment: i.sentiment }));
          const pVideos = pItems.filter((i: any) => i.type === 'video').map((i: any) => ({ ...i.originalData, firestoreId: i.firestoreId, sentiment: i.sentiment }));
          const pTrends = pItems.filter((i: any) => i.type === 'trend').map((i: any) => ({ ...i.originalData, firestoreId: i.firestoreId, sentiment: i.sentiment }));

          // Merge personalized + fresh, then dedupe
          fetchedNews = dedupeItems(
            [...pNews, ...(newsData.results || [])],
            (item: any) => item.title || '',
            (item: any) => item.link || ''
          );
          fetchedVideos = dedupeItems(
            [...pVideos, ...(ytData.items || [])],
            (item: any) => item.snippet?.title || '',
            (item: any) => `https://youtube.com/watch?v=${item.id?.videoId || item.id}`
          );
          fetchedTrends = dedupeItems(
            [...pTrends, ...(xData.trends || [])],
            (item: any) => item.name || '',
            (item: any) => item.url || ''
          );

        } else {
          // Fetch specific interest or search query
          const [newsRes, ytRes, xRes] = await Promise.all([
            fetch(`/api/news?q=${encodeURIComponent(activeInterest)}`),
            fetch(`/api/youtube?q=${encodeURIComponent(activeInterest)}`),
            fetch(`/api/x-trends`)
          ]);

          const [newsData, ytData, xData] = await Promise.all([
            newsRes.json().catch(() => ({})),
            ytRes.json().catch(() => ({})),
            xRes.json().catch(() => ({})),
          ]);

          collectWarnings(newsData, ytData, xData);

          fetchedNews = dedupeItems(
            newsData.results || [],
            (item: any) => item.title || '',
            (item: any) => item.link || ''
          );
          fetchedVideos = dedupeItems(
            ytData.items || [],
            (item: any) => item.snippet?.title || '',
            (item: any) => `https://youtube.com/watch?v=${item.id?.videoId || item.id}`
          );
          fetchedTrends = dedupeItems(
            xData.trends || [],
            (item: any) => item.name || '',
            (item: any) => item.url || ''
          );

          if (fetchedNews.length === 0 && fetchedVideos.length === 0 && fetchedTrends.length === 0) {
            throw new Error(newsData.error || ytData.error || xData.error || 'No content found for this topic.');
          }
        }

        setNews(fetchedNews);
        setVideos(fetchedVideos);
        setTrends(fetchedTrends);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'An error occurred while fetching data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeInterest, interests, user.uid, bookmarks.length]);

  const handleItemClick = async (item: any, type: string) => {
    const title = type === 'news' ? item.title : type === 'video' ? item.snippet?.title : item.name;
    const url = type === 'news' ? item.link : type === 'video' ? `https://youtube.com/watch?v=${item.id?.videoId || item.id}` : item.url;
    
    // Log to standard history
    logClickHistory(user.uid, title, url, type);

    // If item has a firestoreId (from our backend), log interaction for vector learning
    if (item.firestoreId) {
      try {
        await fetch('/api/log-interaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            firestoreId: item.firestoreId
          })
        });
      } catch (e) {
        console.error("Failed to log vector interaction", e);
      }
    }
  };

  const openVideoModal = (video: any, e: React.MouseEvent) => {
    e.preventDefault();
    const videoId = video.id?.videoId || video.id;
    setActiveVideoId(videoId);
    setIsModalOpen(true);
    handleItemClick(video, 'video');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setActiveInterest(searchQuery.trim());
      setSearchQuery('');
    }
  };

  const isBookmarked = (item: any, type: string) => {
    const url = type === 'news' ? item.link : type === 'video' ? `https://youtube.com/watch?v=${item.id?.videoId || item.id}` : item.url;
    return bookmarks.some(b => b.url === url);
  };

  const handleBookmark = async (e: React.MouseEvent, item: any, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleBookmark(user.uid, item, type);
  };

  // Determine gradient colors based on active interest
  const getGradientColors = () => {
    const lower = activeInterest.toLowerCase();
    if (lower.includes('tech') || lower.includes('ai') || lower.includes('code')) return { c1: '#0ea5e9', c2: '#3b82f6' }; // Sky/Blue
    if (lower.includes('space') || lower.includes('science')) return { c1: '#8b5cf6', c2: '#d946ef' }; // Violet/Fuchsia
    if (lower.includes('health') || lower.includes('fitness')) return { c1: '#10b981', c2: '#14b8a6' }; // Emerald/Teal
    if (lower.includes('finance') || lower.includes('crypto')) return { c1: '#f59e0b', c2: '#eab308' }; // Amber/Yellow
    if (lower.includes('saved')) return { c1: '#f43f5e', c2: '#ec4899' }; // Rose/Pink
    return { c1: '#4f46e5', c2: '#7c3aed' }; // Default Indigo/Violet
  };

  const colors = getGradientColors();

  // Interleave items for a clean grid layout
  const mixedItems: { type: string; data: any; index?: number }[] = [];
  const maxLength = Math.max(news.length, videos.length, trends.length);
  for (let i = 0; i < maxLength; i++) {
    if (news[i]) mixedItems.push({ type: 'news', data: news[i] });
    if (videos[i]) mixedItems.push({ type: 'video', data: videos[i] });
    if (trends[i]) mixedItems.push({ type: 'trend', data: trends[i], index: i });
  }

  return (
    <div className="flex min-h-screen bg-transparent text-stone-50 font-sans relative">
      <MeshGradient color1={colors.c1} color2={colors.c2} />
      
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-[#111110]/60 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar 
        interests={interests} 
        activeInterest={activeInterest} 
        setActiveInterest={setActiveInterest} 
        user={user} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        <PulseTicker trends={trends} videos={videos} />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-[1600px] mx-auto w-full">
          <header className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <button 
                className={cn(
                  "p-2 -ml-2 text-stone-400 hover:text-white rounded-full hover:bg-white/5 transition-colors",
                  isSidebarOpen ? "md:hidden" : "" // Show on desktop if sidebar is closed
                )}
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <h2 className="text-3xl md:text-clamp-xl font-black tracking-tight text-white mb-1 drop-shadow-lg leading-none">
                  {activeInterest}
                </h2>
                <p className="text-stone-300 font-medium text-sm md:text-base">
                  {activeInterest === 'For You' 
                    ? 'A personalized mix based on your clicks and interests.' 
                    : activeInterest === 'Saved'
                    ? 'Your bookmarked articles, videos, and trends.'
                    : 'Curated updates, videos, and trends based on your interests.'}
                </p>
              </div>
            </div>
            
            <form onSubmit={handleSearch} className="relative w-full lg:w-96 shrink-0">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topics..."
                className="w-full bg-stone-900/60 backdrop-blur-md border border-white/10 rounded-full py-3 pl-12 pr-4 text-sm text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-lg"
              />
            </form>
          </header>

          {sourceWarnings.length > 0 && (
            <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-3 flex items-start gap-3 text-amber-400 backdrop-blur-md">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <span className="font-semibold">Some sources failed to load: </span>
                {sourceWarnings.join(' · ')}
              </div>
              <button onClick={() => setSourceWarnings([])} className="shrink-0 hover:text-amber-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {loading ? (
            <SkeletonLoader />
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 flex items-center gap-4 text-red-400 backdrop-blur-md">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <p>{error}</p>
            </div>
          ) : mixedItems.length === 0 ? (
            <div className="text-center py-20 text-stone-400 backdrop-blur-md bg-stone-900/30 rounded-3xl border border-white/5">
              <p className="text-lg">No content found for this topic.</p>
            </div>
          ) : (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              {mixedItems.map((item, idx) => (
                <motion.div key={`${item.type}-${idx}`} variants={itemVariants} className="h-full">
                  {item.type === 'news' && (
                    <NewsCard 
                      article={item.data} 
                      onClick={() => handleItemClick(item.data, 'news')} 
                      isBookmarked={isBookmarked(item.data, 'news')}
                      onBookmark={(e) => handleBookmark(e, item.data, 'news')}
                      className="h-full" 
                    />
                  )}
                  {item.type === 'video' && (
                    <VideoCard 
                      video={item.data} 
                      onClick={(e) => openVideoModal(item.data, e)} 
                      isBookmarked={isBookmarked(item.data, 'video')}
                      onBookmark={(e) => handleBookmark(e, item.data, 'video')}
                      className="h-full" 
                    />
                  )}
                  {item.type === 'trend' && (
                    <TrendCard 
                      trend={item.data} 
                      index={item.index!} 
                      onClick={() => handleItemClick(item.data, 'trend')} 
                      isBookmarked={isBookmarked(item.data, 'trend')}
                      onBookmark={(e) => handleBookmark(e, item.data, 'trend')}
                      className="h-full" 
                    />
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}
        </main>
      </div>

      <VideoModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        videoId={activeVideoId} 
      />
      <AIPulse />
    </div>
  );
}
