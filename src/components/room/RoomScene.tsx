import { useEffect, useRef, useState } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { gsap } from 'gsap';
import * as THREE from 'three';
import type { ProjectEntry } from '@/components/os/Desktop';
import type { Lang } from '@/hooks/useLanguage';
import RoomModel from './RoomModel';
import RoomMonitor from './RoomMonitor';

interface RoomSceneProps {
  lang: Lang;
  projects: ProjectEntry[];
  focused: boolean;
  onFocusChange: (focused: boolean) => void;
  focusCommand: { current: (() => void) | null };
  returnCommand: { current: (() => void) | null };
}

// Blender's Z-up monitor coordinates are converted to Three.js Y-up by glTF.
const SCREEN_POSITION = new THREE.Vector3(0, 1.56, -1.399);
const SCREEN_FOV = 38;
const SCREEN_WIDTH = 1.015;
const ROOM_TARGET = new THREE.Vector3(0, 0.78, 0);

interface CameraSnapshot {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

export default function RoomScene({
  lang,
  projects,
  focused,
  onFocusChange,
  focusCommand,
  returnCommand,
}: RoomSceneProps) {
  const { camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const cameraTarget = useRef(ROOM_TARGET.clone());
  const snapshot = useRef<CameraSnapshot | null>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const focusedRef = useRef(focused);
  const viewport = useRef(size);
  const [screenVisible, setScreenVisible] = useState(false);
  const [monitorHovered, setMonitorHovered] = useState(false);
  focusedRef.current = focused;
  viewport.current = size;

  const updateCamera = () => {
    camera.lookAt(cameraTarget.current);
    if (camera instanceof THREE.PerspectiveCamera) camera.updateProjectionMatrix();
  };

  useEffect(() => {
    focusCommand.current = () => {
      if (!controls.current || focusedRef.current || !(camera instanceof THREE.PerspectiveCamera)) return;
      const aspect = viewport.current.width / Math.max(1, viewport.current.height);
      const distance = SCREEN_WIDTH / (
        0.82 * 2 * Math.tan(THREE.MathUtils.degToRad(SCREEN_FOV / 2)) * aspect
      );
      const screenPose = {
        x: SCREEN_POSITION.x,
        y: SCREEN_POSITION.y,
        z: SCREEN_POSITION.z + distance,
        fov: SCREEN_FOV,
      };
      snapshot.current = {
        position: camera.position.clone(),
        target: controls.current.target.clone(),
        fov: camera.fov,
      };
      cameraTarget.current.copy(controls.current.target);
      controls.current.enabled = false;
      onFocusChange(true);
      timeline.current?.kill();
      timeline.current = gsap.timeline({
        onUpdate: updateCamera,
        onComplete: () => {
          camera.position.set(screenPose.x, screenPose.y, screenPose.z);
          camera.fov = screenPose.fov;
          updateCamera();
          setScreenVisible(true);
        },
      })
        .to(camera.position, { x: screenPose.x, y: screenPose.y, z: screenPose.z, duration: 1.15, ease: 'power3.inOut' }, 0)
        .to(cameraTarget.current, { x: SCREEN_POSITION.x, y: SCREEN_POSITION.y, z: SCREEN_POSITION.z, duration: 1.15, ease: 'power3.inOut' }, 0)
        .to(camera, { fov: screenPose.fov, duration: 1.15, ease: 'power3.inOut' }, 0);
    };
    returnCommand.current = () => {
      const previous = snapshot.current;
      if (!previous || !(camera instanceof THREE.PerspectiveCamera)) return;
      setScreenVisible(false);
      timeline.current?.kill();
      cameraTarget.current.copy(SCREEN_POSITION);
      timeline.current = gsap.timeline({
        onUpdate: updateCamera,
        onComplete: () => {
          onFocusChange(false);
        },
      })
        .to(camera.position, { x: previous.position.x, y: previous.position.y, z: previous.position.z, duration: 0.95, ease: 'power3.inOut' }, 0)
        .to(cameraTarget.current, { x: previous.target.x, y: previous.target.y, z: previous.target.z, duration: 0.95, ease: 'power3.inOut' }, 0)
        .to(camera, { fov: previous.fov, duration: 0.95, ease: 'power3.inOut' }, 0);
      snapshot.current = null;
    };
    return () => {
      timeline.current?.kill();
      focusCommand.current = null;
      returnCommand.current = null;
    };
  }, [camera, focusCommand, onFocusChange, returnCommand]);

  return (
    <>
      <RoomModel monitorHovered={monitorHovered} />
      {!focused && (
        <OrbitControls
          ref={controls}
          target={[cameraTarget.current.x, cameraTarget.current.y, cameraTarget.current.z]}
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
      )}
      <RoomMonitor
        lang={lang}
        projects={projects}
        focused={focused}
        hovered={monitorHovered}
        screenVisible={screenVisible}
        onOpen={() => focusCommand.current?.()}
        onHoverChange={setMonitorHovered}
      />
    </>
  );
}
