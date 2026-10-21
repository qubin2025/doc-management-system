import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Dashboard from '../components/Dashboard';

vi.mock('../data/indicatorEngine', () => ({
  computeIndicators: () => ({
    cpi: 0.95, spi: 0.72, completeness: 45, qualityScore: 78,
    alerts: [
      { type: 'schedule', level: 'danger', message: '进度滞后15%' },
      { type: 'completeness', level: 'warning', message: '资料完整度偏低' },
    ],
  }),
  getAllProjectIndicators: () => [],
}));

describe('Dashboard', () => {
  const defaultProps = {
    projectName: '测试项目',
    onBack: vi.fn(),
    onNavigate: vi.fn(),
  };

  it('renders project name in header', () => {
    render(<Dashboard {...defaultProps} />);
    // 组件标题为"项目看板"；项目名可能多处出现，取首个匹配
    expect(screen.getAllByText('项目看板')[0]).toBeTruthy();
    expect(screen.getAllByText('测试项目')[0]).toBeTruthy();
  });

  it('renders four KPI cards', () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.getByText('成本绩效 CPI')).toBeTruthy();
    expect(screen.getByText('进度绩效 SPI')).toBeTruthy();
    expect(screen.getByText('资料完整度')).toBeTruthy();
    expect(screen.getByText('审核均分')).toBeTruthy();
  });

  it('renders alert section', () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.getByText('异常预警')).toBeTruthy();
    expect(screen.getByText('1严重')).toBeTruthy();
    expect(screen.getByText('1提示')).toBeTruthy();
  });

  it('renders project management platform button', () => {
    render(<Dashboard {...defaultProps} />);
    // 顶栏返回按钮文本为"工程咨询管理平台"
    expect(screen.getAllByText('工程咨询管理平台')[0]).toBeTruthy();
  });

  it('renders workflow button', () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.getByText('工作流')).toBeTruthy();
  });

  it('calls onBack when back button clicked', () => {
    render(<Dashboard {...defaultProps} />);
    // Back button is the first ArrowLeft icon button
    const buttons = screen.getAllByRole('button');
    const backBtn = buttons[0];
    backBtn.click();
    expect(defaultProps.onBack).toHaveBeenCalled();
  });
});
