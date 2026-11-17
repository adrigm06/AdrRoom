export type RoomLang = 'es' | 'en';

export type EvidenceType = 'professional' | 'project' | 'exploration';

export interface CareerNote {
  id: string;
  title: Record<RoomLang, string>;
  summary: Record<RoomLang, string>;
  period?: Record<RoomLang, string>;
}

export interface SkillTheme {
  id: string;
  title: Record<RoomLang, string>;
  tools: string[];
  summary: Record<RoomLang, string>;
  evidence: EvidenceType;
}

// Editorial draft based on the locally confirmed CV; public wording requires user approval.
export const CAREER_NOTES: CareerNote[] = [
  {
    id: 'foundations',
    title: { es: 'Formación técnica', en: 'Technical foundations' },
    summary: {
      es: 'SMR, DAM y formación en Spring.',
      en: 'SMR, DAM and Spring training.',
    },
  },
  {
    id: 'backend',
    title: { es: 'Backend en equipo', en: 'Backend in a team' },
    summary: {
      es: 'Rewire · Java · Spring Boot · servicios compartidos.',
      en: 'Rewire · Java · Spring Boot · shared services.',
    },
    period: { es: 'feb–jun 2026', en: 'Feb–Jun 2026' },
  },
  {
    id: 'independent-work',
    title: { es: 'Desarrollo independiente', en: 'Independent development' },
    summary: {
      es: 'Integraciones, aplicaciones y automatización.',
      en: 'Integrations, applications and automation.',
    },
    period: { es: 'ene–ago 2026', en: 'Jan–Aug 2026' },
  },
  {
    id: 'aerospace',
    title: { es: 'Entorno aeroespacial', en: 'Aerospace environment' },
    summary: {
      es: 'DHV Technology · componentes y trabajo de precisión.',
      en: 'DHV Technology · components and precision work.',
    },
    period: { es: 'jul 2026–actualidad', en: 'Jul 2026–present' },
  },
];

export const SKILL_THEMES: SkillTheme[] = [
  {
    id: 'ai-agents',
    title: { es: 'IA y agentes', en: 'AI and agents' },
    tools: ['LLMs', 'RAG', 'MCP', 'tools'],
    summary: {
      es: 'Exploración y proyectos para conectar modelos con contexto y herramientas.',
      en: 'Exploration and projects connecting models with context and tools.',
    },
    evidence: 'project',
  },
  {
    id: 'automation',
    title: { es: 'Automatización', en: 'Automation' },
    tools: ['n8n', 'APIs', 'webhooks'],
    summary: {
      es: 'Flujos e integraciones que enlazan servicios y reducen tareas manuales.',
      en: 'Workflows and integrations that connect services and reduce manual tasks.',
    },
    evidence: 'project',
  },
  {
    id: 'backend-data',
    title: { es: 'Backend y datos', en: 'Backend and data' },
    tools: ['Java', 'Spring Boot', 'Python', 'FastAPI'],
    summary: {
      es: 'Desarrollo de servicios y aplicaciones con persistencia e integración de datos.',
      en: 'Building services and applications with persistence and data integration.',
    },
    evidence: 'professional',
  },
  {
    id: 'mobile',
    title: { es: 'Desarrollo móvil', en: 'Mobile development' },
    tools: ['Kotlin', 'Android'],
    summary: {
      es: 'Aplicaciones móviles desarrolladas en proyectos prácticos.',
      en: 'Mobile applications built in practical projects.',
    },
    evidence: 'project',
  },
  {
    id: 'delivery-quality',
    title: { es: 'Entrega y calidad', en: 'Delivery and quality' },
    tools: ['Git', 'Docker', 'CI/CD'],
    summary: {
      es: 'Herramientas de versionado, contenedores y entrega aplicadas al trabajo de ingeniería.',
      en: 'Version control, containers and delivery tools applied to engineering work.',
    },
    evidence: 'professional',
  },
];

export const EVIDENCE_LABELS: Record<EvidenceType, Record<RoomLang, string>> = {
  professional: { es: 'Experiencia profesional', en: 'Professional experience' },
  project: { es: 'Proyectos', en: 'Projects' },
  exploration: { es: 'Exploración', en: 'Exploration' },
};
