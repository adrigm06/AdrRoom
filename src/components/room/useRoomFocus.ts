import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { gsap } from 'gsap';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { FOCUS_TARGETS } from './focus-targets';
import type { FocusTarget } from './focus-targets';

export type RoomFocusPhase = 'room' | 'approaching' | 'focused' | 'returning';

export interface RoomFocusState {
  target: FocusTarget | null;
  phase: RoomFocusPhase;
}

interface CameraSnapshot {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

interface UseRoomFocusOptions {
  camera: THREE.Camera;
  controls: RefObject<OrbitControlsImpl | null>;
  viewport: { width: number; height: number };
  onStateChange: (state: RoomFocusState) => void;
}

const INITIAL_STATE: RoomFocusState = { target: null, phase: 'room' };

export default function useRoomFocus({
  camera,
  controls,
  viewport,
  onStateChange,
}: UseRoomFocusOptions) {
  const [state, setState] = useState(INITIAL_STATE);
  const stateRef = useRef(INITIAL_STATE);
  const snapshot = useRef<CameraSnapshot | null>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);

  const publish = useCallback((next: RoomFocusState) => {
    stateRef.current = next;
    setState(next);
    onStateChange(next);
  }, [onStateChange]);

  const updateCamera = useCallback(() => {
    const target = controls.current?.target;
    if (!target) return;
    camera.lookAt(target);
    if (camera instanceof THREE.PerspectiveCamera) camera.updateProjectionMatrix();
  }, [camera, controls]);

  const focus = useCallback((targetId: FocusTarget): Promise<boolean> => {
    const control = controls.current;
    const current = stateRef.current;
    if (
      !control
      || current.phase !== 'room'
      || !(camera instanceof THREE.PerspectiveCamera)
    ) return Promise.resolve(false);

    const config = FOCUS_TARGETS[targetId];
    const aspect = viewport.width / Math.max(1, viewport.height);
    const halfVerticalFov = Math.tan(THREE.MathUtils.degToRad(config.fov / 2));
    const halfHorizontalFov = halfVerticalFov * Math.max(0.1, aspect);
    const distance = Math.max(
      config.width / (2 * halfHorizontalFov * config.fill),
      config.height / (2 * halfVerticalFov * config.fill),
    );
    const position = config.center.clone().add(
      config.normal.clone().normalize().multiplyScalar(distance),
    );

    snapshot.current = {
      position: camera.position.clone(),
      target: control.target.clone(),
      fov: camera.fov,
    };
    control.enabled = false;
    publish({ target: targetId, phase: 'approaching' });

    return new Promise((resolve) => {
      timeline.current?.kill();
      timeline.current = gsap.timeline({
        onUpdate: updateCamera,
        onComplete: () => {
          publish({ target: targetId, phase: 'focused' });
          resolve(true);
        },
        onInterrupt: () => resolve(false),
      })
        .to(camera.position, {
          x: position.x,
          y: position.y,
          z: position.z,
          duration: 1.1,
          ease: 'power3.inOut',
        }, 0)
        .to(control.target, {
          x: config.center.x,
          y: config.center.y,
          z: config.center.z,
          duration: 1.1,
          ease: 'power3.inOut',
        }, 0)
        .to(camera, { fov: config.fov, duration: 1.1, ease: 'power3.inOut' }, 0);
    });
  }, [camera, controls, publish, updateCamera, viewport.height, viewport.width]);

  const returnToRoom = useCallback((): Promise<void> => {
    const previous = snapshot.current;
    const control = controls.current;
    if (
      !previous
      || !control
      || !(camera instanceof THREE.PerspectiveCamera)
      || stateRef.current.phase === 'room'
    ) return Promise.resolve();

    control.enabled = false;
    publish({ target: stateRef.current.target, phase: 'returning' });
    timeline.current?.kill();

    return new Promise((resolve) => {
      timeline.current = gsap.timeline({
        onUpdate: updateCamera,
        onComplete: resolve,
      })
        .to(camera.position, {
          x: previous.position.x,
          y: previous.position.y,
          z: previous.position.z,
          duration: 0.95,
          ease: 'power3.inOut',
        }, 0)
        .to(control.target, {
          x: previous.target.x,
          y: previous.target.y,
          z: previous.target.z,
          duration: 0.95,
          ease: 'power3.inOut',
        }, 0)
        .to(camera, { fov: previous.fov, duration: 0.95, ease: 'power3.inOut' }, 0);
    });
  }, [camera, controls, publish, updateCamera]);

  const finishReturn = useCallback(() => {
    const control = controls.current;
    const previous = snapshot.current;
    if (control && previous) {
      control.target.copy(previous.target);
      control.enabled = true;
      updateCamera();
    }
    snapshot.current = null;
    timeline.current = null;
    publish(INITIAL_STATE);
  }, [controls, publish, updateCamera]);

  const getState = useCallback(() => stateRef.current, []);

  useEffect(() => () => {
    timeline.current?.kill();
  }, []);

  return { state, focus, returnToRoom, finishReturn, getState };
}
