import React, { useState } from 'react';
import { motion } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useTheme } from '../lib/theme';
import { Loader2, Sparkles, Plus, X } from 'lucide-react';

const AVAILABLE_INTERESTS = [
  // Tech & Science
  "Artificial Intelligence", "Machine Learning", "Web Development", "Cybersecurity",
  "Space Exploration", "Robotics", "Data Science", "Gadgets",
  // News & Politics
  "World News", "US Politics", "Global Politics", "Economics", "Climate Change",
  // Business & Finance
  "Startups", "Cryptocurrency", "Venture Capital", "Fintech", "Stock Market",
  // Lifestyle
  "Cooking", "Fitness & Health", "Travel", "Fashion", "Photography",
  // Entertainment
  "Gaming", "Movies & TV", "Music", "Sports", "Books & Literature",
  // Creative
  "Design", "Open Source", "Productivity"
];

const MIN_TOPICS = 3;
const MAX_TOPICS = 10;

export function Onboarding({ user }: { user: any }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const { theme } = useTheme();

  const allTopics = [...AVAILABLE_INTERESTS, ...customTopics];

  const toggleInterest = (interest: string) => {
    if (selected.includes(interest)) {
      setSelected(selected.filter(i => i !== interest));
    } else {
      if (selected.length < MAX_TOPICS) {
        setSelected([...selected, interest]);
      }
    }
  };

  const addCustomTopic = () => {
    const trimmed = customTopic.trim();
    if (!trimmed) return;
    if (trimmed.length > 30) return;

    // Check for duplicates (case-insensitive)
    const lowerTrimmed = trimmed.toLowerCase();
    const isDuplicate = allTopics.some(t => t.toLowerCase() === lowerTrimmed) ||
                        selected.some(s => s.toLowerCase() === lowerTrimmed);
    if (isDuplicate) {
      setCustomTopic('');
      return;
    }

    if (selected.length >= MAX_TOPICS) return;

    setCustomTopics(prev => [...prev, trimmed]);
    setSelected(prev => [...prev, trimmed]);
    setCustomTopic('');
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomTopic();
    }
  };

  const handleSave = async () => {
    if (selected.length < MIN_TOPICS) return;
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

  // Resolve theme colors for Framer Motion animate prop
  const unselectedBg = theme === 'dark' ? 'rgba(24, 24, 27, 0.5)' : 'rgba(245, 245, 244, 0.8)';
  const unselectedBorder = theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)';
  const unselectedText = theme === 'dark' ? '#a1a1aa' : '#78716c';

  const canSave = selected.length >= MIN_TOPICS;

  return (
    <div className="min-h-screen bg-surface-base text-text-primary flex flex-col items-center justify-center p-4 md:p-6 font-sans relative overflow-hidden">
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
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-text-heading">
          What are you into?
        </h1>
        <p className="text-lg text-text-tertiary mb-10 max-w-xl mx-auto">
          Select {MIN_TOPICS}–{MAX_TOPICS} topics to personalize your PulseBoard feed. You can also add your own.
        </p>

        <div className="flex flex-wrap justify-center gap-3 md:gap-4 mb-8 max-w-3xl mx-auto">
          {allTopics.map((interest) => {
            const isSelected = selected.includes(interest);
            const isCustom = customTopics.includes(interest);
            return (
              <motion.button
                key={interest}
                onClick={() => toggleInterest(interest)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={{
                  scale: isSelected ? 1.05 : 1,
                  backgroundColor: isSelected ? '#6366f1' : unselectedBg,
                  borderColor: isSelected ? '#818cf8' : unselectedBorder,
                  color: isSelected ? '#ffffff' : unselectedText
                }}
                className="px-5 py-3 rounded-full border text-sm md:text-base font-medium transition-colors backdrop-blur-sm shadow-lg flex items-center gap-2"
              >
                {interest}
                {isCustom && isSelected && (
                  <X className="w-3.5 h-3.5 opacity-70" />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Custom topic input */}
        <div className="flex items-center justify-center gap-2 mb-10 max-w-md mx-auto">
          <input
            type="text"
            value={customTopic}
            onChange={e => setCustomTopic(e.target.value)}
            onKeyDown={handleCustomKeyDown}
            placeholder="Add a custom topic..."
            maxLength={30}
            className="flex-1 bg-surface-primary/60 backdrop-blur-md border border-border-primary rounded-full py-3 px-5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-lg"
          />
          <motion.button
            onClick={addCustomTopic}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={!customTopic.trim() || selected.length >= MAX_TOPICS}
            className="p-3 rounded-full bg-indigo-500 text-white disabled:opacity-30 hover:bg-indigo-600 transition-colors shadow-lg shrink-0"
          >
            <Plus className="w-5 h-5" />
          </motion.button>
        </div>

        <motion.button
          onClick={handleSave}
          disabled={!canSave || saving}
          whileHover={canSave ? { scale: 1.02 } : {}}
          whileTap={canSave ? { scale: 0.98 } : {}}
          className={`px-8 py-4 rounded-xl font-bold text-lg flex items-center justify-center mx-auto min-w-[200px] transition-all ${
            canSave
              ? 'bg-white text-stone-900 hover:bg-stone-100 shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)]'
              : 'bg-surface-secondary text-text-muted cursor-not-allowed'
          }`}
        >
          {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Explore'}
        </motion.button>
        <p className="text-text-muted text-sm mt-6 font-medium">
          {selected.length}/{MAX_TOPICS} selected{selected.length < MIN_TOPICS ? ` (min ${MIN_TOPICS})` : ''}
        </p>
      </motion.div>
    </div>
  );
}
