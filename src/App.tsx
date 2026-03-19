import React, { useState, useEffect } from 'react';
import { auth, db, signInWithGoogle, isFirebaseConfigured } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Dashboard } from './components/Dashboard';
import { Onboarding } from './components/Onboarding';
import { Loader2, Compass, AlertTriangle, Sparkles, Newspaper, CalendarDays, BookmarkCheck, Shield, Zap } from 'lucide-react';
import { motion } from 'motion/react';

const USER_CACHE_KEY = 'pulseboard:lastUserData';

function readCachedUserData() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as { uid: string; data: any; cachedAt: number };
  } catch {
    return null;
  }
}

function writeCachedUserData(uid: string, data: any) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      USER_CACHE_KEY,
      JSON.stringify({ uid, data, cachedAt: Date.now() })
    );
  } catch {
    // no-op (storage may be unavailable)
  }
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    let unsubDoc: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      // Clean up previous Firestore listener if user changed
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }

      if (currentUser) {
        const cached = readCachedUserData();
        if (cached?.uid === currentUser.uid && cached.data) {
          setUserData(cached.data);
          setLoading(false);
        }

        // Safety timeout: if Firestore doesn't respond within 5s, stop loading
        const timeout = setTimeout(() => setLoading(false), 5000);

        const userRef = doc(db, 'users', currentUser.uid);
        unsubDoc = onSnapshot(
          userRef,
          (docSnap) => {
            clearTimeout(timeout);
            if (docSnap.exists()) {
              const fresh = docSnap.data();
              setUserData(fresh);
              writeCachedUserData(currentUser.uid, fresh);
            } else {
              setUserData(null);
            }
            setLoading(false);
          },
          (error) => {
            clearTimeout(timeout);
            console.error('Firestore snapshot error', error);
            setLoading(false);
          }
        );
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubDoc) unsubDoc();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--th-accent)] animate-spin" />
      </div>
    );
  }

  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center text-text-primary p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl p-8 bg-surface-primary/50 border border-border-primary rounded-3xl shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border-primary">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
                 style={{ backgroundColor: 'var(--th-warning-bg)', borderColor: 'var(--th-warning-border)' }}>
              <AlertTriangle className="w-6 h-6 text-[var(--th-warning-text)]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-heading">Configuration Required</h1>
              <p className="text-sm text-text-tertiary">Firebase environment variables are missing.</p>
            </div>
          </div>

          <div className="space-y-4 text-sm text-text-secondary">
            <p>To use PulseBoard, you need to configure Firebase authentication and Firestore.</p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-[var(--th-accent-text)] hover:underline">Firebase Console</a> and create a project.</li>
              <li>Enable <strong>Authentication</strong> (Google provider) and <strong>Firestore Database</strong>.</li>
              <li>Register a web app to get your Firebase config.</li>
              <li>Open the <strong>Secrets</strong> panel in AI Studio and add the following variables:</li>
            </ol>

            <div className="bg-surface-base p-4 rounded-xl border border-border-primary font-mono text-xs text-text-tertiary mt-4 leading-relaxed">
              VITE_FIREBASE_API_KEY<br/>
              VITE_FIREBASE_AUTH_DOMAIN<br/>
              VITE_FIREBASE_PROJECT_ID<br/>
              VITE_FIREBASE_STORAGE_BUCKET<br/>
              VITE_FIREBASE_MESSAGING_SENDER_ID<br/>
              VITE_FIREBASE_APP_ID
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center text-text-primary p-4 md:p-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-4xl p-6 md:p-8 bg-surface-primary/55 border border-border-primary rounded-3xl shadow-2xl backdrop-blur-xl relative overflow-hidden"
        >
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-30 pointer-events-none"
               style={{ background: 'radial-gradient(circle, var(--th-accent-soft) 0%, transparent 70%)' }} />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none"
               style={{ background: 'radial-gradient(circle, var(--th-accent-soft) 0%, transparent 70%)' }} />

          <div className="relative z-10">
            <div className="flex justify-end mb-4">
              <button
                onClick={signInWithGoogle}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-stone-900 hover:bg-stone-100 transition-colors border border-border-secondary shadow-sm inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Log in to your PulseBoard
              </button>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[var(--th-accent-soft)] border border-[var(--th-accent-border)] flex items-center justify-center shrink-0">
                <Compass className="w-7 h-7 text-[var(--th-accent-text)]" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-text-heading">PulseBoard</h1>
                <p className="text-text-muted text-sm">Your personalized multi-source feed</p>
              </div>
            </div>

            <p className="text-text-secondary leading-relaxed mb-8 text-base max-w-3xl">
              PulseBoard combines high-quality news, videos, and social posts into one feed that
              adapts to your interests and behavior. It prioritizes authoritative sources, keeps
              content fresh with server-side caching, and uses AI to summarize both individual items
              and the overall feed.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              <LandingFeatureCard
                icon={<Newspaper className="w-5 h-5" />}
                title="Authoritative sources first"
                description="RSS-first ingestion with curated publisher tiers, then NewsData fallback when coverage is sparse."
              />
              <LandingFeatureCard
                icon={<Sparkles className="w-5 h-5" />}
                title="AI summaries, item to feed"
                description="Get concise AI summaries on individual cards plus an overall feed-level narrative."
              />
              <LandingFeatureCard
                icon={<Zap className="w-5 h-5" />}
                title="Relevance + personalization"
                description="Deterministic scoring, behavior signals, and Gemini reranking improve quality over time."
              />
              <LandingFeatureCard
                icon={<CalendarDays className="w-5 h-5" />}
                title="Morning Digest"
                description="Each morning, get topic snapshots and one cohesive story across your interests."
              />
              <LandingFeatureCard
                icon={<BookmarkCheck className="w-5 h-5" />}
                title="Save & export"
                description="Bookmark items for later and export your profile + history as JSON any time."
              />
              <LandingFeatureCard
                icon={<Shield className="w-5 h-5" />}
                title="Your data, your control"
                description="Reset your profile safely with confirmation and start fresh whenever needed."
              />
            </div>

            <div className="bg-surface-primary/40 backdrop-blur-xl border border-border-secondary rounded-2xl p-5 mb-6">
              <h2 className="text-sm font-semibold text-text-heading uppercase tracking-wider mb-4">How it works</h2>
              <div className="space-y-3">
                <LandingStep number={1} text="Pick your interests and optional custom topics." />
                <LandingStep number={2} text="Open For You for a diversified mix of news, videos, and social signals." />
                <LandingStep number={3} text="Use AI summaries on cards and the feed-level overview to scan fast." />
                <LandingStep number={4} text="Check Morning Digest each morning and revisit past briefs anytime." />
              </div>
            </div>

            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 bg-white text-stone-900 px-6 py-3.5 rounded-xl font-semibold hover:bg-stone-100 transition-colors shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] border border-border-secondary"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Log in to your PulseBoard
            </button>
            <p className="mt-3 text-center text-xs text-text-muted">
              Secure Google sign-in. Your feed and preferences are saved to your account.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Wait for userData to load from Firestore
  if (!userData) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--th-accent)] animate-spin" />
      </div>
    );
  }

  // Check if user needs to complete onboarding
  if (!userData.hasCompletedOnboarding && (!userData.interests || userData.interests.length === 0)) {
    return <Onboarding user={user} />;
  }

  return <Dashboard user={user} userData={userData} />;
}

function LandingFeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-surface-primary/40 backdrop-blur-xl border border-border-secondary rounded-2xl p-4 flex gap-3">
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

function LandingStep({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-6 h-6 rounded-full bg-[var(--th-accent-soft)] border border-[var(--th-accent-border)] flex items-center justify-center text-xs font-bold text-[var(--th-accent-text)] shrink-0 mt-0.5">
        {number}
      </div>
      <p className="text-sm text-text-secondary leading-relaxed">{text}</p>
    </div>
  );
}
