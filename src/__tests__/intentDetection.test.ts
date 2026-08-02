import { describe, it, expect } from 'vitest';

// knowledgeOrchestrator detectIntent 逻辑复制
function detectIntent(query: string): 'regulation' | 'template' | 'exact' | 'general' {
  if (/GB\d|JGJ\d|DB\d|GF-|标准|规范|条款|合规|检查|验收|安全|质量/.test(query)) return 'regulation';
  if (/模板|方案|范本|生成|示例|样例|报告|编写|格式/.test(query)) return 'template';
  if (/^[A-Z0-9\-/]{4,30}$/.test(query.trim())) return 'exact';
  return 'general';
}

describe('Knowledge Orchestrator — Intent Detection', () => {
  it('detects regulation intent', () => {
    expect(detectIntent('GB50300施工质量验收标准')).toBe('regulation');
    expect(detectIntent('脚手架安全规范检查')).toBe('regulation');
    expect(detectIntent('JGJ59-2011条款')).toBe('regulation');
    expect(detectIntent('基坑支护安全措施')).toBe('regulation');
  });

  it('detects template intent', () => {
    expect(detectIntent('施工组织设计方案模板')).toBe('template');
    expect(detectIntent('监理规划范本生成')).toBe('template');
    expect(detectIntent('日报格式示例')).toBe('template');
  });

  it('detects exact match intent for non-standard IDs', () => {
    expect(detectIntent('A3-1')).toBe('exact');
    expect(detectIntent('GF-2017-0201')).toBe('regulation'); // 标准编号优先走regulation
    expect(detectIntent('12345')).toBe('exact');
  });

  it('returns general for ambiguous queries', () => {
    expect(detectIntent('项目')).toBe('general');
    expect(detectIntent('进度')).toBe('general');
    expect(detectIntent('')).toBe('general');
  });
});
