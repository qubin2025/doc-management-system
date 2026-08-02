import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import KnowledgeBase from '../components/KnowledgeBase';

vi.mock('../data/vectorStore', () => ({
  vectorStore: { getAllDocs: () => [], searchAll: () => [] },
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
    screen.getAllByRole('button')[0].click();
    expect(onBack).toHaveBeenCalled();
  });
});
