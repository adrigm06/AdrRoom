import { describe, expect, it } from 'vitest';
import { FOCUS_TARGETS, getFocusDistance, getFocusPosition } from '../src/components/room/focus-targets.js';

describe('room camera focus framing', () => {
  it('frames the monitor and robot from the front', () => {
    for (const targetId of ['monitor', 'robot'] as const) {
      const config = FOCUS_TARGETS[targetId];
      const position = getFocusPosition(config, 16 / 9);

      expect(position.x).toBe(config.center.x);
      expect(position.y).toBe(config.center.y);
      expect(position.z).toBeGreaterThan(config.center.z);
    }
  });

  it('approaches the side-wall corkboard from inside the room', () => {
    const config = FOCUS_TARGETS.corkboard;
    const position = getFocusPosition(config, 16 / 9);

    expect(position.x).toBeLessThan(config.center.x);
    expect(position.y).toBe(config.center.y);
    expect(position.z).toBe(config.center.z);
  });

  it('moves farther away when the viewport gets narrow', () => {
    const config = FOCUS_TARGETS.robot;

    expect(getFocusDistance(config, 390 / 844))
      .toBeGreaterThan(getFocusDistance(config, 1440 / 960));
  });
});
