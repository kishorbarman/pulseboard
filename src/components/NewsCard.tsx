import React, { useState } from 'react';
import { ExternalLink, Clock, Bookmark, User, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { HoverSummary } from './HoverSummary';

interface NewsCardProps {
  key?: React.Key;
  article: any;
  onClick: () => void;
  className?: string;
  isBookmarked?: boolean;
  onBookmark?: (e: React.MouseEvent) => void;
}

export function NewsCard({ article, onClick, className = '', isBookmarked, onBookmark }: NewsCardProps) {
  const bgImage = article.image_url || `https://picsum.photos/seed/${encodeURIComponent(article.title)}/800/600?blur=2`;
  const [showSummary, setShowSummary] = useState(false);

  const sentiment = article.sentiment || 'Neutral';
  const sentimentClass =
    sentiment === 'Positive' ? 'border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' :
    sentiment === 'Negative' ? 'border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]' :
    'border-border-secondary';

  return (
    <motion.a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      className={`group relative overflow-hidden rounded-2xl md:rounded-3xl border bg-surface-primary flex flex-col transition-all duration-300 ${sentimentClass} ${className}`}
    >
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

        {onBookmark && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onBookmark(e);
            }}
            className="absolute top-4 right-4 z-10 p-2.5 bg-[var(--th-surface-overlay)] hover:bg-[var(--th-surface-overlay-heavy)] rounded-full backdrop-blur-md transition-all border border-border-primary"
          >
            <Bookmark className={cn("w-4 h-4", isBookmarked ? "fill-indigo-400 text-indigo-400" : "text-text-heading")} />
          </motion.button>
        )}
      </div>

      <div className="p-4 md:p-6 flex flex-col flex-1 bg-surface-primary/90 backdrop-blur-xl relative z-20 -mt-12 rounded-t-2xl md:rounded-t-3xl border-t border-border-secondary">
        <div className="flex items-center gap-3 text-xs text-text-tertiary mb-3">
          <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-full font-medium">
            {article.source_id || 'News'}
          </span>
          {article.creator && article.creator[0] && (
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span className="truncate max-w-[120px]">{article.creator[0]}</span>
            </span>
          )}
          {article.pubDate && (
            <span className="flex items-center gap-1.5 ml-auto">
              <Clock className="w-3.5 h-3.5" />
              {formatDistanceToNow(new Date(article.pubDate), { addSuffix: true })}
            </span>
          )}
        </div>

        <h3 className="text-xl font-bold text-text-primary leading-snug mb-3 group-hover:text-indigo-300 transition-colors line-clamp-2">
          {article.title}
        </h3>

        {article.description && (
          <p className="text-sm text-text-tertiary line-clamp-3 mb-4 flex-1">
            {article.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-4 border-t border-border-secondary">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 group-hover:text-indigo-300 transition-colors flex items-center gap-1">
            Read Article <ExternalLink className="w-3 h-3" />
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowSummary(v => !v); }}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all",
                showSummary
                  ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                  : "border-border-primary text-text-tertiary hover:text-indigo-300 hover:border-indigo-500/30"
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
        text={article.title + (article.description ? `\n\n${article.description}` : '')}
        isVisible={showSummary}
        onClose={() => setShowSummary(false)}
      />
    </motion.a>
  );
}
