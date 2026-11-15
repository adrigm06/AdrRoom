export const RECRUITER_PROJECT_IDS = ['android-skill-pkg', 'komea', 'avisia'] as const;
export const SCENE_DURATION = 8000;
export const RECRUITER_WINDOW_ID = 'recruiter';

export type ProjectNavigation = { type: 'previous' | 'next' } | { type: 'select'; index: number };

export function recruiterNavigation(current: number, count: number) {
  const last = Math.max(0, count - 1);
  const index = Math.max(0, Math.min(last, Number.isFinite(current) ? Math.trunc(current) : 0));
  return { index, hasPrevious: index > 0, hasNext: count > 0 && index < last };
}

export function navigateRecruiterProject(current: number, action: ProjectNavigation, count: number): number {
  const { index } = recruiterNavigation(current, count);
  const target = action.type === 'select' ? action.index : index + (action.type === 'next' ? 1 : -1);
  return recruiterNavigation(target, count).index;
}

export function selectRecruiterProjects<T extends { data: { id: string; caseStudy?: unknown } }>(projects: T[]): T[] {
  return RECRUITER_PROJECT_IDS.flatMap(id => {
    const entry = projects.find(project => project.data.id === id && project.data.caseStudy);
    return entry ? [entry] : [];
  });
}

export interface PlaybackState { elapsed: number; paused: boolean }
export type PlaybackEvent = { type: 'tick'; delta: number } | { type: 'toggle' | 'replay' | 'skip' };
export const initialPlayback = (): PlaybackState => ({ elapsed: 0, paused: false });

export function playbackReducer(state: PlaybackState, event: PlaybackEvent): PlaybackState {
  switch (event.type) {
    case 'replay': return initialPlayback();
    case 'skip': return { elapsed: SCENE_DURATION, paused: false };
    case 'toggle': return { ...state, paused: !state.paused };
    case 'tick': return state.paused ? state : { ...state, elapsed: Math.min(SCENE_DURATION, state.elapsed + Math.max(0, event.delta)) };
  }
}

export function sceneStep(elapsed: number, reducedMotion = false): number {
  return reducedMotion ? 4 : Math.min(4, Math.floor(elapsed / (SCENE_DURATION / 4)));
}
