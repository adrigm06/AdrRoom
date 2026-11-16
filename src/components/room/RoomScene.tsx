import { useCallback, useEffect, useRef, useState } from 'react';
import { Html, OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import type { ProjectEntry } from '@/components/os/Desktop';
import type { Lang } from '@/hooks/useLanguage';
import type { AdrBotSessionValue } from '@/components/widgets/AdrBotSession';
import type { FocusTarget } from './focus-targets';
import type { RoomFocusState } from './useRoomFocus';
import useRoomFocus from './useRoomFocus';
import RoomModel from './RoomModel';
import type { RobotMouthCommands } from './RoomModel';
import RoomMonitor from './RoomMonitor';
import RobotHologram from './RobotHologram';

type ProjectionMode = 'hidden' | 'deploying' | 'live' | 'dismissing';
const ROOM_TARGET: [number, number, number] = [0, 0.78, 0];

interface RoomSceneProps {
  lang: Lang;
  projects: ProjectEntry[];
  chatSession: AdrBotSessionValue;
  focusState: RoomFocusState;
  onFocusStateChange: (state: RoomFocusState) => void;
  focusCommand: { current: ((target: FocusTarget) => void) | null };
  returnCommand: { current: (() => void) | null };
}

export default function RoomScene({
  lang,
  projects,
  chatSession,
  focusState,
  onFocusStateChange,
  focusCommand,
  returnCommand,
}: RoomSceneProps) {
  const { camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const mouthCommands = useRef<RobotMouthCommands | null>(null);
  const transitionTimer = useRef<number | null>(null);
  const [monitorHovered, setMonitorHovered] = useState(false);
  const [robotHovered, setRobotHovered] = useState(false);
  const [projection, setProjection] = useState<ProjectionMode>('hidden');
  const focus = useRoomFocus({
    camera,
    controls,
    viewport: size,
    onStateChange: onFocusStateChange,
  });
  const focused = focusState.phase !== 'room';
  const monitorFocused = focusState.target === 'monitor';
  const robotFocused = focusState.target === 'robot';

  const beginFocus = useCallback(async (target: FocusTarget) => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    setMonitorHovered(false);
    setRobotHovered(false);
    document.body.style.cursor = '';
    const completed = await focus.focus(target);
    if (!completed || target !== 'robot') return;

    setRobotHovered(false);
    document.body.style.cursor = '';
    setProjection('deploying');
    mouthCommands.current?.play(true);
    transitionTimer.current = window.setTimeout(() => {
      const current = focus.getState();
      if (current.target === 'robot' && current.phase === 'focused') {
        setProjection('live');
      }
    }, 520);
  }, [focus.focus, focus.getState]);

  const returnFromFocus = useCallback(async () => {
    const before = focus.getState();
    if (before.phase === 'room' || before.phase === 'returning') return;

    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement
      && activeElement.closest('.room-screen-html, .robot-hologram-html')
    ) activeElement.blur();

    const dismissRobot = before.target === 'robot';
    await focus.returnToRoom();
    if (dismissRobot) {
      setProjection('dismissing');
      mouthCommands.current?.play(false);
      transitionTimer.current = window.setTimeout(() => {
        setProjection('hidden');
        focus.finishReturn();
      }, 520);
      return;
    }
    focus.finishReturn();
  }, [focus.finishReturn, focus.getState, focus.returnToRoom]);

  useEffect(() => {
    focusCommand.current = (target) => { void beginFocus(target); };
    returnCommand.current = () => { void returnFromFocus(); };
    return () => {
      focusCommand.current = null;
      returnCommand.current = null;
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
      document.body.style.cursor = '';
    };
  }, [beginFocus, focusCommand, returnCommand, returnFromFocus]);

  return (
    <>
      <RoomModel
        monitorHovered={monitorHovered}
        robotHovered={robotHovered}
        mouthCommands={mouthCommands}
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
        onHoverChange={setMonitorHovered}
      />
      {!focused && (
        <>
          <mesh
            position={[0.76, 0.97, -1.18]}
            onClick={(event) => {
              event.stopPropagation();
              document.body.style.cursor = '';
              setRobotHovered(false);
              focusCommand.current?.('robot');
            }}
            onPointerOver={(event) => {
              event.stopPropagation();
              document.body.style.cursor = 'pointer';
              setRobotHovered(true);
            }}
            onPointerOut={(event) => {
              event.stopPropagation();
              document.body.style.cursor = '';
              setRobotHovered(false);
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
          <Html position={[0.76, 0.97, -1.18]} center distanceFactor={12} zIndexRange={[10, 0]}>
            <button
              className="room-robot-accessible"
              type="button"
              onClick={() => focusCommand.current?.('robot')}
            >
              {lang === 'es' ? 'Abrir el chat de AdrBOT' : 'Open the AdrBOT chat'}
            </button>
          </Html>
        </>
      )}
      {robotFocused && projection !== 'hidden' && (
        <RobotHologram
          lang={lang}
          mode={projection}
          interactive={focusState.phase === 'focused' && projection === 'live'}
          chatSession={chatSession}
        />
      )}
    </>
  );
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
