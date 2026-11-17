import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  getBeamSegment,
  PANEL_POSITION,
  projectPanelPosition,
  PROJECTOR_ORIGIN,
  PROJECTION_BEAM_LENGTH,
} from '../src/components/room/projection-layout.js';

describe('robot projection alignment', () => {
  it('uses the actual emitter-to-panel distance, not a one-metre beam', () => {
    const distance = Math.hypot(
      ...PANEL_POSITION.map((value, axis) => value - PROJECTOR_ORIGIN[axis]),
    );
    expect(PROJECTION_BEAM_LENGTH).toBeCloseTo(distance);
    expect(getBeamSegment(1).length).toBeCloseTo(distance);
  });

  it('keeps the beam base attached to the mouth throughout deployment', () => {
    for (const progress of [0, 0.2, 0.5, 1]) {
      const { length, centerOffset } = getBeamSegment(progress);
      expect(centerOffset - length / 2).toBeCloseTo(0);
      expect(centerOffset + length / 2).toBeCloseTo(PROJECTION_BEAM_LENGTH * progress);
    }
  });

  it('clamps the beam to its two physical endpoints', () => {
    expect(getBeamSegment(-0.1).length).toBe(0);
    expect(getBeamSegment(1.5).length).toBe(PROJECTION_BEAM_LENGTH);
  });

  it('projects the hologram panel anchor into the canvas screen bounds', () => {
    const camera = new THREE.PerspectiveCamera(38, 4 / 3, 0.1, 100);
    const panel = new THREE.Vector3(...PANEL_POSITION);
    camera.position.copy(panel).add(new THREE.Vector3(0, 0, 3));
    camera.lookAt(panel);
    camera.updateMatrixWorld();

    const projected = projectPanelPosition(camera, {
      left: 30,
      top: 40,
      width: 800,
      height: 600,
    });
    expect(projected.x).toBeCloseTo(430);
    expect(projected.y).toBeCloseTo(340);
    expect(projected.visible).toBe(true);
  });

  it('hides the HTML panel anchor when the hologram is behind the camera', () => {
    const camera = new THREE.PerspectiveCamera(38, 4 / 3, 0.1, 100);
    const panel = new THREE.Vector3(...PANEL_POSITION);
    camera.position.copy(panel).add(new THREE.Vector3(0, 0, -3));
    camera.lookAt(panel.clone().add(new THREE.Vector3(0, 0, -4)));
    camera.updateMatrixWorld();

    expect(projectPanelPosition(camera, {
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    }).visible).toBe(false);
  });
});
