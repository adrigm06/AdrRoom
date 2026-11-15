import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import matter from 'gray-matter';
import { initialPlayback, playbackReducer, selectRecruiterProjects, sceneStep, RECRUITER_PROJECT_IDS, recruiterNavigation, navigateRecruiterProject } from '../src/lib/recruiter.js';

type Localized = Record<'es' | 'en', string>;
type CaseFixture = Record<'headline' | 'problem' | 'contribution' | 'decision' | 'result' | 'limitations' | 'sceneDescription', Localized> & {
  sceneCopy: Record<string, Localized>;
  sceneSteps: Record<'es' | 'en', string[]>;
  evidence: Array<{ url: string }>;
};

describe('independent recruiter project pages', () => {
  it('starts on Android and advances through the editorial order without wrapping', () => {
    let index = 0;
    expect(RECRUITER_PROJECT_IDS[index]).toBe('android-skill-pkg');
    index = navigateRecruiterProject(index, { type: 'next' }, 3);
    expect(RECRUITER_PROJECT_IDS[index]).toBe('komea');
    index = navigateRecruiterProject(index, { type: 'next' }, 3);
    expect(RECRUITER_PROJECT_IDS[index]).toBe('avisia');
    expect(navigateRecruiterProject(index, { type: 'next' }, 3)).toBe(2);
  });
  it('disables unavailable arrows at either boundary and never wraps backwards', () => {
    expect(recruiterNavigation(0, 3)).toEqual({ index: 0, hasPrevious: false, hasNext: true });
    expect(recruiterNavigation(2, 3)).toEqual({ index: 2, hasPrevious: true, hasNext: false });
    expect(navigateRecruiterProject(0, { type: 'previous' }, 3)).toBe(0);
    expect(navigateRecruiterProject(2, { type: 'previous' }, 3)).toBe(1);
  });
  it('allows direct project selection and bounds invalid or empty input', () => {
    expect(navigateRecruiterProject(0, { type: 'select', index: 2 }, 3)).toBe(2);
    expect(navigateRecruiterProject(2, { type: 'select', index: 0 }, 3)).toBe(0);
    expect(navigateRecruiterProject(0, { type: 'select', index: 40 }, 3)).toBe(2);
    expect(navigateRecruiterProject(0, { type: 'select', index: -4 }, 3)).toBe(0);
    expect(recruiterNavigation(8, 0)).toEqual({ index: 0, hasPrevious: false, hasNext: false });
  });
});

describe('recruiter tour playback', () => {
  it('advances to a bounded, stable final frame', () => {
    const state = playbackReducer(initialPlayback(), { type: 'tick', delta: 50000 });
    expect(state.elapsed).toBe(8000);
    expect(sceneStep(state.elapsed)).toBe(4);
    expect(playbackReducer(state, { type: 'tick', delta: 100 })).toEqual(state);
  });
  it('pauses without losing elapsed time and resumes deliberately', () => {
    const started = playbackReducer(initialPlayback(), { type: 'tick', delta: 2100 });
    const paused = playbackReducer(started, { type: 'toggle' });
    expect(playbackReducer(paused, { type: 'tick', delta: 3000 })).toEqual(paused);
    expect(playbackReducer(playbackReducer(paused, { type: 'toggle' }), { type: 'tick', delta: 100 }).elapsed).toBe(2200);
  });
  it('skip completes immediately; replay starts a new unpaused sequence', () => {
    const final = playbackReducer(initialPlayback(), { type: 'skip' });
    expect(sceneStep(final.elapsed)).toBe(4);
    expect(playbackReducer(final, { type: 'replay' })).toEqual(initialPlayback());
  });
  it('rejects negative deltas and supports the reduced-motion final frame', () => {
    expect(playbackReducer(initialPlayback(), { type: 'tick', delta: -10 })).toEqual(initialPlayback());
    expect(sceneStep(0, true)).toBe(4);
  });
});

describe('recruiter editorial selection', () => {
  const entries = RECRUITER_PROJECT_IDS.map(id => ({ data: { id, caseStudy: matter(readFileSync(new URL(`../src/content/projects/${id}.mdx`, import.meta.url), 'utf8')).data.caseStudy as CaseFixture } }));
  it('orders selected projects independently of collection ordering and omits unavailable cases', () => {
    expect(selectRecruiterProjects([...entries].reverse()).map(entry => entry.data.id)).toEqual([...RECRUITER_PROJECT_IDS]);
    expect(selectRecruiterProjects([{ data: { id: 'other' } }])).toEqual([]);
    expect(selectRecruiterProjects([{ data: { id: 'komea' } }])).toEqual([]);
  });
  it('provides five honest narrative fields, scene labels and evidence in both languages', () => {
    for (const entry of entries) {
      const study = entry.data.caseStudy;
      expect(study).toBeDefined();
      for (const lang of ['es', 'en'] as const) {
        for (const field of ['headline', 'problem', 'contribution', 'decision', 'result', 'limitations', 'sceneDescription'] as const) {
          expect(study[field][lang].length).toBeGreaterThan(20);
        }
        expect(study.sceneSteps[lang]).toHaveLength(5);
        for (const copy of Object.values(study.sceneCopy)) {
          expect(copy[lang].length).toBeGreaterThan(0);
        }
      }
      expect(study.evidence.length).toBeGreaterThan(0);
      for (const evidence of study.evidence) expect(evidence.url).toMatch(/^(https:\/\/|\/projects\/)/);
    }
  });
  it('keeps evidence assets local when no public product link exists', () => {
    const komea = entries.find(entry => entry.data.id === 'komea');
    for (const evidence of komea?.data.caseStudy.evidence ?? []) {
      expect(readFileSync(new URL(`../public${evidence.url}`, import.meta.url)).length).toBeGreaterThan(0);
    }
  });
});
