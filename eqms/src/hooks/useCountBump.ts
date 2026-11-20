import { useRef } from 'react';
import type { RefObject } from 'react';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsap';

/**
 * A count that goes up pops once (GSAP, the scale of the element only, about a third of a second), so the eye is drawn to "there is one more".
 *
 * - Only a real increase of a count that was already known pops. The first value (`undefined` until the answer arrives, then the number it arrives with), a
 *   count that stays the same or goes down, and a re-render with the same number do not.
 * - A count that goes from 0 to 1 pops too: keep the hook in a component that stays mounted while the count is 0 (the element itself may be missing then).
 * - With "reduce motion" nothing moves. The element is the badge's own, so `clearProps: 'all'` leaves it with no inline style at all.
 */
export function useCountBump(ref: RefObject<HTMLElement | null>, value: number | undefined): void {
  const previous = useRef(value);

  useGSAP(() => {
    const before = previous.current;
    previous.current = value;
    if (before === undefined || value === undefined || value <= before) return;
    if (prefersReducedMotion() || !ref.current) return;
    const element = ref.current;
    // `clearProps` inside a tween that repeats leaves an identity transform behind, so the element is cleared by hand when the pop is over
    gsap.fromTo(element, { scale: 1 }, { scale: 1.3, duration: 0.16, ease: 'power2.out', yoyo: true, repeat: 1, onComplete: () => { gsap.set(element, { clearProps: 'all' }); } });
  }, { dependencies: [value] });
}
