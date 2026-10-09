import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityBarChart } from '../ActivityBarChart';

const callbacks: IntersectionObserverCallback[] = [];
class FakeIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) { callbacks.push(callback); }
  observe() { /* the test fires the callback */ }
  disconnect() { /* nothing to release */ }
  unobserve() { /* unused */ }
}

const data = [{ label: 'Jan', value: 3 }, { label: 'Feb', value: 7 }];
const comeNear = () => act(() => callbacks[0]([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));

beforeEach(() => {
  callbacks.length = 0;
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});
afterEach(() => vi.unstubAllGlobals());

describe('ActivityBarChart', () => {
  it('draws nothing until it is near the window, then draws on the shared chart container with its series colour', () => {
    const { container } = render(<ActivityBarChart data={data} color="#10b981" valueLabel="Documents" />);

    expect(container.querySelector('[data-slot="chart"]')).toBeNull();
    expect(container.querySelector('.animate-pulse')).not.toBeNull(); // the placeholder keeps the box the same size

    comeNear();

    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull();
    expect(container.querySelector('style')?.textContent).toContain('--color-value: #10b981;');
    expect(container.querySelector('svg.recharts-surface')).not.toBeNull();
  });

  it('keeps the height it is given before and after it is drawn', () => {
    const { container } = render(<ActivityBarChart data={data} color="#10b981" valueLabel="Documents" height={240} />);
    const box = container.firstElementChild as HTMLElement;
    expect(box.style.height).toBe('240px');
    comeNear();
    expect(box.style.height).toBe('240px');
  });
});
