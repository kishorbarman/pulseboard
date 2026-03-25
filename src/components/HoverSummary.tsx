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
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollParentRef = useRef<Element | null>(null);
  const savedScrollRef = useRef<number>(0);

  const normalizeBulletLines = (input: string): string => {
    const raw = String(input || '').trim();
    if (!raw) return raw;
    const normalized = raw
      .replace(/\r/g, '')
      .replace(/\s*[•*-]\s+/g, '\n• ')
      .replace(/^\n+/, '')
      .trim();

    const chunks = normalized
      .split(/\n+/)
      .map((line) => line.replace(/^[•*-]\s*/, '').trim())
      .filter(Boolean);

    const sentenceOnly = (text: string): string => {
      const first = text.match(/(.+?[.!?])(?:\s|$)/)?.[1] || text;
      const cleaned = first.trim().replace(/\s+/g, ' ');
      if (!cleaned) return '';
      return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
    };

    const bullets = chunks.slice(0, 3).map(sentenceOnly).filter(Boolean);
    return bullets.map((b) => `• ${b}`).join('\n');
  };

  // Auto-scroll messages inside the chat area (only for follow-ups, not initial load)
  useEffect(() => {
    if (messages.length > 1) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, responding]);

  // Scroll the entire summary into the viewport when it first appears
  useEffect(() => {
    if (messages.length === 1 && messages[0].role === 'model') {
      setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 250);
    }
  }, [messages]);

  // Preserve scroll position during exit animation
  useEffect(() => {
    if (!isVisible && scrollParentRef.current) {
      const parent = scrollParentRef.current;
      const saved = savedScrollRef.current;
      let frame: number;
      const restore = () => {
        parent.scrollTop = saved;
        frame = requestAnimationFrame(restore);
      };
      frame = requestAnimationFrame(restore);
      const timer = setTimeout(() => {
        cancelAnimationFrame(frame);
        scrollParentRef.current = null;
      }, 300);
      return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
    }
  }, [isVisible]);

  // Reset conversation when closed
  useEffect(() => {
    if (!isVisible) {
      setMessages([]);
      setFollowUp('');
      setResponding(false);
    }
  }, [isVisible]);

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Save scroll position before exit animation starts
    const scrollParent = containerRef.current?.closest('main');
    if (scrollParent) {
      scrollParentRef.current = scrollParent;
      savedScrollRef.current = scrollParent.scrollTop;
    }
    onClose();
  };

  useEffect(() => {
    if (isVisible && text && messages.length === 0 && !loading) {
      const fetchSummary = async () => {
        setLoading(true);
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Provide a concise summary in exactly 3 bullet points.

Format:
• What happened
• Why it matters
• What to watch next

Rules:
- Return exactly 3 bullets
- Each bullet is one short sentence
- Keep bullets concrete, not generic\n\n${text}`,
          });
          const formatted = normalizeBulletLines(response.text || '');
          setMessages([{ role: 'model', text: formatted || 'Failed to generate summary.' }]);
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
      const systemPrompt = `You are a helpful assistant. The user is asking about this article.

Answer in 3-4 concise sentences:
- Direct answer first
- Include one concrete detail from the article
- Briefly explain implication/impact
- Optional next-step/context sentence

ARTICLE:
${text}`;

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
          <div
            ref={containerRef}
            className="px-4 md:px-6 pb-4 pt-4 border-t border-[var(--th-accent-border)]"
            style={{ backgroundColor: 'var(--th-accent-soft)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[var(--th-accent-text)]" />
                <span className="text-xs font-bold text-[var(--th-accent-text)] uppercase tracking-wider">AI Summary</span>
              </div>
              <button
                onClick={handleClose}
                className="p-1 text-text-muted hover:text-text-secondary transition-colors rounded-full hover:bg-[var(--th-surface-btn-overlay)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Messages */}
            <div className="space-y-2">
              {loading ? (
                <div className="flex items-center gap-2 text-text-tertiary text-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating tl;dr...
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={msg.role === 'user' ? 'flex justify-end' : ''}>
                    {msg.role === 'user' ? (
                      <div className="bg-[var(--th-accent-soft)] text-text-primary border border-[var(--th-accent-border)] rounded-lg rounded-br-sm px-2.5 py-1.5 text-sm max-w-[85%]">
                        {msg.text}
                      </div>
                    ) : (
                      <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{msg.text}</p>
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
                  className="flex-1 bg-surface-secondary/50 border border-border-primary rounded-lg px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-[var(--th-focus-ring)] disabled:opacity-50"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                />
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); sendFollowUp(); }}
                  disabled={!followUp.trim() || responding}
                  className="p-1.5 rounded-lg bg-[var(--th-accent)] text-white disabled:opacity-30 hover:bg-[var(--th-accent-strong)] transition-colors shrink-0"
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
