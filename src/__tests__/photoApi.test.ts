import { describe, it, expect } from 'vitest';

// 照片水印线条构建逻辑 (与 watermark.ts buildWatermarkLines 同步)
function buildWatermarkLines(template: { showTime: boolean; showGPS: boolean; showProject: boolean; showPhotographer: boolean }, ctx: { time: string; projectName: string; latitude: number | null; photographer: string }) {
  const lines: string[] = [];
  if (template.showTime) lines.push(ctx.time);
  if (template.showProject) lines.push('项目: ' + ctx.projectName);
  if (template.showGPS && ctx.latitude != null) lines.push('GPS: ' + ctx.latitude.toFixed(5));
  if (template.showPhotographer) lines.push('拍摄: ' + ctx.photographer);
  return lines;
}

// API 响应防御检查
function safeArray(data: unknown) {
  if (!Array.isArray(data)) return [];
  return data;
}

describe('Photo — Watermark Lines', () => {
  const tpl = { showTime: true, showGPS: true, showProject: true, showPhotographer: true };
  it('builds full watermark with all fields', () => {
    const lines = buildWatermarkLines(tpl, { time: '2026-07-30 14:00', projectName: '测试项目', latitude: 39.9042, photographer: 'admin' });
    expect(lines.length).toBe(4);
    expect(lines[0]).toContain('2026');
    expect(lines[1]).toBe('项目: 测试项目');
    expect(lines[2]).toContain('39.90420');
    expect(lines[3]).toBe('拍摄: admin');
  });
  it('skips GPS when null', () => {
    const lines = buildWatermarkLines(tpl, { time: '2026-07-30', projectName: 'P', latitude: null, photographer: 'u' });
    expect(lines.length).toBe(3);
  });
  it('skips disabled fields', () => {
    const lines = buildWatermarkLines({ showTime: false, showGPS: false, showProject: true, showPhotographer: false }, { time: '', projectName: 'P', latitude: 39, photographer: '' });
    expect(lines).toEqual(['项目: P']);
  });
});

describe('Photo — API Defense', () => {
  it('safeArray returns empty for null/object/string', () => {
    expect(safeArray(null)).toEqual([]);
    expect(safeArray({ error: 'x' })).toEqual([]);
    expect(safeArray('string')).toEqual([]);
  });
  it('safeArray returns same array', () => {
    const arr = [{ id: 1 }];
    expect(safeArray(arr)).toBe(arr);
  });
});
