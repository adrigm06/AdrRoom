import { useId } from 'react';
import { useTranslation, type Lang } from '@/hooks/useLanguage';

export default function RecruiterShortcut({ lang, onOpen }: { lang: Lang; onOpen: () => void }) {
  const { t } = useTranslation(lang);
  const descriptionId = useId();
  return <button type="button" className="recruiter-shortcut" onClick={onOpen} aria-label={t('recruiter_label')} aria-describedby={descriptionId} aria-haspopup="dialog">
    <span className="recruiter-shortcut-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="7" width="18" height="14" rx="4" stroke="currentColor" strokeWidth="1.6" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13c5 3 13 3 18 0M12 12v5" stroke="currentColor" strokeWidth="1.6" /></svg></span>
    <span className="recruiter-shortcut-copy"><strong>{t('recruiter_label')}</strong><small id={descriptionId}>{t('recruiter_shortcut_description')}</small></span>
    <span className="recruiter-shortcut-arrow" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="m4 2 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
  </button>;
}
