import { Html } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { useEffect } from 'react';
import { TextureLoader } from 'three';
import * as THREE from 'three';
import Desktop from '@/components/os/Desktop';
import type { ProjectEntry } from '@/components/os/Desktop';
import type { Lang } from '@/hooks/useLanguage';
import { isIntentionalRoomActivation } from './room-discovery';

const PREVIEW_IMAGES = [
  '/adr-os-preview-es.webp',
  '/adr-os-preview-en.webp',
];
const DISPLAY_WIDTH = 1.015;
const DISPLAY_HEIGHT = 0.565;
const DISPLAY_POSITION: [number, number, number] = [0, 1.56, -1.374];
const HIT_POSITION: [number, number, number] = [0, 1.56, -1.35];
const HIT_WIDTH = 1.1;
const HIT_HEIGHT = 0.65;
const HTML_WIDTH = 1280;
const HTML_DISTANCE_FACTOR = DISPLAY_WIDTH * 400 / HTML_WIDTH;

interface RoomMonitorProps {
  lang: Lang;
  projects: ProjectEntry[];
  focused: boolean;
  hovered: boolean;
  screenVisible: boolean;
  onOpen: () => void;
  onHoverChange: (hovered: boolean) => void;
}

export default function RoomMonitor({
  lang,
  projects,
  focused,
  hovered,
  screenVisible,
  onOpen,
  onHoverChange,
}: RoomMonitorProps) {
  const [spanishPreview, englishPreview] = useLoader(TextureLoader, PREVIEW_IMAGES);
  const preview = lang === 'es' ? spanishPreview : englishPreview;

  useEffect(() => {
    for (const texture of [spanishPreview, englishPreview]) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
    }
  }, [englishPreview, spanishPreview]);

  return (
    <>
      {!screenVisible && (
        <mesh position={DISPLAY_POSITION} renderOrder={2}>
          <planeGeometry args={[DISPLAY_WIDTH, DISPLAY_HEIGHT]} />
          <meshBasicMaterial map={preview} toneMapped={false} />
        </mesh>
      )}

      {screenVisible && (
        <Html
          transform
          position={DISPLAY_POSITION}
          distanceFactor={HTML_DISTANCE_FACTOR}
          zIndexRange={[30, 20]}
          className="room-screen-html"
          pointerEvents={focused ? 'auto' : 'none'}
        >
          <div className="room-screen">
            <Desktop projects={projects} embedded />
          </div>
        </Html>
      )}

      {!focused && (
        <>
          <mesh
            position={HIT_POSITION}
            onClick={(event) => {
              event.stopPropagation();
              if (!isIntentionalRoomActivation(event.delta)) return;
              document.body.style.cursor = '';
              onHoverChange(false);
              onOpen();
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
            <planeGeometry args={[HIT_WIDTH, HIT_HEIGHT]} />
            <meshBasicMaterial
              colorWrite={false}
              depthWrite={false}
              side={THREE.DoubleSide}
              transparent
            />
          </mesh>
          {hovered && <MonitorGlow />}
          <Html
            position={[0, 2.12, -1.35]}
            center
            distanceFactor={12}
            zIndexRange={[12, 0]}
          >
            {hovered && (
              <button
                className="room-interaction-label"
                type="button"
                onPointerEnter={() => onHoverChange(true)}
                onPointerLeave={() => onHoverChange(false)}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen();
                }}
              >
                {lang === 'es' ? 'Abrir el portfolio' : 'Open the portfolio'}
              </button>
            )}
          </Html>
          <Html
            position={[0, 1.56, -1.35]}
            center
            distanceFactor={12}
            zIndexRange={[12, 0]}
          >
            <button
              className="room-object-accessible"
              type="button"
              onClick={onOpen}
            >
              {lang === 'es' ? 'Abrir el portfolio en el PC' : 'Open the portfolio on the PC'}
            </button>
          </Html>
        </>
      )}
    </>
  );
}

function MonitorGlow() {
  return (
    <group position={[0, 1.56, -1.379]} renderOrder={3}>
      <mesh position={[0, 0.331, -0.004]}>
        <boxGeometry args={[1.16, 0.024, 0.002]} />
        <meshBasicMaterial color="#319cff" opacity={0.2} transparent toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.331, -0.004]}>
        <boxGeometry args={[1.16, 0.024, 0.002]} />
        <meshBasicMaterial color="#319cff" opacity={0.2} transparent toneMapped={false} />
      </mesh>
      <mesh position={[-0.57, 0, -0.004]}>
        <boxGeometry args={[0.024, 0.68, 0.002]} />
        <meshBasicMaterial color="#319cff" opacity={0.2} transparent toneMapped={false} />
      </mesh>
      <mesh position={[0.57, 0, -0.004]}>
        <boxGeometry args={[0.024, 0.68, 0.002]} />
        <meshBasicMaterial color="#319cff" opacity={0.2} transparent toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.319, 0]}>
        <boxGeometry args={[1.12, 0.006, 0.003]} />
        <meshBasicMaterial color="#77c9ff" toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.319, 0]}>
        <boxGeometry args={[1.12, 0.006, 0.003]} />
        <meshBasicMaterial color="#77c9ff" toneMapped={false} />
      </mesh>
      <mesh position={[-0.554, 0, 0]}>
        <boxGeometry args={[0.006, 0.65, 0.003]} />
        <meshBasicMaterial color="#77c9ff" toneMapped={false} />
      </mesh>
      <mesh position={[0.554, 0, 0]}>
        <boxGeometry args={[0.006, 0.65, 0.003]} />
        <meshBasicMaterial color="#77c9ff" toneMapped={false} />
      </mesh>
    </group>
  );
}
