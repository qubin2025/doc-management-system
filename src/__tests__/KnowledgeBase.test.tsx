import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import KnowledgeBase from '../components/KnowledgeBase';

vi.mock('../data/vectorStore', () => ({
  vectorStore: { getAllDocs: () => [], searchAll: () => [], addDocuments: () => 0, removeByPrefix: () => 0, getByProject: () => [], stats: () => ({ count: 0, sizeKB: 0 }) },
}));
vi.mock('../data/kbSyncService', () => ({
  kbSyncService: { syncAll: vi.fn().mockResolvedValue({ success: false, error: 'mock', totalSynced: 0, totalSkipped: 0, daily: { synced: 0, skipped: 0 }, issues: { synced: 0, skipped: 0 }, experiences: { synced: 0, skipped: 0 }, duration: 0 }), getLocalSyncState: () => ({}) },
  SyncResult: {},
}));

describe('KnowledgeBase', () => {
  it('renders title', () => {
    render(<KnowledgeBase onBack={vi.fn()} />);
    expect(screen.getByText('知识库')).toBeTruthy();
  });

  it('renders 5 library tabs', () => {
    render(<KnowledgeBase onBack={vi.fn()} />);
    const all = screen.getAllByText('全部');
    expect(all.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('规程规范')).toBeTruthy();
    expect(screen.getByText('政策法规')).toBeTruthy();
    expect(screen.getByText('项目经验')).toBeTruthy();
  });

  it('renders search input', () => {
    render(<KnowledgeBase onBack={vi.fn()} />);
    expect(screen.getByPlaceholderText(/搜索/)).toBeTruthy();
  });

  it('renders search mode buttons', () => {
    render(<KnowledgeBase onBack={vi.fn()} />);
    expect(screen.getByText('全文')).toBeTruthy();
    expect(screen.getByText('语义')).toBeTruthy();
  });

  it('calls onBack when back clicked', () => {
    const onBack = vi.fn();
    render(<KnowledgeBase onBack={onBack} />);
    // v5.4 顶栏含"同步业务数据"按钮，返回按钮需按文本定位
    const backBtn = screen.getAllByText(/返回首页/)[0];
    (backBtn.closest('button') as HTMLButtonElement).click();
    expect(onBack).toHaveBeenCalled();
  });
});
