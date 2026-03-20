import React, { useState } from 'react';
import { ExternalLink, Clock, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatCompactTimeAgo } from '../lib/utils';
import { HoverSummary } from './HoverSummary';
import { SourceMenu } from './SourceMenu';

interface NewsCardProps {
  key?: React.Key;
  article: any;
  onClick: () => void;
  className?: string;
  isBookmarked?: boolean;
  onBookmark?: () => void;
}

export function NewsCard({ article, onClick, className = '', isBookmarked, onBookmark }: NewsCardProps) {
  const bgImage = article.image_url || `https://picsum.photos/seed/${encodeURIComponent(article.title)}/800/600?blur=2`;
  const [showSummary, setShowSummary] = useState(false);
  const sourceType = article._ingestionSource === 'rss' ? 'RSS' : 'News';
  const displaySource = (() => {
    const raw = String(article.source_id || '').replace(/\s*[-–—]\s*Google News\s*$/i, '').trim();
    const looksLikeSearchFeed = /site:|\(|\)|\bOR\b|google news/i.test(raw);
    if (!looksLikeSearchFeed && raw && raw.length <= 80) return raw;
    const title = String(article.title || '');
    const match = title.match(/(?:\s[-–—]\s)([^–—-]{2,80})\s*$/u);
    return (match?.[1] || 'News').trim();
  })();

  const sentiment = article.sentiment || 'Neutral';
  const ageLabel = formatCompactTimeAgo(article.pubDate);
  const sentimentClass =
    sentiment === 'Positive' ? 'shadow-[0_0_15px_rgba(16,185,129,0.1)] border-[var(--th-success-border)]' :
    sentiment === 'Negative' ? 'shadow-[0_0_15px_rgba(239,68,68,0.12)] border-[var(--th-danger-border)]' :
    'border-border-secondary';

  return (
    <motion.a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      className={`group relative overflow-hidden rounded-none md:rounded-3xl border border-x-0 md:border-x bg-surface-primary flex flex-col transition-all duration-300 ${sentimentClass} ${className}`}
    >
      <SourceMenu
        source={sourceType}
        className="top-4 right-4"
        isBookmarked={Boolean(isBookmarked)}
        onToggleBookmark={onBookmark}
      />

      <div className="relative h-48 shrink-0 overflow-hidden">
        <img
          src={bgImage}
          alt={article.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(article.title)}/800/600?blur=2`;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--th-surface-primary)] via-[var(--th-surface-primary)]/40 to-transparent" />
      </div>

      <div className="p-4 md:p-6 flex flex-col flex-1 bg-surface-primary/90 backdrop-blur-xl relative z-20 -mt-12 rounded-t-none md:rounded-t-3xl border-t border-border-secondary">
        <div className="flex items-center gap-3 text-xs text-text-tertiary mb-3 pr-14">
          <span className="px-2.5 py-1 rounded-full font-medium border text-[var(--th-accent-text)] bg-[var(--th-accent-soft)] border-[var(--th-accent-border)]">
            {displaySource}
          </span>
        </div>

        <h3 className="text-xl font-bold text-text-primary leading-snug mb-3 group-hover:text-[var(--th-accent-text)] transition-colors line-clamp-2">
          {article.title}
        </h3>

        {article.description && (
          <p className="text-sm text-text-tertiary line-clamp-3 mb-4 flex-1">
            {article.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-4 border-t border-border-secondary">
          <div className="flex items-center gap-3">
            {ageLabel && (
              <span className="text-xs text-text-muted flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {ageLabel}
              </span>
            )}
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--th-accent-text)] transition-colors flex items-center gap-1">
              Read Article <ExternalLink className="w-3 h-3" />
            </span>
          </div>
          <div className="flex items-center gap-2">
            {article._interest && (
              <span className="text-[11px] font-medium text-[var(--th-accent-text)]/80 bg-[var(--th-accent-soft)] px-2 py-0.5 rounded-full">
                #{article._interest}
              </span>
            )}
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowSummary(v => !v); }}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all",
                showSummary
                  ? "bg-[var(--th-accent)] border-[var(--th-accent)] text-white"
                  : "bg-[var(--th-accent-soft)] border-[var(--th-accent-border)] text-[var(--th-accent-text)] hover:bg-[var(--th-accent-soft-strong)]"
              )}
            >
              <Sparkles className="w-3 h-3" />
            </button>
            {sentiment !== 'Neutral' && (
              <span className={cn(
                "text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border",
                sentiment === 'Positive'
                  ? "text-[var(--th-success-text)] border-[var(--th-success-border)] bg-[var(--th-success-bg)]"
                  : "text-[var(--th-danger-text)] border-[var(--th-danger-border)] bg-[var(--th-danger-bg)]"
              )}>
                {sentiment}
              </span>
            )}
          </div>
        </div>
      </div>

      <HoverSummary
        text={article.title + (article.description ? `\n\n${article.description}` : '')}
        isVisible={showSummary}
        onClose={() => setShowSummary(false)}
      />
    </motion.a>
  );
}
