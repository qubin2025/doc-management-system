import { describe, it, expect } from 'vitest';

// 存储诊断 — 键分类与孤立检测
function classifyKey(key: string): string {
  if (key.startsWith('doc-mgmt-projects-')) return 'project';
  if (key.startsWith('doc-mgmt-upload-')) return 'upload';
  if (key.includes('guide-')) return 'guide';
  if (key.startsWith('form-')) return 'form';
  if (key.startsWith('desktop-')) return 'desktop';
  if (key === 'doc-system-auth' || key === 'doc-system-token') return 'auth';
  return 'other';
}

function findOrphans(keys: string[], validProjects: Set<string>): string[] {
  const orphans: string[] = [];
  for (const k of keys) {
    const cat = classifyKey(k);
    if (cat === 'auth' || cat === 'project') continue;
    const hasMatch = [...validProjects].some(pn => k.includes(pn));
    if (!hasMatch) orphans.push(k);
  }
  return orphans;
}

describe('Storage — Key Classification', () => {
  it('classifies project keys', () => expect(classifyKey('doc-mgmt-projects-DB11/T695-2025')).toBe('project'));
  it('classifies upload keys', () => expect(classifyKey('doc-mgmt-upload-DB11/T808-2020')).toBe('upload'));
  it('classifies guide keys', () => expect(classifyKey('guide-项目A-modules')).toBe('guide'));
  it('classifies form keys', () => expect(classifyKey('form-fields-ch1-001')).toBe('form'));
  it('classifies auth keys', () => expect(classifyKey('doc-system-auth')).toBe('auth'));
  it('classifies unknown as other', () => expect(classifyKey('random-key')).toBe('other'));
});

describe('Storage — Orphan Detection', () => {
  it('finds keys without matching project', () => {
    const keys = ['guide-项目A-modules', 'guide-项目B-modules', 'doc-system-auth'];
    const orphans = findOrphans(keys, new Set(['项目A']));
    expect(orphans).toContain('guide-项目B-modules');
    expect(orphans).not.toContain('guide-项目A-modules');
    expect(orphans).not.toContain('doc-system-auth');
  });
});
