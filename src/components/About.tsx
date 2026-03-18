import React from 'react';
import { motion } from 'motion/react';
import { Compass, Sparkles, Zap, BookmarkCheck, Shield, ArrowLeft, Newspaper, CalendarDays } from 'lucide-react';

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
        <div className="w-14 h-14 rounded-2xl bg-[var(--th-accent-soft)] border border-[var(--th-accent-border)] flex items-center justify-center shrink-0">
          <Compass className="w-7 h-7 text-[var(--th-accent-text)]" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-text-heading">PulseBoard</h1>
          <p className="text-text-muted text-sm">Your personalized multi-source feed</p>
        </div>
      </div>

      <p className="text-text-secondary leading-relaxed mb-10 text-base">
        PulseBoard combines high-quality news, videos, and social posts into one feed that
        adapts to your interests and behavior. It prioritizes authoritative sources, keeps
        content fresh with server-side caching, and helps you quickly understand what matters now
        and each morning.
      </p>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <FeatureCard
          icon={<Newspaper className="w-5 h-5" />}
          title="Authoritative sources first"
          description="RSS-first ingestion with curated publisher tiers, then NewsData fallback when coverage is sparse."
        />
        <FeatureCard
          icon={<Sparkles className="w-5 h-5" />}
          title="Relevance + personalization ranking"
          description="Deterministic scoring, personalization signals, and Gemini reranking combine to improve feed quality."
        />
        <FeatureCard
          icon={<Zap className="w-5 h-5" />}
          title="Concise AI Insights"
          description="For You opens with a compact cross-feed summary, with optional per-interest drill-down and follow-up chat."
        />
        <FeatureCard
          icon={<CalendarDays className="w-5 h-5" />}
          title="Daily Brief"
          description="Every morning, PulseBoard creates a structured digest with detailed topic snapshots and a cohesive overview story."
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
          <Step number={2} text="Open For You to see a diversified mix of news, videos, and social posts across your interests." />
          <Step number={3} text="Use Daily Brief from the sidebar for a morning digest and revisit past briefs from history anytime." />
          <Step number={4} text="Use AI Insights for a quick overall summary, then expand by interest if you want deeper context." />
          <Step number={5} text="Save useful items, export your data anytime, and reset profile safely with confirmation when needed." />
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-text-muted text-xs pb-8">
        Built with React, Tailwind, Firebase, and Gemini
      </p>
    </motion.div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-surface-primary/40 backdrop-blur-xl border border-border-secondary rounded-2xl p-5 flex gap-4">
      <div className="w-10 h-10 rounded-xl bg-[var(--th-accent-soft)] border border-[var(--th-accent-border)] flex items-center justify-center text-[var(--th-accent-text)] shrink-0">
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
      <div className="w-6 h-6 rounded-full bg-[var(--th-accent-soft)] border border-[var(--th-accent-border)] flex items-center justify-center text-xs font-bold text-[var(--th-accent-text)] shrink-0 mt-0.5">
        {number}
      </div>
      <p className="text-sm text-text-secondary leading-relaxed">{text}</p>
    </div>
  );
}
