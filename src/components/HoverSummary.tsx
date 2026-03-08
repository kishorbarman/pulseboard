import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2, X } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface HoverSummaryProps {
  text: string;
  isVisible: boolean;
  onClose: () => void;
}

export function HoverSummary({ text, isVisible, onClose }: HoverSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isVisible && text && !summary) {
      const fetchSummary = async () => {
        setLoading(true);
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Provide a 2-sentence 'tl;dr' summary of the following content:\n\n${text}`,
          });
          setSummary(response.text);
        } catch (e) {
          console.error("Failed to fetch summary", e);
          setSummary("Failed to generate summary.");
        } finally {
          setLoading(false);
        }
      };
      fetchSummary();
    }
  }, [isVisible, text, summary]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <div className="px-6 pb-5 pt-4 border-t border-indigo-500/20 bg-indigo-500/5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">AI Summary</span>
              </div>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
                className="p-1 text-stone-500 hover:text-stone-300 transition-colors rounded-full hover:bg-white/5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-stone-400 text-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Generating tl;dr...
              </div>
            ) : (
              <p className="text-sm text-stone-300 leading-relaxed">{summary}</p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
