import { trFormat as __ariaTrFormat, getCatalogLanguage } from "@/i18n";
import React, { memo, useMemo } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { ChartCanvas, barValueLabels, emphasize } from '@/components/ui/chart';
import type { DashboardActivityPoint } from '@/services/api/dashboard';
import { LazyMount } from './LazyMount';

interface ActivityBarChartProps {
  /** Keep this array's identity while the numbers are unchanged: a new array makes the chart play its entrance again. */
  data: DashboardActivityPoint[];
  color: string;
  /** What one unit of the series is, shown in the tooltip. */
  valueLabel: string;
  titleFor?: (label: string) => string;
  /** Shorter text for the x axis, e.g. just the month name. */
  shortLabel?: (label: string) => string;
  height?: number;
  /** Every n-th x label is drawn; the rest are skipped so they never overlap. */
  tickEvery?: number;
  /** Draw each bar's value above it. */
  showValues?: boolean;
  /** One colour per bar; bars fall back to `color`. Bars are always coloured, the hovered one stays full strength while the rest soften. */
  colors?: string[];
}

/**
 * Columns drawn with Chart.js: a bar under the pointer stays at full strength while the others soften, and a tooltip names the bar. The chart is built when it comes near
 * the window and plays its entrance then.
 */
const ActivityBarChartBase: React.FC<ActivityBarChartProps> = ({ data, color, valueLabel, titleFor, shortLabel, height = 232, tickEvery = 1, showValues = false, colors }) => {
  const config = useMemo<ChartConfiguration<'bar'>>(() => {
    const full = data.map((_, index) => colors?.[index] ?? color);
    let hovered: number | null = null;
    return {
      type: 'bar',
      data: {
        labels: data.map((point) => point.label),
        datasets: [{ label: valueLabel, data: data.map((point) => point.value), backgroundColor: full, borderRadius: { topLeft: 3, topRight: 3 }, maxBarThickness: 16, categoryPercentage: 0.82, barPercentage: 0.9 }],
      },
      options: {
        animation: { duration: 900, easing: 'easeOutQuad', delay: 120 },
        layout: { padding: { top: showValues ? 18 : 8, right: 8 } },
        interaction: { mode: 'index', intersect: false },
        onHover: (_event, elements, chart) => {
          const index = elements.length > 0 ? elements[0].index : null;
          if (index === hovered) return;
          hovered = index;
          emphasize(chart, index, full, 0.55);
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              autoSkip: false,
              font: { size: 12 },
              callback(value, index) {
                const label = String(this.getLabelForValue(Number(value)));
                return index % tickEvery === 0 ? (shortLabel ? shortLabel(label) : label) : '';
              },
            },
          },
          y: { beginAtZero: true, border: { display: false }, grid: { color: '#f1f5f9' }, ticks: { precision: 0, font: { size: 12 } } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#ffffff',
            titleColor: '#0f172a',
            bodyColor: '#334155',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            padding: 10,
            displayColors: true,
            boxPadding: 4,
            callbacks: {
              title: (items) => { const label = String(items[0]?.label ?? ''); return titleFor ? titleFor(label) : label; },
              label: (item) => `${valueLabel}: ${Number(item.parsed.y).toLocaleString()}`,
              labelColor: (item) => ({ borderColor: full[item.dataIndex], backgroundColor: full[item.dataIndex], borderRadius: 2 }),
            },
          },
        },
      },
      plugins: showValues ? [barValueLabels as never] : [],
    };
  }, [data, color, colors, valueLabel, titleFor, shortLabel, tickEvery, showValues, getCatalogLanguage()]);

  return (
    <LazyMount style={{ height }} className="px-2 pb-3 pt-2" placeholder={<div className="h-full animate-pulse rounded-lg bg-slate-50" aria-hidden />}>
      <ChartCanvas config={config} ariaLabel={__ariaTrFormat("{v1} by {v2} groups", { v1: valueLabel, v2: data.length })} />
    </LazyMount>
  );
};

export const ActivityBarChart = memo(ActivityBarChartBase);
