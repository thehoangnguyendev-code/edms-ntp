import { act, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GrowthColumns, type GrowthColumn } from '../dashboardUi';

const columns: GrowthColumn[] = [
  { title: 'Review', value: 8, chip: '73%', caption: 'Share of pipeline', pattern: 'hatch', tint: '#d1fae5' },
  { title: 'Approval', value: 2, chip: '18%', caption: 'Share of pipeline', pattern: 'solid', tint: '#ccfbf1' },
  { title: 'Training', value: 1, chip: '9%', caption: 'Share of pipeline', pattern: 'lines', tint: '#ecf3f0' },
];

const column = (title: string, value: number) => screen.getByRole('img', { name: `${title}: ${value}, Share of pipeline` });
const blockOf = (plot: HTMLElement) => plot.lastElementChild as HTMLElement;

afterEach(() => vi.unstubAllGlobals());

describe('GrowthColumns captions', () => {
  it('writes the caption inside a block that is tall enough, and above a block that is not, so it is never cut off', () => {
    render(<GrowthColumns columns={columns} />);

    // 8 of 8 -> the full height: room for the caption inside
    expect(within(column('Review', 8)).getByText('Share of pipeline')).toHaveAttribute('data-caption', 'inside');
    // 2 and 1 of 8 are short: the caption sits above the block, outside its clipping box
    for (const [title, value] of [['Approval', 2], ['Training', 1]] as const) {
      const caption = within(column(title, value)).getByText('Share of pipeline');
      expect(caption).toHaveAttribute('data-caption', 'above');
      expect(blockOf(column(title, value)).contains(caption)).toBe(false);
    }
  });

  it('shows the caption of an empty column too, above its base strip', () => {
    render(<GrowthColumns columns={[{ ...columns[0], value: 0 }, { ...columns[1], value: 0 }, { ...columns[2], value: 0 }]} />);
    const caption = within(column('Review', 0)).getByText('Share of pipeline');
    expect(caption).toHaveAttribute('data-caption', 'above');
  });
});

describe('GrowthColumns heights', () => {
  it('rise to heights in proportion to the values, with the base strip as the least a block can be', async () => {
    render(<GrowthColumns columns={columns} />);

    await waitFor(() => expect(blockOf(column('Review', 8)).style.height).toBe('168px'), { timeout: 4000 }); // the largest value fills the plot
    await waitFor(() => expect(blockOf(column('Approval', 2)).style.height).toBe('42px'), { timeout: 4000 }); // 2 / 8 of 168
    await waitFor(() => expect(blockOf(column('Training', 1)).style.height).toBe('34px'), { timeout: 4000 }); // 1 / 8 is 21 px: never less than strip + 12
  });
});

describe('GrowthColumns entrance', () => {
  it('is built only when it comes near the window, so the columns rise when they are seen', () => {
    const callbacks: IntersectionObserverCallback[] = [];
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { callbacks.push(callback); }
      observe() { /* the test fires the callback */ }
      disconnect() { /* nothing to release */ }
      unobserve() { /* unused */ }
    });
    const { container } = render(<GrowthColumns columns={columns} />);

    expect(screen.queryAllByRole('img')).toHaveLength(0);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3); // one placeholder per column keeps the card the same size

    act(() => callbacks[0]([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));

    expect(screen.getAllByRole('img')).toHaveLength(3);
  });
});
