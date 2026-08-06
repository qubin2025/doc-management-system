import { describe, it, expect } from 'vitest';

// 指南进度 ON CONFLICT upsert 逻辑
function buildUpsertParams(projectName: string, chapterId: string, completed: string[]) {
  return { projectName, chapterId, completedItems: JSON.stringify(completed) };
}

function parseProgressRow(row: { completed_items: string } | null): string[] {
  if (!row) return [];
  try { return JSON.parse(row.completed_items); } catch { return []; }
}

describe('Guide Progress — Serialization', () => {
  it('builds upsert params', () => {
    const p = buildUpsertParams('项目A', 'ch1', ['wi-1', 'wi-2']);
    expect(p.projectName).toBe('项目A');
    expect(p.chapterId).toBe('ch1');
    expect(JSON.parse(p.completedItems)).toEqual(['wi-1', 'wi-2']);
  });
  it('parses completed items from DB row', () => {
    expect(parseProgressRow({ completed_items: '["a","b"]' })).toEqual(['a', 'b']);
  });
  it('returns empty for null row', () => {
    expect(parseProgressRow(null)).toEqual([]);
  });
  it('handles invalid JSON', () => {
    expect(parseProgressRow({ completed_items: 'invalid' })).toEqual([]);
  });
});

describe('Guide Progress — Multi-Chapter', () => {
  it('different chapters have different keys', () => {
    const p1 = buildUpsertParams('P', 'ch1', ['a']);
    const p2 = buildUpsertParams('P', 'ch2', ['b']);
    expect(p1.chapterId).not.toBe(p2.chapterId);
    expect(p1.completedItems).not.toBe(p2.completedItems);
  });
});
