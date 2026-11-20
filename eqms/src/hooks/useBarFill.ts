import { useRef } from 'react';
import type { RefObject } from 'react';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsap';

/**
 * A bar that fills (GSAP, the width of the fill only): from 0 when it first appears, and from the old width to the new one when the figure changes.
 *
 * - The element keeps the `width` style React gives it. The tween starts from the old value and ends on exactly `percent`, so what is left behind is the same
 *   inline width React wrote, and the numbers a screen reads (aria values, tests) never depend on the animation.
 * - With "reduce motion" nothing moves. A figure that did not change does not play again.
 * - The figure counts as "shown" only when the tween has finished (or was skipped): React's StrictMode (and a hidden-then-revealed screen) mounts, cleans up
 *   and mounts again at once, and the second run must still play what the first run's cleanup cut short.
 */
export function useBarFill(ref: RefObject<HTMLElement | null>, percent: number): void {
  const previous = useRef<number | null>(null);

  useGSAP(() => {
    const element = ref.current;
    const before = previous.current;
    if (!element || before === percent) return;
    if (prefersReducedMotion()) {
      previous.current = percent;
      return;
    }
    const final = `${percent}%`;
    gsap.fromTo(element, { width: `${before ?? 0}%` }, { width: final, duration: before === null ? 0.9 : 0.6, ease: 'power2.out', onComplete: () => { gsap.set(element, { width: final }); previous.current = percent; } });
  }, { dependencies: [percent] });
}

/**
 * A bar made of several segments is revealed from the left (a clip-path wipe of the whole bar) when it first appears or when its figures change.
 * `signature` is a string that changes exactly when the figures do. The clip-path is removed afterwards, so the bar keeps no style of its own.
 */
export function useBarWipe(ref: RefObject<HTMLElement | null>, signature: string): void {
  const previous = useRef<string | null>(null);

  useGSAP(() => {
    const element = ref.current;
    const before = previous.current;
    if (!element || before === signature) return;
    if (prefersReducedMotion()) {
      previous.current = signature;
      return;
    }
    gsap.fromTo(element, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.8, ease: 'power2.out', onComplete: () => { gsap.set(element, { clearProps: 'clipPath' }); previous.current = signature; } });
  }, { dependencies: [signature] });
}
