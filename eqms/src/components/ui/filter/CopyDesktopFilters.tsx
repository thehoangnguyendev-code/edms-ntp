import React from 'react';
import { DesktopFilterPanel, type DesktopFilterField } from './DesktopFilterPanel';
import type { SelectOption } from '@/components/ui/select/Select';
import { FilterOptionList } from './FilterOptionList';
import { DateRangePicker } from '@/components/ui/datetime-picker/DateRangePicker';

export function CopyDesktopFilters({ search, status, statusOptions, statusLocked, allStatus, dates, onApply }: {
  search: React.ReactNode;
  status: string;
  statusOptions: SelectOption[];
  statusLocked: boolean;
  allStatus: string;
  dates: Array<{ id: string; label: string; from: string; to: string }>;
  onApply: (draft: Record<string, string>) => void;
}) {
  const values: Record<string, string> = { status };
  const defaults: Record<string, string> = { status: statusLocked ? status : allStatus };
  const fields: DesktopFilterField[] = [{ id: 'status', label: 'Status', render: (draft, change) =>
    <FilterOptionList label="Status" value={draft.status} options={statusOptions} disabled={statusLocked}
      onChange={value => { if (!statusLocked) change('status', String(value)); }} /> }];
  for (const date of dates) {
    values[`${date.id}From`] = date.from;
    values[`${date.id}To`] = date.to;
    defaults[`${date.id}From`] = '';
    defaults[`${date.id}To`] = '';
    fields.push({ id: date.id, label: date.label, render: (draft, change, active) => active ?
      <DateRangePicker inline label={date.label} startDate={draft[`${date.id}From`]} endDate={draft[`${date.id}To`]}
        onStartDateChange={value => change(`${date.id}From`, value)} onEndDateChange={value => change(`${date.id}To`, value)} /> : null });
  }
  return <DesktopFilterPanel search={search} fields={fields} values={values} defaults={defaults} onApply={onApply} />;
}
