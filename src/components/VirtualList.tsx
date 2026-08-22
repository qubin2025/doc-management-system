import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 通用虚拟列表组件
 *
 * 只渲染可视区域内的列表项，无论数据量多大，DOM节点数保持恒定。
 * 适用于审计日志、知识库检索结果、项目经验库等数据量大的列表场景。
 *
 * @example
 * <VirtualList
 *   items={logs}
 *   itemHeight={48}
 *   height={600}
 *   renderItem={(item, index) => <LogRow log={item} />}
 * />
 */
export interface VirtualListProps<T> {
  /** 列表数据 */
  items: T[];
  /** 每项高度（像素），固定高度模式 */
  itemHeight: number;
  /** 列表容器高度（像素） */
  height: number;
  /** 渲染单项的函数 */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** 列表项 key 提取函数（默认用 index） */
  keyExtractor?: (item: T, index: number) => string | number;
  /** 上下额外渲染的缓冲区行数（默认5） */
  overscan?: number;
  /** 自定义类名 */
  className?: string;
  /** 空状态渲染 */
  emptyRenderer?: React.ReactNode;
}

export function VirtualList<T>({
  items,
  itemHeight,
  height,
  renderItem,
  keyExtractor,
  overscan = 5,
  className = '',
  emptyRenderer,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalHeight = items.length * itemHeight;
  const visibleCount = Math.ceil(height / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // 空状态
  if (items.length === 0 && emptyRenderer) {
    return <div className={className}>{emptyRenderer}</div>;
  }

  const visibleItems = items.slice(startIndex, endIndex);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${startIndex * itemHeight}px)` }}>
          {visibleItems.map((item, i) => {
            const actualIndex = startIndex + i;
            const key = keyExtractor ? keyExtractor(item, actualIndex) : actualIndex;
            return (
              <div key={key} style={{ height: itemHeight }}>
                {renderItem(item, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default VirtualList;

/**
 * 分页加载 Hook
 *
 * 用于大数据量列表的分页加载，配合虚拟列表使用。
 *
 * @example
 * const { items, loading, hasMore, loadMore } = usePagination(fetchData, { pageSize: 50 });
 */
export function usePagination<T>(
  fetchFn: (page: number, pageSize: number) => Promise<T[]>,
  options: { pageSize?: number; immediate?: boolean } = {}
) {
  const { pageSize = 50, immediate = true } = options;
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const newItems = await fetchFn(page, pageSize);
      setItems(prev => [...prev, ...newItems]);
      setPage(p => p + 1);
      if (newItems.length < pageSize) setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page, pageSize, fetchFn]);

  useEffect(() => {
    if (immediate) loadMore();
  }, []);

  return { items, loading, hasMore, loadMore, reset: () => { setItems([]); setPage(0); setHasMore(true); } };
}
