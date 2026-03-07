import React, { useState, useRef } from 'react';
import { Play, Bookmark, Clock, Youtube } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { HoverSummary } from './HoverSummary';

interface VideoCardProps {
  key?: React.Key;
  video: any;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
  isBookmarked?: boolean;
  onBookmark?: (e: React.MouseEvent) => void;
}

export function VideoCard({ video, onClick, className = '', isBookmarked, onBookmark }: VideoCardProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovering(true);
    }, 2000); // 2 seconds delay
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isHovering) {
      setMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovering(false);
  };

  const sentiment = video.sentiment || 'Neutral';
  const sentimentClass = 
    sentiment === 'Positive' ? 'border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' :
    sentiment === 'Negative' ? 'border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]' :
    'border-white/5';

  return (
    <>
      <motion.button
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.97 }}
        className={`group relative overflow-hidden rounded-3xl border bg-stone-900 text-left flex flex-col transition-all duration-300 ${sentimentClass} ${className}`}
      >
        <div className="relative h-48 shrink-0 overflow-hidden">
          <img
            src={video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url}
            alt={video.snippet.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-[#111110]/20 group-hover:bg-[#111110]/40 transition-colors flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-red-500/90 flex items-center justify-center backdrop-blur-sm shadow-lg transform transition-transform duration-300 group-hover:scale-110">
              <Play className="w-5 h-5 text-white ml-1" />
            </div>
          </div>
          
          {onBookmark && (
            <motion.div 
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onBookmark(e);
              }}
              className="absolute top-4 right-4 z-10 p-2.5 bg-[#111110]/40 hover:bg-[#111110]/60 rounded-full backdrop-blur-md transition-all border border-white/10"
            >
              <Bookmark className={cn("w-4 h-4", isBookmarked ? "fill-indigo-400 text-indigo-400" : "text-white")} />
            </motion.div>
          )}
        </div>
        
        <div className="p-6 flex flex-col flex-1 bg-stone-900/90 backdrop-blur-xl relative z-20 -mt-12 rounded-t-3xl border-t border-white/5">
          <div className="flex items-center gap-3 text-xs text-stone-400 mb-3">
            <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5">
              <Youtube className="w-3.5 h-3.5" />
              YouTube
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-stone-600"></span>
              <span className="truncate max-w-[120px]">{video.snippet.channelTitle}</span>
            </span>
            {video.snippet.publishedAt && (
              <span className="flex items-center gap-1.5 ml-auto">
                <Clock className="w-3.5 h-3.5" />
                {formatDistanceToNow(new Date(video.snippet.publishedAt), { addSuffix: true })}
              </span>
            )}
          </div>
          
          <h3 className="text-xl font-bold text-stone-100 leading-snug mb-3 group-hover:text-indigo-300 transition-colors line-clamp-2">
            {video.snippet.title}
          </h3>
          
          {video.snippet.description && (
            <p className="text-sm text-stone-400 line-clamp-3 mb-4 flex-1">
              {video.snippet.description}
            </p>
          )}
          
          <div className="mt-auto flex items-center justify-between pt-4 border-t border-white/5">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 group-hover:text-indigo-300 transition-colors flex items-center gap-1">
              Watch Video <Play className="w-3 h-3" />
            </span>
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
      </motion.button>
      
      <HoverSummary 
        text={video.snippet.title + (video.snippet.description ? `\n\n${video.snippet.description}` : '')} 
        isVisible={isHovering} 
        x={mousePos.x} 
        y={mousePos.y} 
      />
    </>
  );
}
