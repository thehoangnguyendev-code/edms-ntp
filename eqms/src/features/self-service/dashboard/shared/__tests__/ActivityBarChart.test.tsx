import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChartConfiguration } from 'chart.js';

// The chart itself is Chart.js on a canvas, which a test browser cannot draw: the canvas is a stand-in that keeps the configuration the screen gave it.
const drawn = vi.hoisted(() => ({ configs: [] as unknown[] }));
vi.mock('@/components/ui/chart', () => ({
  ChartCanvas: ({ config, ariaLabel }: { config: unknown; ariaLabel: string }) => {
    drawn.configs.push(config);
    return <canvas role="img" aria-label={ariaLabel} />;
  },
  barValueLabels: { id: 'barValueLabels' },
  emphasize: vi.fn(),
}));
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
const lastConfig = () => drawn.configs[drawn.configs.length - 1] as ChartConfiguration<'bar'>;

beforeEach(() => {
  callbacks.length = 0;
  drawn.configs.length = 0;
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});
afterEach(() => vi.unstubAllGlobals());

describe('ActivityBarChart', () => {
  it('draws nothing until it is near the window, then draws a Chart.js column chart with its series colour', () => {
    const { container } = render(<ActivityBarChart data={data} color="#10b981" valueLabel="Documents" />);

    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('.animate-pulse')).not.toBeNull(); // the placeholder keeps the box the same size

    comeNear();

    expect(container.querySelector('canvas')).not.toBeNull();
    const config = lastConfig();
    expect(config.type).toBe('bar');
    expect(config.data.labels).toEqual(['Jan', 'Feb']);
    expect(config.data.datasets[0].data).toEqual([3, 7]);
    expect(config.data.datasets[0].backgroundColor).toEqual(['#10b981', '#10b981']);
  });

  it('keeps the height it is given before and after it is drawn', () => {
    const { container } = render(<ActivityBarChart data={data} color="#10b981" valueLabel="Documents" height={240} />);
    const box = container.firstElementChild as HTMLElement;
    expect(box.style.height).toBe('240px');
    comeNear();
    expect(box.style.height).toBe('240px');
  });

  it('gives each bar its own colour when it is given, and names the bar in the tooltip', () => {
    render(<ActivityBarChart data={data} color="#10b981" colors={['#ef4444', '#0ea5e9']} valueLabel="Documents" titleFor={(label) => `Month of ${label}`} />);
    comeNear();
    const config = lastConfig();
    expect(config.data.datasets[0].backgroundColor).toEqual(['#ef4444', '#0ea5e9']);
    const tooltip = config.options?.plugins?.tooltip?.callbacks as { title: (items: unknown[]) => string; label: (item: unknown) => string };
    expect(tooltip.title([{ label: 'Feb' }])).toBe('Month of Feb');
    expect(tooltip.label({ parsed: { y: 1234 } })).toBe('Documents: 1,234');
  });

  it('draws only every n-th label of the axis, and the values above the bars on request', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ label: `M${i}`, value: i }));
    render(<ActivityBarChart data={many} color="#10b981" valueLabel="Documents" tickEvery={2} shortLabel={(label) => label.toLowerCase()} showValues />);
    comeNear();
    const config = lastConfig();
    const ticks = (config.options?.scales?.x as { ticks: { callback: (this: { getLabelForValue: (v: number) => string }, value: number, index: number) => string } }).ticks;
    const scale = { getLabelForValue: (v: number) => many[v].label };
    expect(many.map((_, i) => ticks.callback.call(scale, i, i))).toEqual(['m0', '', 'm2', '', 'm4', '']);
    expect(config.plugins).toHaveLength(1);
  });
});
