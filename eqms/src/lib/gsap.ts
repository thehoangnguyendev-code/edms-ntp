import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

/**
 * The one place GSAP is set up. Import `gsap` and `useGSAP` from here, never from the packages, so the plugins are registered once.
 *
 * - Animate inside `useGSAP(() => {...}, { scope: ref, dependencies: [...] })`: it limits selectors to the component and reverts every tween on unmount.
 * - Animate only what framer-motion and dnd-kit do not already move: two libraries writing the transform of one element overwrite each other.
 * - Scroll-driven animation needs `ScrollTrigger`, which is in `@/lib/gsapScroll` (kept apart so a screen that does not scroll-animate never loads it).
 */
gsap.registerPlugin(useGSAP);

/** The OS "reduce motion" setting. Every GSAP animation of the application checks it and shows the end state at once instead. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export { gsap, useGSAP };
