import React from 'react';
import { TrendingUp, ExternalLink, Hash, Bookmark } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface TrendCardProps {
  key?: React.Key;
  trend: any;
  index: number;
  onClick: () => void;
  className?: string;
  isBookmarked?: boolean;
  onBookmark?: (e: React.MouseEvent) => void;
}

export function TrendCard({ trend, index, onClick, className = '', isBookmarked, onBookmark }: TrendCardProps) {
  const sentiment = trend.sentiment || 'Neutral';
  const sentimentClass = 
    sentiment === 'Positive' ? 'border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' :
    sentiment === 'Negative' ? 'border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]' :
    'border-white/5 hover:border-indigo-500/30';

  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      className={`group relative flex flex-col p-8 bg-stone-900/40 backdrop-blur-xl border rounded-3xl transition-all duration-300 ${sentimentClass} ${className}`}
    >
      {onBookmark && (
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={onBookmark}
          className="absolute top-6 right-6 z-10 p-2.5 bg-[#111110]/40 hover:bg-[#111110]/60 rounded-full backdrop-blur-md transition-all border border-white/10"
        >
          <Bookmark className={cn("w-4 h-4", isBookmarked ? "fill-indigo-400 text-indigo-400" : "text-white")} />
        </motion.button>
      )}
      
      <div className="flex items-start justify-between mb-auto">
        <div className="bg-indigo-500/20 text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-indigo-500/30">
          <TrendingUp className="w-3.5 h-3.5" />
          TRENDING
        </div>
        <span className="text-6xl font-black text-white/5 group-hover:text-white/10 transition-colors mr-12 -mt-2">
          {(index + 1).toString().padStart(2, '0')}
        </span>
      </div>
      
      <div className="mt-8">
        <h4 className="text-3xl font-bold text-stone-100 mb-2 flex items-center gap-2 group-hover:text-indigo-300 transition-colors line-clamp-2">
          {trend.name.startsWith('#') ? trend.name : <><Hash className="w-6 h-6 text-stone-500" />{trend.name}</>}
        </h4>
        <p className="text-base text-stone-400 mb-8">{trend.volume}</p>
        
        <div className="flex items-center justify-between pt-6 border-t border-white/5">
          <a
            href={trend.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClick}
            className="text-sm font-semibold uppercase tracking-wider text-indigo-400 group-hover:text-indigo-300 transition-colors flex items-center gap-1.5"
          >
            View on X <ExternalLink className="w-4 h-4" />
          </a>
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
    </motion.div>
  );
}
