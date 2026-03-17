import React, { useEffect, useRef, useState } from 'react';
import { Bookmark, Ellipsis, Radio } from 'lucide-react';
import { cn } from '../lib/utils';

interface SourceMenuProps {
  source: string;
  className?: string;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
}

export function SourceMenu({ source, className = '', isBookmarked = false, onToggleBookmark }: SourceMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  return (
    <div ref={rootRef} className={`absolute z-50 ${className}`}>
      <button
        type="button"
        aria-label="Open source menu"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-2.5 bg-[var(--th-surface-overlay)] hover:bg-[var(--th-surface-overlay-heavy)] rounded-full backdrop-blur-md transition-all border border-border-primary"
      >
        <Ellipsis className="w-4 h-4 text-text-heading" />
      </button>

      {open && (
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="absolute top-12 right-0 z-50 min-w-40 rounded-xl border border-border-primary bg-surface-primary/95 backdrop-blur-md p-3 shadow-xl"
        >
          <p className="text-[11px] uppercase tracking-wider text-text-muted mb-2">Source</p>
          <div className="inline-flex items-center gap-1.5 text-xs text-text-primary bg-surface-secondary/60 rounded-full px-2.5 py-1 border border-border-secondary">
            <Radio className="w-3 h-3" />
            {source}
          </div>
          {onToggleBookmark && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleBookmark();
                setOpen(false);
              }}
              className="mt-3 w-full flex items-center gap-2 rounded-lg border border-border-secondary bg-surface-secondary/40 px-3 py-2 text-xs text-text-primary hover:bg-surface-secondary/70 transition-colors"
            >
              <Bookmark className={cn("w-3.5 h-3.5", isBookmarked && "fill-[var(--th-accent)] text-[var(--th-accent)]")} />
              {isBookmarked ? 'Remove Save' : 'Save'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
