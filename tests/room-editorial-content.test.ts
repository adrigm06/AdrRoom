import { describe, expect, it } from 'vitest';
import { CAREER_NOTES, EVIDENCE_LABELS, SKILL_THEMES } from '../src/components/room/room-editorial-content.js';

describe('room editorial draft', () => {
  it('keeps four localized career notes without exposing personal contact details', () => {
    expect(CAREER_NOTES).toHaveLength(4);
    for (const note of CAREER_NOTES) {
      expect(note.title.es).toBeTruthy();
      expect(note.title.en).toBeTruthy();
      expect(note.summary.es).toBeTruthy();
      expect(note.summary.en).toBeTruthy();
      expect(note.summary.es).not.toMatch(/@|https?:|\\+\\d/);
    }
  });

  it('describes five practical skill themes with evidence labels and no proficiency scores', () => {
    expect(SKILL_THEMES).toHaveLength(5);
    for (const theme of SKILL_THEMES) {
      expect(theme.tools.length).toBeGreaterThan(0);
      expect(theme.summary.es).toBeTruthy();
      expect(theme.summary.en).toBeTruthy();
      expect(EVIDENCE_LABELS[theme.evidence].es).toBeTruthy();
      expect(theme.summary.es).not.toMatch(/\\d+\\s?%/);
    }
  });
});
