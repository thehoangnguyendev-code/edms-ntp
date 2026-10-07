import React from "react";
import { useBranding } from "@/components/branding/BrandLogo";
import type { SelectOption } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { DesktopFilterPanel } from "./DesktopFilterPanel";
import { FilterOptionList } from "./FilterOptionList";

type Draft = Record<string, string>;
export interface ConfiguredSelectFilter {
  id: string;
  label: string;
  value: string;
  options: SelectOption[];
  defaultValue?: string;
  disabled?: boolean;
  loading?: boolean;
  getOptions?: (draft: Draft) => SelectOption[];
  isDisabled?: (draft: Draft) => boolean;
  resetOnChange?: Record<string, string>;
  dependsOn?: string[];
  onSearch?: (query: string) => Promise<SelectOption[]>;
  searchOptions?: (draft: Draft, query: string) => Promise<SelectOption[]>;
  onChange: (value: string) => void;
}
export interface ConfiguredDateFilter {
  id: string;
  label: string;
  from: string;
  to: string;
  includeTime?: boolean;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onApply?: (range: { startDate: string; endDate: string }) => void;
}

/** Explicit screen-owned state; all existing handlers run only after the panel's Apply. */
export function ConfiguredDesktopFilters({
  search,
  filters,
  dates = [],
  children,
  preserveMobile = false,
  trailing,
}: {
  search: React.ReactNode;
  filters: ConfiguredSelectFilter[];
  dates?: ConfiguredDateFilter[];
  children: React.ReactNode;
  preserveMobile?: boolean;
  /** Extra control shown beside the Filter button in compact mode. */
  trailing?: React.ReactNode;
}) {
  const { compactDesktopFilters = false } = useBranding();
  if (!compactDesktopFilters) return <>{children}</>;
  const values: Draft = {};
  const defaults: Draft = {};
  for (const filter of filters) {
    values[filter.id] = filter.value;
    defaults[filter.id] = filter.disabled
      ? filter.value
      : (filter.defaultValue ?? String(filter.options[0]?.value ?? ""));
  }
  for (const date of dates) {
    values[`${date.id}From`] = date.from;
    values[`${date.id}To`] = date.to;
    defaults[`${date.id}From`] = "";
    defaults[`${date.id}To`] = "";
  }
  return (
    <>
      {preserveMobile && <div className="md:hidden">{children}</div>}
      <DesktopFilterPanel
        trailing={trailing}
        search={search}
        values={values}
        defaults={defaults}
        fields={[
          ...filters.map((filter) => ({
            id: filter.id,
            label: filter.label,
            render: (
              draft: Draft,
              change: (key: string, value: string) => void,
              active: boolean,
            ) => (
              <FilterOptionList
                key={JSON.stringify(filter.dependsOn?.map((key) => draft[key]))}
                label={filter.label}
                value={draft[filter.id]}
                active={active}
                options={filter.getOptions?.(draft) ?? filter.options}
                disabled={
                  filter.loading ||
                  (filter.isDisabled?.(draft) ?? filter.disabled)
                }
                onSearch={
                  filter.searchOptions
                    ? (query) => filter.searchOptions!(draft, query)
                    : filter.onSearch
                }
                onChange={(value) => {
                  change(filter.id, value);
                  for (const [key, reset] of Object.entries(
                    filter.resetOnChange ?? {},
                  ))
                    change(key, reset);
                }}
              />
            ),
          })),
          ...dates.map((date) => ({
            id: date.id,
            label: date.label,
            render: (
              draft: Draft,
              change: (key: string, value: string) => void,
              active: boolean,
            ) =>
              active ? (
                <DateRangePicker
                  inline
                  includeTime={date.includeTime}
                  startDate={draft[`${date.id}From`]}
                  endDate={draft[`${date.id}To`]}
                  onStartDateChange={(value) => change(`${date.id}From`, value)}
                  onEndDateChange={(value) => change(`${date.id}To`, value)}
                />
              ) : null,
          })),
        ]}
        onApply={(draft) => {
          for (const filter of filters) {
            const dependencyChanged = filter.dependsOn?.some(
              (key) => draft[key] !== values[key],
            );
            if (
              !(filter.isDisabled?.(draft) ?? filter.disabled) &&
              (draft[filter.id] !== filter.value || dependencyChanged)
            )
              filter.onChange(draft[filter.id]);
          }
          for (const date of dates) {
            const startDate = draft[`${date.id}From`];
            const endDate = draft[`${date.id}To`];
            if (startDate === date.from && endDate === date.to) continue;
            // Preserve atomic range setters where the screen already supplies one.
            if (date.onApply) date.onApply({ startDate, endDate });
            else {
              date.onFromChange(startDate);
              date.onToChange(endDate);
            }
          }
        }}
      />
    </>
  );
}
