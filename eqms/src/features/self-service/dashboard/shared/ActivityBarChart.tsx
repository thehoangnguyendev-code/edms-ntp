import React, { useState } from 'react';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DashboardActivityPoint } from '@/services/api/dashboard';

interface TipProps {
  active?: boolean;
  payload?: { value: number; payload: DashboardActivityPoint }[];
  color: string;
  valueLabel: string;
  titleFor?: (label: string) => string;
}

/** White card with the date on top and one coloured row per series, as in the reference. */
export const ChartTooltip: React.FC<TipProps> = ({ active, payload, color, valueLabel, titleFor }) => {
  if (!active || !payload?.length) return null;
  const { label } = payload[0].payload;
  return (
    <div className="min-w-[176px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-lg">
      <p className="text-xs text-slate-500">{titleFor ? titleFor(label) : label}</p>
      <div className="mt-1.5 flex items-center justify-between gap-6 text-[13px]">
        <span className="inline-flex items-center gap-2 text-slate-900">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: color }} />
          {valueLabel}
        </span>
        <span className="font-medium tabular-nums text-slate-900">{payload[0].value.toLocaleString()}</span>
      </div>
    </div>
  );
};

interface ActivityBarChartProps {
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

/** Pale bars; the bar under the pointer takes the series colour and a tooltip opens beside it. */
export const ActivityBarChart: React.FC<ActivityBarChartProps> = ({ data, color, valueLabel, titleFor, shortLabel, height = 232, tickEvery = 1, showValues = false, colors }) => {
  const [active, setActive] = useState<number | null>(null);
  return (
    <div style={{ height }} className="px-2 pb-3 pt-2">
      <ResponsiveContainer width="100%" height="100%" minHeight={160}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
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
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            interval={0}
            tickFormatter={(label: string, index: number) => (index % tickEvery === 0 ? (shortLabel ? shortLabel(label) : label) : '')}
            tickMargin={8}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} tick={{ fill: '#94a3b8', fontSize: 12 }} />
          <Tooltip cursor={false} content={<ChartTooltip color={color} valueLabel={valueLabel} titleFor={titleFor} />} wrapperStyle={{ outline: 'none', zIndex: 20 }} />
          <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={16} animationBegin={120} animationDuration={900} animationEasing="ease-out">
            {data.map((point, index) => (
              <Cell key={`${point.label}-${index}`} fill={colors?.[index] ?? color} fillOpacity={active === null || active === index ? 1 : 0.55} style={{ transition: 'fill-opacity 200ms ease' }} />
            ))}
            {showValues && <LabelList dataKey="value" position="top" fill="#475569" fontSize={12} />}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
