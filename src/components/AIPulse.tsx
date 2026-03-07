import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';

export function AIPulse() {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Simulate periodic learning updates
  useEffect(() => {
    const interval = setInterval(() => {
      setIsUpdating(true);
      setTimeout(() => setIsUpdating(false), 2000);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="bg-stone-900/90 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-4 shadow-2xl w-64 text-sm text-stone-200"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="font-bold text-indigo-400 uppercase tracking-wider text-xs">AI Thought</span>
            </div>
            <p>Curating more content based on your recent interactions to refine your personalized feed.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-12 h-12 rounded-full flex items-center justify-center bg-stone-900 border transition-colors shadow-xl ${
          isUpdating ? 'border-indigo-500' : 'border-white/10'
        }`}
      >
        {isUpdating && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-indigo-500"
            animate={{ scale: [1, 1.5], opacity: [1, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
        <Sparkles className={`w-5 h-5 ${isUpdating ? 'text-indigo-400' : 'text-stone-400'}`} />
      </motion.button>
    </div>
  );
}
