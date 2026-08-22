/**
 * 性能优化工具函数
 *
 * 包含防抖、节流等常用性能优化函数。
 * 用于搜索输入、窗口滚动、resize 等高频触发场景。
 */

import { useState, useEffect, useRef } from 'react';

/**
 * 防抖函数
 * 在高频触发事件中，只有当事件停止触发 delay 毫秒后才执行回调。
 * 适用于搜索输入、窗口 resize 等场景。
 *
 * @param fn - 要执行的回调函数
 * @param delay - 延迟时间（毫秒），默认 300ms
 * @returns 防抖后的函数
 *
 * @example
 * const handleSearch = debounce((value: string) => {
 *   fetchSearchResults(value);
 * }, 300);
 *
 * <input onChange={(e) => handleSearch(e.target.value)} />
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

/**
 * 节流函数
 * 在高频触发事件中，每隔 delay 毫秒最多执行一次回调。
 * 适用于滚动监听、鼠标移动、按钮防重复点击等场景。
 *
 * @param fn - 要执行的回调函数
 * @param delay - 间隔时间（毫秒），默认 300ms
 * @returns 节流后的函数
 *
 * @example
 * const handleScroll = throttle(() => {
 *   updateScrollPosition();
 * }, 100);
 *
 * window.addEventListener('scroll', handleScroll);
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  let lastTime = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    const remaining = delay - (now - lastTime);

    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastTime = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastTime = Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

/**
 * 带取消功能的防抖函数
 * 可以手动取消待执行的防抖回调。
 *
 * @param fn - 要执行的回调函数
 * @param delay - 延迟时间（毫秒）
 * @returns 防抖后的函数，附带 cancel 方法
 *
 * @example
 * const handleSearch = debounceWithCancel((value) => { ... }, 300);
 * // 组件卸载时取消
 * useEffect(() => () => handleSearch.cancel(), []);
 */
export function debounceWithCancel<T extends (...args: any[]) => any>(  fn: T,
  delay: number = 300
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = function (this: any, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return debounced as ((...args: Parameters<T>) => void) & { cancel: () => void };
}

/**
 * React Hook: 防抖值
 * 返回一个防抖后的值，当输入值变化 delay 毫秒后才更新。
 *
 * @param value - 输入值
 * @param delay - 延迟时间（毫秒）
 * @returns 防抖后的值
 *
 * @example
 * const [search, setSearch] = useState('');
 * const debouncedSearch = useDebounce(search, 300);
 * useEffect(() => { fetchResults(debouncedSearch); }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 简单的图片懒加载 Hook
 * 使用 IntersectionObserver 实现图片懒加载。
 *
 * @returns ref - 绑定到 img 元素的 ref
 * @returns isVisible - 元素是否进入视口
 *
 * @example
 * const { ref, isVisible } = useImageLazyLoad();
 * <img ref={ref} src={isVisible ? actualSrc : placeholderSrc} />
 */
export function useImageLazyLoad<T extends HTMLElement = HTMLImageElement>(
  options: IntersectionObserverInit = { rootMargin: '50px' }
) {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(element);
      }
    }, options);

    observer.observe(element);
    return () => observer.disconnect();
  }, [options]);

  return { ref, isVisible };
}
