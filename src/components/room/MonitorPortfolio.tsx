import type { Lang } from './language';
import './monitor-portfolio.css';

const COPY = {
  es: {
    eyebrow: 'PORTFOLIO INTERACTIVO · 2026',
    title: 'Bienvenido a AdrRoom.',
    description: 'Una habitación 3D que convierte un portfolio en un espacio para explorar.',
    project: 'Proyecto destacado',
    projectName: 'AdrRoom',
    projectDescription: 'Modelado en Blender · Web 3D · Interacción',
    action: 'Ver código en GitHub',
    note: 'Arrastra fuera de este panel para volver a mirar alrededor.',
  },
  en: {
    eyebrow: 'INTERACTIVE PORTFOLIO · 2026',
    title: 'Welcome to AdrRoom.',
    description: 'A 3D room that turns a portfolio into a space to explore.',
    project: 'Featured project',
    projectName: 'AdrRoom',
    projectDescription: 'Blender modeling · 3D web · Interaction',
    action: 'Explore on GitHub',
    note: 'Press Escape or use the button to return to the room.',
  },
} as const;

export default function MonitorPortfolio({ lang }: { lang: Lang }) {
  const copy = COPY[lang];

  return (
    <main className="monitor-portfolio" lang={lang}>
      <header className="monitor-portfolio__topbar">
        <a className="monitor-portfolio__brand" href="https://github.com/adrigm06/AdrRoom">
          <span className="monitor-portfolio__mark" aria-hidden="true">a</span>
          <span>AdrRoom</span>
        </a>
        <span className="monitor-portfolio__status">
          <span aria-hidden="true" />
          {copy.eyebrow}
        </span>
      </header>

      <section className="monitor-portfolio__content">
        <div className="monitor-portfolio__intro">
          <p className="monitor-portfolio__label">{copy.project}</p>
          <h1>{copy.title}</h1>
          <p className="monitor-portfolio__description">{copy.description}</p>
          <a className="monitor-portfolio__action" href="https://github.com/adrigm06/AdrRoom">
            {copy.action}
            <span aria-hidden="true">↗</span>
          </a>
        </div>

        <article className="monitor-portfolio__card">
          <div className="monitor-portfolio__card-art" aria-hidden="true">
            <span className="monitor-portfolio__sun" />
            <span className="monitor-portfolio__window">
              <span />
              <span />
              <span />
            </span>
            <span className="monitor-portfolio__card-mark">a</span>
          </div>
          <div className="monitor-portfolio__card-copy">
            <div>
              <span className="monitor-portfolio__label">{copy.project}</span>
              <h2>{copy.projectName}</h2>
            </div>
            <p>{copy.projectDescription}</p>
          </div>
        </article>
      </section>

      <footer className="monitor-portfolio__footer">
        <span>ADRROOM / 01</span>
        <span>{copy.note}</span>
      </footer>
    </main>
  );
}
