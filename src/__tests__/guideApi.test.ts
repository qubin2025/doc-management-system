import { describe, it, expect } from 'vitest';

// 指南进度数据格式
function serializeCompleted(items: Set<string>): string {
  return JSON.stringify([...items]);
}
function deserializeCompleted(json: string): Set<string> {
  try { return new Set(JSON.parse(json)); } catch { return new Set(); }
}

// 表单内容存储格式
function formStorageKey(chapterId: string, code: string): string {
  return `form-content-${chapterId}-${code}`;
}
function formStorageValue(content: string): string {
  return JSON.stringify({ content, lastModified: new Date().toISOString(), version: 1 });
}

describe('Guide — Progress Persistence', () => {
  it('serializes Set to JSON array', () => {
    const s = new Set(['wi-1', 'wi-2']);
    const json = serializeCompleted(s);
    expect(json).toBe('["wi-1","wi-2"]');
  });
  it('deserializes JSON array to Set', () => {
    const s = deserializeCompleted('["a","b"]');
    expect(s.has('a')).toBe(true);
    expect(s.has('b')).toBe(true);
    expect(s.size).toBe(2);
  });
  it('handles empty array', () => {
    const s = deserializeCompleted('[]');
    expect(s.size).toBe(0);
  });
  it('handles invalid JSON gracefully', () => {
    const s = deserializeCompleted('not-json');
    expect(s.size).toBe(0);
  });
});

describe('Guide — Form Persistence', () => {
  it('generates correct storage key', () => {
    expect(formStorageKey('ch3', 'table-01')).toBe('form-content-ch3-table-01');
  });
  it('generates storage value with metadata', () => {
    const v = JSON.parse(formStorageValue('test content'));
    expect(v.content).toBe('test content');
    expect(v.version).toBe(1);
    expect(v.lastModified).toBeTruthy();
  });
});
