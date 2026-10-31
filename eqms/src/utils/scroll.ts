/** Direct gestures and explicit resets use instant; animated navigation honors OS preferences. */
export function preferredScrollBehavior(): ScrollBehavior {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? 'instant' : 'smooth';
}

/**
 * A portal only moves when its anchor's ancestors scroll. Scrolling the popup's own options,
 * or a different panel, must not measure the anchor or re-render the overlay. Batch the
 * remaining scroll/resize events into one update per paint and cancel work on close.
 */
export function observeOverlayPosition(anchor: () => Element | null, update: () => void): () => void {
  let frame: number | null = null;
  const schedule = () => {
    if (frame !== null) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      if (anchor()) update();
    });
  };
  const onScroll = (event: Event) => {
    const element = anchor();
    if (!element) return;
    if (event.target instanceof Element && !event.target.contains(element)) return;
    schedule();
  };
  window.addEventListener('scroll', onScroll, { capture: true, passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  return () => {
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', schedule);
    if (frame !== null) window.cancelAnimationFrame(frame);
  };
}
