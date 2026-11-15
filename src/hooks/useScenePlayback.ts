import { useEffect, useReducer, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { initialPlayback, playbackReducer, SCENE_DURATION, sceneStep } from '@/lib/recruiter';

/** A finite, viewport-aware illustration. No timer survives a pause or unmount. */
export function useScenePlayback() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.25 });
  const reducedMotion = Boolean(useReducedMotion());
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [state, dispatch] = useReducer(playbackReducer, undefined, initialPlayback);
  const complete = reducedMotion || state.elapsed >= SCENE_DURATION;
  const playing = inView && !hidden && !state.paused && !complete;

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      dispatch({ type: 'tick', delta: now - previous });
      previous = now;
    }, 100);
    return () => window.clearInterval(timer);
  }, [playing]);

  return { ref, state, dispatch, step: sceneStep(state.elapsed, reducedMotion), playing, complete, reducedMotion };
}
