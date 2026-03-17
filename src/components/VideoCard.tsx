import React, { useState } from 'react';
import { Play, Clock, Youtube, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatCompactTimeAgo } from '../lib/utils';
import { HoverSummary } from './HoverSummary';
import { SourceMenu } from './SourceMenu';

interface VideoCardProps {
  key?: React.Key;
  video: any;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
  isBookmarked?: boolean;
  onBookmark?: () => void;
}

export function VideoCard({ video, onClick, className = '', isBookmarked, onBookmark }: VideoCardProps) {
  const [showSummary, setShowSummary] = useState(false);
  const ageLabel = formatCompactTimeAgo(video.snippet.publishedAt);

  const sentiment = video.sentiment || 'Neutral';
  const sentimentClass =
    sentiment === 'Positive' ? 'shadow-[0_0_15px_rgba(16,185,129,0.1)] border-[var(--th-success-border)]' :
    sentiment === 'Negative' ? 'shadow-[0_0_15px_rgba(239,68,68,0.12)] border-[var(--th-danger-border)]' :
    'border-border-secondary';

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      className={`group relative overflow-hidden rounded-2xl md:rounded-3xl border bg-surface-primary text-left flex flex-col transition-all duration-300 ${sentimentClass} ${className}`}
    >
      <SourceMenu
        source="YouTube"
        className="top-4 right-4"
        isBookmarked={Boolean(isBookmarked)}
        onToggleBookmark={onBookmark}
      />

      <div className="relative h-48 shrink-0 overflow-hidden">
        <img
          src={video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url}
          alt={video.snippet.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-[var(--th-surface-overlay)]/50 group-hover:bg-[var(--th-surface-overlay)] transition-colors flex items-center justify-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-sm shadow-lg transform transition-transform duration-300 group-hover:scale-110"
               style={{ backgroundColor: 'var(--th-accent)' }}>
            <Play className="w-5 h-5 text-white ml-1" />
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 flex flex-col flex-1 bg-surface-primary/90 backdrop-blur-xl relative z-20 -mt-12 rounded-t-2xl md:rounded-t-3xl border-t border-border-secondary">
        <div className="flex items-center gap-3 text-xs text-text-tertiary mb-3 pr-14">
          <span className="flex items-center gap-1.5">
            <Youtube className="w-3.5 h-3.5" />
            <span className="w-2 h-2 rounded-full bg-text-muted"></span>
            <span className="truncate max-w-[120px]">{video.snippet.channelTitle}</span>
          </span>
        </div>

        <h3 className="text-xl font-bold text-text-primary leading-snug mb-3 group-hover:text-[var(--th-accent-text)] transition-colors line-clamp-2">
          {video.snippet.title}
        </h3>

        {video.snippet.description && (
          <p className="text-sm text-text-tertiary line-clamp-3 mb-4 flex-1">
            {video.snippet.description}
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
              Watch Video <Play className="w-3 h-3" />
            </span>
          </div>
          <div className="flex items-center gap-2">
            {video._interest && (
              <span className="text-[11px] font-medium text-[var(--th-accent-text)]/80 bg-[var(--th-accent-soft)] px-2 py-0.5 rounded-full">
                #{video._interest}
              </span>
            )}
            <div
              role="button"
              onClick={(e) => { e.stopPropagation(); setShowSummary(v => !v); }}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all cursor-pointer",
                showSummary
                  ? "bg-[var(--th-accent)] border-[var(--th-accent)] text-white"
                  : "bg-[var(--th-accent-soft)] border-[var(--th-accent-border)] text-[var(--th-accent-text)] hover:bg-[var(--th-accent-soft-strong)]"
              )}
            >
              <Sparkles className="w-3 h-3" />
            </div>
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
        text={video.snippet.title + (video.snippet.description ? `\n\n${video.snippet.description}` : '')}
        isVisible={showSummary}
        onClose={() => setShowSummary(false)}
      />
    </motion.button>
  );
}
