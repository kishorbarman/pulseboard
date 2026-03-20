import React, { useState } from 'react';
import { ExternalLink, Heart, Repeat2, MessageCircle, Sparkles, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatCompactTimeAgo } from '../lib/utils';
import { HoverSummary } from './HoverSummary';
import { SourceMenu } from './SourceMenu';

interface TrendCardProps {
  key?: React.Key;
  trend: any;
  index: number;
  onClick: () => void;
  className?: string;
  isBookmarked?: boolean;
  onBookmark?: () => void;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

export function TrendCard({ trend, index, onClick, className = '', isBookmarked, onBookmark }: TrendCardProps) {
  const [showSummary, setShowSummary] = useState(false);
  const ageLabel = formatCompactTimeAgo(trend.created_at);

  const sentiment = trend.sentiment || 'Neutral';
  const sentimentClass =
    sentiment === 'Positive' ? 'shadow-[0_0_15px_rgba(16,185,129,0.1)] border-[var(--th-success-border)]' :
    sentiment === 'Negative' ? 'shadow-[0_0_15px_rgba(239,68,68,0.12)] border-[var(--th-danger-border)]' :
    'border-border-secondary hover:border-[var(--th-accent-border)]';

  const author = trend.author || { name: 'Unknown', username: 'unknown', profile_image_url: '' };
  const metrics = trend.metrics || { likes: 0, retweets: 0, replies: 0 };
  const firstImage = trend.media?.find((m: any) => m.type === 'photo');
  const imageUrl = firstImage?.url || firstImage?.preview_image_url;

  return (
    <motion.a
      href={trend.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      className={`group relative overflow-hidden rounded-none md:rounded-3xl border border-x-0 md:border-x bg-surface-primary flex flex-col transition-all duration-300 ${sentimentClass} ${className}`}
    >
      <SourceMenu
        source="X"
        className="top-4 right-4"
        isBookmarked={Boolean(isBookmarked)}
        onToggleBookmark={onBookmark}
      />

      {/* Media image */}
      {imageUrl && (
        <div className="relative h-48 shrink-0 overflow-hidden">
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--th-surface-primary)] via-[var(--th-surface-primary)]/40 to-transparent" />
        </div>
      )}

      <div className={cn(
        "p-4 md:p-6 flex flex-col flex-1 bg-surface-primary/90 backdrop-blur-xl relative z-20",
        imageUrl && "-mt-12 rounded-t-none md:rounded-t-3xl border-t border-border-secondary"
      )}>
        {/* Author row */}
        <div className="flex items-center gap-3 mb-3 pr-14">
          {author.profile_image_url ? (
            <img
              src={author.profile_image_url}
              alt={author.name}
              className="w-10 h-10 rounded-full object-cover border border-border-secondary"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[var(--th-accent-soft)] border border-[var(--th-accent-border)] flex items-center justify-center text-[var(--th-accent-text)] font-bold text-sm">
              {author.name?.charAt(0) || 'X'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text-primary truncate">{author.name}</p>
            <p className="text-xs text-text-tertiary truncate">@{author.username}</p>
          </div>
        </div>

        {/* Tweet text */}
        <p className="text-base text-text-primary leading-relaxed mb-4 flex-1 line-clamp-4">
          {trend.text}
        </p>

        {/* Engagement + actions */}
        <div className="mt-auto flex items-center justify-between pt-4 border-t border-border-secondary">
          <div className="flex items-center gap-4 text-xs text-text-tertiary">
            {ageLabel && (
              <span className="text-text-muted flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {ageLabel}
              </span>
            )}
            <span className="flex items-center gap-1.5 hover:text-[var(--th-danger-text)] transition-colors">
              <Heart className="w-3.5 h-3.5" />
              {formatCount(metrics.likes)}
            </span>
            <span className="flex items-center gap-1.5 hover:text-[var(--th-success-text)] transition-colors">
              <Repeat2 className="w-3.5 h-3.5" />
              {formatCount(metrics.retweets)}
            </span>
            <span className="flex items-center gap-1.5 hover:text-[var(--th-accent-text)] transition-colors">
              <MessageCircle className="w-3.5 h-3.5" />
              {formatCount(metrics.replies)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {trend._interest && (
              <span className="text-[11px] font-medium text-[var(--th-accent-text)]/80 bg-[var(--th-accent-soft)] px-2 py-0.5 rounded-full">
                #{trend._interest}
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
        text={trend.text || ''}
        isVisible={showSummary}
        onClose={() => setShowSummary(false)}
      />
    </motion.a>
  );
}
