import { useCallback, useEffect, useRef, useState } from 'react';
import { Html, OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { RefObject } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { PANEL_POSITION } from './projection-layout';
import type { ProjectEntry } from '@/components/os/Desktop';
import type { Lang } from '@/hooks/useLanguage';
import type { FocusTarget } from './focus-targets';
import type { RoomFocusState } from './useRoomFocus';
import useRoomFocus from './useRoomFocus';
import { isIntentionalRoomActivation } from './room-discovery';
import RoomModel from './RoomModel';
import type { RobotMouthCommands } from './RoomModel';
import RoomMonitor from './RoomMonitor';
import RobotHologramEffects from './RobotHologramEffects';
import type { HologramMode } from './RobotHologram';
import { projectPanelPosition } from './projection-layout';

export type ProjectionMode = 'hidden' | HologramMode;
const ROOM_TARGET: [number, number, number] = [0, 0.78, 0];
const HOVER_EXIT_DELAY_MS = 280;
type HoverTarget = FocusTarget;

interface RoomSceneProps {
  lang: Lang;
  projects: ProjectEntry[];
  focusState: RoomFocusState;
  onFocusStateChange: (state: RoomFocusState) => void;
  projection: ProjectionMode;
  onProjectionChange: (mode: ProjectionMode) => void;
  panelAnchorRef: RefObject<HTMLDivElement | null>;
  onReady: () => void;
  focusCommand: { current: ((target: FocusTarget) => void) | null };
  returnCommand: { current: (() => void) | null };
}

export default function RoomScene({
  lang,
  projects,
  focusState,
  onFocusStateChange,
  projection,
  onProjectionChange,
  panelAnchorRef,
  onReady,
  focusCommand,
  returnCommand,
}: RoomSceneProps) {
  const { camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const mouthCommands = useRef<RobotMouthCommands | null>(null);
  const transitionTimer = useRef<number | null>(null);
  const hoverTimers = useRef<Partial<Record<HoverTarget, number>>>({});
  const [monitorHovered, setMonitorHovered] = useState(false);
  const [robotHovered, setRobotHovered] = useState(false);
  const [corkboardHovered, setCorkboardHovered] = useState(false);
  const [libraryHovered, setLibraryHovered] = useState(false);
  const focus = useRoomFocus({
    camera,
    controls,
    viewport: size,
    onStateChange: onFocusStateChange,
  });
  const focused = focusState.phase !== 'room';
  const monitorFocused = focusState.target === 'monitor';
  const robotFocused = focusState.target === 'robot';

  const setTargetHovered = useCallback((target: HoverTarget, hovered: boolean) => {
    const existingTimer = hoverTimers.current[target];
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
      delete hoverTimers.current[target];
    }

    const update = {
      monitor: setMonitorHovered,
      robot: setRobotHovered,
      corkboard: setCorkboardHovered,
      library: setLibraryHovered,
    }[target];
    if (hovered) {
      update(true);
      return;
    }

    hoverTimers.current[target] = window.setTimeout(() => {
      update(false);
      delete hoverTimers.current[target];
    }, HOVER_EXIT_DELAY_MS);
  }, []);

  const beginFocus = useCallback(async (target: FocusTarget) => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    for (const timer of Object.values(hoverTimers.current)) {
      if (timer !== undefined) window.clearTimeout(timer);
    }
    hoverTimers.current = {};
    setMonitorHovered(false);
    setRobotHovered(false);
    document.body.style.cursor = '';
    const completed = await focus.focus(target);
    if (!completed || target !== 'robot') return;

    setRobotHovered(false);
    document.body.style.cursor = '';
    onProjectionChange('deploying');
    mouthCommands.current?.play(true);
    transitionTimer.current = window.setTimeout(() => {
      const current = focus.getState();
      if (current.target === 'robot' && current.phase === 'focused') {
        onProjectionChange('live');
      }
    }, 520);
  }, [focus.focus, focus.getState, onProjectionChange]);

  const returnFromFocus = useCallback(async () => {
    const before = focus.getState();
    if (before.phase === 'room' || before.phase === 'returning') return;

    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement
      && activeElement.closest('.room-screen-html, .robot-hologram-overlay, .room-editorial-panel')
    ) activeElement.blur();

    const dismissRobot = before.target === 'robot';
    await focus.returnToRoom();
    if (dismissRobot) {
      onProjectionChange('dismissing');
      mouthCommands.current?.play(false);
      transitionTimer.current = window.setTimeout(() => {
        onProjectionChange('hidden');
        focus.finishReturn();
      }, 520);
      return;
    }
    focus.finishReturn();
    if (before.target === 'corkboard' || before.target === 'library') {
      window.setTimeout(() => {
        document.getElementById(`room-hotspot-${before.target}`)?.focus();
      }, 0);
    }
  }, [focus.finishReturn, focus.getState, focus.returnToRoom, onProjectionChange]);

  useEffect(() => {
    focusCommand.current = (target) => { void beginFocus(target); };
    returnCommand.current = () => { void returnFromFocus(); };
    return () => {
      focusCommand.current = null;
      returnCommand.current = null;
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
      for (const timer of Object.values(hoverTimers.current)) {
        if (timer !== undefined) window.clearTimeout(timer);
      }
      document.body.style.cursor = '';
    };
  }, [beginFocus, focusCommand, returnCommand, returnFromFocus]);

  return (
    <>
      <RoomModel
        monitorHovered={monitorHovered}
        robotHovered={robotHovered}
        mouthCommands={mouthCommands}
        onReady={onReady}
      />
      <OrbitControls
        ref={controls}
        target={ROOM_TARGET}
        enabled={!focused}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={7.4}
        maxDistance={9.5}
        minPolarAngle={0.92}
        maxPolarAngle={1.55}
        minAzimuthAngle={-0.34}
        maxAzimuthAngle={0.34}
        rotateSpeed={0.35}
        zoomSpeed={0.45}
      />
      <RoomMonitor
        lang={lang}
        projects={projects}
        focused={focused}
        hovered={monitorHovered}
        screenVisible={monitorFocused && focusState.phase === 'focused'}
        onOpen={() => focusCommand.current?.('monitor')}
        onHoverChange={(hovered) => setTargetHovered('monitor', hovered)}
      />
      {!focused && (
        <>
          <RoomHotspot
            id="corkboard"
            label={lang === 'es' ? 'Leer mi trayectoria' : 'Read my journey'}
            position={[3.255, 1.73, -1.16]}
            width={1.17}
            height={0.79}
            hovered={corkboardHovered}
            onHoverChange={(hovered) => setTargetHovered('corkboard', hovered)}
            onActivate={() => focusCommand.current?.('corkboard')}
          />
          <RoomHotspot
            id="library"
            label={lang === 'es' ? 'Explorar habilidades' : 'Explore skills'}
            position={[-2.75, 1.65, 0]}
            width={3.5}
            height={1.65}
            hovered={libraryHovered}
            onHoverChange={(hovered) => setTargetHovered('library', hovered)}
            onActivate={() => focusCommand.current?.('library')}
          />
          <mesh
            position={[0.76, 0.97, -1.18]}
            onClick={(event) => {
              event.stopPropagation();
              if (!isIntentionalRoomActivation(event.delta)) return;
              document.body.style.cursor = '';
              setRobotHovered(false);
              focusCommand.current?.('robot');
            }}
            onPointerOver={(event) => {
              event.stopPropagation();
              document.body.style.cursor = 'pointer';
              setTargetHovered('robot', true);
            }}
            onPointerOut={(event) => {
              event.stopPropagation();
              document.body.style.cursor = '';
              setTargetHovered('robot', false);
            }}
          >
            <sphereGeometry args={[0.205, 20, 14]} />
            <meshBasicMaterial
              colorWrite={false}
              depthWrite={false}
              side={THREE.DoubleSide}
              transparent
            />
          </mesh>
          {robotHovered && <RobotGlow />}
          {robotHovered && (
            <Html
              position={[0.76, 1.44, -1.18]}
              center
              distanceFactor={12}
              zIndexRange={[12, 0]}
            >
              <button
                className="room-interaction-label"
                type="button"
                onPointerEnter={() => setTargetHovered('robot', true)}
                onPointerLeave={() => setTargetHovered('robot', false)}
                onClick={(event) => {
                  event.stopPropagation();
                  focusCommand.current?.('robot');
                }}
              >
                {lang === 'es' ? 'Hablar con AdrBOT' : 'Talk to AdrBOT'}
              </button>
            </Html>
          )}
          <Html position={[0.76, 0.97, -1.18]} center distanceFactor={12} zIndexRange={[10, 0]}>
            <button
              className="room-object-accessible room-robot-accessible"
              type="button"
              onClick={() => focusCommand.current?.('robot')}
            >
              {lang === 'es' ? 'Abrir el chat de AdrBOT' : 'Open the AdrBOT chat'}
            </button>
          </Html>
        </>
      )}
      {robotFocused && projection !== 'hidden' && (
        <>
          <RobotHologramEffects mode={projection} />
          <HologramPanelAnchor panelAnchorRef={panelAnchorRef} />
        </>
      )}
    </>
  );
}

function RoomHotspot({
  id,
  label,
  position,
  width,
  height,
  hovered,
  onHoverChange,
  onActivate,
}: {
  id: 'corkboard' | 'library';
  label: string;
  position: [number, number, number];
  width: number;
  height: number;
  hovered: boolean;
  onHoverChange: (hovered: boolean) => void;
  onActivate: () => void;
}) {
  const library = id === 'library';
  const rotation: [number, number, number] = [0, Math.PI / 2, 0];

  return (
    <>
      <mesh
        position={position}
        rotation={rotation}
        onClick={(event) => {
          event.stopPropagation();
          if (!isIntentionalRoomActivation(event.delta)) return;
          onActivate();
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = 'pointer';
          onHoverChange(true);
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          document.body.style.cursor = '';
          onHoverChange(false);
        }}
      >
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          colorWrite={false}
          depthWrite={false}
          side={THREE.DoubleSide}
          transparent
        />
      </mesh>
      {hovered && (
        <Html
          position={[
            position[0] + (library ? 0.12 : -0.08),
            position[1] + height * 0.5 + 0.08,
            position[2],
          ]}
          center
          distanceFactor={12}
          zIndexRange={[12, 0]}
        >
          <button
            className="room-interaction-label"
            type="button"
            onPointerEnter={() => onHoverChange(true)}
            onPointerLeave={() => onHoverChange(false)}
            onClick={(event) => {
              event.stopPropagation();
              onActivate();
            }}
          >
            {label}
          </button>
        </Html>
      )}
      <Html position={position} center distanceFactor={12} zIndexRange={[10, 0]}>
        <button
          id={`room-hotspot-${id}`}
          className="room-object-accessible"
          type="button"
          onClick={onActivate}
        >
          {label}
        </button>
      </Html>
    </>
  );
}

function HologramPanelAnchor({
  panelAnchorRef,
}: {
  panelAnchorRef: RefObject<HTMLDivElement | null>;
}) {
  const { gl } = useThree();
  const panelPosition = useRef(new THREE.Vector3(...PANEL_POSITION));

  useFrame(({ camera }) => {
    const anchor = panelAnchorRef.current;
    const overlay = anchor?.parentElement;
    if (!anchor || !overlay) return;

    const canvasBounds = gl.domElement.getBoundingClientRect();
    const overlayBounds = overlay.getBoundingClientRect();
    const projected = projectPanelPosition(camera, canvasBounds, panelPosition.current);
    anchor.style.transform = `translate3d(${projected.x - overlayBounds.left}px, ${projected.y - overlayBounds.top}px, 0)`;
    anchor.style.visibility = projected.visible ? 'visible' : 'hidden';
  });

  return null;
}

function RobotGlow() {
  return (
    <group position={[0.76, 0.985, -1.47]} scale={[1, 0.9, 0.8]} renderOrder={4}>
      <mesh raycast={() => null}>
        <sphereGeometry args={[0.212, 24, 18]} />
        <meshBasicMaterial
          color="#319cff"
          opacity={0.16}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh raycast={() => null} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.218, 0.0035, 8, 40]} />
        <meshBasicMaterial
          color="#77c9ff"
          opacity={0.88}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh raycast={() => null} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.218, 0.0025, 8, 40]} />
        <meshBasicMaterial
          color="#319cff"
          opacity={0.58}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
