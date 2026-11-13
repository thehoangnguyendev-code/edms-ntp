import { act, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '../Toast';

const branding = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/components/branding/BrandLogo', () => ({ useBranding: () => branding.value }));

const Trigger = () => {
  const { showToast } = useToast();
  return <button onClick={() => showToast({ type: 'info', title: 'T', message: 'm' })}>go</button>;
};

const stackOf = () => screen.getByRole('alert').closest('.fixed') as HTMLElement;

it('puts the toast in the top centre, the bottom centre and the middle of the screen, as chosen', () => {
  for (const position of ['top-center', 'bottom-center', 'center'] as const) {
    branding.value = { toastPosition: position };
    const { unmount } = render(<ToastProvider><Trigger /></ToastProvider>);
    act(() => screen.getByText('go').click());
    const stack = stackOf();
    expect(stack.className).toContain('items-center');
    expect(stack.className).not.toContain('md:items-end');
    // the safe-area offsets are not understood by the test browser, so only what it keeps is checked: the stack spans the width, and the middle one sits at half the height
    expect(stack.style.left).toBe('0px');
    if (position === 'center') expect(stack.style.top).toBe('50%');
    unmount();
  }
});

it('falls back to the top right for a place that is not known', () => {
  branding.value = { toastPosition: 'nowhere' };
  render(<ToastProvider><Trigger /></ToastProvider>);
  act(() => screen.getByText('go').click());
  expect(stackOf().className).toContain('md:items-end');
});
