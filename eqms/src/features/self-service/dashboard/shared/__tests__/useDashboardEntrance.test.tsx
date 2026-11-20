import React, { useRef } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDashboardEntrance } from '../useDashboardEntrance';

const Grid: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  useDashboardEntrance(ref);
  return (
    <div ref={ref}>
      <div data-dashboard-widget="a"><div data-dashboard-widget-body><section data-testid="card-a" /></div></div>
      <div data-dashboard-widget="b"><div data-dashboard-widget-body><section data-testid="card-b" /></div></div>
    </div>
  );
};

const motion = (reduce: boolean) => vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce'), media: query }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('dashboard entrance', () => {
  it('starts each widget body hidden, brings them in, and leaves the normal styles behind', async () => {
    motion(false);
    const { getByTestId } = render(<Grid />);
    const first = getByTestId('card-a');
    const second = getByTestId('card-b');
    expect(first.style.opacity).toBe('0'); // set before the first paint, so nothing flashes
    expect(second.style.opacity).toBe('0');

    await waitFor(() => expect(first.style.opacity).toBe(''), { timeout: 4000 });
    await waitFor(() => expect(second.style.opacity).toBe(''), { timeout: 4000 });
    expect(first.style.transform).toBe(''); // no leftover transform that would trap sticky or fixed children
  });

  it('does not touch the widgets when the person asked for reduced motion', () => {
    motion(true);
    const { getByTestId } = render(<Grid />);
    expect(getByTestId('card-a').style.opacity).toBe('');
    expect(getByTestId('card-b').style.opacity).toBe('');
  });
});
