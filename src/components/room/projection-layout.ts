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
