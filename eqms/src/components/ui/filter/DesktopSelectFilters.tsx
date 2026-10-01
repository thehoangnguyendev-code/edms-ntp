import React from 'react';
import { DesktopFilterPanel } from './DesktopFilterPanel';
import type { SelectOption } from '@/components/ui/select/Select';
import { FilterOptionList } from './FilterOptionList';
import { DateRangePicker } from '@/components/ui/datetime-picker/DateRangePicker';

/** Adapter for state-owned select filters. URL-owned callers must supply an atomic commit instead. */
export function DesktopSelectFilters({ search, filters, dates = [], onApplied }: {
  search: React.ReactNode;
  filters: Array<{
    id: string; label: string; value: string; defaultValue: string; options: SelectOption[];
    disabled?: boolean; onChange: (value: string) => void;
    onSearch?: (query: string) => Promise<SelectOption[]>;
  }>;
  dates?: Array<{ id: string; label: string; from: string; to: string; onFromChange: (value: string) => void; onToChange: (value: string) => void }>;
  onApplied: () => void;
}) {
  const values = Object.fromEntries(filters.map(f => [f.id, f.value]));
  const defaults = Object.fromEntries(filters.map(f => [f.id, f.disabled ? f.value : f.defaultValue]));
  for (const d of dates) {
    values[`${d.id}From`] = d.from; values[`${d.id}To`] = d.to;
    defaults[`${d.id}From`] = ''; defaults[`${d.id}To`] = '';
  }
  return <DesktopFilterPanel search={search} values={values} defaults={defaults}
    fields={[...filters.map(f => ({ id: f.id, label: f.label, render: (draft: Record<string, string>, change: (key: string, value: string) => void, active: boolean) =>
      <FilterOptionList label={f.label} value={draft[f.id]} disabled={f.disabled} active={active}
        options={f.options.some(option => String(option.value) === f.defaultValue)
          ? f.options : [{ label: 'All', value: f.defaultValue }, ...f.options]}
        onSearch={f.onSearch} onChange={value => { if (!f.disabled) change(f.id, String(value)); }} /> })),
      ...dates.map(d => ({ id: d.id, label: d.label, render: (draft: Record<string, string>, change: (key: string, value: string) => void, active: boolean) => active ?
        <DateRangePicker inline label={d.label} startDate={draft[`${d.id}From`]} endDate={draft[`${d.id}To`]}
          onStartDateChange={value => change(`${d.id}From`, value)} onEndDateChange={value => change(`${d.id}To`, value)} /> : null }))]}
    onApply={draft => {
      let changed = false;
      for (const f of filters) if (!f.disabled && draft[f.id] !== f.value) { changed = true; f.onChange(draft[f.id]); }
      for (const d of dates) {
        if (draft[`${d.id}From`] !== d.from) { changed = true; d.onFromChange(draft[`${d.id}From`]); }
        if (draft[`${d.id}To`] !== d.to) { changed = true; d.onToChange(draft[`${d.id}To`]); }
      }
      if (changed) onApplied();
    }} />;
}
