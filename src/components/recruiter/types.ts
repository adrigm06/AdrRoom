import type { ProjectEntry } from '@/components/os/Desktop';
import type { Lang } from '@/hooks/useLanguage';

export type CaseStudy = NonNullable<ProjectEntry['data']['caseStudy']>;
export interface SceneProps { study: CaseStudy; lang: Lang; step: number; playing: boolean; reducedMotion: boolean }
export const sceneText = (study: CaseStudy, lang: Lang, key: string) => study.sceneCopy[key]?.[lang] ?? key;
