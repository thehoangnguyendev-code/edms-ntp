import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gsap } from '@/lib/gsap';
import { WorkflowStepper } from '../WorkflowStepper';

const STEPS = ['Draft', 'Review', 'Approval', 'Effective'];
const motion = (reduce: boolean) => vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce'), media: query }));
const desktop = (container: HTMLElement) => container.querySelector('[data-stepper-view="desktop"]') as HTMLElement;
const fill = (container: HTMLElement, index: number) => desktop(container).querySelector(`[data-step-fill][data-step-index="${index}"]`) as HTMLElement | null;
const check = (container: HTMLElement, index: number) => desktop(container).querySelector(`[data-step-check][data-step-index="${index}"]`) as HTMLElement | null;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('workflow stepper motion', () => {
  it('colours only the finished and the current steps, the others and the skipped ones keep the plain base', () => {
    motion(true);
    const { container } = render(<WorkflowStepper steps={STEPS} currentStepIndex={2} skippedSteps={['Review']} />);

    expect(fill(container, 0)?.className).toContain('bg-emerald-100'); // finished
    expect(fill(container, 1)).toBeNull(); // skipped: striped, not coloured
    expect(fill(container, 2)?.className).toContain('bg-emerald-600'); // current
    expect(fill(container, 3)).toBeNull(); // still to come
  });

  it('brings the steps in one after the other and leaves the normal styles behind', async () => {
    motion(false);
    const { container } = render(<WorkflowStepper steps={STEPS} currentStepIndex={1} />);
    const steps = Array.from(desktop(container).querySelectorAll<HTMLElement>('[data-step]'));

    expect(steps).toHaveLength(4);
    expect(steps.every((step) => step.style.opacity === '0')).toBe(true); // hidden before the first paint, so nothing flashes
    await waitFor(() => expect(steps.every((step) => step.style.opacity === '' && step.style.transform === '')).toBe(true), { timeout: 4000 });
  });

  it('sweeps the colour into the new current step and pops the check of the step just completed', async () => {
    motion(false);
    const { container, rerender } = render(<WorkflowStepper steps={STEPS} currentStepIndex={1} />);
    await waitFor(() => expect(desktop(container).querySelector<HTMLElement>('[data-step]')?.style.opacity).toBe(''), { timeout: 4000 });

    rerender(<WorkflowStepper steps={STEPS} currentStepIndex={2} />);

    const incoming = fill(container, 2) as HTMLElement;
    expect(incoming.className).toContain('bg-emerald-600');
    expect(gsap.getProperty(incoming, 'scaleX')).toBe(0); // starts empty and grows from the left
    const popped = check(container, 1) as HTMLElement; // step 1 was current and is finished now
    expect(popped).toBeTruthy();
    expect(Number(gsap.getProperty(popped, 'scale'))).toBeLessThan(1);

    await waitFor(() => expect(incoming.style.transform).toBe(''), { timeout: 4000 });
    await waitFor(() => expect(popped.style.transform).toBe(''), { timeout: 4000 });
    expect(popped.style.opacity).toBe('');
    // a check that was already there is not played again
    expect(Number(gsap.getProperty(check(container, 0) as HTMLElement, 'scale'))).toBe(1);
  });

  it('does not play again when it renders with the current step where it was', async () => {
    motion(false);
    const { container, rerender } = render(<WorkflowStepper steps={STEPS} currentStepIndex={1} />);
    await waitFor(() => expect(desktop(container).querySelector<HTMLElement>('[data-step]')?.style.opacity).toBe(''), { timeout: 4000 });

    rerender(<WorkflowStepper steps={STEPS} currentStepIndex={1} className="mt-2" />);

    expect(gsap.getProperty(fill(container, 1) as HTMLElement, 'scaleX')).toBe(1);
    expect(desktop(container).querySelector<HTMLElement>('[data-step]')?.style.opacity).toBe('');
  });

  it('sweeps into the step too when the record goes back, without popping any check', () => {
    motion(false);
    const { container, rerender } = render(<WorkflowStepper steps={STEPS} currentStepIndex={2} />);

    rerender(<WorkflowStepper steps={STEPS} currentStepIndex={1} />);

    expect(gsap.getProperty(fill(container, 1) as HTMLElement, 'scaleX')).toBe(0);
    expect(check(container, 0)?.style.opacity ?? '').not.toBe('0'); // step 0 was finished before and still is
  });

  it('moves nothing when the person asked for reduced motion', () => {
    motion(true);
    const { container, rerender } = render(<WorkflowStepper steps={STEPS} currentStepIndex={1} />);
    expect(Array.from(desktop(container).querySelectorAll<HTMLElement>('[data-step]')).every((step) => step.style.opacity === '')).toBe(true);

    rerender(<WorkflowStepper steps={STEPS} currentStepIndex={2} />);
    expect(gsap.getProperty(fill(container, 2) as HTMLElement, 'scaleX')).toBe(1);
  });
});
