import { useRef } from 'react';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsap';

/** More rows than this are not staggered: the later ones would arrive after the person has started reading. */
const MAX_ANIMATED_ROWS = 30;

/**
 * The rows that a table did not show before fade in, one after the other (GSAP, opacity only and about a fifth of a second).
 *
 * - "New" is decided by the key of the row, not by a change of the list: a new page, a new search or filter, or the first load brings rows that were not there, so
 *   they fade in; a refresh that brings the same rows again, a re-render, a sort (the same rows in another order) or a new column layout moves nothing; when
 *   one record is added to what is shown, only that row fades in.
 * - Only `opacity` moves. A transform on a row would break the pinned columns (they are sticky) and the row menus, and `clearProps` leaves no style behind.
 * - With "reduce motion" nothing moves. While the next page is being fetched the old rows stay, and nothing plays until the answer is in (`settled`).
 */
export function useRowEntrance(root: HTMLElement | null, rowKeys: readonly string[], settled: boolean): void {
  const scope = useRef<HTMLElement | null>(null);
  scope.current = root;
  const previous = useRef<Set<string> | null>(null);
  const signature = rowKeys.join('\u0001');

  useGSAP(() => {
    if (!root || !settled || rowKeys.length === 0) return;
    const shownBefore = previous.current;
    previous.current = new Set(rowKeys);
    if (prefersReducedMotion()) return;

    const fresh = new Set(shownBefore ? rowKeys.filter((key) => !shownBefore.has(key)) : rowKeys);
    if (fresh.size === 0) return;
    const rows = Array.from(root.querySelectorAll<HTMLElement>('tr[data-table-row]'))
      .filter((row) => fresh.has(row.getAttribute('data-table-row') ?? ''))
      .slice(0, MAX_ANIMATED_ROWS);
    if (rows.length === 0) return;
    gsap.from(rows, { opacity: 0, duration: 0.22, ease: 'power1.out', stagger: { each: 0.012, amount: 0.2 }, clearProps: 'opacity' });
  }, { scope, dependencies: [signature, root, settled] });
}
