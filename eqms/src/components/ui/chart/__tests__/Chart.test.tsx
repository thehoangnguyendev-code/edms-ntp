import { render, screen } from '@testing-library/react';
import { Bar, BarChart, XAxis } from 'recharts';
import { describe, expect, it, vi } from 'vitest';
import { ChartContainer, ChartLegendContent, ChartTooltipContent, type ChartConfig } from '..';

const config = {
  desktop: { label: 'Desktop', color: '#10b981' },
  mobile: { label: 'Mobile', theme: { light: '#3b82f6', dark: '#93c5fd' } },
} satisfies ChartConfig;

const renderInContainer = (node: React.ReactNode, id = 'demo') =>
  render(
    <ChartContainer config={config} id={id}>
      {node as React.ReactElement}
    </ChartContainer>,
  );

describe('ChartContainer', () => {
  it('exposes each series colour as a CSS variable scoped to this chart, for both themes', () => {
    const { container } = renderInContainer(<BarChart data={[{ month: 'Jan', desktop: 1 }]}><XAxis dataKey="month" /><Bar dataKey="desktop" fill="var(--color-desktop)" /></BarChart>);

    const root = container.querySelector('[data-slot="chart"]') as HTMLElement;
    expect(root.dataset.chart).toBe('chart-demo');
    const css = container.querySelector('style')?.textContent ?? '';
    expect(css).toContain('[data-chart=chart-demo]');
    expect(css).toContain('--color-desktop: #10b981;');
    expect(css).toContain('--color-mobile: #3b82f6;'); // light
    expect(css).toContain('.dark [data-chart=chart-demo]');
    expect(css).toContain('--color-mobile: #93c5fd;'); // dark
  });

  it('keeps two charts on a page apart', () => {
    const { container } = render(
      <>
        <ChartContainer config={{ a: { label: 'A', color: 'red' } }}><BarChart data={[]} /></ChartContainer>
        <ChartContainer config={{ a: { label: 'A', color: 'blue' } }}><BarChart data={[]} /></ChartContainer>
      </>,
    );
    const ids = Array.from(container.querySelectorAll<HTMLElement>('[data-slot="chart"]')).map((chart) => chart.dataset.chart);
    expect(new Set(ids).size).toBe(2);
    // Ids look like 'chart-_r_0_': plain characters that work unquoted in the CSS attribute selector the style block uses
    expect(ids.every((id) => /^chart-[A-Za-z0-9_-]+$/.test(id ?? ''))).toBe(true);
  });

  it('draws a chart even where the browser reports no size, such as in these tests', () => {
    const { container } = renderInContainer(<BarChart data={[{ month: 'Jan', desktop: 3 }]}><Bar dataKey="desktop" /></BarChart>);
    expect(container.querySelector('svg.recharts-surface')).not.toBeNull();
  });
});

describe('ChartTooltipContent', () => {
  const payload = [
    { name: 'desktop', dataKey: 'desktop', value: 1234, color: '#10b981', payload: { month: 'January', fill: '#10b981' } },
    { name: 'mobile', dataKey: 'mobile', value: 56, color: '#3b82f6', payload: { month: 'January', fill: '#3b82f6' } },
  ];

  it('names each series from the config and formats the numbers', () => {
    renderInContainer(<ChartTooltipContent active payload={payload as never} label="January" />);

    expect(screen.getByText('Desktop')).toBeInTheDocument();
    expect(screen.getByText('Mobile')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('56')).toBeInTheDocument();
  });

  it('is a white card with a slate border, not one that depends on shadcn colour variables the app does not define', () => {
    renderInContainer(<ChartTooltipContent active payload={payload as never} />);
    const card = screen.getAllByText('Desktop')[0].closest('div.rounded-lg') as HTMLElement; // the first series also titles the card
    expect(card.className).toContain('bg-white');
    expect(card.className).toContain('border-slate-200');
    expect(card.className).not.toMatch(/bg-background|border-border/);
  });

  it('shows nothing while no point is hovered', () => {
    const { container } = renderInContainer(<ChartTooltipContent active={false} payload={payload as never} />);
    expect(container.querySelector('.shadow-xl')).toBeNull();
  });

  it('refuses to be used outside a chart', () => {
    const quiet = () => undefined;
    const spy = vi.spyOn(console, 'error').mockImplementation(quiet);
    expect(() => render(<ChartTooltipContent active payload={payload as never} />)).toThrow('useChart must be used within a <ChartContainer />');
    spy.mockRestore();
  });
});

describe('ChartLegendContent', () => {
  it('lists the series by their configured label with their colour', () => {
    renderInContainer(
      <ChartLegendContent payload={[{ value: 'desktop', dataKey: 'desktop', color: '#10b981', type: 'square' }] as never} />,
    );
    const label = screen.getByText('Desktop');
    const swatch = label.parentElement?.querySelector('div.h-2.w-2') as HTMLElement;
    expect(swatch.style.backgroundColor).toBe('rgb(16, 185, 129)');
  });
});

describe('ChartTooltipContent card', () => {
  it('stays a solid white card when the caller asks for a wider one, so nothing shows through it', () => {
    render(
      <ChartContainer config={config}>
        <ChartTooltipContent
          active
          className="min-w-[10rem] bg-white"
          payload={[{ name: 'desktop', dataKey: 'desktop', value: 1, color: '#10b981', payload: { fill: '#10b981' } }] as never}
        />
      </ChartContainer>,
    );
    const card = screen.getAllByText('Desktop')[0].closest('div.rounded-lg') as HTMLElement;
    expect(card.className).toContain('bg-white');
    expect(card.className).toContain('min-w-[10rem]');
    expect(card.className).not.toContain('min-w-[8rem]'); // replaced, not added to
    expect(card.className).not.toMatch(/bg-white\/|opacity-/); // no translucency
  });
});
