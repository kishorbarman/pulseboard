import React, { useState } from 'react';
import { LogOut, Hash, Compass, User, RefreshCw, Loader2, Sparkles, Bookmark, X, PanelLeftClose, Download, Sun, Moon, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { logout, resetProfile, exportUserData } from '../lib/firebase';
import { useTheme } from '../lib/theme';
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

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
      onClose();
    }
  };

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 bg-[var(--th-sidebar-bg)] backdrop-blur-xl border-r border-border-primary h-screen flex flex-col transition-all duration-300 ease-in-out md:sticky md:top-0 shrink-0 overflow-hidden",
      isOpen ? "translate-x-0 w-72 md:w-64" : "-translate-x-full w-72 md:w-0 md:translate-x-0 md:border-none"
    )}>
      <div className="w-72 md:w-64 h-full flex flex-col">
        <div className="p-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent flex items-center gap-2">
            <Compass className="w-6 h-6 text-indigo-400" />
            PulseBoard
          </h1>
          <button onClick={onClose} className="p-2 text-text-tertiary hover:text-text-heading rounded-full hover:bg-[var(--th-surface-btn-overlay)] transition-colors">
            <PanelLeftClose className="w-5 h-5 hidden md:block" />
            <X className="w-5 h-5 md:hidden" />
          </button>
        </div>

        <div className="px-4 py-2 overflow-y-auto flex-1 custom-scrollbar">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 px-2">
            Your Feed
          </h2>
          <nav className="space-y-1 mb-6">
            <button
              onClick={() => handleInterestClick('For You')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                activeInterest === 'For You'
                  ? "bg-indigo-500/15 text-indigo-300"
                  : "text-text-tertiary hover:bg-[var(--th-surface-btn-overlay)] hover:text-text-primary"
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
                  : "text-text-tertiary hover:bg-[var(--th-surface-btn-overlay)] hover:text-text-primary"
              )}
            >
              <Bookmark className="w-4 h-4" />
              Saved
            </button>
          </nav>

          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 px-2">
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
                    : "text-text-tertiary hover:bg-[var(--th-surface-btn-overlay)] hover:text-text-primary"
                )}
              >
                <Hash className="w-4 h-4" />
                {interest}
              </button>
            ))}
          </nav>
        </div>

        {/* Collapsible Profile Section */}
        <div className="p-4 mt-auto border-t border-border-secondary bg-surface-base/50">
          <button
            onClick={() => setIsProfileOpen(prev => !prev)}
            className="w-full bg-[var(--th-surface-btn-overlay)] hover:bg-[var(--th-surface-btn-overlay)]/80 rounded-2xl p-3 flex items-center gap-3 border border-border-secondary transition-colors cursor-pointer"
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-9 h-9 rounded-full shrink-0" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-surface-secondary flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-text-tertiary" />
              </div>
            )}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-text-primary truncate">{user?.displayName || 'User'}</p>
              <p className="text-xs text-text-muted truncate">{user?.email}</p>
            </div>
            {isProfileOpen ? (
              <ChevronUp className="w-4 h-4 text-text-muted shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
            )}
          </button>

          <AnimatePresence>
            {isProfileOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-1 pt-3">
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-text-tertiary hover:bg-[var(--th-surface-btn-overlay)] hover:text-text-primary transition-colors"
                  >
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-text-tertiary hover:bg-[var(--th-surface-btn-overlay)] hover:text-indigo-400 transition-colors disabled:opacity-50"
                  >
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Export Data
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={isResetting}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-text-tertiary hover:bg-[var(--th-surface-btn-overlay)] hover:text-amber-400 transition-colors disabled:opacity-50"
                  >
                    {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Reset Profile
                  </button>
                  <button
                    onClick={() => handleInterestClick('About')}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-text-tertiary hover:bg-[var(--th-surface-btn-overlay)] hover:text-text-primary transition-colors"
                  >
                    <Info className="w-4 h-4" />
                    About
                  </button>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-text-tertiary hover:bg-[var(--th-surface-btn-overlay)] hover:text-rose-400 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

    </aside>
  );
}
