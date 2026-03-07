import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string | null;
}

export function VideoModal({ isOpen, onClose, videoId }: VideoModalProps) {
  return (
    <AnimatePresence>
      {isOpen && videoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#111110]/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-5xl aspect-video bg-stone-950 rounded-2xl overflow-hidden shadow-2xl border border-white/10 z-10"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-10 h-10 bg-[#111110]/50 hover:bg-[#111110]/80 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-colors z-20"
            >
              <X className="w-5 h-5" />
            </button>
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0"
            ></iframe>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
