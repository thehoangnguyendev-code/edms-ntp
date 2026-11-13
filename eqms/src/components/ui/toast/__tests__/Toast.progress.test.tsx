import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '../Toast';

const Trigger = () => {
  const { showToast } = useToast();
  return <button onClick={() => showToast({ type: 'info', title: 'T', message: 'M', duration: 4000 })}>go</button>;
};

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame'] }));
afterEach(() => vi.useRealTimers());

it('draws the time left from the clock, not from a CSS animation (a phone that reduces motion cuts every animation short)', () => {
  render(<ToastProvider><Trigger /></ToastProvider>);
  act(() => screen.getByText('go').click());
  const bar = screen.getByRole('progressbar', { name: 'Time left' });
  expect(bar.style.animation).toBe('');
  act(() => { vi.advanceTimersByTime(50); });
  expect(Number(bar.getAttribute('aria-valuenow'))).toBeGreaterThan(95);
  act(() => { vi.advanceTimersByTime(2000); });
  const half = Number(bar.getAttribute('aria-valuenow'));
  expect(half).toBeGreaterThan(40);
  expect(half).toBeLessThan(60);
  expect(bar.style.transform).toMatch(/scaleX\(0\.[4-5]/);
});
