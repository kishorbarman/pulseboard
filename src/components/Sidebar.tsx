import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, Hash, Compass, User, RefreshCw, Loader2, Sparkles, Bookmark, X, PanelLeftClose, Download, Sun, Moon, ChevronDown, ChevronUp, Info, Newspaper, Pencil, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { logout, resetProfile, exportUserData, updateUserInterests } from '../lib/firebase';
import { useTheme } from '../lib/theme';
import { cn } from '../lib/utils';
import { AVAILABLE_INTERESTS, PROFILE_MAX_TOPICS, shuffleTopics } from '../lib/topics';

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
  const [isInterestEditorOpen, setIsInterestEditorOpen] = useState(false);
  const [recommendedTopics, setRecommendedTopics] = useState<string[]>(() => shuffleTopics(AVAILABLE_INTERESTS));
  const [editableInterests, setEditableInterests] = useState<string[]>(interests);
  const [newInterest, setNewInterest] = useState('');
  const [isSavingInterests, setIsSavingInterests] = useState(false);
  const [interestError, setInterestError] = useState<string | null>(null);
  const { toggleTheme, theme } = useTheme();

  useEffect(() => {
    if (!isInterestEditorOpen) return;
    setRecommendedTopics(shuffleTopics(AVAILABLE_INTERESTS));
    setEditableInterests(interests);
    setInterestError(null);
    setNewInterest('');
  }, [interests, isInterestEditorOpen]);

  const handleReset = async () => {
    if (!user?.uid) return;
    const confirmed = window.confirm(
      "Reset your profile and personalization history? This will clear your interests, saved feed learning, and related data for this account."
    );
    if (!confirmed) return;
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

  const allTopics = [
    ...recommendedTopics,
    ...editableInterests.filter(
      (topic) => !recommendedTopics.some((recommended) => recommended.toLowerCase() === topic.toLowerCase())
    ),
  ];
  const normalizedCustomTopic = newInterest.trim().toLowerCase();
  const matchingTopics = normalizedCustomTopic
    ? allTopics.filter((topic) => topic.toLowerCase().includes(normalizedCustomTopic))
    : [];
  const hasExactExistingMatch = normalizedCustomTopic
    ? allTopics.some((topic) => topic.toLowerCase() === normalizedCustomTopic)
    : false;

  const toggleTopicSelection = (topic: string) => {
    const isSelected = editableInterests.includes(topic);
    if (isSelected) {
      if (editableInterests.length <= 1) {
        setInterestError('Keep at least one interest.');
        return;
      }
      setEditableInterests((prev) => prev.filter((item) => item !== topic));
      setInterestError(null);
      return;
    }
    if (editableInterests.length >= PROFILE_MAX_TOPICS) {
      setInterestError(`You can keep up to ${PROFILE_MAX_TOPICS} topics.`);
      return;
    }
    setEditableInterests((prev) => [...prev, topic]);
    setInterestError(null);
  };

  const addInterest = () => {
    const value = newInterest.trim();
    if (!value) return;
    const normalized = value.toLowerCase();
    if (allTopics.some((interest) => interest.toLowerCase() === normalized)) {
      setInterestError('That topic already exists.');
      return;
    }
    if (editableInterests.length >= PROFILE_MAX_TOPICS) {
      setInterestError(`You can keep up to ${PROFILE_MAX_TOPICS} topics.`);
      return;
    }
    setEditableInterests((prev) => [...prev, value]);
    setNewInterest('');
    setInterestError(null);
  };

  const saveInterests = async () => {
    if (!user?.uid) return;
    const cleaned = editableInterests.map((i) => i.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      setInterestError('Keep at least one interest.');
      return;
    }

    setIsSavingInterests(true);
    setInterestError(null);
    const updated = await updateUserInterests(user.uid, cleaned);
    if (!updated) {
      setInterestError('Could not save topics. Please try again.');
      setIsSavingInterests(false);
      return;
    }

    if (!cleaned.includes(activeInterest)) {
      setActiveInterest('For You');
    }

    try {
      await fetch('/api/prewarm-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interests: cleaned }),
      });
    } catch (error) {
      console.warn('Prewarm failed after updating interests:', error);
    }

    setIsInterestEditorOpen(false);
    setIsSavingInterests(false);
  };

  return (
    <>
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 bg-[var(--th-sidebar-bg)] backdrop-blur-xl border-r border-border-primary h-screen flex flex-col transition-all duration-300 ease-in-out md:sticky md:top-0 shrink-0 overflow-hidden",
      isOpen ? "translate-x-0 w-72 md:w-64" : "-translate-x-full w-72 md:w-0 md:translate-x-0 md:border-none"
    )}>
      <div className="w-72 md:w-64 h-full flex flex-col">
        <div className="p-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--th-accent-text)] flex items-center gap-2">
            <Compass className="w-6 h-6 text-[var(--th-accent)]" />
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
                  ? "bg-[var(--th-accent-soft)] text-[var(--th-accent-text)]"
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
                  ? "bg-[var(--th-accent-soft)] text-[var(--th-accent-text)]"
                  : "text-text-tertiary hover:bg-[var(--th-surface-btn-overlay)] hover:text-text-primary"
              )}
            >
              <Bookmark className="w-4 h-4" />
              Saved
            </button>
            <button
              onClick={() => handleInterestClick('Morning Digest')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                activeInterest === 'Morning Digest'
                  ? "bg-[var(--th-accent-soft)] text-[var(--th-accent-text)]"
                  : "text-text-tertiary hover:bg-[var(--th-surface-btn-overlay)] hover:text-text-primary"
              )}
            >
              <Newspaper className="w-4 h-4" />
              Morning Digest
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
                    ? "bg-[var(--th-accent-soft)] text-[var(--th-accent-text)]"
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
              <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
            ) : (
              <ChevronUp className="w-4 h-4 text-text-muted shrink-0" />
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
                    onClick={() => setIsInterestEditorOpen(true)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-text-tertiary hover:bg-[var(--th-surface-btn-overlay)] hover:text-text-primary transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit Topics
                  </button>
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
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-text-tertiary hover:bg-[var(--th-surface-btn-overlay)] hover:text-[var(--th-accent-text)] transition-colors disabled:opacity-50"
                  >
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Export Data
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={isResetting}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-text-tertiary hover:bg-[var(--th-surface-btn-overlay)] hover:text-[var(--th-warning-text)] transition-colors disabled:opacity-50"
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
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-text-tertiary hover:bg-[var(--th-surface-btn-overlay)] hover:text-[var(--th-danger-text)] transition-colors"
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
    {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {isInterestEditorOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] bg-surface-base/90 backdrop-blur-xl"
          >
            <div className="h-full w-full overflow-y-auto p-4 md:p-8">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="max-w-5xl mx-auto bg-surface-primary/70 border border-border-primary rounded-3xl p-5 md:p-8 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-1">Edit Interests</p>
                    <h2 className="text-2xl font-bold text-text-heading">Tune your PulseBoard topics</h2>
                    <p className="text-sm text-text-secondary mt-2">
                      Select from the full recommended catalog or add a custom topic.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsInterestEditorOpen(false)}
                    className="p-2 rounded-full text-text-tertiary hover:text-text-primary hover:bg-[var(--th-surface-btn-overlay)] transition-colors"
                    aria-label="Close topic editor"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 mb-4">
                  <p className="text-sm text-text-secondary">
                    {editableInterests.length}/{PROFILE_MAX_TOPICS} selected
                  </p>
                  <div className="flex flex-wrap gap-2 justify-end">
                    {editableInterests.slice(0, 6).map((interest) => (
                      <span key={interest} className="px-2.5 py-1 rounded-full text-xs bg-[var(--th-accent-soft)] text-[var(--th-accent-text)] border border-[var(--th-accent-border)]">
                        {interest}
                      </span>
                    ))}
                    {editableInterests.length > 6 && (
                      <span className="px-2.5 py-1 rounded-full text-xs bg-surface-base/70 text-text-muted border border-border-secondary">
                        +{editableInterests.length - 6}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-6">
                  <input
                    type="text"
                    value={newInterest}
                    onChange={(e) => setNewInterest(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (!hasExactExistingMatch) addInterest();
                      }
                    }}
                    placeholder="Search recommended topics or add a custom one..."
                    maxLength={40}
                    className="flex-1 bg-surface-primary/60 backdrop-blur-md border border-border-primary rounded-full py-3 px-5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[var(--th-focus-ring)] transition-all shadow-lg"
                  />
                  <button
                    type="button"
                    onClick={addInterest}
                    disabled={!newInterest.trim() || hasExactExistingMatch || editableInterests.length >= PROFILE_MAX_TOPICS}
                    className="p-3 rounded-full bg-[var(--th-accent)] text-white disabled:opacity-30 hover:bg-[var(--th-accent-strong)] transition-colors shadow-lg shrink-0"
                    aria-label="Add topic"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 md:gap-3">
                  {allTopics.map((topic) => {
                    const isSelected = editableInterests.includes(topic);
                    const isMatch = matchingTopics.includes(topic);
                    return (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => toggleTopicSelection(topic)}
                        className={cn(
                          "px-4 py-2.5 rounded-full border text-sm font-medium transition-colors",
                          isSelected
                            ? "bg-[var(--th-accent)] text-white border-[var(--th-accent-strong)]"
                            : isMatch
                              ? "bg-[var(--th-accent-soft)] text-[var(--th-accent-text)] border-[var(--th-accent-border)]"
                              : "bg-surface-primary/50 text-text-tertiary border-border-secondary hover:bg-[var(--th-surface-btn-overlay)] hover:text-text-primary"
                        )}
                      >
                        {topic}
                      </button>
                    );
                  })}
                </div>

                {interestError && (
                  <p className="mt-4 text-sm text-[var(--th-warning-text)]">{interestError}</p>
                )}

                <div className="mt-7 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsInterestEditorOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-text-tertiary hover:text-text-primary hover:bg-[var(--th-surface-btn-overlay)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveInterests}
                    disabled={isSavingInterests}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[var(--th-accent)] text-white border border-[var(--th-accent-strong)] disabled:opacity-60 hover:bg-[var(--th-accent-strong)] transition-colors"
                  >
                    {isSavingInterests ? 'Saving...' : 'Save Topics'}
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </>
  );
}
