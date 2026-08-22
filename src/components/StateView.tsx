import React from 'react';
import { Loader2, AlertCircle, RefreshCw, Inbox } from 'lucide-react';

/**
 * 统一状态视图组件
 *
 * 用于列表页、详情页等需要处理加载/空/错误状态的场景。
 * 统一视觉风格，避免每个页面重复实现。
 *
 * @example
 * <StateView loading={loading} error={error} empty={data.length === 0}
 *   emptyTitle="暂无数据" emptyDescription="点击上方按钮创建"
 *   onRetry={fetchData}>
 *   <DataList data={data} />
 * </StateView>
 */
export interface StateViewProps {
  /** 是否加载中 */
  loading?: boolean;
  /** 错误信息（字符串或 Error 对象） */
  error?: string | Error | null;
  /** 是否为空状态 */
  empty?: boolean;
  /** 空状态标题 */
  emptyTitle?: string;
  /** 空状态描述 */
  emptyDescription?: string;
  /** 空状态操作按钮（如"新建"） */
  emptyAction?: React.ReactNode;
  /** 加载中提示文字 */
  loadingText?: string;
  /** 错误重试回调 */
  onRetry?: () => void;
  /** 子内容（正常状态下渲染） */
  children?: React.ReactNode;
  /** 自定义类名 */
  className?: string;
}

export const StateView: React.FC<StateViewProps> = ({
  loading = false,
  error = null,
  empty = false,
  emptyTitle = '暂无数据',
  emptyDescription = '',
  emptyAction = null,
  loadingText = '加载中...',
  onRetry,
  children,
  className = '',
}) => {
  // 加载状态
  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
        <p className="mt-3 text-sm text-[var(--text-muted)]">{loadingText}</p>
      </div>
    );
  }

  // 错误状态
  if (error) {
    const errorMsg = typeof error === 'string' ? error : error.message || '加载失败';
    return (
      <div className={`flex flex-col items-center justify-center py-16 ${className}`}>
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-red-500" />
        </div>
        <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">加载失败</p>
        <p className="mt-1 text-xs text-[var(--text-muted)] max-w-md text-center">{errorMsg}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            重试
          </button>
        )}
      </div>
    );
  }

  // 空状态
  if (empty) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 ${className}`}>
        <div className="w-14 h-14 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center">
          <Inbox className="w-7 h-7 text-[var(--text-muted)]" />
        </div>
        <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">{emptyTitle}</p>
        {emptyDescription && (
          <p className="mt-1 text-xs text-[var(--text-muted)] max-w-md text-center">{emptyDescription}</p>
        )}
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </div>
    );
  }

  // 正常状态
  return <>{children}</>;
};

export default StateView;
