import { describe, it, expect } from 'vitest';
import { guideChapters } from '../data/guideModules';

describe('guideModules', () => {
  it('should have exactly 4 chapters', () => {
    expect(guideChapters).toHaveLength(4);
  });

  it('each chapter should have required fields', () => {
    for (const ch of guideChapters) {
      expect(ch.id).toBeTruthy();
      expect(ch.number).toBeGreaterThan(0);
      expect(ch.title).toBeTruthy();
      expect(ch.subModules.length).toBeGreaterThan(0);
    }
  });

  it('work item ids should be unique across all chapters', () => {
    const ids = new Set<string>();
    for (const ch of guideChapters) {
      for (const sm of ch.subModules) {
        for (const wi of sm.workItems) {
          expect(ids.has(wi.id)).toBe(false);
          ids.add(wi.id);
        }
      }
    }
  });

  it('subModule ids should be unique within each chapter', () => {
    for (const ch of guideChapters) {
      const smIds = ch.subModules.map(sm => sm.id);
      expect(new Set(smIds).size).toBe(smIds.length);
    }
  });

  it('each work item should have a name', () => {
    for (const ch of guideChapters) {
      for (const sm of ch.subModules) {
        for (const wi of sm.workItems) {
          expect(wi.name).toBeTruthy();
          expect(wi.id).toBeTruthy();
        }
      }
    }
  });
});
