import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LazyMount } from '../LazyMount';

/** A controllable IntersectionObserver: the test decides when the box comes near the window. */
const observers: Array<{ callback: IntersectionObserverCallback; options?: IntersectionObserverInit; disconnect: ReturnType<typeof vi.fn> }> = [];

class FakeIntersectionObserver {
  disconnect = vi.fn();
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    observers.push({ callback, options, disconnect: this.disconnect });
  }
  observe() { /* the test fires the callback */ }
  unobserve() { /* unused */ }
}

const intersect = (isIntersecting: boolean) =>
  act(() => observers[0].callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver));

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => vi.unstubAllGlobals());

describe('LazyMount', () => {
  it('shows the placeholder, and builds nothing, until the box comes near the window', () => {
    const Heavy = vi.fn(() => <p>chart</p>);
    render(<LazyMount placeholder={<p>placeholder</p>}><Heavy /></LazyMount>);

    expect(screen.getByText('placeholder')).toBeInTheDocument();
    expect(screen.queryByText('chart')).toBeNull();
    expect(Heavy).not.toHaveBeenCalled();
  });

  it('stays unbuilt while the box is still far away', () => {
    render(<LazyMount placeholder={<p>placeholder</p>}><p>chart</p></LazyMount>);
    intersect(false);
    expect(screen.queryByText('chart')).toBeNull();
  });

  it('builds the content when the box comes near, keeps it, and stops observing', () => {
    render(<LazyMount placeholder={<p>placeholder</p>}><p>chart</p></LazyMount>);

    intersect(true);

    expect(screen.getByText('chart')).toBeInTheDocument();
    expect(screen.queryByText('placeholder')).toBeNull();
    expect(observers[0].disconnect).toHaveBeenCalled();
    intersect(false); // scrolling away again does not tear the chart down
    expect(screen.getByText('chart')).toBeInTheDocument();
  });

  it('starts a little before the box is visible, so the chart is ready when it is seen', () => {
    render(<LazyMount><p>chart</p></LazyMount>);
    expect(observers[0].options?.rootMargin).toBe('240px');
  });

  it('just shows the content where there is no IntersectionObserver', () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<LazyMount placeholder={<p>placeholder</p>}><p>chart</p></LazyMount>);
    expect(screen.getByText('chart')).toBeInTheDocument();
  });

  it('lets the caller size the box, so the page does not jump when the content arrives', () => {
    const { container } = render(<LazyMount className="h-[200px]" style={{ height: 232 }}><p>chart</p></LazyMount>);
    const box = container.firstElementChild as HTMLElement;
    expect(box.className).toContain('h-[200px]');
    expect(box.style.height).toBe('232px');
  });
});
