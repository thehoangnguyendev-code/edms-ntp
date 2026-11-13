import { act, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ToastProvider, toastShadowCss, useToast } from '../Toast';

const branding = vi.hoisted(() => ({ value: { toastColor: 'purple' } as Record<string, unknown> }));
vi.mock('@/components/branding/BrandLogo', () => ({ useBranding: () => branding.value }));

const Trigger = () => {
  const { showToast } = useToast();
  return (
    <>
      <button onClick={() => showToast({ type: 'error', title: 'E', message: 'm' })}>error</button>
      <button onClick={() => showToast({ type: 'success', title: 'S', message: 'm' })}>success</button>
    </>
  );
};

it('every kind of toast has the one colour the administrator chose, on its border and its time bar', () => {
  branding.value = { toastColor: '#A855F7' };
  render(<ToastProvider><Trigger /></ToastProvider>);
  act(() => screen.getByText('error').click());
  act(() => screen.getByText('success').click());
  const alerts = screen.getAllByRole('alert');
  expect(alerts).toHaveLength(2);
  alerts.forEach((alert) => {
    expect((alert as HTMLElement).style.borderColor).toBe('rgb(168, 85, 247)');
  });
  screen.getAllByRole('progressbar').forEach((bar) => expect((bar as HTMLElement).style.backgroundColor).toBe('rgb(168, 85, 247)'));
});

it('is blue when nothing, or something that is not a colour, was chosen', () => {
  branding.value = { toastColor: 'pink' };
  render(<ToastProvider><Trigger /></ToastProvider>);
  act(() => screen.getByText('error').click());
  expect((screen.getByRole('alert') as HTMLElement).style.borderColor).toBe('rgb(59, 130, 246)');
});

it('draws the shadow with the strength the administrator chose, and none at 0', () => {
  expect(toastShadowCss(0)).toBe('none');
  expect(toastShadowCss(100)).toContain('rgba(15, 23, 42, 0.350)');
  expect(toastShadowCss(40)).toBe(toastShadowCss(undefined));
  expect(toastShadowCss(-5)).toBe('none');
  expect(toastShadowCss(500)).toBe(toastShadowCss(100));
  branding.value = { toastColor: '#3B82F6', toastShadow: 0 };
  render(<ToastProvider><Trigger /></ToastProvider>);
  act(() => screen.getByText('error').click());
  expect((screen.getByRole('alert') as HTMLElement).style.boxShadow).toBe('none');
});
