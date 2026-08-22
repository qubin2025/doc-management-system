import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '../components/HomePage';

// Mock ProjectContext
vi.mock('../data/ProjectContext', () => ({
  useProject: () => ({
    currentProject: '测试项目',
    isAdmin: true,
    auth: { user: { username: 'admin', role: 'admin' }, token: 'test', permissions: {} },
    setCurrentProject: vi.fn(),
    setStandard: vi.fn(),
    setAuth: vi.fn(),
  }),
  setGlobalProject: vi.fn(),
  setGlobalAuth: vi.fn(),
  getGlobalProject: () => '测试项目',
}));

// Mock sub-components
vi.mock('../components/GlobalSearch', () => ({
  default: () => null,
}));
vi.mock('../components/ModelAdmin', () => ({
  default: () => null,
}));
vi.mock('../components/ThemeSwitcher', () => ({
  default: () => null,
}));

describe('HomePage', () => {
  const defaultProps = {
    onNavigate: vi.fn(),
    onLogout: vi.fn(),
  };

  beforeEach(() => { vi.clearAllMocks(); });

  it('renders the logo and title', () => {
    render(<HomePage {...defaultProps} />);
    const titles = screen.getAllByText('中航建科 · 工程咨询管理平台');
    expect(titles.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('项目全过程数智化管理')).toBeTruthy();
  });

  it('renders guide module section', () => {
    render(<HomePage {...defaultProps} />);
    expect(screen.getByText('指南工作模块')).toBeTruthy();
    expect(screen.getByText('第1章 前期工作')).toBeTruthy();
    expect(screen.getByText('第2章 招标采购')).toBeTruthy();
    expect(screen.getByText('第3章 工程施工')).toBeTruthy();
    expect(screen.getByText('第4章 竣工验收及移交')).toBeTruthy();
  });

  it('renders feature module section with key cards', () => {
    render(<HomePage {...defaultProps} />);
    const headings = screen.getAllByText('功能模块');
    expect(headings.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('AI智能体')).toBeTruthy();
    expect(screen.getByText('工程资料管理')).toBeTruthy();
    expect(screen.getByText('知识图谱')).toBeTruthy();
  });

  it('renders management module section', () => {
    render(<HomePage {...defaultProps} />);
    expect(screen.getByText('管理模块')).toBeTruthy();
    expect(screen.getByText('干系人管理')).toBeTruthy();
    expect(screen.getByText('风险管理')).toBeTruthy();
  });

  it('renders admin-only buttons when isAdmin', () => {
    render(<HomePage {...defaultProps} />);
    expect(screen.getByText('模型')).toBeTruthy();
    expect(screen.getByText('管理')).toBeTruthy();
    expect(screen.getByText('审计日志')).toBeTruthy();
  });

  it('calls onLogout when logout button clicked', () => {
    render(<HomePage {...defaultProps} />);
    const logoutBtn = screen.getByText('退出');
    logoutBtn.click();
    expect(defaultProps.onLogout).toHaveBeenCalled();
  });
});
