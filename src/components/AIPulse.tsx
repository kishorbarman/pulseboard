import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2, X, ArrowUp } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface AIPulseProps {
  news: any[];
  videos: any[];
  trends: any[];
  activeInterest: string;
  trendContext?: string;
  interestSummaries?: Record<string, string>;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export function AIPulse({ news, videos, trends, activeInterest, trendContext, interestSummaries = {} }: AIPulseProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [followUp, setFollowUp] = useState('');
  const [responding, setResponding] = useState(false);
  const [showByInterest, setShowByInterest] = useState(false);
  const cachedInterestRef = useRef<string>('');
  const contentRef = useRef<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Auto-scroll only for follow-up chat (not on first open)
  useEffect(() => {
    if (messages.length <= 1 && !responding) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, responding]);

  // Clear conversation when interest changes
  useEffect(() => {
    if (activeInterest !== cachedInterestRef.current) {
      setMessages([]);
      setIsOpen(false);
      contentRef.current = '';
      cachedInterestRef.current = activeInterest;
      setShowByInterest(false);
    }
  }, [activeInterest]);

  const buildContentString = () => {
    const parts: string[] = [];
    if (news.length > 0) {
      parts.push('NEWS ARTICLES:\n' + news.map(a => `- ${a.title}${a.description ? ': ' + a.description : ''}`).join('\n'));
    }
    if (videos.length > 0) {
      parts.push('VIDEOS:\n' + videos.map(v => `- ${v.snippet?.title || ''}${v.snippet?.description ? ': ' + v.snippet.description : ''}`).join('\n'));
    }
    if (trends.length > 0) {
      parts.push('TRENDING TOPICS:\n' + trends.map(t => `- ${t.name} (${t.volume})`).join('\n'));
    }
    return parts.join('\n\n');
  };

  const openInsights = () => {
    if (!trendContext) return;

    // Already have messages for this interest — just re-open
    if (messages.length > 0) {
      setIsOpen(true);
      requestAnimationFrame(() => {
        bodyRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      });
      return;
    }

    // First open — populate with precomputed summary
    contentRef.current = buildContentString();
    setMessages([{ role: 'model', text: trendContext }]);
    setIsOpen(true);
    requestAnimationFrame(() => {
      bodyRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    });
  };

  const sendFollowUp = async () => {
    const text = followUp.trim();
    if (!text || responding) return;

    const userMessage: ChatMessage = { role: 'user', text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setFollowUp('');
    setResponding(true);

    try {
      const systemPrompt = `You are a news analyst assistant. The user is asking about the following content feed.

Answer in 3-4 concise sentences:
- Sentence 1: direct answer
- Sentence 2: key evidence/examples from the feed
- Sentence 3: why it matters now
- Optional sentence 4: what to watch next

CONTENT:
${contentRef.current}`;

      const contents = [
        { role: 'user' as const, parts: [{ text: systemPrompt }] },
        ...updatedMessages.map(m => ({
          role: m.role === 'model' ? 'model' as const : 'user' as const,
          parts: [{ text: m.text }]
        })),
      ];

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents,
      });

      setMessages(prev => [...prev, { role: 'model', text: response.text || 'No response.' }]);
    } catch (e) {
      console.error('Follow-up failed', e);
      setMessages(prev => [...prev, { role: 'model', text: 'Failed to respond. Please try again.' }]);
    } finally {
      setResponding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendFollowUp();
    }
  };

  const topicEntries = Object.entries(interestSummaries);
  const leadMessage = messages[0]?.role === 'model' ? messages[0].text : '';
  const followUpMessages = leadMessage ? messages.slice(1) : messages;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col items-center gap-3 px-0 pb-4 md:pb-6 pointer-events-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="pointer-events-auto bg-surface-primary/95 backdrop-blur-xl border border-[var(--th-accent-border)] rounded-t-3xl rounded-b-none shadow-2xl w-full max-h-[92dvh] flex flex-col text-sm text-text-secondary border-x-0 border-b-0"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--th-accent-text)]" />
                <span className="font-bold text-[var(--th-accent-text)] uppercase tracking-wider text-xs">AI Insights</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-text-muted hover:text-text-secondary transition-colors rounded-full hover:bg-[var(--th-surface-btn-overlay)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div ref={bodyRef} className="flex-1 overflow-y-auto px-4 pb-3 space-y-3 min-h-0">
              {leadMessage && (
                <div className="rounded-xl border border-[var(--th-accent-border)] bg-[var(--th-accent-soft)] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--th-accent-text)] mb-1">Overall Brief</p>
                  <div className="text-text-secondary leading-relaxed whitespace-pre-line">{leadMessage}</div>
                </div>
              )}

              {activeInterest === 'For You' && topicEntries.length > 0 && (
                <div className="rounded-xl border border-border-secondary bg-surface-secondary/30 p-3">
                  <p className="text-xs font-semibold text-text-primary mb-2">By Interest</p>
                  <div className="space-y-2">
                    {topicEntries.map(([interest, summary]) => (
                      <details key={interest} open={showByInterest} className="rounded-lg border border-border-secondary bg-surface-primary/50 px-3 py-2">
                        <summary className="cursor-pointer text-xs font-semibold text-text-primary">{interest}</summary>
                        <p className="mt-2 text-xs text-text-secondary whitespace-pre-line leading-relaxed">{summary}</p>
                      </details>
                    ))}
                  </div>
                </div>
              )}

              {followUpMessages.map((msg, i) => (
                <div key={`chat-${i}`} className={msg.role === 'user' ? 'flex justify-end' : ''}>
                  {msg.role === 'user' ? (
                    <div className="bg-[var(--th-accent-soft)] text-text-primary border border-[var(--th-accent-border)] rounded-xl rounded-br-sm px-3 py-2 max-w-[85%]">
                      {msg.text}
                    </div>
                  ) : (
                    <div className="text-text-secondary leading-relaxed whitespace-pre-line">
                      {msg.text}
                    </div>
                  )}
                </div>
              ))}

              {responding && (
                <div className="flex items-center gap-2 text-text-tertiary">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Thinking...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Follow-up input */}
            {messages.length > 0 && (
              <div className="px-4 pb-4 pt-2 border-t border-border-secondary shrink-0">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={followUp}
                    onChange={e => setFollowUp(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a follow-up..."
                    disabled={responding}
                    className="flex-1 bg-surface-secondary/50 border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-[var(--th-focus-ring)] disabled:opacity-50"
                  />
                  <button
                    onClick={sendFollowUp}
                    disabled={!followUp.trim() || responding}
                    className="p-2 rounded-lg bg-[var(--th-accent)] text-white disabled:opacity-30 hover:bg-[var(--th-accent-strong)] transition-colors shrink-0"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!isOpen && (
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={openInsights}
          disabled={!trendContext}
          className={`pointer-events-auto self-end mr-4 md:mr-6 relative flex items-center gap-2 md:gap-3 rounded-2xl bg-surface-primary/90 backdrop-blur-xl border border-[var(--th-accent-border)] shadow-lg transition-colors disabled:opacity-40 hover:border-[var(--th-accent)] px-3 py-2 md:py-3 ${
            trendContext ? 'md:px-4 md:max-w-sm' : 'md:px-4'
          }`}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--th-accent)] shrink-0">
            {!trendContext ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Sparkles className="w-4 h-4 text-white" />
            )}
          </div>
          <span className="text-sm font-semibold text-[var(--th-accent-text)] md:hidden">{trendContext ? 'Insights' : 'Loading...'}</span>
          {trendContext ? (
            <div className="hidden md:block flex-1 min-w-0 text-left">
              <p className="text-xs font-semibold text-[var(--th-accent-text)] uppercase tracking-wider mb-0.5">AI Insights</p>
              <p className="text-sm text-text-primary leading-snug line-clamp-2">{trendContext}</p>
            </div>
          ) : (
            <span className="hidden md:inline text-sm font-medium text-text-muted">Loading insights...</span>
          )}
        </motion.button>
      )}
    </div>
  );
}
