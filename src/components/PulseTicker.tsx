import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Play } from 'lucide-react';

interface PulseTickerProps {
  trends: any[];
  videos: any[];
}

export function PulseTicker({ trends, videos }: PulseTickerProps) {
  if (!trends.length && !videos.length) return null;

  // Combine and shuffle items for the ticker
  const items = [
    ...trends.map(t => ({ type: 'trend', text: t.name, url: t.url })),
    ...videos.map(v => ({ type: 'video', text: v.snippet?.title, url: `https://youtube.com/watch?v=${v.id?.videoId || v.id}` }))
  ].filter(i => i.text).sort(() => Math.random() - 0.5).slice(0, 10); // Take 10 random items

  if (items.length === 0) return null;

  return (
    <div className="relative w-full h-10 bg-[var(--th-ticker-bg)] backdrop-blur-md border-b border-border-secondary overflow-hidden flex items-center z-40">
      {/* Left Blur */}
      <div className="absolute left-0 top-0 bottom-0 w-10 md:w-16 bg-gradient-to-r from-[var(--th-ticker-fade)] to-transparent z-10 pointer-events-none" />

      {/* Marquee Container */}
      <div className="flex whitespace-nowrap animate-marquee">
        {/* Duplicate items to create seamless loop */}
        {[...items, ...items].map((item, idx) => (
          <a
            key={`${idx}-${item.text}`}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 text-sm font-medium text-text-tertiary hover:text-indigo-400 transition-colors"
          >
            {item.type === 'trend' ? (
              <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
            ) : (
              <Play className="w-3.5 h-3.5 text-red-500" />
            )}
            <span className="truncate max-w-[300px]">{item.text}</span>
            <span className="mx-4 text-text-muted">&bull;</span>
          </a>
        ))}
      </div>

      {/* Right Blur */}
      <div className="absolute right-0 top-0 bottom-0 w-10 md:w-16 bg-gradient-to-l from-[var(--th-ticker-fade)] to-transparent z-10 pointer-events-none" />
    </div>
  );
}
