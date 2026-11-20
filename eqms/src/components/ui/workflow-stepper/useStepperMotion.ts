import { useRef } from 'react';
import type { RefObject } from 'react';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsap';

/**
 * Motion for the lifecycle stepper (GSAP). The status of the record must be readable at once, so every effect is short and the end state is the normal one
 * (`clearProps`); with "reduce motion" nothing moves.
 *
 * - When the stepper first appears the steps come in one after the other.
 * - When the current step really changes (the record moved on or back), the colour sweeps into the new current step, and the check of each step that has just
 *   been completed pops (on the phone, the line to the next step is drawn). It never replays on a re-render that leaves the current step where it was.
 *
 * It moves the step boxes, the colour fills, the checks and the connectors only. The round step of the phone view is moved by framer-motion (its pulse), so GSAP
 * stays off that element.
 */
export function useStepperMotion(rootRef: RefObject<HTMLElement | null>, currentStepIndex: number): void {
  const previous = useRef<number | undefined>(undefined);

  useGSAP(() => {
    const before = previous.current;
    previous.current = currentStepIndex;
    if (prefersReducedMotion()) return;
    const root = rootRef.current;
    if (!root) return;

    if (before === undefined) {
      // both views are in the page (the other one is hidden by CSS), each is staggered on its own
      for (const view of ['desktop', 'mobile']) {
        const steps = root.querySelectorAll(`[data-stepper-view="${view}"] [data-step]`);
        if (steps.length > 0) {
          gsap.from(steps, { opacity: 0, x: -10, duration: 0.35, ease: 'power2.out', stagger: { each: 0.05, amount: 0.4 }, clearProps: 'opacity,transform' });
        }
      }
      return;
    }
    if (before === currentStepIndex) return;

    // the colour sweeps into the step that is current now, whichever way the record moved
    gsap.from(root.querySelectorAll(`[data-step-fill][data-step-index="${currentStepIndex}"]`), {
      scaleX: 0,
      duration: 0.45,
      ease: 'power2.out',
      clearProps: 'transform',
    });

    // moving on: the steps passed over are completed now; their check pops and, on the phone, the line after them is drawn
    if (currentStepIndex > before) {
      const completed: number[] = [];
      for (let index = before; index < currentStepIndex; index += 1) completed.push(index);
      const only = (attribute: string) => completed.flatMap((index) => Array.from(root.querySelectorAll(`[${attribute}][data-step-index="${index}"]`)));
      const checks = only('data-step-check');
      if (checks.length > 0) {
        gsap.from(checks, { opacity: 0, scale: 0.3, duration: 0.5, ease: 'back.out(2.4)', stagger: 0.08, delay: 0.15, clearProps: 'opacity,transform' });
      }
      const connectors = only('data-step-connector');
      if (connectors.length > 0) {
        gsap.from(connectors, { scaleX: 0, duration: 0.3, ease: 'power1.out', stagger: 0.08, clearProps: 'transform' });
      }
    }
  }, { scope: rootRef, dependencies: [currentStepIndex] });
}
