import { useCallback, useEffect, useState } from 'react';

const scrollerOf = (element: HTMLElement): HTMLElement | null => {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) return parent;
  }
  return null;
};

/** What is left of the page below an element: the bottom padding of the page and whatever stands after it (the footer). */
const below = (element: HTMLElement): number => {
  const main = element.closest('main');
  if (!main) return 0;
  let height = parseFloat(getComputedStyle(main).paddingBottom) || 0;
  for (let next = main.nextElementSibling as HTMLElement | null; next; next = next.nextElementSibling as HTMLElement | null) height += next.offsetHeight;
  return height;
};

/**
 * The height that makes an element reach exactly the bottom of the page, so the page does not scroll and leaves no empty band, on any size of screen. It is
 * measured again when the window or the page area changes size (the sidebar opening, the browser zoom). Never less than {@code min}.
 */
export function useFillHeight(min = 420): { ref: (element: HTMLElement | null) => void; height: number | undefined } {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const ref = useCallback((next: HTMLElement | null) => setElement(next), []);

  useEffect(() => {
    if (!element) return undefined;
    const scroller = scrollerOf(element);
    const measure = () => {
      if (!scroller) {
        setHeight(Math.max(min, window.innerHeight - element.getBoundingClientRect().top));
        return;
      }
      const top = element.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      setHeight(Math.max(min, Math.floor(scroller.clientHeight - top - below(element))));
    };
    measure();
    // once more when the page has finished coming in (it is moved a little while it appears)
    const settled = window.setTimeout(measure, 450);
    window.addEventListener('resize', measure);
    const watcher = typeof ResizeObserver === 'undefined' || !scroller ? null : new ResizeObserver(measure);
    if (watcher && scroller) watcher.observe(scroller);
    return () => {
      window.clearTimeout(settled);
      window.removeEventListener('resize', measure);
      watcher?.disconnect();
    };
  }, [element, min]);

  return { ref, height };
}
