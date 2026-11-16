import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Lang } from '@/hooks/useLanguage';
import { useAdrBotSession } from './AdrBotSession';
import type { AdrBotMessage } from './AdrBotSession';

const PLACEHOLDER: Record<Lang, string> = {
  es: 'Escribe una pregunta para AdrBOT...',
  en: 'Ask AdrBOT anything about Adrián...',
};

function SiriThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2" aria-label="AdrBOT is thinking">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="block w-2 h-2 rounded-full"
          style={{
            background: index === 0 ? 'var(--os-blue)' : index === 1 ? 'var(--os-violet)' : '#ec4899',
          }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: index * 0.18 }}
        />
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: AdrBotMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <img
          src="/icons/siri.webp"
          alt="AdrBOT"
          className="w-6 h-6 object-contain mr-2 mt-0.5 flex-shrink-0"
        />
      )}
      <div
        className={`max-w-[85%] sm:max-w-[78%] rounded-[16px] px-4 py-2.5 text-[13px] leading-relaxed font-sans whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-[var(--os-blue)] text-white shadow-sm rounded-br-[4px]'
            : 'bg-white/10 text-white/90 border border-white/10 rounded-bl-[4px] backdrop-blur-md'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

export default function ChatWindow({ lang }: { lang: Lang }) {
  const { messages, thinking, sendMessage } = useAdrBotSession();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  useEffect(() => {
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 150);
    return () => window.clearTimeout(timeout);
  }, []);

  const submit = useCallback(() => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');
    void sendMessage(text, lang);
  }, [input, lang, sendMessage, thinking]);

  const handleKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[rgba(16,18,26,0.85)] overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-white/5 bg-white/[0.02] flex-shrink-0">
        <div className="relative">
          <img src="/icons/siri.webp" alt="AdrBOT" className="w-5 h-5 object-contain" />
          <div className="absolute -inset-0.5 rounded-full bg-[var(--os-blue)]/30 blur-[4px] -z-10" />
        </div>
        <div className="flex flex-col">
          <span className="font-sans text-xs font-semibold text-white tracking-tight">AdrBOT</span>
          <span className="font-sans text-[10px] text-white/50">
            {lang === 'es' ? 'Asistente de Inteligencia Artificial' : 'Artificial Intelligence Assistant'}
          </span>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto p-4 sm:p-5"
        aria-live="polite"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
      >
        {messages.map((message, index) => (
          <MessageBubble key={`${message.role}-${index}`} message={message} />
        ))}
        {thinking && (
          <div className="flex items-center gap-2 mb-3">
            <img src="/icons/siri.webp" alt="" className="w-6 h-6 object-contain flex-shrink-0" />
            <div className="rounded-[16px] rounded-bl-[4px] bg-white/10 border border-white/10 backdrop-blur-md">
              <SiriThinkingDots />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 sm:p-4 border-t border-white/10 bg-[rgba(22,25,36,0.6)] flex-shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 rounded-[14px] bg-white/10 border border-white/15 focus-within:border-[var(--os-blue)] transition-all">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKey}
            placeholder={PLACEHOLDER[lang]}
            disabled={thinking}
            className="flex-1 bg-transparent outline-none font-sans text-xs text-white placeholder-white/40"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!input.trim() || thinking}
            aria-label={lang === 'es' ? 'Enviar mensaje a AdrBOT' : 'Send message to AdrBOT'}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              input.trim() && !thinking
                ? 'bg-[var(--os-blue)] text-white shadow-md hover:scale-105 active:scale-95'
                : 'bg-white/10 text-white/30 cursor-default'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1a.75.75 0 0 1 .75.75v10.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V1.75A.75.75 0 0 1 8 1z" transform="rotate(180 8 8)" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
