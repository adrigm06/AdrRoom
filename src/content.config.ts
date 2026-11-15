import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const localized = z.object({ es: z.string().min(1), en: z.string().min(1) });
const caseStudy = z.object({
  scene: z.enum(['android', 'komea', 'avisia']),
  headline: localized,
  problem: localized,
  contribution: localized,
  decision: localized,
  result: localized,
  limitations: localized,
  sceneDescription: localized,
  sceneCopy: z.record(z.string(), localized),
  sceneSteps: z.object({ es: z.array(z.string()).length(5), en: z.array(z.string()).length(5) }),
  evidence: z.array(z.object({ label: localized, url: z.string().refine(value => value.startsWith('/projects/') || /^https:\/\//.test(value)) })).min(1),
});

const projectSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  zone: z.enum(['android', 'fullstack', 'ai-tools']),
  status: z.enum(['active', 'completed', 'archived']),
  date: z.string(),
  color: z.string(),
  hasImages: z.boolean(),
  githubUrl: z.string(),
  demoUrl: z.string(),
  linkedinUrl: z.string(),
  stack: z.array(z.string()),
  description: z.object({
    es: z.string(),
    en: z.string(),
  }),
  videos: z.array(z.object({
    title: z.string(),
    url: z.string(),
  })).optional(),
  caseStudy: caseStudy.optional(),
});

export const collections = {
  projects: defineCollection({
    loader: glob({ pattern: '**/*.mdx', base: './src/content/projects' }),
    schema: projectSchema,
  }),
};
