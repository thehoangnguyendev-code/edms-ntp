import React, { useState } from "react";
import { Check, Search, X } from "lucide-react";
import { IconFilter2 } from "@tabler/icons-react";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { ConfiguredDesktopFilters } from "@/components/ui/filter/ConfiguredDesktopFilters";
import { FilterAccordionItem, FilterDrawer } from "@/components/ui/filter/FilterDrawer";
import { FilterSearchInput } from "@/components/ui/filter/FilterSearchInput";

export interface ReportSelectFilter {
  id: string;
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}

export interface ReportDateFilter {
  id: string;
  label: string;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

/**
 * The card of every report list (REPORT-LIST-STANDARD-2026-10-14). It follows User Management: one card with the filter section on top and
 * the table section below. On a phone: a Search box and a Filters button that opens the drawer. On a desktop: Search and the filters in a
 * three-column grid, and in the last cell Clear Filters and the Custom Column control side by side. In the system's compact filter mode
 * the filters sit in the shared filter panel and the Custom Column control is its trailing control.
 *
 * `framed` is true for a screen of its own. Inside a section of an administration page the card already exists, so it is false.
 */
/**
 * The search box of the classic desktop grid and of the phone row, built as User Management builds it. The shared FilterSearchInput is used only
 * inside the compact filter panel: it marks its icon, and the global stylesheet then removes the bottom padding of the filter section.
 */
function PlainSearch({ value, onChange, placeholder, height }: { value: string; onChange: (value: string) => void; placeholder: string; height: "h-9" | "h-10" }) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <Search className="h-4 w-4 text-slate-400" />
      </div>
      <input
        type="text"
        aria-label="Search"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`block w-full ${height} rounded-lg border border-slate-200 bg-white pl-10 pr-10 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500`}
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange("")} className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function ReportListToolbar({
  searchPlaceholder,
  search,
  onSearch,
  filters = [],
  dates = [],
  hasActiveFilters,
  onClear,
  customControl,
  framed = true,
  flush = false,
  children,
}: {
  searchPlaceholder: string;
  search: string;
  onSearch: (value: string) => void;
  filters?: ReportSelectFilter[];
  dates?: ReportDateFilter[];
  hasActiveFilters: boolean;
  onClear: () => void;
  customControl?: React.ReactNode;
  framed?: boolean;
  /** True inside a container that already has its own padding (a tab, a section): the filters and the table then sit on its edges instead of being indented a second time. */
  flush?: boolean;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const optionClass = (active: boolean) =>
    `flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left ${
      active ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-700 hover:bg-slate-50"
    }`;

  const filterSection = (
    <div className={flush ? "compact-filter-section flex flex-col pb-4" : "compact-filter-section flex flex-col px-4 pt-4 md:p-5"}>
      <div className="-mx-1.5 -mb-1.5 px-1.5 pb-1.5">
        <div className="mb-4 flex w-full flex-col gap-1.5 md:hidden">
          <label className="block text-xs font-medium text-slate-700 sm:text-sm">Search</label>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <PlainSearch value={search} onChange={onSearch} placeholder={searchPlaceholder} height="h-10" />
            </div>
            <Button variant="outline" onClick={() => setDrawerOpen(true)} className="gap-2 whitespace-nowrap">
              <IconFilter2 className="h-4 w-4" />
              Filters
            </Button>
          </div>
        </div>
        <ConfiguredDesktopFilters
          trailing={<div className="hidden md:block">{customControl}</div>}
          search={<FilterSearchInput aria-label="Search" value={search} onChange={onSearch} placeholder={searchPlaceholder} />}
          filters={filters.map((filter) => ({
            id: filter.id,
            label: filter.label,
            value: filter.value,
            options: filter.options,
            defaultValue: "",
            onChange: filter.onChange,
          }))}
          dates={dates.map((date) => ({
            id: date.id,
            label: date.label,
            from: date.from,
            to: date.to,
            onFromChange: (value: string) => date.onChange(value, date.to),
            onToChange: (value: string) => date.onChange(date.from, value),
          }))}
        >
          <div className="hidden grid-cols-1 items-end gap-4 sm:grid-cols-2 md:grid lg:grid-cols-3">
            <div className="w-full">
              <label className="mb-1.5 block text-xs font-medium text-slate-700 transition-colors sm:text-sm">Search</label>
              <PlainSearch value={search} onChange={onSearch} placeholder={searchPlaceholder} height="h-9" />
            </div>
            {filters.map((filter) => (
              <Select key={filter.id} label={filter.label} value={filter.value} onChange={(value) => filter.onChange(String(value))} options={filter.options} />
            ))}
            {dates.map((date) => (
              <DateRangePicker
                key={date.id}
                label={date.label}
                startDate={date.from}
                endDate={date.to}
                onStartDateChange={(value) => date.onChange(value, date.to)}
                onEndDateChange={(value) => date.onChange(date.from, value)}
                placeholder="Select date range"
              />
            ))}
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onClear}
                className="h-9 gap-2 whitespace-nowrap px-4 font-medium transition-all duration-200 hover:border-red-600 hover:bg-red-600 hover:text-white"
              >
                Clear Filters
              </Button>
              {customControl}
            </div>
          </div>
        </ConfiguredDesktopFilters>
      </div>
    </div>
  );

  const tableSection = (
    <div className={flush ? "relative flex flex-1 flex-col" : "relative flex flex-1 flex-col px-4 pb-4 md:px-5 md:pb-5"}>
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">{children}</div>
    </div>
  );

  const drawer = (
    <FilterDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} onClear={onClear} onApply={() => setDrawerOpen(false)}>
      {filters.map((filter) => (
        <FilterAccordionItem key={filter.id} label={filter.label} isExpanded={expanded.has(filter.id)} onToggle={() => toggle(filter.id)}>
          <div className="grid grid-cols-1 gap-2 pb-4 pt-1">
            {filter.options.map((option) => (
              <button key={option.value || "all"} type="button" onClick={() => filter.onChange(option.value)} className={optionClass(filter.value === option.value)}>
                <span className="text-xs">{option.label}</span>
                {filter.value === option.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
      ))}
      {dates.map((date) => (
        <FilterAccordionItem key={date.id} label={date.label} isExpanded={expanded.has(date.id)} onToggle={() => toggle(date.id)}>
          <div className="pb-4 pt-2">
            <DateRangePicker
              label=""
              startDate={date.from}
              endDate={date.to}
              onStartDateChange={(value) => date.onChange(value, date.to)}
              onEndDateChange={(value) => date.onChange(date.from, value)}
              placeholder="Select date range"
            />
          </div>
        </FilterAccordionItem>
      ))}
    </FilterDrawer>
  );

  return framed ? (
    <div className="flex w-full flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {filterSection}
      {tableSection}
      {drawer}
    </div>
  ) : (
    <div className="flex w-full flex-1 flex-col">
      {filterSection}
      {tableSection}
      {drawer}
    </div>
  );
}

/** The date picker shows dd/MM/yyyy; the server takes yyyy-MM-dd. An empty value stays empty. */
export function pickerDateToIso(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}
