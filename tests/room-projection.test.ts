import { describe, expect, it } from 'vitest';
import { getBeamSegment, PANEL_POSITION, PROJECTOR_ORIGIN, PROJECTION_BEAM_LENGTH } from '../src/components/room/projection-layout.js';

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
});
