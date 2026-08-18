import { describe, it, expect, beforeEach } from 'vitest';
import { vectorStore } from '../data/vectorStore';
import { kbSyncService } from '../data/kbSyncService';

describe('VectorStore 批量方法 (方案A)', () => {
  beforeEach(() => {
    vectorStore.clearAll();
    localStorage.clear();
  });

  it('addDocuments 应批量添加向量（一次保存）', () => {
    const project = 'test-proj';
    const docs = [
      { id: 'daily-1-seg1', text: '日报1段1', embedding: [0.1, 0.2, 0.3], metadata: { projectName: project, fileName: '日报-2026-01-01-进度', fileType: 'daily-segment' } },
      { id: 'daily-1-seg2', text: '日报1段2', embedding: [0.4, 0.5, 0.6], metadata: { projectName: project, fileName: '日报-2026-01-01-质量风险', fileType: 'daily-segment' } },
      { id: 'daily-1-seg3', text: '日报1段3', embedding: [0.7, 0.8, 0.9], metadata: { projectName: project, fileName: '日报-2026-01-01-现场问题', fileType: 'daily-segment' } },
    ];
    const n = vectorStore.addDocuments(docs);
    expect(n).toBe(3);
    expect(vectorStore.getByProject(project).length).toBe(3);
  });

  it('addDocuments 空数组应返回 0', () => {
    const n = vectorStore.addDocuments([]);
    expect(n).toBe(0);
  });

  it('removeByPrefix 应按前缀批量删除（一次保存）', () => {
    const project = 'test-proj';
    const docs = [
      { id: 'daily-1-seg1', text: '段1', embedding: [0.1], metadata: { projectName: project, fileName: '日报-A-进度', fileType: 'daily-segment' } },
      { id: 'daily-1-seg2', text: '段2', embedding: [0.2], metadata: { projectName: project, fileName: '日报-A-质量', fileType: 'daily-segment' } },
      { id: 'issue-5', text: '问题5', embedding: [0.3], metadata: { projectName: project, fileName: '问题-标题5', fileType: 'issue' } },
      { id: 'exp-x1', text: '经验1', embedding: [0.4], metadata: { projectName: project, fileName: '经验-标题1', fileType: 'experience' } },
    ];
    vectorStore.addDocuments(docs);
    expect(vectorStore.getByProject(project).length).toBe(4);

    // 删除 daily-1 的所有段
    const removed = vectorStore.removeByPrefix('daily-1-', project);
    expect(removed).toBe(2);
    expect(vectorStore.getByProject(project).length).toBe(2);

    // 剩余应为 issue-5 和 exp-x1
    const remaining = vectorStore.getByProject(project);
    const ids = remaining.map(d => d.id).sort();
    expect(ids).toEqual(['exp-x1', 'issue-5']);
  });

  it('removeByPrefix 不存在的项目应返回 0', () => {
    const removed = vectorStore.removeByPrefix('daily-1-', 'nonexistent');
    expect(removed).toBe(0);
  });

  it('getByProject 应只返回指定项目向量（项目隔离）', () => {
    const docsA = [
      { id: 'daily-1-seg1', text: '段1', embedding: [0.1], metadata: { projectName: 'projA', fileName: '日报-A-1', fileType: 'daily-segment' } },
    ];
    const docsB = [
      { id: 'daily-2-seg1', text: '段2', embedding: [0.2], metadata: { projectName: 'projB', fileName: '日报-B-1', fileType: 'daily-segment' } },
      { id: 'daily-2-seg2', text: '段3', embedding: [0.3], metadata: { projectName: 'projB', fileName: '日报-B-2', fileType: 'daily-segment' } },
    ];
    vectorStore.addDocuments(docsA);
    vectorStore.addDocuments(docsB);

    expect(vectorStore.getByProject('projA').length).toBe(1);
    expect(vectorStore.getByProject('projB').length).toBe(2);
    expect(vectorStore.getByProject('projC').length).toBe(0);
  });

  it('removeByPrefix 应不影响其他项目（隔离性）', () => {
    // addDocuments 假设单项目调用（kbSyncService 同步按项目分组），分两次添加
    vectorStore.addDocuments([
      { id: 'daily-1-seg1', text: '段1', embedding: [0.1], metadata: { projectName: 'projA', fileName: '日报-A-1', fileType: 'daily-segment' } },
      { id: 'daily-1-seg2', text: '段2', embedding: [0.2], metadata: { projectName: 'projA', fileName: '日报-A-2', fileType: 'daily-segment' } },
    ]);
    vectorStore.addDocuments([
      { id: 'daily-1-seg1', text: '段3', embedding: [0.3], metadata: { projectName: 'projB', fileName: '日报-B-1', fileType: 'daily-segment' } },
    ]);

    // 删除 projA 的 daily-1 向量
    const removed = vectorStore.removeByPrefix('daily-1-', 'projA');
    expect(removed).toBe(2);
    expect(vectorStore.getByProject('projA').length).toBe(0);
    // projB 的 daily-1-seg1 应保留
    expect(vectorStore.getByProject('projB').length).toBe(1);
  });
});

describe('kbSyncService 同步状态持久化 (方案A)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getLocalSyncState 初始应为空对象', () => {
    const state = kbSyncService.getLocalSyncState();
    expect(state).toEqual({});
  });

  it('syncAll 无后端时应返回失败结果（不抛异常）', async () => {
    // 不启动后端 → fetchSyncStatus 应失败 → syncAll 返回 success:false
    const result = await kbSyncService.syncAll(true);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(typeof result.duration).toBe('number');
  });

  it('SyncResult 类型应包含完整字段', async () => {
    const result = await kbSyncService.syncAll(false);
    expect(result).toHaveProperty('totalSynced');
    expect(result).toHaveProperty('totalSkipped');
    expect(result).toHaveProperty('daily');
    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('experiences');
    expect(result).toHaveProperty('duration');
    expect(result.daily).toHaveProperty('synced');
    expect(result.daily).toHaveProperty('skipped');
  });
});
