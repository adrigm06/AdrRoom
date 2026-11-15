import { useEffect, useRef, useState } from 'react';
import type { ProjectEntry } from '@/components/os/Desktop';
import type { Lang } from '@/hooks/useLanguage';
import { useTranslation } from '@/hooks/useLanguage';
import { navigateRecruiterProject, recruiterNavigation, selectRecruiterProjects, type ProjectNavigation } from '@/lib/recruiter';
import RecruiterSection from './RecruiterSection';

interface Props { projects: ProjectEntry[]; lang: Lang; onOpenCv: () => void; onOpenContact: () => void }
const projectName = (project: ProjectEntry) => project.data.caseStudy?.scene === 'android' ? 'Android Engineering Skill' : project.data.title;

export default function RecruiterTour({ projects, lang, onOpenCv, onOpenContact }: Props) {
  const { t } = useTranslation(lang);
  const [activeIndex, setActiveIndex] = useState(0);
  const pageRef = useRef<HTMLElement>(null);
  const focusAfterNavigation = useRef(false);
  const selected = selectRecruiterProjects(projects);
  const navigation = recruiterNavigation(activeIndex, selected.length);
  const active = selected[navigation.index];

  const navigate = (action: ProjectNavigation) => {
    const next = navigateRecruiterProject(navigation.index, action, selected.length);
    if (next === navigation.index) return;
    focusAfterNavigation.current = true;
    setActiveIndex(next);
  };

  useEffect(() => {
    if (!focusAfterNavigation.current) return;
    focusAfterNavigation.current = false;
    pageRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    pageRef.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }, [active?.data.id]);

  return (
    <div className="recruiter-pages" data-project={active?.data.caseStudy?.scene}>
      <h1 id="recruiter-title" className="sr-only">{t('recruiter_label')}</h1>
      <div className="recruiter-pagination-header">
        <nav className="recruiter-project-tabs" aria-label={t('recruiter_navigation')}>
          {selected.map((project, index) => (
            <button key={project.data.id} type="button" aria-current={index === navigation.index ? 'page' : undefined}
              onClick={() => navigate({ type: 'select', index })}>
              <span>0{index + 1}</span><span>{projectName(project)}</span>
            </button>
          ))}
        </nav>
        <div className="recruiter-project-actions">
          <button type="button" onClick={onOpenCv}>{t('recruiter_cv')} <span aria-hidden="true">↗</span></button>
          <button type="button" onClick={onOpenContact}>{t('recruiter_contact')} <span aria-hidden="true">↗</span></button>
        </div>
      </div>
      <main key={active?.data.id ?? 'empty'} className="recruiter-project-page" ref={pageRef}>
        {active ? <RecruiterSection key={active.data.id} project={active} lang={lang} index={navigation.index} /> : <p className="recruiter-loading">{t('recruiter_no_projects')}</p>}
      </main>
      <footer className="recruiter-pager" aria-label={t('recruiter_page_controls')}>
        <button type="button" disabled={!navigation.hasPrevious} onClick={() => navigate({ type: 'previous' })}>
          <span aria-hidden="true">←</span> {t('recruiter_previous_project')}
        </button>
        <p className="recruiter-page-status" role="status" aria-live="polite" aria-atomic="true">
          <span>{String(navigation.index + (active ? 1 : 0)).padStart(2, '0')} / {String(selected.length).padStart(2, '0')}</span>
          <strong>{active ? projectName(active) : t('recruiter_no_projects')}</strong>
        </p>
        <button type="button" disabled={!navigation.hasNext} onClick={() => navigate({ type: 'next' })}>
          {t('recruiter_next_project')} <span aria-hidden="true">→</span>
        </button>
      </footer>
    </div>
  );
}
