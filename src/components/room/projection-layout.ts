import * as THREE from 'three';

// Blender's Y-depth is negated into the web scene's Z axis.
export const PROJECTOR_ORIGIN: [number, number, number] = [0.76, 0.945, -1.289];
export const PANEL_POSITION: [number, number, number] = [0.96, 1.55, -1.18];
export const PROJECTION_BEAM_LENGTH = Math.hypot(
  ...PANEL_POSITION.map((value, index) => value - PROJECTOR_ORIGIN[index]),
);

/** A unit-height cylinder must grow from the emitter, not through its centre. */
export function getBeamSegment(progress: number): { length: number; centerOffset: number } {
  const length = PROJECTION_BEAM_LENGTH * Math.min(1, Math.max(0, progress));
  return { length, centerOffset: length / 2 };
}

export interface ScreenBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

const projectedPanelPosition = new THREE.Vector3();
const cameraSpacePanelPosition = new THREE.Vector3();

export function projectPanelPosition(
  camera: THREE.Camera,
  bounds: ScreenBounds,
  worldPosition: THREE.Vector3 = new THREE.Vector3(...PANEL_POSITION),
): { x: number; y: number; visible: boolean } {
  camera.updateMatrixWorld();
  const projected = projectedPanelPosition.copy(worldPosition).project(camera);
  const cameraSpace = cameraSpacePanelPosition
    .copy(worldPosition)
    .applyMatrix4(camera.matrixWorldInverse);

  return {
    x: bounds.left + (projected.x * 0.5 + 0.5) * bounds.width,
    y: bounds.top + (projected.y * -0.5 + 0.5) * bounds.height,
    visible: cameraSpace.z < 0 && projected.z >= -1 && projected.z <= 1,
  };
}
