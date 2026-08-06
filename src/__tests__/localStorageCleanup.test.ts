import { describe, it, expect } from 'vitest';

// 物理删除逻辑 — 扫描全部localStorage键, 移除含项目名的条目
function findKeysByPattern(keys: string[], patterns: RegExp[]): string[] {
  return keys.filter(k => patterns.some(re => re.test(k)));
}

function extractProjectNameFromKey(key: string): string | null {
  const m = key.match(/doc-mgmt-upload-([A-Z0-9/\\\-]+)/);
  return m ? m[1] : null;
}

const SAMPLE_KEYS = [
  'doc-mgmt-projects-DB11/T695-2025',
  'doc-mgmt-upload-DB11/T695-2025',
  'guide-项目A-modules',
  'form-fields-ch3-xyz',
  'doc-system-auth',
  'desktop-daily-reports',
  'knowledge-graph',
  'doc-mgmt-upload-DB11/T808-2020',
];

describe('LocalStorage — Pattern Matching', () => {
  it('finds project keys', () => {
    const result = findKeysByPattern(SAMPLE_KEYS, [/^doc-mgmt-projects-/]);
    expect(result.length).toBe(1);
    expect(result[0]).toBe('doc-mgmt-projects-DB11/T695-2025');
  });
  it('finds upload keys', () => {
    const result = findKeysByPattern(SAMPLE_KEYS, [/^doc-mgmt-upload-/]);
    expect(result.length).toBe(2);
  });
  it('extracts project name from upload key', () => {
    expect(extractProjectNameFromKey('doc-mgmt-upload-DB11/T695-2025')).toBe('DB11/T695-2025');
  });
});

describe('LocalStorage — Safety', () => {
  it('auth key NOT in project patterns', () => {
    const result = findKeysByPattern(SAMPLE_KEYS, [/^(doc-mgmt-projects|doc-mgmt-upload|guide-|form-|desktop-)/]);
    expect(result.includes('doc-system-auth')).toBe(false);
  });
  it('knowledge-graph IS in data patterns', () => {
    const result = findKeysByPattern(SAMPLE_KEYS, [/^knowledge-graph/]);
    expect(result.length).toBe(1);
  });
});
