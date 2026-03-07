import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface HoverSummaryProps {
  text: string;
  isVisible: boolean;
  x: number;
  y: number;
}

export function HoverSummary({ text, isVisible, x, y }: HoverSummaryProps) {
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
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            left: Math.min(x + 20, window.innerWidth - 320), // Prevent overflow
            top: Math.min(y + 20, window.innerHeight - 150),
            zIndex: 100
          }}
          className="w-80 bg-stone-900/95 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-4 shadow-2xl pointer-events-none"
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">AI Summary</span>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-stone-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating tl;dr...
            </div>
          ) : (
            <p className="text-sm text-stone-200 leading-relaxed">
              {summary}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
