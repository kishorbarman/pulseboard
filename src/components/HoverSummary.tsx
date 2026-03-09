import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2, X, ArrowUp } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface HoverSummaryProps {
  text: string;
  isVisible: boolean;
  onClose: () => void;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export function HoverSummary({ text, isVisible, onClose }: HoverSummaryProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [followUp, setFollowUp] = useState('');
  const [responding, setResponding] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, responding]);

  // Reset conversation when closed
  useEffect(() => {
    if (!isVisible) {
      setMessages([]);
      setFollowUp('');
      setResponding(false);
    }
  }, [isVisible]);

  useEffect(() => {
    if (isVisible && text && messages.length === 0 && !loading) {
      const fetchSummary = async () => {
        setLoading(true);
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Provide a 2-sentence 'tl;dr' summary of the following content:\n\n${text}`,
          });
          setMessages([{ role: 'model', text: response.text || 'Failed to generate summary.' }]);
        } catch (e) {
          console.error("Failed to fetch summary", e);
          setMessages([{ role: 'model', text: 'Failed to generate summary.' }]);
        } finally {
          setLoading(false);
        }
      };
      fetchSummary();
    }
  }, [isVisible, text, messages.length, loading]);

  const sendFollowUp = async () => {
    const input = followUp.trim();
    if (!input || responding) return;

    const userMessage: ChatMessage = { role: 'user', text: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setFollowUp('');
    setResponding(true);

    try {
      const systemPrompt = `You are a helpful assistant. The user is asking about this article. Answer concisely (2-3 sentences max).\n\nARTICLE:\n${text}`;

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
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <div className="px-4 md:px-6 pb-4 pt-4 border-t border-indigo-500/20 bg-indigo-500/5">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">AI Summary</span>
              </div>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
                className="p-1 text-text-muted hover:text-text-secondary transition-colors rounded-full hover:bg-[var(--th-surface-btn-overlay)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Messages */}
            <div className="max-h-48 overflow-y-auto space-y-2">
              {loading ? (
                <div className="flex items-center gap-2 text-text-tertiary text-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating tl;dr...
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={msg.role === 'user' ? 'flex justify-end' : ''}>
                    {msg.role === 'user' ? (
                      <div className="bg-indigo-500/20 text-text-primary border border-indigo-500/30 rounded-lg rounded-br-sm px-2.5 py-1.5 text-sm max-w-[85%]">
                        {msg.text}
                      </div>
                    ) : (
                      <p className="text-sm text-text-secondary leading-relaxed">{msg.text}</p>
                    )}
                  </div>
                ))
              )}
              {responding && (
                <div className="flex items-center gap-2 text-text-tertiary text-sm">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Thinking...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Follow-up input */}
            {messages.length > 0 && !loading && (
              <div className="flex items-center gap-2 mt-3">
                <input
                  type="text"
                  value={followUp}
                  onChange={e => setFollowUp(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a follow-up..."
                  disabled={responding}
                  className="flex-1 bg-surface-secondary/50 border border-border-primary rounded-lg px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                />
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); sendFollowUp(); }}
                  disabled={!followUp.trim() || responding}
                  className="p-1.5 rounded-lg bg-indigo-500 text-white disabled:opacity-30 hover:bg-indigo-600 transition-colors shrink-0"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
