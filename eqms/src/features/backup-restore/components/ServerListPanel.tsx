import React, { useState } from "react";
import { Search, X } from "lucide-react";
import { IconFilter2 } from "@tabler/icons-react";
import { Button } from "@/components/ui/button/Button";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { DataTable, useCustomColumnLayout, type DataTableAction, type DataTableColumn, type DataTableSelection } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { FilterOptionButton } from "@/components/ui/filter/FilterOptionButton";
import { ConfiguredDesktopFilters } from "@/components/ui/filter/ConfiguredDesktopFilters";
import { FilterSearchInput } from "@/components/ui/filter/FilterSearchInput";

export interface ListFilter {
  id: string;
  label: string;
  value: string;
  options: SelectOption[];
  defaultValue: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

export interface ListDateFilter {
  id: string;
  label: string;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  /** Also pick the time of day ("dd/MM/yyyy HH:mm:ss"); without it the range is whole days. */
  includeTime?: boolean;
}

interface Props<T> {
  /** Key of the user's saved column layout, for example `backup-restore.history`. */
  tableKey: string;
  columns: DataTableColumn<T>[];
  action?: DataTableAction<T>;
  rows: readonly T[];
  getRowKey: (row: T, index: number) => React.Key;
  loading: boolean;
  /** True once the first answer has arrived; later loads dim the table instead of replacing it. */
  hasLoaded: boolean;
  error: string;
  emptyTitle: string;
  emptyDescription: string;
  search: string;
  onSearch: (value: string) => void;
  searchLabel: string;
  searchPlaceholder: string;
  filters: ListFilter[];
  dates?: ListDateFilter[];
  onClear: () => void;
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  /** Row selection column (for example a checkbox), passed to the table as is. */
  selection?: DataTableSelection<T>;
  onRowClick?: (row: T, index: number) => void;
  rowClassName?: string | ((row: T, index: number) => string);
}

/**
 * The list every Backup & Restore table is built from: search, select filters, date ranges, the filter drawer on small screens,
 * per-user column layout (Custom Column) and a page-size selector. It lays out exactly like the other server-side lists
 * (for example System Announcements); the screen owns the data and the state, this owns the arrangement.
 */
export function ServerListPanel<T>({
  tableKey, columns, action, rows, getRowKey, loading, hasLoaded, error, emptyTitle, emptyDescription,
  search, onSearch, searchLabel, searchPlaceholder, filters, dates = [], onClear,
  page, totalPages, totalItems, pageSize, onPageChange, onPageSizeChange, pageSizeOptions = [10, 20, 50],
  selection, onRowClick, rowClassName,
}: Props<T>) {
  const { layout, control } = useCustomColumnLayout(tableKey, columns, action);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set([filters[0]?.id ?? ""]));
  const tableLoading = loading && hasLoaded;

  const toggle = (id: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const searchInput = <FilterSearchInput aria-label={searchLabel} placeholder={searchPlaceholder} value={search} onChange={onSearch} />;

  return (
    <div className="flex w-full min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-1 flex-col p-4 md:p-5">
        <div className="flex w-full flex-col">
          <div className="mb-4 flex w-full flex-col gap-1.5 md:hidden">
            <label className="block text-xs font-medium text-slate-700 sm:text-sm">Search</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(event) => onSearch(event.target.value)}
                  className="block h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-9 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                {search && (
                  <button onClick={() => onSearch("")} className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400" aria-label="Clear search">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button variant="outline" onClick={() => setDrawerOpen(true)} className="h-10 gap-2 whitespace-nowrap">
                <IconFilter2 className="h-4 w-4" />
                Filters
              </Button>
            </div>
          </div>

          <ConfiguredDesktopFilters
            search={searchInput}
            trailing={control}
            filters={filters.map((f) => ({ id: f.id, label: f.label, value: f.value, options: f.options, defaultValue: f.defaultValue, onChange: f.onChange }))}
            dates={dates}
          >
            <div className="hidden items-end gap-4 pb-4 md:grid md:grid-cols-2 md:pb-5 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => onSearch(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
              {filters.map((f) => (
                <Select key={f.id} label={f.label} value={f.value} onChange={(value) => f.onChange(String(value))} options={f.options} placeholder={f.placeholder ?? f.label} />
              ))}
              {dates.map((d) => (
                <DateRangePicker
                  key={d.id}
                  label={d.label}
                  startDate={d.from}
                  endDate={d.to}
                  onStartDateChange={d.onFromChange}
                  onEndDateChange={d.onToChange}
                  includeTime={d.includeTime}
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
                {control}
              </div>
            </div>
          </ConfiguredDesktopFilters>

          <FilterDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} onClear={onClear} onApply={() => setDrawerOpen(false)}>
            {filters.map((f) => (
              <FilterAccordionItem key={f.id} label={f.label} isExpanded={expanded.has(f.id)} onToggle={() => toggle(f.id)}>
                <div className="flex flex-wrap gap-2 pb-3">
                  {f.options.map((option) => (
                    <FilterOptionButton key={String(option.value)} label={option.label} isSelected={f.value === String(option.value)} onClick={() => f.onChange(String(option.value))} />
                  ))}
                </div>
              </FilterAccordionItem>
            ))}
            {dates.map((d) => (
              <FilterAccordionItem key={d.id} label={d.label} isExpanded={expanded.has(d.id)} onToggle={() => toggle(d.id)}>
                <div className="pb-4 pt-2">
                  <DateRangePicker
                    label={d.label}
                    startDate={d.from}
                    endDate={d.to}
                    onStartDateChange={d.onFromChange}
                    onEndDateChange={d.onToChange}
                    includeTime={d.includeTime}
                    placeholder="Select date range"
                  />
                </div>
              </FilterAccordionItem>
            ))}
          </FilterDrawer>
        </div>

        <div className="relative flex flex-1 flex-col">
          {tableLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/40 backdrop-blur-[4px] transition-all duration-300">
              <SectionLoading text="Searching..." minHeight="150px" />
            </div>
          )}
          <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-300">
            <DataTable
              rows={rows}
              getRowKey={getRowKey}
              columns={layout.columns}
              columnLayout={layout}
              action={action}
              selection={selection}
              onRowClick={onRowClick}
              rowClassName={rowClassName}
              isLoading={loading}
              emptyState={<TableEmptyState title={error ? `Unable to load: ${emptyTitle.toLowerCase()}` : emptyTitle} description={error || emptyDescription} />}
              pagination={
                totalItems > 0 ? (
                  <div className="border-t border-slate-200">
                    <TablePagination
                      currentPage={page}
                      totalPages={totalPages}
                      totalItems={totalItems}
                      itemsPerPage={pageSize}
                      isLoading={tableLoading}
                      onPageChange={onPageChange}
                      onItemsPerPageChange={onPageSizeChange}
                      itemsPerPageOptions={pageSizeOptions}
                    />
                  </div>
                ) : undefined
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
