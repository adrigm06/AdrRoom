import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Lang } from '@/hooks/useLanguage';

export interface AdrBotMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AdrBotSessionValue {
  messages: AdrBotMessage[];
  thinking: boolean;
  sendMessage: (text: string, lang: Lang) => Promise<void>;
}

const WELCOME: Record<Lang, string> = {
  es: '¡Hola! Soy AdrBOT, el asistente de Adrián impulsado por IA. Pregúntame sobre sus proyectos, stack tecnológico o experiencia profesional.',
  en: "Hi! I'm AdrBOT, Adrián's AI-powered assistant. Ask me about his projects, tech stack, or professional background.",
};

const WELCOME_MESSAGES = new Set(Object.values(WELCOME));
const API_URL = import.meta.env.PUBLIC_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CHAT_URL = API_URL ? `${API_URL.replace(/\/$/, '')}/functions/v1/chat` : null;

const CHAT_ERROR: Record<Lang, string> = {
  es: 'Algo salió mal al conectar con el servidor. Inténtalo de nuevo.',
  en: 'Something went wrong connecting to the server. Please try again.',
};

const ChatSessionContext = createContext<AdrBotSessionValue | null>(null);

export function AdrBotSessionProvider({
  children,
  lang,
}: {
  children: ReactNode;
  lang: Lang;
}) {
  const initialMessages = [{ role: 'assistant', content: WELCOME[lang] }] as AdrBotMessage[];
  const [messages, setMessages] = useState(initialMessages);
  const [thinking, setThinking] = useState(false);
  const messagesRef = useRef(messages);
  const thinkingRef = useRef(false);

  const publishMessages = useCallback((next: AdrBotMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  useEffect(() => {
    const current = messagesRef.current;
    if (current.length === 1 && current[0].role === 'assistant' && WELCOME_MESSAGES.has(current[0].content)) {
      publishMessages([{ role: 'assistant', content: WELCOME[lang] }]);
    }
  }, [lang, publishMessages]);

  const sendMessage = useCallback(async (value: string, requestLang: Lang) => {
    const text = value.trim();
    if (!text || thinkingRef.current) return;

    thinkingRef.current = true;
    setThinking(true);
    publishMessages([...messagesRef.current, { role: 'user', content: text }]);

    try {
      if (!CHAT_URL || !ANON_KEY) {
        const missingConfig = requestLang === 'es'
          ? 'El servicio de IA no está configurado. Revisa las variables públicas de Supabase.'
          : 'The AI service is not configured. Check the public Supabase environment variables.';
        publishMessages([...messagesRef.current, { role: 'assistant', content: missingConfig }]);
        return;
      }

      const history = messagesRef.current
        .filter((message) => message.role !== 'assistant' || !WELCOME_MESSAGES.has(message.content))
        .slice(-6);
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ANON_KEY}`,
          apikey: ANON_KEY,
        },
        body: JSON.stringify({ message: text, history }),
      });

      if (!response.ok) {
        let errorMessage = CHAT_ERROR[requestLang];
        try {
          const body = await response.json();
          if (body?.error) errorMessage = `${errorMessage} (${String(body.error)})`;
        } catch {
          // Keep the localized fallback if the Edge Function response is not JSON.
        }
        publishMessages([...messagesRef.current, { role: 'assistant', content: errorMessage }]);
        return;
      }

      const body = await response.json();
      publishMessages([
        ...messagesRef.current,
        { role: 'assistant', content: body.answer ?? CHAT_ERROR[requestLang] },
      ]);
    } catch {
      publishMessages([...messagesRef.current, { role: 'assistant', content: CHAT_ERROR[requestLang] }]);
    } finally {
      thinkingRef.current = false;
      setThinking(false);
    }
  }, [publishMessages]);

  return (
    <ChatSessionContext.Provider value={{ messages, thinking, sendMessage }}>
      {children}
    </ChatSessionContext.Provider>
  );
}

export function useAdrBotSession() {
  const session = useContext(ChatSessionContext);
  if (!session) throw new Error('useAdrBotSession must be used within AdrBotSessionProvider');
  return session;
}
