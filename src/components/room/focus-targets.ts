import * as THREE from 'three';

export type FocusTarget = 'monitor' | 'robot' | 'corkboard' | 'library';

export interface FocusTargetConfig {
  center: THREE.Vector3;
  normal: THREE.Vector3;
  width: number;
  height: number;
  fov: number;
  fill: number;
}

export const FOCUS_TARGETS: Record<FocusTarget, FocusTargetConfig> = {
  monitor: {
    center: new THREE.Vector3(0, 1.56, -1.399),
    normal: new THREE.Vector3(0, 0, 1),
    width: 1.015,
    height: 0.565,
    fov: 38,
    fill: 0.82,
  },
  robot: {
    center: new THREE.Vector3(0.91, 1.315, -1.18),
    normal: new THREE.Vector3(0, 0, 1),
    width: 0.92,
    height: 1.08,
    fov: 38,
    fill: 0.82,
  },
  corkboard: {
    center: new THREE.Vector3(3.325, 1.73, -1.16),
    normal: new THREE.Vector3(-1, 0, 0),
    width: 1.24,
    height: 0.88,
    fov: 38,
    fill: 0.82,
  },
  library: {
    center: new THREE.Vector3(-3.04, 1.57, 1.71),
    normal: new THREE.Vector3(1, 0, 0),
    width: 3.42,
    height: 1.56,
    fov: 38,
    fill: 0.82,
  },
};

export function getFocusDistance(
  config: FocusTargetConfig,
  aspect: number,
): number {
  const safeAspect = Math.max(0.1, aspect);
  const halfVerticalFov = Math.tan(THREE.MathUtils.degToRad(config.fov / 2));
  const halfHorizontalFov = halfVerticalFov * safeAspect;
  const fill = THREE.MathUtils.clamp(config.fill, 0.1, 0.95);

  return Math.max(
    config.width / (2 * halfHorizontalFov * fill),
    config.height / (2 * halfVerticalFov * fill),
  );
}

export function getFocusPosition(
  config: FocusTargetConfig,
  aspect: number,
): THREE.Vector3 {
  return config.center.clone().add(
    config.normal.clone().normalize().multiplyScalar(getFocusDistance(config, aspect)),
  );
}
