import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useLanguageState } from '@/hooks/useLanguage';
import type { ProjectEntry } from '@/components/os/Desktop';
import { AdrBotSessionProvider } from '@/components/widgets/AdrBotSession';
import { useAdrBotSession } from '@/components/widgets/AdrBotSession';
import type { FocusTarget } from './focus-targets';
import type { RoomFocusState } from './useRoomFocus';
import type { ProjectionMode } from './RoomScene';
import RobotHologram from './RobotHologram';
import {
  hasDismissedRoomWelcome,
  rememberRoomWelcomeDismissal,
} from './room-discovery';
import RoomScene from './RoomScene';
import { RoomCanvasFallback, RoomErrorBoundary, RoomLoadingStatus } from './RoomStatus';
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
  const [projection, setProjection] = useState<ProjectionMode>('hidden');
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const handleSceneReady = useCallback(() => setSceneReady(true), []);
  const handleSceneFailure = useCallback(() => setSceneFailed(true), []);
  const canvasContainer = useRef<HTMLDivElement>(null);
  const hologramPanelAnchor = useRef<HTMLDivElement>(null);
  const focusTarget = useRef<((target: FocusTarget) => void) | null>(null);
  const returnToRoom = useRef<(() => void) | null>(null);
  const focused = focusState.phase !== 'room';

  useEffect(() => {
    if (!sceneReady) return;

    let dismissed = false;
    try {
      dismissed = hasDismissedRoomWelcome(window.localStorage);
    } catch {
      // Storage can be unavailable in private or restricted browsing contexts.
    }
    setWelcomeOpen(!dismissed);
  }, [sceneReady]);

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
        && target.closest('.room-screen-html, .robot-hologram-overlay')
      ) return;

      returnToRoom.current?.();
    };

    container.addEventListener('pointerdown', returnOnOutsidePointerDown);
    return () => container.removeEventListener('pointerdown', returnOnOutsidePointerDown);
  }, [focused]);

  const isSpanish = lang === 'es';
  const dismissWelcome = () => {
    setWelcomeOpen(false);
    try {
      rememberRoomWelcomeDismissal(window.localStorage);
    } catch {
      // The room remains usable when persistence is unavailable.
    }
  };

  const openFromWelcome = (target: FocusTarget) => {
    dismissWelcome();
    focusTarget.current?.(target);
  };

  return (
    <main className={`room-experience${focused ? ' room-experience--focused' : ''}`} lang={lang}>
      <div
        ref={canvasContainer}
        className="room-experience__canvas"
        aria-label={isSpanish ? 'Habitación 3D interactiva' : 'Interactive 3D room'}
      >
        <RoomErrorBoundary lang={lang} onFailure={handleSceneFailure}>
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
            fallback={<RoomCanvasFallback lang={lang} onFailure={handleSceneFailure} />}
          >
            <ambientLight intensity={0.3} />
            <hemisphereLight args={['#fff1d6', '#3b4b4c', 0.4]} />
            <directionalLight position={[-3, 7, 5]} intensity={0.9} />
            <directionalLight position={[4, 4, -3]} intensity={0.25} color="#d7e5ff" />
            <Suspense fallback={null}>
              <RoomScene
                lang={lang}
                projects={projects}
                focusState={focusState}
                onFocusStateChange={setFocusState}
                projection={projection}
                onProjectionChange={setProjection}
                panelAnchorRef={hologramPanelAnchor}
                onReady={handleSceneReady}
                focusCommand={focusTarget}
                returnCommand={returnToRoom}
              />
            </Suspense>
          </Canvas>
        </RoomErrorBoundary>
      </div>
      {focusState.target === 'robot' && projection !== 'hidden' && (
        <RobotHologram
          lang={lang}
          mode={projection}
          interactive={focusState.phase === 'focused'}
          chatSession={chatSession}
          panelAnchorRef={hologramPanelAnchor}
        />
      )}
      {!sceneFailed && <RoomLoadingStatus lang={lang} />}

      <header className="room-header">
        <a className="room-wordmark" href="/" aria-label="AdrRoom">
          <span className="room-wordmark__symbol" aria-hidden="true">a</span>
          <span>AdrRoom</span>
        </a>
        {!focused && sceneReady && !sceneFailed && (
          <div className="room-header__actions">
            <button
              className="room-help"
              type="button"
              onClick={() => setWelcomeOpen(true)}
              aria-expanded={welcomeOpen}
            >
              {isSpanish ? 'Ayuda' : 'Help'}
            </button>
            <div className="room-language" role="group" aria-label={isSpanish ? 'Idioma' : 'Language'}>
              <button type="button" aria-pressed={lang === 'es'} onClick={() => lang !== 'es' && toggleLang()}>
                ES
              </button>
              <button type="button" aria-pressed={lang === 'en'} onClick={() => lang !== 'en' && toggleLang()}>
                EN
              </button>
            </div>
          </div>
        )}
      </header>

      {!focused && sceneReady && !sceneFailed && (
        <>
          <div className="room-hint" aria-label={isSpanish ? 'Controles de cámara' : 'Camera controls'}>
            <span className="room-hint__icon" aria-hidden="true">↔</span>
            <span>{isSpanish ? 'Arrastrar para mirar alrededor' : 'Drag to look around'}</span>
          </div>
          <button
            className="room-robot-shortcut"
            type="button"
            onClick={() => focusTarget.current?.('robot')}
          >
            {isSpanish ? 'Hablar con AdrBOT' : 'Talk to AdrBOT'}
          </button>
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

      {sceneReady && !sceneFailed && !focused && welcomeOpen && (
        <section
          className="room-welcome"
          id="room-welcome"
          role="region"
          aria-labelledby="room-welcome-title"
          aria-live="polite"
        >
          <button
            className="room-welcome__close"
            type="button"
            onClick={dismissWelcome}
            aria-label={isSpanish ? 'Cerrar ayuda' : 'Close help'}
          >
            ×
          </button>
          <p className="room-welcome__eyebrow">AdrRoom</p>
          <h1 id="room-welcome-title">
            {isSpanish ? 'Bienvenido a mi espacio' : 'Welcome to my space'}
          </h1>
          <p className="room-welcome__copy">
            {isSpanish
              ? 'Explora la habitación: abre el portfolio en el PC o charla con AdrBOT.'
              : 'Explore the room: open the portfolio on the PC or chat with AdrBOT.'}
          </p>
          <div className="room-welcome__actions">
            <button type="button" onClick={() => openFromWelcome('monitor')}>
              {isSpanish ? 'Abrir el PC' : 'Open the PC'}
            </button>
            <button type="button" onClick={() => openFromWelcome('robot')}>
              {isSpanish ? 'Hablar con AdrBOT' : 'Talk to AdrBOT'}
            </button>
          </div>
          <button className="room-welcome__dismiss" type="button" onClick={dismissWelcome}>
            {isSpanish ? 'Empezar a explorar' : 'Start exploring'}
          </button>
        </section>
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
