import React, { useState, useEffect } from 'react';
import { auth, db, signInWithGoogle, isFirebaseConfigured } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Dashboard } from './components/Dashboard';
import { Onboarding } from './components/Onboarding';
import { Loader2, Compass, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Subscribe to user document changes
        const userRef = doc(db, 'users', currentUser.uid);
        const unsubDoc = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          } else {
            setUserData(null);
          }
          setLoading(false);
        });
        return () => unsubDoc();
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center text-stone-50 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl p-8 bg-stone-900/50 border border-stone-800 rounded-3xl shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-stone-800">
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-100">Configuration Required</h1>
              <p className="text-sm text-stone-400">Firebase environment variables are missing.</p>
            </div>
          </div>
          
          <div className="space-y-4 text-sm text-stone-300">
            <p>To use PulseBoard, you need to configure Firebase authentication and Firestore.</p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">Firebase Console</a> and create a project.</li>
              <li>Enable <strong>Authentication</strong> (Google provider) and <strong>Firestore Database</strong>.</li>
              <li>Register a web app to get your Firebase config.</li>
              <li>Open the <strong>Secrets</strong> panel in AI Studio and add the following variables:</li>
            </ol>
            
            <div className="bg-stone-950 p-4 rounded-xl border border-stone-800 font-mono text-xs text-stone-400 mt-4 leading-relaxed">
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
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center text-stone-50 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md p-8 bg-stone-900/50 border border-stone-800 rounded-3xl shadow-2xl backdrop-blur-xl text-center"
        >
          <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Compass className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent mb-3">
            PulseBoard
          </h1>
          <p className="text-stone-400 mb-8">
            Your personalized dashboard for trending news, videos, and topics across the web.
          </p>
          
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white text-stone-900 px-6 py-3.5 rounded-xl font-semibold hover:bg-stone-100 transition-colors shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </motion.div>
      </div>
    );
  }

  // Wait for userData to load from Firestore
  if (!userData) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // Check if user needs to complete onboarding
  if (!userData.hasCompletedOnboarding && (!userData.interests || userData.interests.length === 0)) {
    return <Onboarding user={user} />;
  }

  return <Dashboard user={user} userData={userData} />;
}
