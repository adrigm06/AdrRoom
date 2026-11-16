import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { normalizeRoomObjectName } from './model-object-names';

const MODEL_URL = '/models/room.glb';
const EYE_NAMES = new Set(['Robot_pet_|_eye', 'Robot_pet_|_eye001']);
const BEZEL_NAME = 'monitor bezel';
const SHELL_NAME = 'robot pet rounded shell';
const PANORAMA_MASK_NAME = 'panorama depth mask';
const EYE_TRAVEL = { x: 0.026, y: 0.018 };

interface EmissiveMaterialState {
  material: THREE.MeshStandardMaterial;
  color: THREE.Color;
  intensity: number;
}

export interface RobotMouthCommands {
  play: (open: boolean) => void;
}

interface RoomModelProps {
  monitorHovered?: boolean;
  robotHovered?: boolean;
  mouthCommands: { current: RobotMouthCommands | null };
}

export default function RoomModel({
  monitorHovered = false,
  robotHovered = false,
  mouthCommands,
}: RoomModelProps) {
  const { scene, animations } = useGLTF(MODEL_URL);
  const canvas = useThree((state) => state.gl.domElement);
  const eyes = useRef<THREE.Object3D[]>([]);
  const pointer = useRef(new THREE.Vector2());
  const reducedMotion = useRef(false);
  const bezelMaterials = useRef<EmissiveMaterialState[]>([]);
  const shellMaterials = useRef<EmissiveMaterialState[]>([]);
  const model = useMemo(() => {
    const copy = scene.clone(true);
    const foundEyes: THREE.Object3D[] = [];
    const oldBackdrop: THREE.Object3D[] = [];
    const clonedBezelMaterials: EmissiveMaterialState[] = [];
    const clonedShellMaterials: EmissiveMaterialState[] = [];
    copy.traverse((object) => {
      const normalizedName = normalizeRoomObjectName(object.name);
      if (
        object instanceof THREE.Mesh
        && normalizedName.includes(PANORAMA_MASK_NAME)
      ) {
        object.material = new THREE.MeshBasicMaterial({
          colorWrite: false,
          depthWrite: true,
          side: THREE.DoubleSide,
        });
        object.renderOrder = -1;
        object.frustumCulled = false;
      }
      if (EYE_NAMES.has(object.name)) {
        object.userData.home = object.position.clone();
        foundEyes.push(object);
      }
      if (normalizedName === BEZEL_NAME && object instanceof THREE.Mesh) {
        const originals = Array.isArray(object.material) ? object.material : [object.material];
        const clones = originals.map((original) => original.clone());
        object.material = Array.isArray(object.material) ? clones : clones[0];
        for (const material of clones) {
          if (material instanceof THREE.MeshStandardMaterial) {
            clonedBezelMaterials.push({
              material,
              color: material.emissive.clone(),
              intensity: material.emissiveIntensity,
            });
          }
        }
      }
      if (normalizedName === SHELL_NAME && object instanceof THREE.Mesh) {
        const originals = Array.isArray(object.material) ? object.material : [object.material];
        const clones = originals.map((original) => original.clone());
        object.material = Array.isArray(object.material) ? clones : clones[0];
        for (const material of clones) {
          if (material instanceof THREE.MeshStandardMaterial) {
            clonedShellMaterials.push({
              material,
              color: material.emissive.clone(),
              intensity: material.emissiveIntensity,
            });
          }
        }
      }
      if (
        normalizedName.startsWith('exterior ')
        || normalizedName.startsWith('distant city ')
      ) {
        oldBackdrop.push(object);
      }
    });
    for (const object of oldBackdrop) object.removeFromParent();
    eyes.current = foundEyes;
    bezelMaterials.current = clonedBezelMaterials;
    shellMaterials.current = clonedShellMaterials;
    return copy;
  }, [scene]);

  const mouthAnimation = useMemo(() => {
    const clip = animations.find((animation) => animation.name === 'AN_Robot_Mouth_Projection');
    if (!clip) return null;
    const mixer = new THREE.AnimationMixer(model);
    return { mixer, action: mixer.clipAction(clip), duration: clip.duration };
  }, [animations, model]);

  useEffect(() => {
    const play = (open: boolean) => {
      const animation = mouthAnimation;
      if (!animation) return;
      const { action, duration } = animation;
      action.stop();
      action.reset();
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.timeScale = open ? 1 : -1;
      action.time = open ? 0 : duration;
      action.play();
    };
    mouthCommands.current = { play };
    return () => {
      mouthCommands.current = null;
      mouthAnimation?.mixer.stopAllAction();
    };
  }, [mouthAnimation, mouthCommands]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateReducedMotion = () => {
      reducedMotion.current = media.matches;
      if (media.matches) pointer.current.set(0, 0);
    };
    const trackPointer = (event: PointerEvent) => {
      if (reducedMotion.current) return;
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      const y = 1 - ((event.clientY - bounds.top) / bounds.height) * 2;
      pointer.current.set(
        THREE.MathUtils.clamp(x, -1, 1),
        THREE.MathUtils.clamp(y, -1, 1),
      );
    };
    const resetPointer = () => pointer.current.set(0, 0);

    updateReducedMotion();
    media.addEventListener('change', updateReducedMotion);
    window.addEventListener('pointermove', trackPointer, { passive: true });
    window.addEventListener('pointerleave', resetPointer);
    return () => {
      media.removeEventListener('change', updateReducedMotion);
      window.removeEventListener('pointermove', trackPointer);
      window.removeEventListener('pointerleave', resetPointer);
    };
  }, [canvas]);

  useEffect(() => {
    for (const { material, color, intensity } of bezelMaterials.current) {
      material.emissive.copy(monitorHovered ? new THREE.Color('#1479dc') : color);
      material.emissiveIntensity = monitorHovered ? 1.35 : intensity;
    }
  }, [monitorHovered]);

  useEffect(() => {
    for (const { material, color, intensity } of shellMaterials.current) {
      material.emissive.copy(robotHovered ? new THREE.Color('#319cff') : color);
      material.emissiveIntensity = robotHovered ? 0.72 : intensity;
    }
  }, [robotHovered]);

  useFrame((_, delta) => {
    mouthAnimation?.mixer.update(delta);
    for (const eye of eyes.current) {
      const home = eye.userData.home as THREE.Vector3;
      const targetX = home.x + pointer.current.x * EYE_TRAVEL.x;
      const targetY = home.y + pointer.current.y * EYE_TRAVEL.y;
      eye.position.x = reducedMotion.current
        ? home.x
        : THREE.MathUtils.damp(eye.position.x, targetX, 16, delta);
      eye.position.y = reducedMotion.current
        ? home.y
        : THREE.MathUtils.damp(eye.position.y, targetY, 16, delta);
    }
  });

  return <primitive object={model} />;
}
