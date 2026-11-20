import React from 'react';
import { IconLock } from '@tabler/icons-react';
import { formatDate } from '@/utils/format';
import { DEFAULT_FIXED_RETENTION_YEARS, MAX_RETENTION_YEARS, isPermanentRetention, retentionLockedUntil } from './storageIntegration';

interface RetentionControlProps {
  /** The retention being set (MAX_RETENTION_YEARS means Permanent). */
  years: number;
  /** The retention that is saved: the summary warns while the two differ. */
  savedYears: number;
  onChange: (years: number) => void;
}

const MODE_CLASS = 'inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium transition-colors peer-checked:bg-white peer-checked:text-emerald-700 peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 text-slate-600';

/**
 * How long stored records are locked (WORM, Compliance Mode). It cannot be undone, so the control says in plain words what the choice does: the date until which the
 * records stored from now on cannot be shortened or deleted by anyone, administrators included. A change is asked to be confirmed when the page is saved.
 */
export const RetentionControl: React.FC<RetentionControlProps> = ({ years, savedYears, onChange }) => {
  const permanent = isPermanentRetention(years);
  const changed = years !== savedYears;
  const until = formatDate(retentionLockedUntil(years));

  return (
    <div>
      <p className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">Retention Period</p>
      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Retention mode" className="inline-flex gap-1 rounded-lg bg-slate-100 p-1">
          <label className="relative cursor-pointer">
            <input type="radio" name="retention-mode" checked={permanent} onChange={() => onChange(MAX_RETENTION_YEARS)} className="peer sr-only" />
            <span className={MODE_CLASS}>Permanent</span>
          </label>
          <label className="relative cursor-pointer">
            <input type="radio" name="retention-mode" checked={!permanent} onChange={() => onChange(DEFAULT_FIXED_RETENTION_YEARS)} className="peer sr-only" />
            <span className={MODE_CLASS}>Set years</span>
          </label>
        </div>
        {!permanent && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={MAX_RETENTION_YEARS - 1}
              value={years}
              onChange={(e) => onChange(Math.min(Math.max(Number(e.target.value || DEFAULT_FIXED_RETENTION_YEARS), 1), MAX_RETENTION_YEARS - 1))}
              className="h-9 w-24 rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              aria-label="Retention period in years"
            />
            <span className="text-sm text-slate-600">years</span>
          </div>
        )}
      </div>
      <div className={`mt-3 flex items-start gap-2.5 rounded-lg border p-3 text-sm ${changed ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
        <IconLock className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p>Records stored from now on are <strong>locked until {until}</strong>. Nobody, administrators included, can shorten or delete them before then.</p>
          <p className="mt-1 text-xs opacity-80">
            Objects already stored keep the period they were written with. Permanent is the longest period the storage allows ({MAX_RETENTION_YEARS} years).
          </p>
        </div>
      </div>
      {changed && <p className="mt-2 text-xs text-slate-500">You are asked to confirm this change when you press Save.</p>}
    </div>
  );
};
