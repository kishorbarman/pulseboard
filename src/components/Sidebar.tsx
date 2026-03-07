import React, { useState } from 'react';
import { LogOut, Settings, Hash, Compass, Clock, User, RefreshCw, Loader2, Sparkles, Bookmark, X, PanelLeftClose, Download } from 'lucide-react';
import { auth, logout, resetProfile, exportUserData } from '../lib/firebase';
import { cn } from '../lib/utils';

interface SidebarProps {
  interests: string[];
  activeInterest: string;
  setActiveInterest: (interest: string) => void;
  user: any;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ interests, activeInterest, setActiveInterest, user, isOpen, onClose }: SidebarProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleReset = async () => {
    if (!user?.uid) return;
    setIsResetting(true);
    await resetProfile(user.uid);
    setIsResetting(false);
  };

  const handleExport = async () => {
    if (!user?.uid) return;
    setIsExporting(true);
    await exportUserData(user.uid);
    setIsExporting(false);
  };

  const handleInterestClick = (interest: string) => {
    setActiveInterest(interest);
    if (window.innerWidth < 768) {
      onClose(); // Close sidebar on mobile after selection
    }
  };

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 bg-stone-950/95 backdrop-blur-xl border-r border-white/10 h-screen flex flex-col transition-all duration-300 ease-in-out md:sticky md:top-0 shrink-0 overflow-hidden",
      isOpen ? "translate-x-0 w-72 md:w-64" : "-translate-x-full w-72 md:w-0 md:translate-x-0 md:border-none"
    )}>
      <div className="w-72 md:w-64 h-full flex flex-col">
        <div className="p-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent flex items-center gap-2">
            <Compass className="w-6 h-6 text-indigo-400" />
            PulseBoard
          </h1>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-white rounded-full hover:bg-white/5 transition-colors">
            <PanelLeftClose className="w-5 h-5 hidden md:block" />
            <X className="w-5 h-5 md:hidden" />
          </button>
        </div>

        <div className="px-4 py-2 overflow-y-auto flex-1 custom-scrollbar">
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3 px-2">
            Your Feed
          </h2>
          <nav className="space-y-1 mb-6">
            <button
              onClick={() => handleInterestClick('For You')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                activeInterest === 'For You'
                  ? "bg-indigo-500/15 text-indigo-300"
                  : "text-stone-400 hover:bg-white/5 hover:text-stone-200"
              )}
            >
              <Sparkles className="w-4 h-4" />
              For You
            </button>
            <button
              onClick={() => handleInterestClick('Saved')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                activeInterest === 'Saved'
                  ? "bg-indigo-500/15 text-indigo-300"
                  : "text-stone-400 hover:bg-white/5 hover:text-stone-200"
              )}
            >
              <Bookmark className="w-4 h-4" />
              Saved
            </button>
          </nav>

          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3 px-2">
            Your Interests
          </h2>
          <nav className="space-y-1">
            {interests.map((interest) => (
              <button
                key={interest}
                onClick={() => handleInterestClick(interest)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  activeInterest === interest
                    ? "bg-indigo-500/15 text-indigo-300"
                    : "text-stone-400 hover:bg-white/5 hover:text-stone-200"
                )}
              >
                <Hash className="w-4 h-4" />
                {interest}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 mt-auto border-t border-white/5 bg-stone-950/50">
          <div className="bg-white/5 rounded-2xl p-3 flex items-center gap-3 mb-3 border border-white/5">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-9 h-9 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-stone-800 flex items-center justify-center">
                <User className="w-4 h-4 text-stone-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-200 truncate">{user?.displayName || 'User'}</p>
              <p className="text-xs text-stone-500 truncate">{user?.email}</p>
            </div>
          </div>
          
          <div className="space-y-1">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-stone-400 hover:bg-white/5 hover:text-indigo-400 transition-colors disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export Data
            </button>
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-stone-400 hover:bg-white/5 hover:text-amber-400 transition-colors disabled:opacity-50"
            >
              {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Reset Profile
            </button>
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-stone-400 hover:bg-white/5 hover:text-rose-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
