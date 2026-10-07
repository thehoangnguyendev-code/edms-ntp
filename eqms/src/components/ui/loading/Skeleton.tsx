import React from 'react';
import { cn } from '../utils';

/*
 * Skeleton placeholders for asynchronous READ phases only (first load of a list, a dashboard, or
 * a lazily loaded tab). The layout is known up front, so the placeholder mirrors it.
 *
 * Do NOT use these for signing, state transitions or any action the user just triggered: those
 * must keep the blocking overlay / modal loader so the user cannot act on stale or half-updated data.
 */

/** Base shimmer block. Respects reduced-motion via the `motion-reduce` variant. */
export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => (
  <div
    aria-hidden="true"
    className={cn('animate-pulse rounded-md bg-slate-200/70 motion-reduce:animate-none', className)}
    {...rest}
  />
);

/** A run of text lines. The last line is shorter so the block reads as a paragraph. */
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ lines = 3, className }) => (
  <div className={cn('space-y-2', className)} role="status" aria-label="Loading">
    {Array.from({ length: lines }, (_, index) => (
      <Skeleton key={index} className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')} />
    ))}
  </div>
);

/**
 * Table body placeholder. `columns` drives the header/cell count so the skeleton matches the real
 * table width; `rows` the number of body rows (defaults to the usual page size of 10).
 */
export const SkeletonTable: React.FC<{ rows?: number; columns?: number; className?: string }> = ({
  rows = 10,
  columns = 6,
  className,
}) => (
  <div
    role="status"
    aria-label="Loading table"
    className={cn('w-full overflow-hidden rounded-xl border border-slate-200 bg-white', className)}
  >
    <div className="grid gap-4 border-b-2 border-slate-200 bg-slate-50 px-4 py-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: columns }, (_, index) => (
        <Skeleton key={index} className="h-3 w-3/4" />
      ))}
    </div>
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="grid gap-4 px-4 py-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton key={column} className={cn('h-3', column === 0 ? 'w-1/2' : 'w-full')} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

/** Card-shaped placeholder for dashboards and stat tiles. */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
  <div role="status" aria-label="Loading" className={cn('rounded-xl border border-slate-200 bg-white p-5', className)}>
    <Skeleton className="mb-4 h-4 w-1/3" />
    <SkeletonText lines={3} />
  </div>
);
