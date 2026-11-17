import { useEffect, useRef } from 'react';
import type { Lang } from '@/hooks/useLanguage';
import {
  CAREER_NOTES,
  EVIDENCE_LABELS,
  SKILL_THEMES,
} from './room-editorial-content';
import type { EvidenceType, RoomLang } from './room-editorial-content';

interface RoomEditorialPanelProps {
  lang: Lang;
  section: 'corkboard' | 'library';
  onClose: () => void;
}

export default function RoomEditorialPanel({
  lang,
  section,
  onClose,
}: RoomEditorialPanelProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const isSpanish = lang === 'es';

  useEffect(() => {
    closeButton.current?.focus();
  }, [section]);

  return (
    <section
      className="room-editorial-panel"
      role="region"
      aria-labelledby="room-editorial-title"
      aria-describedby="room-editorial-intro"
    >
      <button
        ref={closeButton}
        className="room-editorial-panel__close"
        type="button"
        onClick={onClose}
        aria-label={isSpanish ? 'Cerrar y volver a la habitación' : 'Close and return to the room'}
      >
        ×
      </button>
      <p className="room-editorial-panel__eyebrow">
        {section === 'corkboard'
          ? (isSpanish ? 'TRAYECTORIA' : 'CAREER')
          : (isSpanish ? 'BIBLIOTECA DE HABILIDADES' : 'SKILL LIBRARY')}
      </p>
      <h1 id="room-editorial-title">
        {section === 'corkboard'
          ? (isSpanish ? 'Mi recorrido' : 'My journey')
          : (isSpanish ? 'Cómo trabajo' : 'How I work')}
      </h1>
      <p id="room-editorial-intro" className="room-editorial-panel__intro">
        {isSpanish
          ? 'Borrador editorial para revisión. Los textos aún no están aprobados para publicación.'
          : 'Editorial draft for review. This copy is not yet approved for publication.'}
      </p>

      {section === 'corkboard' ? (
        <ol className="room-editorial-list room-editorial-list--career">
          {CAREER_NOTES.map((note) => (
            <li key={note.id}>
              <h2>{note.title[lang]}</h2>
              {note.period && <span className="room-editorial-period">{note.period[lang]}</span>}
              <p>{note.summary[lang]}</p>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="room-editorial-list room-editorial-list--skills">
          {SKILL_THEMES.map((theme) => (
            <li key={theme.id}>
              <div className="room-editorial-list__heading">
                <h2>{theme.title[lang]}</h2>
                <EvidenceLabel evidence={theme.evidence} lang={lang} />
              </div>
              <p>{theme.summary[lang]}</p>
              <ul className="room-editorial-tags" aria-label={isSpanish ? 'Herramientas' : 'Tools'}>
                {theme.tools.map((tool) => <li key={tool}>{tool}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EvidenceLabel({ evidence, lang }: { evidence: EvidenceType; lang: RoomLang }) {
  return (
    <span className="room-editorial-evidence">
      {EVIDENCE_LABELS[evidence][lang]}
    </span>
  );
}
