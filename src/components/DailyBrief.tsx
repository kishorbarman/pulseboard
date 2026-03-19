import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, Newspaper, PlayCircle, MessageSquare, Layers3, Radar, ListChecks } from 'lucide-react';

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

function formatGeneratedAt(iso?: string) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function DailyBrief({ userId }: DailyBriefProps) {
  const [history, setHistory] = useState<BriefHistoryItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateKey());
  const [brief, setBrief] = useState<DailyBriefDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const res = await fetch(`/api/daily-brief-history?userId=${encodeURIComponent(userId)}&limit=21`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch daily brief history');
    const items = Array.isArray(data.items) ? data.items : [];
    setHistory(items);
    return items as BriefHistoryItem[];
  }, [userId]);

  const loadBrief = useCallback(async (dateKey: string) => {
    const res = await fetch(`/api/daily-brief?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(dateKey)}`);
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
        await loadHistory();
        const initialDate = getTodayDateKey();
        if (!cancelled) {
          setSelectedDate(initialDate);
          await loadBrief(initialDate);
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
      await loadBrief(dateKey);
    } catch (e: any) {
      setError(e.message || 'Unable to load daily brief.');
    } finally {
      setLoading(false);
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
      <section className="rounded-2xl md:rounded-3xl border border-border-primary bg-surface-primary/60 backdrop-blur-md p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-sm md:text-base text-text-secondary">
            A structured narrative across your interests, designed for fast scanning.
          </p>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs border border-border-secondary bg-surface-base/60 text-text-secondary shrink-0">
              Updated: {formatGeneratedAt(brief?.generatedAtIso) || 'Now'}
            </span>
            <span className="text-xs uppercase tracking-wider text-text-muted shrink-0">Date</span>
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
          </div>
        </div>
      </section>

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
            <p className="text-xs uppercase tracking-wider text-text-muted mb-2 flex items-center gap-2">
              <Radar className="w-4 h-4" />
              Overview Story
            </p>
            {brief.overviewNarrative && (
              <p className="text-sm md:text-base text-text-primary mb-4 whitespace-pre-line leading-relaxed">
                {brief.overviewNarrative}
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {summaryLines.slice(0, 4).map((line, idx) => (
                <div key={idx} className="rounded-xl border border-border-secondary bg-surface-base/60 p-3 text-sm text-text-primary">
                  {line.replace(/^•\s*/, '')}
                </div>
              ))}
            </div>
            {brief.crossTopicThemes?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {brief.crossTopicThemes.slice(0, 5).map((theme, idx) => (
                  <span key={idx} className="px-2.5 py-1 rounded-full text-xs border border-border-secondary bg-surface-base/50 text-text-secondary">
                    {theme}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6">
            <div className="lg:col-span-2 rounded-2xl md:rounded-3xl border border-border-primary bg-surface-primary/60 backdrop-blur-md p-4 md:p-6">
              <p className="text-xs uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                <Layers3 className="w-4 h-4" />
                Topic Snapshots
              </p>
              <div className="space-y-3">
                {brief.topicSnapshots.slice(0, 12).map((item, idx) => (
                  <div key={`${item.interest}-${idx}`} className="rounded-xl border border-border-secondary bg-surface-base/60 p-3 md:p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-wider text-text-muted">{item.interest}</p>
                      <span className="text-[11px] px-2 py-0.5 rounded-full border border-border-secondary bg-surface-primary/60 text-text-muted inline-flex items-center gap-1">
                        <TypeIcon type={item.type} />
                        {item.source}
                      </span>
                    </div>
                    <p className="text-base md:text-lg text-text-heading font-semibold mt-2 leading-snug">{item.headline}</p>
                    {item.detailedSummary && (
                      <p className="text-sm md:text-base text-text-primary mt-2 leading-relaxed">{item.detailedSummary}</p>
                    )}
                    <p className="text-sm text-text-secondary mt-2">{item.whyItMatters}</p>
                    {item.keyDevelopments && item.keyDevelopments.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {item.keyDevelopments.slice(0, 3).map((dev, i) => (
                          <li key={i} className="text-sm text-text-secondary">{dev}</li>
                        ))}
                      </ul>
                    )}
                    {item.signalCount && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-border-secondary bg-surface-primary/60 text-text-muted">
                          {item.signalCount.news} news
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-border-secondary bg-surface-primary/60 text-text-muted">
                          {item.signalCount.videos} videos
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-border-secondary bg-surface-primary/60 text-text-muted">
                          {item.signalCount.posts} posts
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 md:space-y-6">
              <div className="rounded-2xl border border-border-primary bg-surface-primary/60 backdrop-blur-md p-4">
                <p className="text-xs uppercase tracking-wider text-text-muted mb-3">Coverage Mix</p>
                <p className="text-sm text-text-primary">News: {brief.counts.news}</p>
                <div className="h-1.5 rounded-full bg-surface-base mt-1 mb-2 overflow-hidden">
                  <div className="h-full bg-[var(--th-accent)]" style={{ width: `${Math.max(5, (brief.counts.news / Math.max(brief.counts.news + brief.counts.videos + brief.counts.posts, 1)) * 100)}%` }} />
                </div>
                <p className="text-sm text-text-primary">Videos: {brief.counts.videos}</p>
                <div className="h-1.5 rounded-full bg-surface-base mt-1 mb-2 overflow-hidden">
                  <div className="h-full bg-[var(--th-accent)]" style={{ width: `${Math.max(5, (brief.counts.videos / Math.max(brief.counts.news + brief.counts.videos + brief.counts.posts, 1)) * 100)}%` }} />
                </div>
                <p className="text-sm text-text-primary">Posts: {brief.counts.posts}</p>
                <div className="h-1.5 rounded-full bg-surface-base mt-1 overflow-hidden">
                  <div className="h-full bg-[var(--th-accent)]" style={{ width: `${Math.max(5, (brief.counts.posts / Math.max(brief.counts.news + brief.counts.videos + brief.counts.posts, 1)) * 100)}%` }} />
                </div>
              </div>
              <div className="rounded-2xl border border-border-primary bg-surface-primary/60 backdrop-blur-md p-4">
                <p className="text-xs uppercase tracking-wider text-text-muted mb-2 flex items-center gap-2">
                  <ListChecks className="w-4 h-4" />
                  Watchlist
                </p>
                <ul className="space-y-2">
                  {brief.watchlist.slice(0, 5).map((line, idx) => (
                    <li key={idx} className="text-sm text-text-primary bg-surface-base/50 rounded-lg px-2.5 py-2 border border-border-secondary">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
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
