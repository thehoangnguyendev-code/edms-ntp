import { useRef } from 'react';
import type { RefObject } from 'react';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsap';

/** More items than this are not staggered: the later ones would arrive after the person has started reading. */
const MAX_ANIMATED_ITEMS = 12;

/**
 * The notifications that the list did not show before rise in one after the other (GSAP: opacity and a few pixels of travel, about a third of a second).
 *
 * - "New" is decided by the id, not by a change of the list: the first load (the skeletons are replaced), a tab that shows other notifications, and a notification
 *   that arrives while the list is open animate; a refresh that brings the same ones again moves nothing.
 * - Items are marked `data-notification-id` on a plain wrapper (the button inside keeps its own CSS transitions, which would lag behind a per-frame tween).
 * - With "reduce motion" nothing moves. Nothing plays while the list is still loading (`settled` false).
 */
export function useNotificationEntrance(scope: RefObject<HTMLElement | null>, ids: readonly string[], settled: boolean): void {
  const previous = useRef<Set<string> | null>(null);
  const signature = ids.join('\u0001');

  useGSAP(() => {
    if (!settled || ids.length === 0 || !scope.current) return;
    const shownBefore = previous.current;
    previous.current = new Set(ids);
    if (prefersReducedMotion()) return;

    const fresh = new Set(shownBefore ? ids.filter((id) => !shownBefore.has(id)) : ids);
    if (fresh.size === 0) return;
    const items = Array.from(scope.current.querySelectorAll<HTMLElement>('[data-notification-id]'))
      .filter((item) => fresh.has(item.getAttribute('data-notification-id') ?? ''))
      .slice(0, MAX_ANIMATED_ITEMS);
    if (items.length === 0) return;
    gsap.from(items, { opacity: 0, y: 8, duration: 0.3, ease: 'power2.out', stagger: { each: 0.035, amount: 0.3 }, clearProps: 'opacity,transform' });
  }, { scope, dependencies: [signature, settled] });
}
