import React from 'react';
import { motion } from 'motion/react';
import { Compass, Sparkles, Zap, BookmarkCheck, Shield, ArrowLeft } from 'lucide-react';

interface AboutProps {
  onBack: () => void;
}

export function About({ onBack }: AboutProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-2xl mx-auto w-full"
    >
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-text-tertiary hover:text-text-primary transition-colors mb-8 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to feed
      </button>

      {/* Hero */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
          <Compass className="w-7 h-7 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-text-heading">PulseBoard</h1>
          <p className="text-text-muted text-sm">Your personalized content hub</p>
        </div>
      </div>

      <p className="text-text-secondary leading-relaxed mb-10 text-base">
        PulseBoard brings together news, videos, and trending topics into a single feed
        that adapts to what you care about. No algorithms you can't control — just pick
        your interests and start exploring.
      </p>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <FeatureCard
          icon={<Sparkles className="w-5 h-5" />}
          title="AI-powered feed"
          description="Click on content you like and PulseBoard learns your taste. The 'For You' feed gets smarter with every interaction."
        />
        <FeatureCard
          icon={<Zap className="w-5 h-5" />}
          title="Instant AI summaries"
          description="Summarize your entire feed or any article with one tap. Ask follow-up questions to dive deeper."
        />
        <FeatureCard
          icon={<BookmarkCheck className="w-5 h-5" />}
          title="Save & export"
          description="Bookmark articles for later. Export your full reading history and profile data as JSON anytime."
        />
        <FeatureCard
          icon={<Shield className="w-5 h-5" />}
          title="Your data, your control"
          description="Reset your profile to start fresh or export everything. No hidden tracking beyond what powers your feed."
        />
      </div>

      {/* How to use */}
      <div className="bg-surface-primary/40 backdrop-blur-xl border border-border-secondary rounded-2xl p-6 mb-10">
        <h2 className="text-sm font-semibold text-text-heading uppercase tracking-wider mb-5">How to use</h2>
        <div className="space-y-4">
          <Step number={1} text="Pick 3–10 topics during onboarding, or add your own custom interests." />
          <Step number={2} text="Browse your feed — click articles, watch videos, explore trends." />
          <Step number={3} text='Check "For You" as your personalized feed builds over time.' />
          <Step number={4} text="Tap the ✦ button for AI summaries, then ask follow-ups in the chat." />
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-text-muted text-xs pb-8">
        Built with React, Tailwind, Firebase & Gemini AI
      </p>
    </motion.div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-surface-primary/40 backdrop-blur-xl border border-border-secondary rounded-2xl p-5 flex gap-4">
      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-1">{title}</h3>
        <p className="text-xs text-text-tertiary leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function Step({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0 mt-0.5">
        {number}
      </div>
      <p className="text-sm text-text-secondary leading-relaxed">{text}</p>
    </div>
  );
}
