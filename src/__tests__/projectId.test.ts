import { describe, it, expect } from 'vitest';

// 项目ID验证与双规程key管理
function projectKey(std: string) { return `doc-mgmt-projects-${std}`; }
const STANDARDS = ['DB11/T695-2025', 'DB11/T808-2020'];

function mergeProjectLists(lists: Record<string, any[]>) {
  const seen = new Set<string>();
  const result: any[] = [];
  for (const std of STANDARDS) {
    const list = lists[std] || [];
    for (const p of list) {
      if (p.name && !seen.has(p.name)) { seen.add(p.name); result.push(p); }
    }
  }
  return result;
}

function simulateDelete(lists: Record<string, any[]>, name: string) {
  const copy: Record<string, any[]> = {};
  for (const std of STANDARDS) {
    copy[std] = (lists[std] || []).filter((p: any) => p.name !== name);
  }
  return copy;
}

describe('Project — Key Management', () => {
  it('generates correct storage keys', () => {
    expect(projectKey('DB11/T695-2025')).toContain('DB11/T695');
    expect(projectKey('DB11/T808-2020')).toContain('DB11/T808');
  });
  it('both keys are different', () => {
    expect(projectKey(STANDARDS[0])).not.toBe(projectKey(STANDARDS[1]));
  });
});

describe('Project — Merge & Delete', () => {
  it('merges without duplicates', () => {
    const lists = {
      'DB11/T695-2025': [{ name: 'A' }, { name: 'B' }],
      'DB11/T808-2020': [{ name: 'B' }, { name: 'C' }],
    };
    const merged = mergeProjectLists(lists);
    expect(merged.length).toBe(3);
  });
  it('delete removes from all standards', () => {
    const lists = {
      'DB11/T695-2025': [{ name: 'A' }, { name: 'B' }],
      'DB11/T808-2020': [{ name: 'A' }],
    };
    const after = simulateDelete(lists, 'A');
    expect(after['DB11/T695-2025'].length).toBe(1);
    expect(after['DB11/T808-2020'].length).toBe(0);
  });
  it('handles empty source', () => {
    expect(mergeProjectLists({}).length).toBe(0);
  });
});
