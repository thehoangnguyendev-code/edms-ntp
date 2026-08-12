import React from "react";
import { Search, X, Check } from "lucide-react";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { Button } from "@/components/ui/button/Button";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { cn } from "@/components/ui/utils";
import type { DocumentType, DocumentStatus } from "@/features/documents/types";
import { IconFilter2 } from "@tabler/icons-react";

interface DocumentFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: DocumentStatus | "All";
  onStatusChange: (value: DocumentStatus | "All") => void;
  typeFilter: DocumentType | "All";
  onTypeChange: (value: DocumentType | "All") => void;
  departmentFilter: string;
  onDepartmentChange: (value: string) => void;
  authorFilter: string;
  onAuthorChange: (value: string) => void;
  createdFromDate: string;
  onCreatedFromDateChange: (value: string) => void;
  createdToDate: string;
  onCreatedToDateChange: (value: string) => void;
  effectiveFromDate: string;
  onEffectiveFromDateChange: (value: string) => void;
  effectiveToDate: string;
  onEffectiveToDateChange: (value: string) => void;
  validFromDate: string;
  onValidFromDateChange: (value: string) => void;
  validToDate: string;
  onValidToDateChange: (value: string) => void;
  businessUnitFilter?: string;
  onBusinessUnitChange?: (value: string) => void;
  relatedDocumentFilter?: string;
  onRelatedDocumentFilterChange?: (value: string) => void;
  correlatedDocumentFilter?: string;
  onCorrelatedDocumentFilterChange?: (value: string) => void;
  templateFilter?: string;
  onTemplateFilterChange?: (value: string) => void;
  onClearFilters?: () => void;
  showTypeFilter?: boolean;
  showBusinessUnitFilter?: boolean;
  showDepartmentFilter?: boolean;
  showRelatedDocumentFilter?: boolean;
  showCorrelatedDocumentFilter?: boolean;
  showTemplateFilter?: boolean;
  disableStatusFilter?: boolean;
  authorFilterDisabled?: boolean;
  allowedStatuses?: DocumentStatus[];
  statusOptions?: SelectOption[];
  typeOptions?: SelectOption[];
  businessUnitOptions?: SelectOption[];
  departmentOptions?: SelectOption[];
  authorOptions?: SelectOption[];
  /** Debounced server-side search for the Author filter, falling back to client-side filtering of authorOptions when not provided. */
  onAuthorSearch?: (query: string) => Promise<SelectOption[]>;
  hideSearch?: boolean;
  showCard?: boolean;
}

const ALL_OPTION: SelectOption = { label: "All", value: "All" };

export const DocumentFilters: React.FC<DocumentFiltersProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  typeFilter,
  onTypeChange,
  departmentFilter,
  onDepartmentChange,
  authorFilter,
  onAuthorChange,
  createdFromDate,
  onCreatedFromDateChange,
  createdToDate,
  onCreatedToDateChange,
  effectiveFromDate,
  onEffectiveFromDateChange,
  effectiveToDate,
  onEffectiveToDateChange,
  validFromDate,
  onValidFromDateChange,
  validToDate,
  onValidToDateChange,
  businessUnitFilter = "All",
  onBusinessUnitChange = () => {},
  relatedDocumentFilter = "All",
  onRelatedDocumentFilterChange = () => {},
  correlatedDocumentFilter = "All",
  onCorrelatedDocumentFilterChange = () => {},
  templateFilter = "All",
  onTemplateFilterChange = () => {},
  onClearFilters = () => {},
  showTypeFilter = true,
  showBusinessUnitFilter = true,
  showDepartmentFilter = true,
  showRelatedDocumentFilter = true,
  showCorrelatedDocumentFilter = true,
  showTemplateFilter = true,
  disableStatusFilter = false,
  authorFilterDisabled = false,
  allowedStatuses,
  statusOptions,
  typeOptions,
  businessUnitOptions,
  departmentOptions,
  authorOptions,
  onAuthorSearch,
  hideSearch = false,
  showCard = true,
}) => {
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = React.useState(false);
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set(["status", "type"])
  );

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getOptionClassName = (isActive: boolean) =>
    cn(
      "flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all",
      isActive
        ? "bg-white border-emerald-500 text-emerald-700 font-semibold shadow-sm shadow-emerald-100/50"
        : "bg-white border-slate-200 text-slate-500 font-medium hover:border-slate-200"
    );

  const resolvedStatusOptions = React.useMemo<SelectOption[]>(() => {
    if (statusOptions?.length) return statusOptions;
    if (allowedStatuses?.length) {
      return [ALL_OPTION, ...allowedStatuses.map((status) => ({ label: status, value: status }))];
    }
    return [ALL_OPTION];
  }, [allowedStatuses, statusOptions]);

  const resolvedTypeOptions = typeOptions ?? [ALL_OPTION];
  const resolvedBusinessUnitOptions = businessUnitOptions ?? [ALL_OPTION];
  const resolvedDepartmentOptions = departmentOptions ?? [ALL_OPTION];
  const resolvedAuthorOptions = authorOptions ?? [ALL_OPTION];

  const binaryOptions = [
    { label: "All", value: "All" },
    { label: "Yes", value: "yes" },
    { label: "No", value: "no" },
  ];

  const filterContent = (
    <div className="flex flex-col w-full">
      {!hideSearch && (
        <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
          <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="block w-full pl-10 pr-9 h-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              onClick={() => setIsFilterDrawerOpen(true)}
              className="whitespace-nowrap gap-2"
            >
              <IconFilter2 className="h-4 w-4" />
              Filters
            </Button>
          </div>
        </div>
      )}

      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-end pb-4 md:pb-5">
        {!hideSearch && (
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
                placeholder="Search by document name, ID, author, department..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="block w-full pl-10 pr-3 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
              />
            </div>
          </div>
        )}

        <div className="w-full">
          <Select
            label="Status"
            value={statusFilter}
            onChange={(value) => !disableStatusFilter && onStatusChange(value as DocumentStatus | "All")}
            options={resolvedStatusOptions}
            placeholder="Select status"
            searchPlaceholder="Search status..."
            disabled={disableStatusFilter}
          />
        </div>

        {showTypeFilter && (
          <div className="w-full">
            <Select
              label="Document Type"
              value={typeFilter}
              onChange={(value) => onTypeChange(value as DocumentType | "All")}
              options={resolvedTypeOptions}
              placeholder="Select type"
              searchPlaceholder="Search type..."
            />
          </div>
        )}

        {showBusinessUnitFilter && (
          <div className="w-full">
            <Select
              label="Business Unit"
              value={businessUnitFilter}
              onChange={(value) => onBusinessUnitChange(value as string)}
              options={resolvedBusinessUnitOptions}
              placeholder="Select business unit"
              searchPlaceholder="Search business unit..."
            />
          </div>
        )}

        {showDepartmentFilter && (
          <div className="w-full">
            <Select
              label="Department"
              value={departmentFilter}
              onChange={(value) => onDepartmentChange(value as string)}
              options={resolvedDepartmentOptions}
              placeholder="Select department"
              searchPlaceholder="Search department..."
            />
          </div>
        )}

        <div className="w-full">
          <Select
            label="Author"
            value={authorFilter}
            onChange={(value) => !authorFilterDisabled && onAuthorChange(value as string)}
            options={resolvedAuthorOptions}
            onSearch={onAuthorSearch}
            placeholder="Select author"
            searchPlaceholder="Search author..."
            disabled={authorFilterDisabled}
          />
        </div>

        {showRelatedDocumentFilter && (
          <div className="w-full">
            <Select
              label="Related Document"
              value={relatedDocumentFilter}
              onChange={(value) => onRelatedDocumentFilterChange(value as string)}
              options={binaryOptions}
              placeholder="Select option"
            />
          </div>
        )}

        {showCorrelatedDocumentFilter && (
          <div className="w-full">
            <Select
              label="Correlated Document"
              value={correlatedDocumentFilter}
              onChange={(value) => onCorrelatedDocumentFilterChange(value as string)}
              options={binaryOptions}
              placeholder="Select option"
            />
          </div>
        )}

        {showTemplateFilter && (
          <div className="w-full">
            <Select
              label="Is Template"
              value={templateFilter}
              onChange={(value) => onTemplateFilterChange(value as string)}
              options={binaryOptions}
              placeholder="Select option"
            />
          </div>
        )}

        <div className="w-full">
          <DateRangePicker
            label="Created Date Range"
            startDate={createdFromDate}
            endDate={createdToDate}
            onStartDateChange={onCreatedFromDateChange}
            onEndDateChange={onCreatedToDateChange}
            placeholder="Select date range"
          />
        </div>

        <div className="w-full">
          <DateRangePicker
            label="Effective Date Range"
            startDate={effectiveFromDate}
            endDate={effectiveToDate}
            onStartDateChange={onEffectiveFromDateChange}
            onEndDateChange={onEffectiveToDateChange}
            placeholder="Select date range"
          />
        </div>

        <div className="w-full">
          <DateRangePicker
            label="Valid Date Range"
            startDate={validFromDate}
            endDate={validToDate}
            onStartDateChange={onValidFromDateChange}
            onEndDateChange={onValidToDateChange}
            placeholder="Select date range"
          />
        </div>

        <div className="flex items-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="h-9 px-4 gap-2 font-medium transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap"
          >
            Clear Filters
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {hideSearch || !showCard ? (
        filterContent
      ) : (
        <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm w-full">
          {filterContent}
        </div>
      )}

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={onClearFilters}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
        <FilterAccordionItem
          label="Status"
          isExpanded={expandedSections.has("status")}
          onToggle={() => toggleSection("status")}
          disabled={disableStatusFilter}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {resolvedStatusOptions.map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => onStatusChange(opt.value as DocumentStatus | "All")}
                className={getOptionClassName(statusFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {statusFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        {showTypeFilter && (
          <FilterAccordionItem
            label="Document Type"
            isExpanded={expandedSections.has("type")}
            onToggle={() => toggleSection("type")}
          >
            <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
              {resolvedTypeOptions.map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => onTypeChange(opt.value as DocumentType | "All")}
                  className={getOptionClassName(typeFilter === opt.value)}
                >
                  <span className="text-xs">{opt.label}</span>
                  {typeFilter === opt.value && <Check size={16} className="text-emerald-500" />}
                </button>
              ))}
            </div>
          </FilterAccordionItem>
        )}

        {showBusinessUnitFilter && (
          <FilterAccordionItem
            label="Business Unit"
            isExpanded={expandedSections.has("bu")}
            onToggle={() => toggleSection("bu")}
          >
            <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
              {resolvedBusinessUnitOptions.map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => onBusinessUnitChange(opt.value as string)}
                  className={getOptionClassName(businessUnitFilter === opt.value)}
                >
                  <span className="text-xs">{opt.label}</span>
                  {businessUnitFilter === opt.value && <Check size={16} className="text-emerald-500" />}
                </button>
              ))}
            </div>
          </FilterAccordionItem>
        )}

        {showDepartmentFilter && (
          <FilterAccordionItem
            label="Department"
            isExpanded={expandedSections.has("dept")}
            onToggle={() => toggleSection("dept")}
          >
            <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
              {resolvedDepartmentOptions.map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => onDepartmentChange(opt.value as string)}
                  className={getOptionClassName(departmentFilter === opt.value)}
                >
                  <span className="text-xs">{opt.label}</span>
                  {departmentFilter === opt.value && <Check size={16} className="text-emerald-500" />}
                </button>
              ))}
            </div>
          </FilterAccordionItem>
        )}

        <FilterAccordionItem
          label="Author"
          isExpanded={expandedSections.has("author")}
          onToggle={() => toggleSection("author")}
          disabled={authorFilterDisabled}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {resolvedAuthorOptions.map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => !authorFilterDisabled && onAuthorChange(opt.value as string)}
                className={getOptionClassName(authorFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {authorFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        {showRelatedDocumentFilter && (
          <FilterAccordionItem
            label="Related Document"
            isExpanded={expandedSections.has("related")}
            onToggle={() => toggleSection("related")}
          >
            <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
              {binaryOptions.map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => onRelatedDocumentFilterChange(opt.value)}
                  className={getOptionClassName(relatedDocumentFilter === opt.value)}
                >
                  <span className="text-xs">{opt.label}</span>
                  {relatedDocumentFilter === opt.value && <Check size={16} className="text-emerald-500" />}
                </button>
              ))}
            </div>
          </FilterAccordionItem>
        )}

        {showCorrelatedDocumentFilter && (
          <FilterAccordionItem
            label="Correlated Document"
            isExpanded={expandedSections.has("correlated")}
            onToggle={() => toggleSection("correlated")}
          >
            <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
              {binaryOptions.map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => onCorrelatedDocumentFilterChange(opt.value)}
                  className={getOptionClassName(correlatedDocumentFilter === opt.value)}
                >
                  <span className="text-xs">{opt.label}</span>
                  {correlatedDocumentFilter === opt.value && <Check size={16} className="text-emerald-500" />}
                </button>
              ))}
            </div>
          </FilterAccordionItem>
        )}

        {showTemplateFilter && (
          <FilterAccordionItem
            label="Is Template"
            isExpanded={expandedSections.has("template")}
            onToggle={() => toggleSection("template")}
          >
            <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
              {binaryOptions.map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => onTemplateFilterChange(opt.value)}
                  className={getOptionClassName(templateFilter === opt.value)}
                >
                  <span className="text-xs">{opt.label}</span>
                  {templateFilter === opt.value && <Check size={16} className="text-emerald-500" />}
                </button>
              ))}
            </div>
          </FilterAccordionItem>
        )}

        <FilterAccordionItem
          label="Created Date Range"
          isExpanded={expandedSections.has("createdDate")}
          onToggle={() => toggleSection("createdDate")}
        >
          <div className="pt-2 pb-4">
            <DateRangePicker
              label="Created Date Range"
              startDate={createdFromDate}
              endDate={createdToDate}
              onStartDateChange={onCreatedFromDateChange}
              onEndDateChange={onCreatedToDateChange}
              placeholder="Select date range"
            />
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Effective Date Range"
          isExpanded={expandedSections.has("effectiveDate")}
          onToggle={() => toggleSection("effectiveDate")}
        >
          <div className="pt-2 pb-4">
            <DateRangePicker
              label="Effective Date Range"
              startDate={effectiveFromDate}
              endDate={effectiveToDate}
              onStartDateChange={onEffectiveFromDateChange}
              onEndDateChange={onEffectiveToDateChange}
              placeholder="Select date range"
            />
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Valid Date Range"
          isExpanded={expandedSections.has("validDate")}
          onToggle={() => toggleSection("validDate")}
        >
          <div className="pt-2 pb-4">
            <DateRangePicker
              label="Valid Date Range"
              startDate={validFromDate}
              endDate={validToDate}
              onStartDateChange={onValidFromDateChange}
              onEndDateChange={onValidToDateChange}
              placeholder="Select date range"
            />
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </>
  );
};
