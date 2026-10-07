import React from 'react';
import { Search } from 'lucide-react';
import { CountUp } from '@/components/ui/animated-card';
import { TableMarkup } from '@/components/ui/table/TablePrimitives';
import { cn } from '@/components/ui/utils';

/**
 * Flat building blocks for the dashboard: white cards on a 1px slate border, small medium-weight
 * titles, and tables with ruled cells. Nothing here invents data; every figure is passed in.
 */

export const Card: React.FC<React.HTMLAttributes<HTMLElement>> = ({ className, ...props }) => (
  <section className={cn('min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white', className)} {...props} />
);

export const CardHeader: React.FC<{ title: string; subtitle?: React.ReactNode; right?: React.ReactNode; className?: string }> = ({ title, subtitle, right, className }) => (
  <div className={cn('flex items-start justify-between gap-3 px-4 pt-3.5', className)}>
    <div className="min-w-0">
      <h2 className="truncate text-[15px] font-medium text-slate-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
    </div>
    {right && <div className="shrink-0">{right}</div>}
  </div>
);

export interface KpiCellData {
  title: string;
  /** Colour of the bar in front of the title. */
  accent: string;
  value: number | string;
  /** Small coloured text next to the value, e.g. a real share such as "53% of open". */
  chip?: string;
  footValue: number | string;
  footLabel: string;
}

const KpiCell: React.FC<KpiCellData> = ({ title, accent, value, chip, footValue, footLabel }) => (
  <div className="flex min-w-0 flex-col bg-white">
    <div className="px-4 pb-3 pt-3.5">
      <div className="flex items-center gap-2">
        <span aria-hidden className="h-3.5 w-[3px] shrink-0 rounded-full" style={{ backgroundColor: accent }} />
        <h3 className="truncate text-[13px] font-medium text-slate-800">{title}</h3>
      </div>
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="text-[28px] font-medium leading-none tracking-tight text-slate-900">
          {typeof value === 'number' ? <CountUp value={value} /> : <span className="tabular-nums">{value}</span>}
        </span>
        {chip && <span className="truncate text-[10px] font-medium" style={{ color: accent }}>{chip}</span>}
      </div>
    </div>
    <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs">
      <span className="inline-flex items-center gap-2 font-medium tabular-nums text-slate-800">
        <span aria-hidden className="grid h-3.5 w-3.5 place-items-center rounded-full border" style={{ borderColor: accent }}>
          <span className="h-1 w-1 rounded-full" style={{ backgroundColor: accent }} />
        </span>
        {typeof footValue === 'number' ? footValue.toLocaleString() : footValue}
      </span>
      <span className="truncate text-slate-600">{footLabel}</span>
    </div>
  </div>
);

/** Four metrics in one ruled block, as in the reference. */
export const KpiStrip: React.FC<{ cells: KpiCellData[]; label: string }> = ({ cells, label }) => (
  <section aria-label={label} className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-4">
    {cells.map((cell) => <KpiCell key={cell.title} {...cell} />)}
  </section>
);

export interface GrowthColumn {
  title: string;
  value: number;
  chip?: string;
  /** Text at the foot of the filled block. */
  caption: string;
  pattern: 'hatch' | 'solid' | 'lines';
  /** Tint of the filled block. */
  tint: string;
}

const BASE_PATTERN: Record<GrowthColumn['pattern'], string> = {
  hatch: 'repeating-linear-gradient(-45deg, #047857 0 3px, #10b981 3px 6px)',
  solid: 'linear-gradient(to right, #34d399, #6ee7b7)',
  lines: 'repeating-linear-gradient(90deg, #cfd6e0 0 2px, #f1f4f8 2px 5px)',
};

const PLOT_HEIGHT = 168;
const BASE_HEIGHT = 22;

/** Three figures side by side; each filled block is as tall as its value relative to the largest. */
export const GrowthColumns: React.FC<{ columns: GrowthColumn[] }> = ({ columns }) => {
  const max = Math.max(1, ...columns.map((column) => column.value));
  return (
    <div className="grid grid-cols-3 gap-3 px-4 pb-4 pt-3">
      {columns.map((column) => {
        const height = column.value > 0 ? Math.max(BASE_HEIGHT + 12, Math.round((column.value / max) * PLOT_HEIGHT)) : BASE_HEIGHT;
        return (
          <div key={column.title} className="min-w-0">
            <h3 className="truncate text-sm font-medium text-slate-800">{column.title}</h3>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-[30px] font-medium leading-none tracking-tight text-slate-900"><CountUp value={column.value} /></span>
              {column.chip && <span className="truncate text-[10px] font-medium text-emerald-600">{column.chip}</span>}
            </div>
            <div
              role="img"
              aria-label={`${column.title}: ${column.value}, ${column.caption}`}
              className="mt-3 flex items-end"
              style={{ height: PLOT_HEIGHT }}
            >
              <div
                className="relative w-full overflow-hidden rounded-t-[3px] transition-[height] duration-700 ease-[cubic-bezier(0.2,0.8,0.3,1)]"
                style={{ height, backgroundImage: column.value > 0 ? `linear-gradient(to bottom, transparent, ${column.tint})` : undefined }}
              >
                {column.value > 0 && <span className="absolute bottom-[30px] left-3 right-2 truncate text-sm text-slate-500">{column.caption}</span>}
                <span aria-hidden className="absolute inset-x-0 bottom-0" style={{ height: BASE_HEIGHT, backgroundImage: BASE_PATTERN[column.pattern] }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const SearchBox: React.FC<{ value: string; onChange: (value: string) => void; placeholder: string; label: string }> = ({ value, onChange, placeholder, label }) => (
  <label className="relative block w-full max-w-[260px]">
    <span className="sr-only">{label}</span>
    <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    />
  </label>
);

export const ToolbarButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, type = 'button', ...props }) => (
  <button
    type={type}
    className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500', className)}
    {...props}
  />
);

export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, type = 'button', ...props }) => (
  <button
    type={type}
    className={cn('inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2', className)}
    {...props}
  />
);

export const OutlineButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, type = 'button', ...props }) => (
  <button
    type={type}
    className={cn('inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500', className)}
    {...props}
  />
);

export interface FlatColumn<T> {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => React.ReactNode;
}

/** Ruled table: header and cells are separated by 1px lines both ways. The header row stays pinned while the container (see `className`) scrolls. */
export function FlatTable<T>({ columns, rows, rowKey, onRowClick, rowLabel, className }: {
  columns: FlatColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
  className?: string;
}) {
  const cell = 'border-b border-r border-slate-200 px-4 last:border-r-0';
  return (
    <div className={cn('overflow-x-auto', className)}>
      <TableMarkup.Root className="w-full min-w-[640px] border-separate border-spacing-0 text-left">
        <TableMarkup.Head>
          <TableMarkup.Row>
            {columns.map((column) => (
              <TableMarkup.HeaderCell key={column.key} scope="col" className={cn(cell, 'sticky top-0 z-10 h-11 whitespace-nowrap bg-white text-[13px] font-medium text-slate-800', column.className)}>{column.header}</TableMarkup.HeaderCell>
            ))}
          </TableMarkup.Row>
        </TableMarkup.Head>
        <TableMarkup.Body>
          {rows.map((row) => (
            <TableMarkup.Row
              key={rowKey(row)}
              tabIndex={onRowClick ? 0 : undefined}
              aria-label={rowLabel?.(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (event) => { if (event.key === 'Enter') onRowClick(row); } : undefined}
              className={cn('bg-white', onRowClick && 'cursor-pointer transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500')}
            >
              {columns.map((column) => (
                <TableMarkup.Cell key={column.key} className={cn(cell, 'py-3 align-middle text-[13px] text-slate-800', column.className)}>{column.render(row)}</TableMarkup.Cell>
              ))}
            </TableMarkup.Row>
          ))}
        </TableMarkup.Body>
      </TableMarkup.Root>
    </div>
  );
}

/** Two-line cell: bold name over a grey caption. */
export const NameCell: React.FC<{ name: React.ReactNode; caption?: React.ReactNode }> = ({ name, caption }) => (
  <div className="min-w-0">
    <p className="truncate text-sm font-medium text-slate-900">{name}</p>
    {caption && <p className="mt-0.5 truncate text-xs text-slate-500">{caption}</p>}
  </div>
);
