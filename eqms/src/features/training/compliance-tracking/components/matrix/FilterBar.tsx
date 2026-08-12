import React from "react";
import { Search, ToggleLeft, ToggleRight, X } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { cn } from "@/components/ui/utils";
import type { MatrixFilters, CellStatus } from "../../types";
import {
  DEPARTMENT_OPTIONS,
  JOB_TITLE_OPTIONS,
  STATUS_OPTIONS,
} from "../../mockData";

interface FilterBarProps {
  filters: MatrixFilters;
  onChange: (filters: MatrixFilters) => void;
}

export const FilterBar: React.FC<FilterBarProps> = React.memo(({
  filters,
  onChange,
}) => {
  const set = (patch: Partial<MatrixFilters>) =>
    onChange({ ...filters, ...patch });

  const hasActiveFilters =
    filters.searchQuery !== "" ||
    filters.department !== "All" ||
    filters.position !== "All" ||
    filters.status !== "All";

  const clearAll = () =>
    onChange({
      ...filters,
      searchQuery: "",
      department: "All",
      position: "All",
      status: "All",
    });

  return (
    <div className="p-4 md:p-5 space-y-4 bg-slate-50/30 border-b border-slate-100">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
        <div className="w-full">
          <label className="text-xs sm:text-sm font-medium text-slate-700 block transition-colors px-0.5 mb-1.5">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 transition-colors" />
            <input
              type="text"
              placeholder="Search employee, department, job title..."
              value={filters.searchQuery}
              onChange={(e) => set({ searchQuery: e.target.value })}
              className="w-full h-9 pl-10 pr-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm placeholder:text-slate-400 transition-all"
            />
          </div>
        </div>

        <Select
          label="Department"
          value={filters.department}
          onChange={(val) => set({ department: val })}
          options={DEPARTMENT_OPTIONS}
        />
        <Select
          label="Position"
          value={filters.position}
          onChange={(val) => set({ position: val })}
          options={JOB_TITLE_OPTIONS}
        />
        
        <div className="space-y-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700 block transition-colors px-0.5">
            Status
          </label>
          <div className="flex items-center gap-2">
            <Select
              value={filters.status}
              onChange={(val) => set({ status: val as CellStatus | "All" })}
              options={STATUS_OPTIONS}
              className="flex-1"
            />
          </div>
        </div>

        <div className="flex items-end gap-2 flex-wrap">
          <button
            onClick={() => set({ gapAnalysis: !filters.gapAnalysis })}
            className={cn(
              "inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-sm font-medium transition-all shadow-sm",
              filters.gapAnalysis
                ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            )}
            title="Gap Analysis"
          >
            {filters.gapAnalysis ? (
              <ToggleRight className="h-4 w-4 text-red-500" />
            ) : (
              <ToggleLeft className="h-4 w-4 text-slate-400" />
            )}
            <span>Gap Analysis</span>
          </button>
          
          <Button variant="outline" size="sm" onClick={clearAll} className="h-9 px-4 gap-2 font-medium transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap">
            Clear Filters
          </Button>
        </div>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          {filters.department !== "All" && (
            <FilterChip
              label={`Dept: ${filters.department}`}
              onRemove={() => set({ department: "All" })}
            />
          )}
          {filters.position !== "All" && (
            <FilterChip
              label={`Job: ${filters.position}`}
              onRemove={() => set({ position: "All" })}
            />
          )}
          {filters.status !== "All" && (
            <FilterChip
              label={`Status: ${filters.status}`}
              onRemove={() => set({ status: "All" })}
            />
          )}
        </div>
      )}
    </div>
  );
});

// ─── Internal helper ──────────────────────────────────────────────────────────
const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({
  label,
  onRemove,
}) => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-50 text-slate-700 border-slate-200">
    {label}
    <button
      onClick={onRemove}
      className="hover:text-red-500 transition-colors"
      aria-label="Remove filter"
    >
      <X className="h-3 w-3" />
    </button>
  </span>
);
