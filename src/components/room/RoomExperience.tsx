import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useLanguageState } from '@/hooks/useLanguage';
import type { ProjectEntry } from '@/components/os/Desktop';
import { AdrBotSessionProvider } from '@/components/widgets/AdrBotSession';
import { useAdrBotSession } from '@/components/widgets/AdrBotSession';
import type { FocusTarget } from './focus-targets';
import type { RoomFocusState } from './useRoomFocus';
import RoomScene from './RoomScene';
import { RoomErrorBoundary, RoomLoadingStatus } from './RoomStatus';
import './room.css';

interface RoomExperienceProps {
  projects: ProjectEntry[];
}

function RoomExperienceContent({
  projects,
  lang,
  toggleLang,
}: RoomExperienceProps & { lang: 'es' | 'en'; toggleLang: () => void }) {
  const chatSession = useAdrBotSession();
  const [focusState, setFocusState] = useState<RoomFocusState>({ target: null, phase: 'room' });
  const canvasContainer = useRef<HTMLDivElement>(null);
  const focusTarget = useRef<((target: FocusTarget) => void) | null>(null);
  const returnToRoom = useRef<(() => void) | null>(null);
  const focused = focusState.phase !== 'room';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === 'es' ? 'AdrRoom — Portfolio interactivo' : 'AdrRoom — Interactive portfolio';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        lang === 'es'
          ? 'Explora AdrRoom, un portfolio interactivo en español e inglés.'
          : 'Explore AdrRoom, an interactive portfolio in Spanish and English.',
      );
  }, [lang]);

  useEffect(() => {
    if (!focused) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') returnToRoom.current?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focused]);

  useEffect(() => {
    if (!focused) return;
    const container = canvasContainer.current;
    if (!container) return;

    const returnOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element
        && target.closest('.room-screen-html, .robot-hologram-html')
      ) return;

      returnToRoom.current?.();
    };

    container.addEventListener('pointerdown', returnOnOutsidePointerDown);
    return () => container.removeEventListener('pointerdown', returnOnOutsidePointerDown);
  }, [focused]);

  const isSpanish = lang === 'es';
  return (
    <main className={`room-experience${focused ? ' room-experience--focused' : ''}`} lang={lang}>
      <div
        ref={canvasContainer}
        className="room-experience__canvas"
        aria-label={isSpanish ? 'Habitación 3D interactiva' : 'Interactive 3D room'}
      >
        <RoomErrorBoundary lang={lang}>
          <Canvas
            camera={{ position: [0, 2.7, 9.1], fov: 46, near: 0.05, far: 100 }}
            dpr={[1, 1.5]}
            gl={{
              alpha: true,
              antialias: true,
              powerPreference: 'high-performance',
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 1,
            }}
            fallback={
              <div className="room-fallback" role="alert">
                <img
                  src="/room-preview.png"
                  width="1440"
                  height="960"
                  alt={isSpanish ? 'Vista previa de la habitación de AdrRoom' : 'AdrRoom room preview'}
                />
                <p>
                  {isSpanish
                    ? 'Este navegador no puede mostrar la escena 3D.'
                    : 'This browser cannot display the 3D room.'}
                </p>
              </div>
            }
          >
            <ambientLight intensity={0.3} />
            <hemisphereLight args={['#fff1d6', '#3b4b4c', 0.4]} />
            <directionalLight position={[-3, 7, 5]} intensity={0.9} />
            <directionalLight position={[4, 4, -3]} intensity={0.25} color="#d7e5ff" />
            <Suspense fallback={null}>
              <RoomScene
                lang={lang}
                projects={projects}
                chatSession={chatSession}
                focusState={focusState}
                onFocusStateChange={setFocusState}
                focusCommand={focusTarget}
                returnCommand={returnToRoom}
              />
            </Suspense>
          </Canvas>
        </RoomErrorBoundary>
      </div>
      <RoomLoadingStatus lang={lang} />

      <header className="room-header">
        <a className="room-wordmark" href="/" aria-label="AdrRoom">
          <span className="room-wordmark__symbol" aria-hidden="true">a</span>
          <span>AdrRoom</span>
        </a>
        {!focused && (
          <div className="room-language" role="group" aria-label={isSpanish ? 'Idioma' : 'Language'}>
            <button type="button" aria-pressed={lang === 'es'} onClick={() => lang !== 'es' && toggleLang()}>
              ES
            </button>
            <button type="button" aria-pressed={lang === 'en'} onClick={() => lang !== 'en' && toggleLang()}>
              EN
            </button>
          </div>
        )}
      </header>

      {!focused && (
        <>
          <div className="room-hint" aria-label={isSpanish ? 'Controles de cámara' : 'Camera controls'}>
            <span className="room-hint__icon" aria-hidden="true">↔</span>
            <span>{isSpanish ? 'Arrastrar para mirar alrededor' : 'Drag to look around'}</span>
          </div>
          <button
            className="room-skip"
            type="button"
            onClick={() => focusTarget.current?.('monitor')}
            aria-label={isSpanish ? 'Abrir portfolio en el monitor' : 'Open portfolio on the monitor'}
          >
            {isSpanish ? 'Abrir portfolio' : 'Open portfolio'}
          </button>
        </>
      )}

      {focused && (
        <button
          className="room-return"
          type="button"
          onClick={() => returnToRoom.current?.()}
          aria-label={isSpanish ? 'Volver a la habitación' : 'Return to the room'}
        >
          {isSpanish ? 'Volver' : 'Back'}
        </button>
      )}
    </main>
  );
}

export default function RoomExperience({ projects }: RoomExperienceProps) {
  const { lang, toggleLang } = useLanguageState();
  return (
    <AdrBotSessionProvider lang={lang}>
      <RoomExperienceContent projects={projects} lang={lang} toggleLang={toggleLang} />
    </AdrBotSessionProvider>
  );
}
