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
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export function AIPulse({ news, videos, trends, activeInterest, trendContext }: AIPulseProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [followUp, setFollowUp] = useState('');
  const [responding, setResponding] = useState(false);
  const cachedInterestRef = useRef<string>('');
  const contentRef = useRef<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasContent = news.length > 0 || videos.length > 0 || trends.length > 0;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, responding]);

  // Clear conversation when interest changes
  useEffect(() => {
    if (activeInterest !== cachedInterestRef.current) {
      setMessages([]);
      contentRef.current = '';
      cachedInterestRef.current = activeInterest;
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

  const generateSummary = async () => {
    if (loading || !hasContent) return;
    if (messages.length > 0 && cachedInterestRef.current === activeInterest) {
      setIsOpen(true);
      return;
    }

    // If we already have a precomputed trend context, show it instantly
    if (trendContext) {
      contentRef.current = buildContentString();
      setMessages([{ role: 'model', text: trendContext }]);
      cachedInterestRef.current = activeInterest;
      setIsOpen(true);
      return;
    }

    // Otherwise fall back to generating a summary via Gemini
    setIsOpen(true);
    setLoading(true);
    setMessages([]);

    try {
      const content = buildContentString();
      contentRef.current = content;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are a news analyst. Summarize the following content in 3-4 concise bullet points covering the key themes and highlights. Use plain text with bullet points (•). Be crisp and insightful.\n\n${content}`,
      });

      const text = response.text || 'Could not generate summary.';
      setMessages([{ role: 'model', text }]);
      cachedInterestRef.current = activeInterest;
    } catch (e) {
      console.error('Failed to generate page summary', e);
      setMessages([{ role: 'model', text: 'Failed to generate summary. Please try again.' }]);
    } finally {
      setLoading(false);
    }
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
      const systemPrompt = `You are a news analyst assistant. The user is asking about the following content feed. Answer concisely (2-3 sentences max).\n\nCONTENT:\n${contentRef.current}`;

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

  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 flex flex-col items-end gap-4">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="bg-surface-primary/95 backdrop-blur-xl border border-indigo-500/30 rounded-2xl shadow-2xl w-80 max-w-[calc(100vw-2rem)] max-h-[60vh] flex flex-col text-sm text-text-secondary"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-indigo-400 uppercase tracking-wider text-xs">Page Summary</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-text-muted hover:text-text-secondary transition-colors rounded-full hover:bg-[var(--th-surface-btn-overlay)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-3 min-h-0">
              {loading ? (
                <div className="flex items-center gap-2 text-text-tertiary py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing {news.length + videos.length + trends.length} items...
                </div>
              ) : messages.length > 0 ? (
                messages.map((msg, i) => (
                  <div key={i} className={msg.role === 'user' ? 'flex justify-end' : ''}>
                    {msg.role === 'user' ? (
                      <div className="bg-indigo-500/20 text-text-primary border border-indigo-500/30 rounded-xl rounded-br-sm px-3 py-2 max-w-[85%]">
                        {msg.text}
                      </div>
                    ) : (
                      <div className="text-text-secondary leading-relaxed whitespace-pre-line">
                        {msg.text}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-text-muted">Click to generate a summary of the current feed.</p>
              )}
              {responding && (
                <div className="flex items-center gap-2 text-text-tertiary">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Thinking...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Follow-up input */}
            {messages.length > 0 && !loading && (
              <div className="px-4 pb-4 pt-2 border-t border-border-secondary shrink-0">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={followUp}
                    onChange={e => setFollowUp(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a follow-up..."
                    disabled={responding}
                    className="flex-1 bg-surface-secondary/50 border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50"
                  />
                  <button
                    onClick={sendFollowUp}
                    disabled={!followUp.trim() || responding}
                    className="p-2 rounded-lg bg-indigo-500 text-white disabled:opacity-30 hover:bg-indigo-600 transition-colors shrink-0"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        onClick={generateSummary}
        disabled={!hasContent}
        className={`relative flex items-center gap-3 rounded-2xl bg-surface-primary/90 backdrop-blur-xl border border-indigo-500/30 shadow-lg shadow-indigo-500/10 transition-colors disabled:opacity-40 hover:border-indigo-500/50 ${
          trendContext && !isOpen ? 'px-4 py-3 max-w-xs md:max-w-sm' : 'px-4 py-2.5'
        }`}
      >
        {loading && (
          <motion.div
            className="absolute inset-0 rounded-2xl border-2 border-indigo-400"
            animate={{ scale: [1, 1.02], opacity: [1, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500 shrink-0">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <Sparkles className="w-4 h-4 text-white" />
          )}
        </div>
        {trendContext && !isOpen ? (
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-0.5">AI Insights</p>
            <p className="text-sm text-text-primary leading-snug line-clamp-2">{trendContext}</p>
          </div>
        ) : (
          <span className="text-sm font-medium text-text-primary">{loading ? 'Summarizing...' : 'Summarize feed'}</span>
        )}
      </motion.button>
    </div>
  );
}
