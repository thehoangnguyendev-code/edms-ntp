import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Picks how much a one-line control can show in the room it has, not in the width of the screen: the sidebar, a drawer or a
 * modal take a different share of the same screen, so a viewport breakpoint cannot tell. Level 0 is the fullest form. While the
 * element (which must be `overflow-hidden`, `whitespace-nowrap` and as wide as its parent) is wider than its box, the next
 * level is tried, before the browser paints; when the box changes size or `signature` changes, it starts again from level 0.
 *
 * `levels` is the number of forms. The last one is used even when it still does not fit (the element then clips, never wraps).
 */
export function useFitLevel(ref: RefObject<HTMLElement | null>, levels: number, signature: string): number {
  const [width, setWidth] = useState(0);
  const [state, setState] = useState({ key: '', level: 0 });
  const key = `${signature}|${width}`;
  // A state of another key is stale: the content or the width changed since, so the fullest form is tried again.
  const level = state.key === key ? state.level : 0;

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (level < levels - 1 && element.scrollWidth > element.clientWidth + 1) setState({ key, level: level + 1 });
  }, [ref, level, levels, key]);

  return level;
}
