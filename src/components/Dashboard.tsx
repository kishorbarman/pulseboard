import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { NewsCard } from './NewsCard';
import { VideoCard } from './VideoCard';
import { TrendCard } from './TrendCard';
import { VideoModal } from './VideoModal';
import { logClickHistory, subscribeToBookmarks, toggleBookmark } from '../lib/firebase';
import { AlertCircle, Search, Menu, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MeshGradient } from './MeshGradient';
import { AIPulse } from './AIPulse';
import { About } from './About';
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
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="h-[400px] rounded-2xl md:rounded-3xl bg-surface-primary/50 animate-pulse border border-border-secondary" />
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
  const [loadMultiplier, setLoadMultiplier] = useState(1);
  const [hasMoreContent, setHasMoreContent] = useState(false);
  const [news, setNews] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceWarnings, setSourceWarnings] = useState<string[]>([]);
  const [trendContext, setTrendContext] = useState<string>('');
  
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
  const maxLoadMultiplier = 4;

  const changeInterest = (interest: string) => {
    setActiveInterest(interest);
    setLoadMultiplier(1);
    setHasMoreContent(false);
  };

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeToBookmarks(user.uid, setBookmarks);
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    document.title = `${activeInterest} | PulseBoard`;
  }, [activeInterest]);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (forceRefresh || loadMultiplier > 1) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    setSourceWarnings([]);
    setTrendContext('');
    try {
      let fetchedNews: any[] = [];
      let fetchedVideos: any[] = [];
      let fetchedTrends: any[] = [];

      // Helper to parse smart-feed response into content arrays
      const parseSmartFeed = (data: any) => ({
        news: data.news?.results || [],
        videos: data.videos?.items || [],
        posts: data.posts?.posts || [],
        trendContext: data.trendContext || '',
        warnings: data.warnings || [],
        pagination: data.pagination || null,
      });

      const refreshParam = forceRefresh ? '&refresh=true' : '';
      const loadParam = `&loadMultiplier=${loadMultiplier}`;

      if (activeInterest === 'Saved') {
        fetchedNews = bookmarks.filter(b => b.type === 'news').map(b => b.item);
        fetchedVideos = bookmarks.filter(b => b.type === 'video').map(b => b.item);
        fetchedTrends = bookmarks.filter(b => b.type === 'trend').map(b => b.item);
        setHasMoreContent(false);
      } else if (activeInterest === 'For You') {
        // Fetch personalized feed + smart content covering all interests
        const [personalizedRes, smartRes] = await Promise.all([
          fetch(`/api/personalized-feed?userId=${user.uid}`),
          fetch(`/api/smart-feed-foryou?interests=${encodeURIComponent(interests.join(','))}&userId=${encodeURIComponent(user.uid)}${refreshParam}${loadParam}`),
        ]);

        const personalizedData = await personalizedRes.json();
        const pItems = personalizedData.items || [];
        const smartData = await smartRes.json().catch(() => ({}));
        const smart = parseSmartFeed(smartData);
        setHasMoreContent(Boolean(smart.pagination?.hasMore) && loadMultiplier < (smart.pagination?.maxLoadMultiplier || maxLoadMultiplier));

        if (smart.warnings.length > 0) setSourceWarnings(smart.warnings);
        setTrendContext(smart.trendContext);

        // Separate personalized items by type
        const pNews = pItems.filter((i: any) => i.type === 'news').map((i: any) => ({ ...i.originalData, firestoreId: i.firestoreId, sentiment: i.sentiment }));
        const pVideos = pItems.filter((i: any) => i.type === 'video').map((i: any) => ({ ...i.originalData, firestoreId: i.firestoreId, sentiment: i.sentiment }));
        const pTrends = pItems.filter((i: any) => i.type === 'trend').map((i: any) => ({ ...i.originalData, firestoreId: i.firestoreId, sentiment: i.sentiment }));

        // Merge personalized + smart fresh, then dedupe
        fetchedNews = dedupeItems(
          [...pNews, ...smart.news],
          (item: any) => item.title || '',
          (item: any) => item.link || ''
        );
        fetchedVideos = dedupeItems(
          [...pVideos, ...smart.videos],
          (item: any) => item.snippet?.title || '',
          (item: any) => `https://youtube.com/watch?v=${item.id?.videoId || item.id}`
        );
        fetchedTrends = dedupeItems(
          [...pTrends, ...smart.posts],
          (item: any) => item.id || item.text || '',
          (item: any) => item.url || ''
        );

      } else {
        // Smart feed for specific interest or search query
        const smartRes = await fetch(`/api/smart-feed?q=${encodeURIComponent(activeInterest)}&userId=${encodeURIComponent(user.uid)}${refreshParam}${loadParam}`);
        const smartData = await smartRes.json().catch(() => ({}));

        if (smartData.error) {
          throw new Error(smartData.error);
        }

        const smart = parseSmartFeed(smartData);
        setHasMoreContent(Boolean(smart.pagination?.hasMore) && loadMultiplier < (smart.pagination?.maxLoadMultiplier || maxLoadMultiplier));
        if (smart.warnings.length > 0) setSourceWarnings(smart.warnings);
        setTrendContext(smart.trendContext);

        fetchedNews = dedupeItems(
          smart.news,
          (item: any) => item.title || '',
          (item: any) => item.link || ''
        );
        fetchedVideos = dedupeItems(
          smart.videos,
          (item: any) => item.snippet?.title || '',
          (item: any) => `https://youtube.com/watch?v=${item.id?.videoId || item.id}`
        );
        fetchedTrends = dedupeItems(
          smart.posts,
          (item: any) => item.id || item.text || '',
          (item: any) => item.url || ''
        );

        if (fetchedNews.length === 0 && fetchedVideos.length === 0 && fetchedTrends.length === 0) {
          throw new Error('No content found for this topic.');
        }
      }

      setNews(fetchedNews);
      setVideos(fetchedVideos);
      setTrends(fetchedTrends);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while fetching data.');
      setHasMoreContent(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeInterest, interests, user.uid, bookmarks.length, loadMultiplier]);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

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
      changeInterest(searchQuery.trim());
      setSearchQuery('');
    }
  };

  const isBookmarked = (item: any, type: string) => {
    const url = type === 'news' ? item.link : type === 'video' ? `https://youtube.com/watch?v=${item.id?.videoId || item.id}` : item.url;
    return bookmarks.some(b => b.url === url);
  };

  const handleBookmark = async (item: any, type: string) => {
    await toggleBookmark(user.uid, item, type);
  };

  // Determine gradient colors based on active interest
  const getGradientColors = () => {
    return { c1: '#0e7490', c2: '#1f2937' };
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
    <div className="flex min-h-screen bg-transparent text-text-primary font-sans relative">
      <MeshGradient color1={colors.c1} color2={colors.c2} />
      
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-[var(--th-surface-overlay-heavy)] z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar 
        interests={interests} 
        activeInterest={activeInterest} 
        setActiveInterest={changeInterest} 
        user={user} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        <main className="flex-1 overflow-y-auto px-2 py-3 md:p-8 max-w-[1600px] mx-auto w-full mobile-hide-scrollbar">
          {activeInterest === 'About' ? (
            <About onBack={() => changeInterest('For You')} />
          ) : (
            <>
              <header className="mb-4 md:mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6">
                <div className="flex items-center gap-4">
                  <button
                    className={cn(
                      "p-2 -ml-2 text-text-tertiary hover:text-text-heading rounded-full hover:bg-[var(--th-surface-btn-overlay)] transition-colors",
                      isSidebarOpen ? "md:hidden" : "" // Show on desktop if sidebar is closed
                    )}
                    onClick={() => setIsSidebarOpen(true)}
                  >
                    <Menu className="w-6 h-6" />
                  </button>
                  {(activeInterest === 'For You' || activeInterest === 'Saved') && (
                    <div>
                      <h2 className="text-3xl md:text-clamp-xl font-black tracking-tight text-text-heading mb-1 drop-shadow-lg leading-none">
                        {activeInterest}
                      </h2>
                      <p className="text-text-secondary font-medium text-sm md:text-base">
                        {activeInterest === 'For You'
                          ? 'Curated for you.'
                          : 'Your bookmarked articles, videos, and trends.'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
                  <form onSubmit={handleSearch} className="relative w-full lg:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search topics..."
                      className="w-full bg-surface-primary/60 backdrop-blur-md border border-border-primary rounded-full py-3 pl-12 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[var(--th-focus-ring)] transition-all shadow-lg"
                    />
                  </form>
                  {activeInterest !== 'Saved' && (
                    <button
                      onClick={() => fetchData(true)}
                      disabled={loading || refreshing}
                      className="p-2.5 rounded-full bg-surface-primary/60 backdrop-blur-md border border-border-primary text-text-secondary hover:text-text-heading hover:border-[var(--th-accent-border)] transition-all disabled:opacity-40 shrink-0"
                      title="Refresh feed"
                    >
                      <RefreshCw className={cn("w-5 h-5", refreshing && "animate-spin")} />
                    </button>
                  )}
                </div>
              </header>

              {sourceWarnings.length > 0 && (
                <div className="mb-6 rounded-2xl px-5 py-3 flex items-start gap-3 text-[var(--th-warning-text)] backdrop-blur-md border"
                     style={{ backgroundColor: 'var(--th-warning-bg)', borderColor: 'var(--th-warning-border)' }}>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1 text-sm">
                    {sourceWarnings.join(' · ')}
                  </div>
                  <button onClick={() => setSourceWarnings([])} className="shrink-0 hover:text-text-heading transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <AnimatePresence>
                {refreshing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mb-4 h-1 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'var(--th-accent-soft)' }}
                  >
                    <motion.div
                      className="h-full rounded-full w-1/3"
                      style={{ backgroundColor: 'var(--th-accent)' }}
                      animate={{ x: ['-100%', '300%'] }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {loading && !refreshing ? (
                <SkeletonLoader />
              ) : error ? (
                <div className="rounded-2xl p-6 flex items-center gap-4 backdrop-blur-md border"
                     style={{ backgroundColor: 'var(--th-danger-bg)', borderColor: 'var(--th-danger-border)', color: 'var(--th-danger-text)' }}>
                  <AlertCircle className="w-6 h-6 shrink-0" />
                  <p>{error}</p>
                </div>
              ) : mixedItems.length === 0 ? (
                <div className="text-center py-20 text-text-tertiary backdrop-blur-md bg-surface-primary/30 rounded-2xl md:rounded-3xl border border-border-secondary">
                  <p className="text-lg">No content found for this topic.</p>
                </div>
              ) : (
                <>
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6"
                  >
                    {mixedItems.map((item, idx) => (
                      <motion.div key={`${item.type}-${idx}`} variants={itemVariants} className="h-full">
                        {item.type === 'news' && (
                          <NewsCard
                            article={item.data}
                            onClick={() => handleItemClick(item.data, 'news')}
                            isBookmarked={isBookmarked(item.data, 'news')}
                            onBookmark={() => handleBookmark(item.data, 'news')}
                            className="h-full"
                          />
                        )}
                        {item.type === 'video' && (
                          <VideoCard
                            video={item.data}
                            onClick={(e) => openVideoModal(item.data, e)}
                            isBookmarked={isBookmarked(item.data, 'video')}
                            onBookmark={() => handleBookmark(item.data, 'video')}
                            className="h-full"
                          />
                        )}
                        {item.type === 'trend' && (
                          <TrendCard
                            trend={item.data}
                            index={item.index!}
                            onClick={() => handleItemClick(item.data, 'trend')}
                            isBookmarked={isBookmarked(item.data, 'trend')}
                            onBookmark={() => handleBookmark(item.data, 'trend')}
                            className="h-full"
                          />
                        )}
                      </motion.div>
                    ))}
                  </motion.div>
                  {activeInterest !== 'Saved' && hasMoreContent && loadMultiplier < maxLoadMultiplier && (
                    <div className="mt-6 flex justify-center">
                      <button
                        onClick={() => setLoadMultiplier((v) => Math.min(maxLoadMultiplier, v + 1))}
                        disabled={refreshing}
                        className="px-5 py-2.5 rounded-full bg-surface-primary/70 border border-border-primary text-text-primary hover:text-text-heading hover:border-[var(--th-accent-border)] transition-colors disabled:opacity-50"
                      >
                        {refreshing ? 'Loading...' : 'Fetch More Content'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>

      <VideoModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        videoId={activeVideoId} 
      />
      <AIPulse news={news} videos={videos} trends={trends} activeInterest={activeInterest} trendContext={trendContext} />
    </div>
  );
}
