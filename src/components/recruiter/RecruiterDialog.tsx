import { lazy, Suspense, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ProjectEntry } from '@/components/os/Desktop';
import type { Lang } from '@/hooks/useLanguage';
import { useTranslation } from '@/hooks/useLanguage';
import '@/styles/recruiter.css';

const RecruiterTour = lazy(() => import('./RecruiterTour'));
interface Props {
  projects: ProjectEntry[];
  lang: Lang;
  onClose: () => void;
  onOpenCv: () => void;
  onOpenContact: () => void;
  onToggleLang: () => void;
}

export default function RecruiterDialog(props: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useTranslation(props.lang);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  return createPortal(
    <dialog ref={ref} className="recruiter-dialog" aria-labelledby="recruiter-title" onCancel={event => { event.preventDefault(); props.onClose(); }}>
      <div className="recruiter-shell">
        <header className="recruiter-bar">
          <span className="recruiter-brand">AdrOS <span>/ {t('recruiter_label')}</span></span>
          <div className="recruiter-bar-actions">
            <button type="button" onClick={props.onToggleLang} aria-label={t('recruiter_language')}>{props.lang === 'es' ? 'EN' : 'ES'}</button>
            <button type="button" onClick={props.onClose} className="recruiter-exit" autoFocus>{t('recruiter_exit')} <span aria-hidden="true">↗</span></button>
          </div>
        </header>
        <Suspense fallback={<div className="recruiter-loading" role="status">{t('recruiter_loading')}</div>}>
          <RecruiterTour {...props} />
        </Suspense>
      </div>
    </dialog>, document.body,
  );
}
