import type { RefObject } from 'react';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsap';

/**
 * The widgets come in one after the other when the dashboard opens. Only what is inside a widget moves (its card or figures): the widget box itself belongs to
 * dnd-kit (dragging) and framer-motion (resizing), and two libraries writing one transform overwrite each other. It runs once, when the dashboard opens, so a widget
 * shown later from the Widgets drawer, or data arriving, does not replay it. Nothing is hidden for good: the end state is the normal one (`clearProps`), and
 * with "reduce motion" nothing moves at all.
 */
export function useDashboardEntrance(gridRef: RefObject<HTMLElement | null>): void {
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    const bodies = gsap.utils.toArray<HTMLElement>('[data-dashboard-widget-body] > *');
    if (bodies.length === 0) return;
    gsap.from(bodies, {
      opacity: 0,
      y: 14,
      duration: 0.5,
      ease: 'power2.out',
      stagger: { each: 0.05, amount: 0.6 },
      clearProps: 'opacity,transform',
    });
  }, { scope: gridRef, dependencies: [] });
}
