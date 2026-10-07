import React, { useMemo, useState } from 'react';
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { TabNav, type TabItem } from '@/components/ui/tabs';
import { ActivityBarChart } from './ActivityBarChart';
import { groupTail, share, type RankedCount } from './dashboardMetrics';
import { PanelError } from './dashboardParts';
import { Card, CardHeader } from './dashboardUi';
import type { DashboardResource } from './useDashboardResource';

type View = 'bar' | 'donut';

const EASE_OUT = [0.2, 0.8, 0.3, 1] as const;
const VIEW_ORDER: readonly string[] = ['bar', 'donut'];
/** How far (px) a view slides in from the side of the tab that was chosen. */
const SLIDE = 28;

interface ViewMotion {
  /** 1 when the new tab is to the right of the old one, -1 when it is to the left. */
  direction: 1 | -1;
  /** Reduced-motion users get a plain swap. */
  still: boolean;
}

/** The old view leaves toward the tab it came from, the new one arrives from the tab that was chosen. */
const viewVariants: Variants = {
  enter: ({ direction, still }: ViewMotion) => ({ opacity: 0, x: still ? 0 : direction * SLIDE, scale: still ? 1 : 0.985 }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: ({ direction, still }: ViewMotion) => ({
    opacity: 0,
    x: still ? 0 : -direction * SLIDE,
    scale: still ? 1 : 0.985,
    transition: { duration: still ? 0 : 0.16, ease: 'easeIn' },
  }),
};

const VIEWS: readonly TabItem[] = [
  { id: 'bar', label: 'Bar', icon: BarChart3 },
  { id: 'donut', label: 'Donut', icon: PieChartIcon },
];

/** One colour per row, shared by the columns, the ring and the legend. Red is left out on purpose: it reads as an alarm. */
export const BREAKDOWN_PALETTE = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#14b8a6', '#ec4899', '#f97316', '#6366f1', '#84cc16', '#06b6d4'];
const OTHER_COLOR = '#94a3b8';
const MAX_SLICES = 8;
const COLUMN_WIDTH = 64;
const CHART_HEIGHT = 248;

/** Both views, and every loading/empty/error state, share this height so switching never resizes the card. */
const BODY_HEIGHT = 'h-[456px] sm:h-[280px]';

export type ColorFor = (row: RankedCount, index: number) => string;

const paletteColor: ColorFor = (row, index) => (row.key === 'OTHER' ? OTHER_COLOR : BREAKDOWN_PALETTE[index % BREAKDOWN_PALETTE.length]);

/** Name, count and share of every row, always visible; hovering a row highlights its slice in the donut. Rows arrive one after the other. */
const Legend: React.FC<{ rows: RankedCount[]; total: number; colorFor: ColorFor; active?: number | null; onActive?: (index: number | null) => void }> = ({ rows, total, colorFor, active = null, onActive }) => {
  const reduceMotion = useReducedMotion();
  return (
    <ul className="max-h-[160px] space-y-0.5 overflow-y-auto custom-scrollbar sm:max-h-[248px]">
      {rows.map((row, index) => (
        <motion.li
          key={row.key}
          initial={reduceMotion ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: reduceMotion ? 0 : 0.12 + Math.min(index, 9) * 0.05, ease: EASE_OUT }}
          onMouseEnter={() => onActive?.(index)}
          onMouseLeave={() => onActive?.(null)}
          className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[13px] transition-colors ${active === index ? 'bg-slate-50' : ''}`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: colorFor(row, index) }} />
            <span className="min-w-0">
              <span className="block truncate text-slate-800" title={row.name}>{row.name}</span>
              {row.shortCode !== row.name && <span className="block truncate text-[11px] text-slate-400">{row.shortCode}</span>}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="font-medium tabular-nums text-slate-900">{row.value.toLocaleString()}</span>
            <span className="w-9 text-right text-xs tabular-nums text-slate-400">{share(row.value, total)}%</span>
          </span>
        </motion.li>
      ))}
    </ul>
  );
};

/** One coloured column per row, labelled with its short code and its count. */
const Columns: React.FC<{ rows: RankedCount[]; total: number; valueLabel: string; colorFor: ColorFor }> = ({ rows, total, valueLabel, colorFor }) => {
  const names = useMemo(() => new Map(rows.map((row) => [row.shortCode, row.name])), [rows]);
  return (
    <div className="grid h-full grid-cols-1 items-center gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(200px,280px)]">
      <div className="h-[200px] overflow-x-auto custom-scrollbar sm:h-full">
        <div className="h-full" style={{ minWidth: rows.length * COLUMN_WIDTH + 60 }}>
          <ActivityBarChart
            data={rows.map((row) => ({ label: row.shortCode, value: row.value }))}
            color={BREAKDOWN_PALETTE[0]}
            colors={rows.map(colorFor)}
            valueLabel={valueLabel}
            titleFor={(label) => names.get(label) ?? label}
            height={CHART_HEIGHT}
            showValues
          />
        </div>
      </div>
      <Legend rows={rows} total={total} colorFor={colorFor} />
    </div>
  );
};

/** Ring of the rows with the total in the centre; the legend shares its colours. */
const Donut: React.FC<{ rows: RankedCount[]; total: number; centerCaption: string; colorFor: ColorFor }> = ({ rows, total, centerCaption, colorFor }) => {
  const [active, setActive] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const centerValue = (active === null ? total : rows[active].value).toLocaleString();
  return (
    <div className="grid h-full grid-cols-1 items-center gap-4 p-4 sm:grid-cols-[200px_minmax(0,1fr)]">
      <div className="relative mx-auto h-[200px] w-[200px]">
        <ResponsiveContainer width="100%" height="100%" minHeight={160}>
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="name"
              innerRadius="64%"
              outerRadius="94%"
              paddingAngle={rows.length > 1 ? 2 : 0}
              stroke="none"
              animationBegin={120}
              animationDuration={900}
              animationEasing="ease-out"
              onMouseEnter={(_, index) => setActive(index)}
              onMouseLeave={() => setActive(null)}
            >
              {rows.map((row, index) => (
                <Cell key={row.key} fill={colorFor(row, index)} fillOpacity={active === null || active === index ? 1 : 0.4} style={{ transition: 'fill-opacity 200ms ease' }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <motion.span
            key={centerValue}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            className="text-[28px] font-medium leading-none tracking-tight tabular-nums text-slate-900"
          >
            {centerValue}
          </motion.span>
          <span className="mt-1 max-w-[110px] truncate text-xs text-slate-500">{active === null ? centerCaption : rows[active].shortCode}</span>
        </div>
      </div>
      <Legend rows={rows} total={total} colorFor={colorFor} active={active} onActive={setActive} />
    </div>
  );
};

export interface BreakdownPanelProps {
  title: string;
  /** Shown once the rows are loaded. */
  subtitle: (total: number, count: number) => string;
  /** Shown before that. */
  idleSubtitle: string;
  resource: DashboardResource<RankedCount[]>;
  /** What one unit is, in the tooltip. */
  valueLabel: string;
  /** Under the total in the middle of the ring. */
  centerCaption: string;
  /** Names the chart for assistive technology: "<noun> by …". */
  chartLabel: string;
  emptyLabel: string;
  errorMessage: string;
  /** Unique per page; ties each tab to its panel. */
  idPrefix: string;
  /** Overrides the shared palette, e.g. for statuses that carry a meaning. */
  colorFor?: ColorFor;
  className?: string;
}

/**
 * Rows of a real breakdown, switchable between coloured columns and a ring. Both views draw the same rows:
 * the columns show every row, the ring folds the smallest ones into "Other" so it stays readable.
 */
export const BreakdownPanel: React.FC<BreakdownPanelProps> = ({
  title, subtitle, idleSubtitle, resource, valueLabel, centerCaption, chartLabel, emptyLabel, errorMessage, idPrefix, colorFor = paletteColor, className,
}) => {
  const [view, setView] = useState<View>('bar');
  const [direction, setDirection] = useState<1 | -1>(1);
  const reduceMotion = useReducedMotion();
  const viewMotion: ViewMotion = { direction, still: !!reduceMotion };
  const switchView = (next: string) => {
    setDirection(VIEW_ORDER.indexOf(next) >= VIEW_ORDER.indexOf(view) ? 1 : -1);
    setView(next as View);
  };
  const rows = useMemo(() => [...(resource.data ?? [])].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)), [resource.data]);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const ringRows = useMemo(() => groupTail(rows, MAX_SLICES), [rows]);
  const summary = rows.map((row) => `${row.name} ${row.value}`).join(', ');

  return (
    <Card className={className} aria-label={title}>
      <CardHeader
        title={title}
        subtitle={resource.data ? subtitle(total, rows.length) : idleSubtitle}
        right={
          <TabNav
            tabs={VIEWS}
            activeTab={view}
            onChange={switchView}
            variant="pill"
            ariaLabel="Chart view"
            tabIdPrefix={`${idPrefix}-tab`}
            panelIdPrefix={`${idPrefix}-panel`}
            className="!w-auto"
          />
        }
      />
      <div id={`${idPrefix}-panel-${view}`} role="tabpanel" aria-labelledby={`${idPrefix}-tab-${view}`} className={`${BODY_HEIGHT} relative overflow-hidden`}>
        {resource.error ? (
          <div className="flex h-full items-center justify-center">
            <PanelError message={errorMessage} onRetry={resource.reload} />
          </div>
        ) : resource.loading && !resource.data ? (
          <div className="m-4 h-[calc(100%-2rem)] animate-pulse rounded-lg bg-slate-50" aria-hidden />
        ) : rows.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-slate-400">{emptyLabel}</p>
        ) : (
          <AnimatePresence mode="wait" initial={false} custom={viewMotion}>
            <motion.div
              key={view}
              custom={viewMotion}
              variants={viewVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: reduceMotion ? 0 : 0.32, ease: EASE_OUT }}
              className="h-full"
              role="img"
              aria-label={`${view === 'bar' ? 'Bar chart' : 'Donut chart'} of ${chartLabel}: ${summary}`}
            >
              {view === 'bar'
                ? <Columns rows={rows} total={total} valueLabel={valueLabel} colorFor={colorFor} />
                : <Donut rows={ringRows} total={total} centerCaption={centerCaption} colorFor={colorFor} />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </Card>
  );
};
