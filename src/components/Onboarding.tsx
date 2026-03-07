import React, { useState } from 'react';
import { motion } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Loader2, Sparkles } from 'lucide-react';

const AVAILABLE_INTERESTS = [
  "Artificial Intelligence", "Startups", "Space Exploration", "Cryptocurrency",
  "Web Development", "Machine Learning", "Gadgets", "Cybersecurity",
  "Venture Capital", "Gaming", "Esports", "Mobile Apps",
  "Robotics", "Virtual Reality", "Data Science", "Cloud Computing",
  "SaaS", "Biotech", "Fintech", "Open Source", "Design", "Productivity"
];

export function Onboarding({ user }: { user: any }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleInterest = (interest: string) => {
    if (selected.includes(interest)) {
      setSelected(selected.filter(i => i !== interest));
    } else {
      if (selected.length < 5) {
        setSelected([...selected, interest]);
      }
    }
  };

  const handleSave = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        interests: selected,
        hasCompletedOnboarding: true
      });
    } catch (error) {
      console.error("Error saving interests:", error);
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-stone-50 flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full z-10 text-center"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-8">
          <Sparkles className="w-8 h-8 text-indigo-400" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-stone-100">
          What are you into?
        </h1>
        <p className="text-lg text-stone-400 mb-12 max-w-xl mx-auto">
          Select up to 5 topics to personalize your PulseBoard feed. We'll use this to curate your news, videos, and trends.
        </p>

        <div className="flex flex-wrap justify-center gap-3 md:gap-4 mb-12 max-w-3xl mx-auto">
          {AVAILABLE_INTERESTS.map((interest) => {
            const isSelected = selected.includes(interest);
            return (
              <motion.button
                key={interest}
                onClick={() => toggleInterest(interest)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={{
                  scale: isSelected ? 1.05 : 1,
                  backgroundColor: isSelected ? '#6366f1' : 'rgba(24, 24, 27, 0.5)',
                  borderColor: isSelected ? '#818cf8' : 'rgba(255, 255, 255, 0.05)',
                  color: isSelected ? '#ffffff' : '#a1a1aa'
                }}
                className={`px-5 py-3 rounded-full border text-sm md:text-base font-medium transition-colors backdrop-blur-sm shadow-lg`}
              >
                {interest}
              </motion.button>
            );
          })}
        </div>

        <motion.button
          onClick={handleSave}
          disabled={selected.length === 0 || saving}
          whileHover={selected.length > 0 ? { scale: 1.02 } : {}}
          whileTap={selected.length > 0 ? { scale: 0.98 } : {}}
          className={`px-8 py-4 rounded-xl font-bold text-lg flex items-center justify-center mx-auto min-w-[200px] transition-all ${
            selected.length > 0
              ? 'bg-white text-stone-900 hover:bg-stone-100 shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)]'
              : 'bg-stone-800 text-stone-500 cursor-not-allowed'
          }`}
        >
          {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Explore'}
        </motion.button>
        <p className="text-stone-500 text-sm mt-6 font-medium">
          {selected.length}/5 selected
        </p>
      </motion.div>
    </div>
  );
}
