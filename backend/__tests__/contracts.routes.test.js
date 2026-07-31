import { describe, it, expect } from 'vitest';

// 合同风险分级逻辑 (与 ContractManager 同步)
function classifyRisk(riskItems) {
  if (!Array.isArray(riskItems) || riskItems.length === 0) return 'low';
  const highCount = riskItems.filter(r => r.risk === 'high').length;
  const mediumCount = riskItems.filter(r => r.risk === 'medium').length;
  if (highCount > 0) return 'high';
  if (mediumCount > 2) return 'medium';
  return 'low';
}

// 合同模板名称生成
function templateName(contractName) {
  return `${contractName}模板`;
}

// 知识沉淀ID生成
function expId(contractId) {
  return `contract-${contractId}-${Date.now()}`;
}

describe('Contracts — Risk Classification', () => {
  it('empty risks → low', () => {
    expect(classifyRisk([])).toBe('low');
    expect(classifyRisk(null)).toBe('low');
  });
  it('1 high risk → high', () => {
    expect(classifyRisk([{ risk: 'high' }, { risk: 'low' }])).toBe('high');
  });
  it('>2 medium → medium', () => {
    expect(classifyRisk([{ risk: 'medium' }, { risk: 'medium' }, { risk: 'medium' }])).toBe('medium');
  });
  it('1-2 medium → low', () => {
    expect(classifyRisk([{ risk: 'medium' }, { risk: 'medium' }])).toBe('low');
  });
});

describe('Contracts — Template Generation', () => {
  it('generates template name', () => {
    expect(templateName('建设工程施工合同')).toBe('建设工程施工合同模板');
    expect(templateName('监理合同')).toBe('监理合同模板');
  });
});

describe('Contracts — Knowledge Deposit', () => {
  it('generates unique experience ID', () => {
    const id1 = expId(1);
    const id2 = expId(2);
    expect(id1).toContain('contract-1-');
    expect(id2).toContain('contract-2-');
    expect(id1).not.toBe(id2);
  });
});
