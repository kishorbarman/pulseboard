import React, { useState } from 'react';
import { ExternalLink, Heart, Repeat2, MessageCircle, Bookmark, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { HoverSummary } from './HoverSummary';

interface TrendCardProps {
  key?: React.Key;
  trend: any;
  index: number;
  onClick: () => void;
  className?: string;
  isBookmarked?: boolean;
  onBookmark?: (e: React.MouseEvent) => void;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

export function TrendCard({ trend, index, onClick, className = '', isBookmarked, onBookmark }: TrendCardProps) {
  const [showSummary, setShowSummary] = useState(false);

  const sentiment = trend.sentiment || 'Neutral';
  const sentimentClass =
    sentiment === 'Positive' ? 'border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' :
    sentiment === 'Negative' ? 'border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]' :
    'border-border-secondary hover:border-sky-500/30';

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
      className={`group relative overflow-hidden rounded-2xl md:rounded-3xl border bg-surface-primary flex flex-col transition-all duration-300 ${sentimentClass} ${className}`}
    >
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

      {onBookmark && (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onBookmark(e);
          }}
          className={cn(
            "absolute top-4 right-4 z-10 p-2.5 bg-[var(--th-surface-overlay)] hover:bg-[var(--th-surface-overlay-heavy)] rounded-full backdrop-blur-md transition-all border border-border-primary",
          )}
        >
          <Bookmark className={cn("w-4 h-4", isBookmarked ? "fill-indigo-400 text-indigo-400" : "text-text-heading")} />
        </motion.button>
      )}

      <div className={cn(
        "p-4 md:p-6 flex flex-col flex-1 bg-surface-primary/90 backdrop-blur-xl relative z-20",
        imageUrl && "-mt-12 rounded-t-2xl md:rounded-t-3xl border-t border-border-secondary"
      )}>
        {/* Author row */}
        <div className="flex items-center gap-3 mb-3">
          {author.profile_image_url ? (
            <img
              src={author.profile_image_url}
              alt={author.name}
              className="w-10 h-10 rounded-full object-cover border border-border-secondary"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-sm">
              {author.name?.charAt(0) || 'X'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text-primary truncate">{author.name}</p>
            <p className="text-xs text-text-tertiary truncate">@{author.username}</p>
          </div>
          {trend.created_at && (
            <span className="text-xs text-text-muted shrink-0">
              {formatDistanceToNow(new Date(trend.created_at), { addSuffix: true })}
            </span>
          )}
        </div>

        {/* Tweet text */}
        <p className="text-base text-text-primary leading-relaxed mb-4 flex-1 line-clamp-4">
          {trend.text}
        </p>

        {/* Engagement + actions */}
        <div className="mt-auto flex items-center justify-between pt-4 border-t border-border-secondary">
          <div className="flex items-center gap-4 text-xs text-text-tertiary">
            <span className="flex items-center gap-1.5 hover:text-rose-400 transition-colors">
              <Heart className="w-3.5 h-3.5" />
              {formatCount(metrics.likes)}
            </span>
            <span className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
              <Repeat2 className="w-3.5 h-3.5" />
              {formatCount(metrics.retweets)}
            </span>
            <span className="flex items-center gap-1.5 hover:text-sky-400 transition-colors">
              <MessageCircle className="w-3.5 h-3.5" />
              {formatCount(metrics.replies)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowSummary(v => !v); }}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all",
                showSummary
                  ? "bg-indigo-500 border-indigo-500 text-white"
                  : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-500/40"
              )}
            >
              <Sparkles className="w-3 h-3" />
              AI
            </button>
            {sentiment !== 'Neutral' && (
              <span className={cn(
                "text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border",
                sentiment === 'Positive' ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" : "text-rose-400 border-rose-400/30 bg-rose-400/10"
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
