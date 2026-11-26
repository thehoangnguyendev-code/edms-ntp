import { tr as __ariaTr } from "@/i18n";
import { SearchInput } from "@/components/ui/form/SearchInput";
import { Select } from "@/components/ui/select/Select";
import { ClearFiltersButton } from "@/components/ui/filter/ClearFiltersButton";
import { tr } from "@/i18n";

/**
 * The filters of a list of report fields (Fields & Defaults, Included columns): a search, the group, and Clear Filters in the last cell, in the layout of every list.
 * The list of fields of a Report Type is a fixed catalogue held in the screen, so it is narrowed here and not on the server.
 */
export function ReportFieldFilters({
  search,
  onSearchChange,
  group,
  onGroupChange,
  groups,
  narrow,
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  group: string;
  onGroupChange: (value: string) => void;
  groups: string[];
  /** For a narrow card (the Included columns of Create Report): two columns, and Clear Filters on its own line. */
  narrow?: boolean;
  /** What the screen adds after the filters, in the last cell (for example the bulk buttons). */
  children?: React.ReactNode;
}) {
  return (
    <div className={narrow ? "grid grid-cols-1 gap-4 sm:grid-cols-2 items-end" : "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 items-end"}>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">{tr("Search fields")}</label>
        <SearchInput value={search} onChange={onSearchChange} placeholder={tr("Name or group...")} ariaLabel={__ariaTr("Search fields")} />
      </div>
      <Select
        label={tr("Group")}
        value={group}
        enableSearch={false}
        options={[{ value: "", label: tr("All groups") }, ...groups.map((name) => ({ value: name, label: name }))]}
        onChange={(value) => onGroupChange(String(value))}
      />
      <div className={narrow ? "filter-actions flex items-end gap-2 sm:col-span-2" : "filter-actions flex items-end gap-2"}>
        <ClearFiltersButton onClearSearch={() => onSearchChange("")} onClear={() => onGroupChange("")} disabled={!search && !group} />
        {children}
      </div>
    </div>
  );
}
