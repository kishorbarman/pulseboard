import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, RefreshCw, Newspaper, PlayCircle, MessageSquare, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';

interface DailyBriefProps {
  userId: string;
}

interface DailyBriefItem {
  type: 'news' | 'video' | 'trend';
  title: string;
  source: string;
  url: string;
  whyItMatters: string;
}

interface TopicSnapshot {
  interest: string;
  headline: string;
  source: string;
  type: 'news' | 'video' | 'trend';
  whyItMatters: string;
  detailedSummary?: string;
  keyDevelopments?: string[];
  signalCount?: { news: number; videos: number; posts: number };
}

interface DailyBriefDocument {
  dateKey: string;
  generatedAtIso: string;
  executiveSummary: string;
  overviewNarrative?: string;
  overviewBullets: string[];
  crossTopicThemes: string[];
  watchlist: string[];
  topicSnapshots: TopicSnapshot[];
  mustRead: DailyBriefItem[];
  counts: { news: number; videos: number; posts: number };
}

interface BriefHistoryItem {
  dateKey: string;
  generatedAtIso: string;
  executiveSummary: string;
  topicCount: number;
}

function getTodayDateKey() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value || String(now.getFullYear());
  const m = parts.find((p) => p.type === 'month')?.value || String(now.getMonth() + 1).padStart(2, '0');
  const d = parts.find((p) => p.type === 'day')?.value || String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatBriefDate(dateKey: string) {
  const asDate = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(asDate.getTime())) return dateKey;
  return asDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function TypeIcon({ type }: { type: 'news' | 'video' | 'trend' }) {
  if (type === 'video') return <PlayCircle className="w-4 h-4" />;
  if (type === 'trend') return <MessageSquare className="w-4 h-4" />;
  return <Newspaper className="w-4 h-4" />;
}

export function DailyBrief({ userId }: DailyBriefProps) {
  const [history, setHistory] = useState<BriefHistoryItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateKey());
  const [brief, setBrief] = useState<DailyBriefDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const res = await fetch(`/api/daily-brief-history?userId=${encodeURIComponent(userId)}&limit=21`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch daily brief history');
    const items = Array.isArray(data.items) ? data.items : [];
    setHistory(items);
    return items as BriefHistoryItem[];
  }, [userId]);

  const loadBrief = useCallback(async (dateKey: string, refresh = false) => {
    const refreshParam = refresh ? '&refresh=true' : '';
    const res = await fetch(`/api/daily-brief?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(dateKey)}${refreshParam}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch daily brief');
    setBrief(data);
    return data as DailyBriefDocument;
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await loadHistory();
        const initialDate = items[0]?.dateKey || getTodayDateKey();
        if (!cancelled) {
          setSelectedDate(initialDate);
          await loadBrief(initialDate, false);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Unable to load daily brief.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadBrief, loadHistory]);

  const handleDateSelect = async (dateKey: string) => {
    setSelectedDate(dateKey);
    setLoading(true);
    setError(null);
    try {
      await loadBrief(dateKey, false);
    } catch (e: any) {
      setError(e.message || 'Unable to load daily brief.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshToday = async () => {
    const today = getTodayDateKey();
    setRefreshing(true);
    setError(null);
    try {
      await loadBrief(today, true);
      setSelectedDate(today);
      await loadHistory();
    } catch (e: any) {
      setError(e.message || 'Unable to refresh today brief.');
    } finally {
      setRefreshing(false);
    }
  };

  const summaryLines = useMemo(
    () => brief?.overviewBullets?.filter(Boolean) || brief?.executiveSummary?.split('\n').filter(Boolean) || [],
    [brief]
  );

  const availableDates = useMemo(() => {
    const all = new Set<string>([getTodayDateKey(), ...history.map((h) => h.dateKey)]);
    return [...all].sort((a, b) => (a < b ? 1 : -1));
  }, [history]);

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="rounded-2xl md:rounded-3xl border border-border-primary bg-surface-primary/60 backdrop-blur-md p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-text-muted mb-1">Morning Digest</p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-text-heading">Daily Brief</h2>
            <p className="text-sm text-text-secondary mt-1">A cross-topic snapshot you can revisit anytime.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
              <select
                value={selectedDate}
                onChange={(e) => handleDateSelect(e.target.value)}
                className="bg-surface-base border border-border-primary rounded-xl pl-9 pr-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-[var(--th-focus-ring)]"
              >
                {availableDates.map((dateKey) => (
                  <option key={dateKey} value={dateKey}>
                    {formatBriefDate(dateKey)}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleRefreshToday}
              disabled={refreshing}
              className="px-3 py-2 rounded-xl border border-border-primary bg-surface-base text-sm text-text-primary hover:text-text-heading transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl p-4 flex items-center gap-3 border"
             style={{ backgroundColor: 'var(--th-danger-bg)', borderColor: 'var(--th-danger-border)', color: 'var(--th-danger-text)' }}>
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
          <div className="h-44 rounded-2xl bg-surface-primary/50 animate-pulse border border-border-secondary" />
          <div className="h-44 rounded-2xl bg-surface-primary/50 animate-pulse border border-border-secondary" />
        </div>
      ) : brief ? (
        <>
          <section className="rounded-2xl md:rounded-3xl border border-border-primary bg-surface-primary/60 backdrop-blur-md p-4 md:p-6">
            <p className="text-xs uppercase tracking-wider text-text-muted mb-2">Overview</p>
            {brief.overviewNarrative && (
              <p className="text-sm md:text-base text-text-primary mb-3 whitespace-pre-line">
                {brief.overviewNarrative}
              </p>
            )}
            <ul className="space-y-2">
              {summaryLines.slice(0, 4).map((line, idx) => (
                <li key={idx} className="text-sm md:text-base text-text-primary">{line.replace(/^•\s*/, '')}</li>
              ))}
            </ul>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6">
            <div className="lg:col-span-2 rounded-2xl md:rounded-3xl border border-border-primary bg-surface-primary/60 backdrop-blur-md p-4 md:p-6">
              <p className="text-xs uppercase tracking-wider text-text-muted mb-3">Topic Snapshots</p>
              <div className="space-y-3">
                {brief.topicSnapshots.slice(0, 12).map((item, idx) => (
                  <div key={`${item.interest}-${idx}`} className="rounded-xl border border-border-secondary bg-surface-base/60 p-3">
                    <p className="text-xs uppercase tracking-wider text-text-muted">{item.interest}</p>
                    <p className="text-sm text-text-heading font-semibold mt-1">{item.headline}</p>
                    {item.detailedSummary && (
                      <p className="text-xs text-text-primary mt-2">{item.detailedSummary}</p>
                    )}
                    <p className="text-xs text-text-secondary mt-1">{item.whyItMatters}</p>
                    {item.keyDevelopments && item.keyDevelopments.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {item.keyDevelopments.slice(0, 3).map((dev, i) => (
                          <li key={i} className="text-xs text-text-secondary">{dev}</li>
                        ))}
                      </ul>
                    )}
                    {item.signalCount && (
                      <p className="text-[11px] text-text-muted mt-2">
                        Signals: {item.signalCount.news} news · {item.signalCount.videos} videos · {item.signalCount.posts} posts
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 md:space-y-6">
              <div className="rounded-2xl border border-border-primary bg-surface-primary/60 backdrop-blur-md p-4">
                <p className="text-xs uppercase tracking-wider text-text-muted mb-2">Coverage</p>
                <p className="text-sm text-text-primary">News: {brief.counts.news}</p>
                <p className="text-sm text-text-primary">Videos: {brief.counts.videos}</p>
                <p className="text-sm text-text-primary">Posts: {brief.counts.posts}</p>
              </div>
              <div className="rounded-2xl border border-border-primary bg-surface-primary/60 backdrop-blur-md p-4">
                <p className="text-xs uppercase tracking-wider text-text-muted mb-2">Watchlist</p>
                <ul className="space-y-2">
                  {brief.watchlist.slice(0, 5).map((line, idx) => (
                    <li key={idx} className="text-sm text-text-primary">{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="rounded-2xl md:rounded-3xl border border-border-primary bg-surface-primary/60 backdrop-blur-md p-4 md:p-6">
            <p className="text-xs uppercase tracking-wider text-text-muted mb-3">Must Read</p>
            <div className="space-y-2">
              {brief.mustRead.slice(0, 12).map((item, idx) => (
                <a
                  key={`${item.url}-${idx}`}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-3 rounded-xl border border-border-secondary bg-surface-base/60 p-3 hover:bg-surface-base/80 transition-colors"
                >
                  <span className="mt-0.5 text-text-secondary"><TypeIcon type={item.type} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-text-heading">{item.title}</span>
                    <span className="block text-xs text-text-muted mt-1">{item.source}</span>
                  </span>
                  <ExternalLink className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                </a>
              ))}
            </div>
          </section>
        </>
      ) : (
        <div className="rounded-2xl p-6 border border-border-secondary bg-surface-primary/40 text-text-secondary">
          No daily brief available yet.
        </div>
      )}
    </div>
  );
}
