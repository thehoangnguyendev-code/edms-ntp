import type { ReactNode } from "react";
import { FilterSearchInput } from "@/components/ui/filter/FilterSearchInput";
import { Select } from "@/components/ui/select/Select";
import type { ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { tr } from "@/i18n";

/** Layout only. The owning tab still supplies all filter values and request handlers. */
export function ComplianceFilterFields({ departmentFilter, search, onSearch, searchPlaceholder, filters, actions }: {
  departmentFilter?: ReportSelectFilter;
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder: string;
  filters: ReportSelectFilter[];
  actions?: ReactNode;
}) {
  const field = (filter: ReportSelectFilter) => (
    <Select key={filter.id} label={filter.label} value={filter.value} options={filter.options}
      onChange={(value) => filter.onChange(String(value))} className="min-w-0" triggerClassName="h-11 md:h-9" />
  );
  return (
    <div className={departmentFilter
      ? "grid min-w-0 grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-4"
      : filters.length
        ? "grid min-w-0 grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
        : "flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end"}>
      {departmentFilter && field(departmentFilter)}
      <div className="min-w-0 flex-1 [&_input]:h-11 [&_input]:text-base [&_input]:placeholder:text-slate-500 md:[&_input]:h-9 md:[&_input]:text-sm">
        <FilterSearchInput aria-label={tr("Search")} value={search} onChange={onSearch} placeholder={searchPlaceholder} debounceMs={0} />
      </div>
      {filters.map(field)}
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
