import React, { useState } from "react";
import { Search, X, Check } from "lucide-react";
import { IconFilter2 } from "@tabler/icons-react";
import { Select } from "@/components/ui/select/Select";
import { Button } from "@/components/ui/button/Button";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { cn } from "@/components/ui/utils";
import type { PermissionRiskLevel } from "../../access-profiles/types";

export type RiskFilter = "ALL" | PermissionRiskLevel;
export type AssignedFilter = "ALL" | "ASSIGNED" | "UNASSIGNED";
export type AuditFilter = "ALL" | "AUDIT" | "NO_AUDIT";
export type ESignFilter = "ALL" | "ESIGN" | "NO_ESIGN";

export interface PermissionToolbarFilters {
  search: string;
  module: string;
  resource: string;
  risk: RiskFilter;
  audit: AuditFilter;
  esign: ESignFilter;
  assigned: AssignedFilter;
}

export const DEFAULT_FILTERS: PermissionToolbarFilters = {
  search: "",
  module: "",
  resource: "",
  risk: "ALL",
  audit: "ALL",
  esign: "ALL",
  assigned: "ALL",
};

interface PermissionToolbarProps {
  filters: PermissionToolbarFilters;
  onChange: (filters: PermissionToolbarFilters) => void;
  modules: string[];
  resources: string[];
  totalCount: number;
  filteredCount: number;
}

const RISK_OPTIONS: { value: RiskFilter; label: string }[] = [
  { value: "ALL", label: "All Risk" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const AUDIT_OPTIONS: { value: AuditFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "AUDIT", label: "GMP Audit" },
  { value: "NO_AUDIT", label: "No Audit" },
];

const ESIGN_OPTIONS: { value: ESignFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ESIGN", label: "E-Sign Required" },
  { value: "NO_ESIGN", label: "No E-Sign" },
];

const ASSIGNED_OPTIONS: { value: AssignedFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "UNASSIGNED", label: "Unassigned" },
];

const getOptionClassName = (isActive: boolean) =>
  cn(
    "flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all",
    isActive
      ? "bg-white border-emerald-500 text-emerald-700 font-semibold shadow-sm shadow-emerald-100/50"
      : "bg-white border-slate-200 text-slate-500 font-medium hover:border-slate-200"
  );

export const PermissionToolbar: React.FC<PermissionToolbarProps> = ({
  filters,
  onChange,
  modules,
  resources,
  totalCount,
  filteredCount,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["risk", "assigned"])
  );

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const set = <K extends keyof PermissionToolbarFilters>(
    key: K,
    value: PermissionToolbarFilters[K]
  ) => onChange({ ...filters, [key]: value });

  const hasActiveFilters =
    filters.search !== "" ||
    filters.module !== "" ||
    filters.resource !== "" ||
    filters.risk !== "ALL" ||
    filters.audit !== "ALL" ||
    filters.esign !== "ALL" ||
    filters.assigned !== "ALL";

  const clearAll = () => onChange(DEFAULT_FILTERS);

  const moduleOptions = [
    { label: "All Modules", value: "" },
    ...modules.map((m) => ({ label: m, value: m })),
  ];

  const resourceOptions = [
    { label: "All Resources", value: "" },
    ...resources.map((r) => ({ label: r, value: r })),
  ];

  return (
    <div className="w-full">

      {/* ── Mobile: Search + Filter button ── */}
      <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
        <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search permissions..."
              value={filters.search}
              onChange={(e) => set("search", e.target.value)}
              className="block w-full pl-10 pr-9 h-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
            />
            {filters.search && (
              <button
                onClick={() => set("search", "")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => setIsDrawerOpen(true)}
            className="whitespace-nowrap gap-2"
          >
            <IconFilter2 className="h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>

      {/* ── Desktop: Full filter grid ── */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-end pb-4 md:pb-5">
        {/* Search */}
        <div className="w-full">
          <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
            Search
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => set("search", e.target.value)}
              placeholder="Search by name, code, resource..."
              className="block w-full pl-10 pr-9 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
            />
            {filters.search && (
              <button
                onClick={() => set("search", "")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="w-full">
          <Select
            label="Module"
            value={filters.module}
            onChange={(v) => onChange({ ...filters, module: v, resource: "" })}
            options={moduleOptions}
            placeholder="All Modules"
            searchPlaceholder="Search module..."
          />
        </div>

        <div className="w-full">
          <Select
            label="Resource"
            value={filters.resource}
            onChange={(v) => set("resource", v)}
            options={resourceOptions}
            placeholder="All Resources"
            searchPlaceholder="Search resource..."
          />
        </div>

        <div className="w-full">
          <Select
            label="Risk Level"
            value={filters.risk}
            onChange={(v) => set("risk", v as RiskFilter)}
            options={RISK_OPTIONS}
            placeholder="All Risk"
          />
        </div>

        <div className="w-full">
          <Select
            label="GMP Audit"
            value={filters.audit}
            onChange={(v) => set("audit", v as AuditFilter)}
            options={AUDIT_OPTIONS}
            placeholder="All"
          />
        </div>

        <div className="w-full">
          <Select
            label="E-Sign"
            value={filters.esign}
            onChange={(v) => set("esign", v as ESignFilter)}
            options={ESIGN_OPTIONS}
            placeholder="All"
          />
        </div>

        <div className="w-full">
          <Select
            label="Assigned"
            value={filters.assigned}
            onChange={(v) => set("assigned", v as AssignedFilter)}
            options={ASSIGNED_OPTIONS}
            placeholder="All"
          />
        </div>

        <div className="flex items-end">
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            className="h-9 px-4 gap-2 font-medium transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap"
          >
            Clear Filters
          </Button>
        </div>
      </div>

      {hasActiveFilters && (
        <p className="mt-1 mb-3 text-xs text-slate-400">
          Showing {filteredCount} of {totalCount} permissions
        </p>
      )}

      {/* ── Mobile FilterDrawer ── */}
      <FilterDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onClear={clearAll}
        onApply={() => setIsDrawerOpen(false)}
      >
        <FilterAccordionItem
          label="Module"
          isExpanded={expandedSections.has("module")}
          onToggle={() => toggleSection("module")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {moduleOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onChange({ ...filters, module: opt.value, resource: "" })}
                className={getOptionClassName(filters.module === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {filters.module === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Resource"
          isExpanded={expandedSections.has("resource")}
          onToggle={() => toggleSection("resource")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {resourceOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => set("resource", opt.value)}
                className={getOptionClassName(filters.resource === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {filters.resource === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Risk Level"
          isExpanded={expandedSections.has("risk")}
          onToggle={() => toggleSection("risk")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {RISK_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => set("risk", opt.value)}
                className={getOptionClassName(filters.risk === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {filters.risk === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="GMP Audit"
          isExpanded={expandedSections.has("audit")}
          onToggle={() => toggleSection("audit")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {AUDIT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => set("audit", opt.value as AuditFilter)}
                className={getOptionClassName(filters.audit === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {filters.audit === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="E-Sign"
          isExpanded={expandedSections.has("esign")}
          onToggle={() => toggleSection("esign")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {ESIGN_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => set("esign", opt.value as ESignFilter)}
                className={getOptionClassName(filters.esign === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {filters.esign === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Assigned"
          isExpanded={expandedSections.has("assigned")}
          onToggle={() => toggleSection("assigned")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {ASSIGNED_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => set("assigned", opt.value as AssignedFilter)}
                className={getOptionClassName(filters.assigned === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {filters.assigned === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </div>
  );
};
