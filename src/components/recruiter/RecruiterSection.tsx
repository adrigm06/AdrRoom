import { useRef } from 'react';
import type { ProjectEntry } from '@/components/os/Desktop';
import { useTranslation, type Lang } from '@/hooks/useLanguage';
import { useScenePlayback } from '@/hooks/useScenePlayback';
import AndroidScene from './scenes/AndroidScene';
import KomeaScene from './scenes/KomeaScene';
import AvisiaScene from './scenes/AvisiaScene';

const fields = ['problem', 'contribution', 'decision', 'result', 'limitations'] as const;
interface Props { project: ProjectEntry; lang: Lang; index: number }

export default function RecruiterSection({ project, lang, index }: Props) {
  const study = project.data.caseStudy;
  const { t } = useTranslation(lang);
  const playback = useScenePlayback();
  const caseRef = useRef<HTMLDivElement>(null);
  if (!study) return null;
  const Scene = { android: AndroidScene, komea: KomeaScene, avisia: AvisiaScene }[study.scene];
  const skip = () => {
    playback.dispatch({ type: 'skip' });
    if (window.matchMedia('(min-width: 900px)').matches) {
      caseRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      caseRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
    caseRef.current?.focus({ preventScroll: true });
  };
  return (
    <section id={`recruiter-${project.data.id}`} className={`recruiter-section recruiter-${study.scene}`} tabIndex={-1} aria-labelledby={`title-${project.data.id}`}>
      <div className="recruiter-section-heading"><span className="recruiter-section-number">0{index + 1}</span><div><p className="recruiter-eyebrow">{study.scene === 'android' ? 'Android Engineering Skill' : project.data.title}</p><h2 id={`title-${project.data.id}`} tabIndex={-1}>{study.headline[lang]}</h2></div></div>
      <div className="recruiter-project-body">
      <div className="recruiter-visual-column">
      <div className={`recruiter-stage ${playback.playing ? 'is-playing' : 'is-paused'}`} ref={playback.ref}>
        <div className="recruiter-stage-top"><span className="recruiter-eyebrow">{t('recruiter_illustration')}</span><span className="recruiter-stage-count">0{playback.step + 1} / 05</span></div>
        <Scene study={study} lang={lang} step={playback.step} playing={playback.playing} reducedMotion={playback.reducedMotion} />
        <div className="recruiter-stage-caption"><span aria-hidden="true">↳</span><p>{study.sceneSteps[lang][playback.step]}</p><span className="recruiter-stage-status">{playback.reducedMotion ? t('recruiter_static') : playback.complete ? t('recruiter_complete') : playback.state.paused ? t('recruiter_paused') : t('recruiter_demo')}</span></div>
      </div>
      <div className="recruiter-scene-controls">
        <div><button type="button" disabled={playback.complete || playback.reducedMotion} onClick={() => playback.dispatch({ type: 'toggle' })}>{playback.state.paused ? t('recruiter_resume') : t('recruiter_pause')}</button><button type="button" disabled={playback.reducedMotion} onClick={() => playback.dispatch({ type: 'replay' })}>{t('recruiter_replay')}</button></div>
        <button type="button" onClick={skip}>{t('recruiter_skip')} <span aria-hidden="true">↓</span></button>
      </div>
      <p className="recruiter-disclaimer">{study.sceneDescription[lang]}</p>
      </div>
      <div className="recruiter-case" ref={caseRef} tabIndex={0} role="region" aria-label={`${t('recruiter_case')} · ${project.data.title}`}>
        {fields.map((field, fieldIndex) => <div className={`recruiter-case-row recruiter-case-${field}`} key={field}><h3><span>0{fieldIndex + 1}</span>{t(`recruiter_${field}`)}</h3><p>{study[field][lang]}</p></div>)}
        <div className="recruiter-evidence"><span>{t('recruiter_evidence')}</span><div>{study.evidence.map(evidence => <a key={evidence.url} href={evidence.url} target="_blank" rel="noopener noreferrer">{evidence.label[lang]} <span aria-hidden="true">↗</span></a>)}</div></div>
      </div>
      </div>
    </section>
  );
}
