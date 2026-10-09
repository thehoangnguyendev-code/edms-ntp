import React, { memo, useMemo, useState } from 'react';
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
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

const MARGIN = { top: 8, right: 8, bottom: 0, left: 0 } as const;
const TICK = { fontSize: 12 } as const;
const TOOLTIP_WRAPPER = { outline: 'none', zIndex: 50 } as const;
const BAR_RADIUS: [number, number, number, number] = [3, 3, 0, 0];

/**
 * Columns drawn with the shared chart primitives: a bar under the pointer stays at full strength while the others soften, and a
 * tooltip names the bar. The chart is built when it comes near the window and plays its entrance then.
 */
const ActivityBarChartBase: React.FC<ActivityBarChartProps> = ({ data, color, valueLabel, titleFor, shortLabel, height = 232, tickEvery = 1, showValues = false, colors }) => {
  const [active, setActive] = useState<number | null>(null);

  const config = useMemo<ChartConfig>(() => ({ value: { label: valueLabel, color } }), [valueLabel, color]);
  // `fill` is what the tooltip uses for the colour chip of the bar it describes.
  const points = useMemo(() => data.map((point, index) => ({ ...point, fill: colors?.[index] ?? color })), [data, colors, color]);

  return (
    <LazyMount style={{ height }} className="px-2 pb-3 pt-2" placeholder={<div className="h-full animate-pulse rounded-lg bg-slate-50" aria-hidden />}>
      <ChartContainer config={config} className="aspect-auto h-full w-full">
        <BarChart
          data={points}
          margin={MARGIN}
          barCategoryGap="22%"
          onMouseMove={(state) => {
            const index = Number(state?.activeTooltipIndex);
            setActive(Number.isInteger(index) ? index : null);
          }}
          onMouseLeave={() => setActive(null)}
        >
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={TICK}
            interval={0}
            tickFormatter={(label: string, index: number) => (index % tickEvery === 0 ? (shortLabel ? shortLabel(label) : label) : '')}
            tickMargin={8}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} tick={TICK} />
          <ChartTooltip
            cursor={false}
            wrapperStyle={TOOLTIP_WRAPPER}
            content={<ChartTooltipContent className="min-w-[10rem] bg-white" labelFormatter={(label) => (titleFor ? titleFor(String(label)) : String(label))} />}
          />
          <Bar dataKey="value" fill="var(--color-value)" radius={BAR_RADIUS} maxBarSize={16} animationBegin={120} animationDuration={900} animationEasing="ease-out">
            {points.map((point, index) => (
              <Cell key={`${point.label}-${index}`} fill={point.fill} fillOpacity={active === null || active === index ? 1 : 0.55} style={{ transition: 'fill-opacity 200ms ease' }} />
            ))}
            {showValues && <LabelList dataKey="value" position="top" fill="#475569" fontSize={12} />}
          </Bar>
        </BarChart>
      </ChartContainer>
    </LazyMount>
  );
};

export const ActivityBarChart = memo(ActivityBarChartBase);
