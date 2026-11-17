import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Lang } from '@/hooks/useLanguage';
import type { AdrBotMessage, AdrBotSessionValue } from '@/components/widgets/AdrBotSession';
import './robot-hologram.css';

export type HologramMode = 'deploying' | 'live' | 'dismissing';

interface RobotHologramProps {
  lang: Lang;
  mode: HologramMode;
  interactive: boolean;
  chatSession: AdrBotSessionValue;
  panelAnchorRef: RefObject<HTMLDivElement | null>;
}

const LABEL: Record<Lang, { placeholder: string; send: string; status: string; title: string }> = {
  es: {
    placeholder: 'Pregunta a AdrBOT sobre proyectos o experiencia…',
    send: 'Enviar',
    status: 'EN LÍNEA · RAG ACTIVO',
    title: 'AdrBOT',
  },
  en: {
    placeholder: 'Ask AdrBOT about projects or experience…',
    send: 'Send',
    status: 'ONLINE · RAG ACTIVE',
    title: 'AdrBOT',
  },
};

function HologramMessages({
  lang,
  messages,
  thinking,
}: {
  lang: Lang;
  messages: AdrBotMessage[];
  thinking: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, thinking]);

  return (
    <div className="robot-hologram__messages" aria-live="polite" aria-label={lang === 'es' ? 'Conversación con AdrBOT' : 'Conversation with AdrBOT'}>
      {messages.map((message, index) => (
        <div
          className={`robot-hologram__message robot-hologram__message--${message.role}`}
          key={`${message.role}-${index}`}
        >
          {message.role === 'assistant' && <span className="robot-hologram__message-mark" aria-hidden="true">a</span>}
          <p>{message.content}</p>
        </div>
      ))}
      {thinking && (
        <div className="robot-hologram__thinking" role="status">
          <span />
          <span />
          <span />
          {lang === 'es' ? 'Procesando contexto…' : 'Retrieving context…'}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function HologramChat({
  lang,
  interactive,
  chatSession,
}: {
  lang: Lang;
  interactive: boolean;
  chatSession: AdrBotSessionValue;
}) {
  const { messages, thinking, sendMessage } = chatSession;
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const copy = LABEL[lang];

  useEffect(() => {
    if (interactive) inputRef.current?.focus({ preventScroll: true });
  }, [interactive]);

  const submit = useCallback(() => {
    const text = input.trim();
    if (!text || thinking || !interactive) return;
    setInput('');
    void sendMessage(text, lang);
  }, [input, interactive, lang, sendMessage, thinking]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <>
      <header className="robot-hologram__header">
        <span className="robot-hologram__sigil" aria-hidden="true">a</span>
        <span className="robot-hologram__identity">
          <strong>{copy.title}</strong>
          <small>{lang === 'es' ? 'ASISTENTE PERSONAL' : 'PERSONAL ASSISTANT'}</small>
        </span>
        <span className="robot-hologram__status">
          <i aria-hidden="true" />
          {copy.status}
        </span>
      </header>

      <HologramMessages lang={lang} messages={messages} thinking={thinking} />

      <form
        className="robot-hologram__composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={copy.placeholder}
          aria-label={copy.placeholder}
          disabled={!interactive || thinking}
          autoComplete="off"
        />
        <button type="submit" disabled={!interactive || !input.trim() || thinking}>
          <span>{copy.send}</span>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 10h13m-5-5 5 5-5 5" />
          </svg>
        </button>
      </form>
      <footer className="robot-hologram__footer">
        <span>{lang === 'es' ? 'PROYECCIÓN HOLOGRÁFICA' : 'HOLOGRAPHIC PROJECTION'}</span>
        <span>ADRROOM / 01</span>
      </footer>
    </>
  );
}

export default function RobotHologram({
  lang,
  mode,
  interactive,
  chatSession,
  panelAnchorRef,
}: RobotHologramProps) {
  const [glitching, setGlitching] = useState(false);
  const glitchTimeout = useRef<number | null>(null);
  const resetTimeout = useRef<number | null>(null);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches) return;

    let cancelled = false;
    const scheduleGlitch = () => {
      glitchTimeout.current = window.setTimeout(() => {
        if (cancelled) return;
        setGlitching(true);
        resetTimeout.current = window.setTimeout(() => {
          setGlitching(false);
          scheduleGlitch();
        }, 460);
      }, 8000 + Math.random() * 4000);
    };
    scheduleGlitch();
    return () => {
      cancelled = true;
      if (glitchTimeout.current !== null) window.clearTimeout(glitchTimeout.current);
      if (resetTimeout.current !== null) window.clearTimeout(resetTimeout.current);
    };
  }, []);

  return (
    <div className="robot-hologram-overlay">
      <div className="robot-hologram-anchor" ref={panelAnchorRef}>
        <div className="robot-hologram-frame">
          <section
            className={`robot-hologram robot-hologram--${mode}${glitching ? ' is-glitching' : ''}`}
            style={{ pointerEvents: interactive ? 'auto' : 'none' }}
            lang={lang}
            aria-label={LABEL[lang].title}
            inert={!interactive}
          >
            <span className="robot-hologram__glitch-line robot-hologram__glitch-line--one" aria-hidden="true" />
            <span className="robot-hologram__glitch-line robot-hologram__glitch-line--two" aria-hidden="true" />
            <span className="robot-hologram__glitch-line robot-hologram__glitch-line--three" aria-hidden="true" />
            <span className="robot-hologram__scan-beam" aria-hidden="true" />
            <HologramChat lang={lang} interactive={interactive} chatSession={chatSession} />
          </section>
        </div>
      </div>
    </div>
  );
}
