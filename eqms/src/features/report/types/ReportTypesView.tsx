import { ClearFiltersButton } from "@/components/ui/filter/ClearFiltersButton";
import { ConfiguredDesktopFilters } from "@/components/ui/filter/ConfiguredDesktopFilters";
import React, { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { AlertTriangle, Check, ChevronRight, MoreVertical, Power, PowerOff, Search, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { Badge } from "@/components/ui/badge/Badge";
import { FilterAccordionItem, FilterDrawer } from "@/components/ui/filter/FilterDrawer";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { DataTable, useCustomColumnLayout, type DataTableAction, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { EXPAND_CONTENT_MOTION, useExpandTransition } from "@/components/ui/table/expandMotion";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";
import { cn } from "@/components/ui/utils";
import { IconFilter2, IconInfoCircle } from "@tabler/icons-react";
import { usePortalDropdown } from "@/hooks";
import { useToast } from "@/components/ui/toast";
import { useDictionaryServerTable, type DictionaryServerQuery } from "@/features/settings/dictionaries/hooks/useDictionaryServerTable";
import { usePermissions } from "@/hooks/usePermissions";
import { reportError } from "@/services/api/reportTemplates";
import { reportTypesApi, type ReportTypeDetail, type ReportTypeListItem } from "@/services/api/reportTypes";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { ReportTypeColumnsPanel } from "./ReportTypeColumnsPanel";
import { displayDateTime } from "@/utils/format";

type StatusFilter = "All" | "Enabled" | "Disabled";
const SERVER_STATUS: Record<StatusFilter, "ALL" | "ENABLED" | "DISABLED"> = { All: "ALL", Enabled: "ENABLED", Disabled: "DISABLED" };
const typePath = (code: string) => `/settings/report-types/${encodeURIComponent(code)}`;
const when = (value?: string) => (value ? displayDateTime(value) : "-");

/** The row that opens under a Report Type: its columns and filters, loaded from the server when it is opened. */
const ExpandedReportTypeRow: React.FC<{ type: ReportTypeListItem; visibleColumnsLength: number }> = ({ type, visibleColumnsLength }) => {
  const transitionConfig = useExpandTransition();
  const [detail, setDetail] = useState<ReportTypeDetail | null>(null);
  const [error, setError] = useState("");
  React.useEffect(() => {
    let alive = true;
    reportTypesApi
      .detail(type.code)
      .then((value) => alive && setDetail(value))
      .catch((e) => alive && setError(reportError(e)));
    return () => {
      alive = false;
    };
  }, [type.code, type.version]);
  return (
    <motion.tr key={`expanded-report-type-${type.code}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transitionConfig} className="bg-slate-50/50">
      <TableMarkup.Cell colSpan={visibleColumnsLength - 1} className="p-0 border-b border-slate-200">
        <motion.div {...EXPAND_CONTENT_MOTION} transition={transitionConfig} className="overflow-hidden">
          <div className="p-4 md:p-5">
            <div className="ml-9">
              {error ? <p role="alert" className="text-xs text-red-600">{error}</p> : detail ? <ReportTypeColumnsPanel detail={detail} /> : <p className="text-xs text-slate-500">Loading columns…</p>}
            </div>
          </div>
        </motion.div>
      </TableMarkup.Cell>
    </motion.tr>
  );
};

/**
 * Report Types (REPORT-PLATFORM-2026-10-15): the sources of report data. Laid out like Report Name Formats: filters above, the table in its own card, a row
 * that expands to show the columns, a three-dot menu and the same pagination. The server searches, filters, sorts and pages.
 */
export const ReportTypesView: React.FC = () => {
  const navigate = useNavigate();
  const { openId: openDropdownId, position: dropdownPosition, getRef: getButtonRef, toggle: handleDropdownToggle, close: closeDropdown } = usePortalDropdown();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["reports.types.manage"]);
  const { showToast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ReportTypeListItem | null>(null);
  const [toggleReason, setToggleReason] = useState("");
  const [toggleError, setToggleError] = useState("");
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["status", "category"]));
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  // A stable function: the table loads again when the fetcher changes.
  const fetcher = useCallback(async (params: DictionaryServerQuery) => {
    const page = await reportTypesApi.list({
      status: params.status as "ALL" | "ENABLED" | "DISABLED",
      category: params.category as string | undefined,
      search: params.search as string | undefined,
      sortBy: params.sortBy as string,
      sortDirection: params.sortDirection as "asc" | "desc",
      page: params.page as number,
      limit: params.limit as number,
    });
    setCategories(page.categories);
    return page;
  }, []);
  const extraParams = useMemo(() => ({ status: SERVER_STATUS[statusFilter], category: categoryFilter || undefined }), [statusFilter, categoryFilter]);
  const { searchQuery, setSearchQuery, currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, totalPages, totalItems, items, isLoading, sortConfig, handleSort, reload } =
    useDictionaryServerTable<ReportTypeListItem>({ fetcher, defaultSortBy: "name", extraParams });

  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, categoryFilter, setCurrentPage]);

  const closeToggle = () => {
    setShowToggleModal(false);
    setSelectedItem(null);
    setToggleReason("");
    setToggleError("");
  };
  const handleConfirmToggle = async () => {
    const item = selectedItem;
    if (!item) return;
    if (!toggleReason.trim()) {
      setToggleError("A reason is required. It is recorded with your name and the time.");
      return;
    }
    setIsSubmitting(true);
    try {
      await reportTypesApi.setEnabled(item.code, item.version, !item.enabled, toggleReason.trim());
      closeToggle();
      reload();
      showToast({ type: "success", title: item.enabled ? "Report Type Disabled" : "Report Type Enabled", message: `"${item.name}" was ${item.enabled ? "disabled" : "enabled"} successfully.` });
    } catch (error) {
      setToggleError(reportError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setCategoryFilter("");
    setCurrentPage(1);
  };
  const hasActiveFilters = searchQuery.length > 0 || statusFilter !== "All" || categoryFilter.length > 0;
  const toggleSection = (section: string) =>
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  const getOptionClassName = (isActive: boolean) =>
    cn(
      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all",
      isActive ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
    );

  const sortOf = (key: string) => ({ direction: sortConfig.key === key ? sortConfig.direction : undefined, onSort: () => handleSort(key) });
  const columns: DataTableColumn<ReportTypeListItem>[] = [
    {
      id: "expand",
      header: "",
      label: "Expand",
      locked: true,
      cell: (item) => (
        <div onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            aria-label="Expand"
            onClick={() => setExpandedCode((prev) => (prev === item.code ? null : item.code))}
            className="inline-flex items-center justify-center h-5 w-5 rounded-lg transition-colors hover:bg-slate-200"
          >
            <ChevronRight className={cn("h-3.5 w-3.5 text-slate-500 transition-transform", expandedCode === item.code ? "rotate-90" : "rotate-0")} />
          </button>
        </div>
      ),
    },
    { id: "no", header: "No.", label: "No.", headerClassName: TABLE_STYLES.headerCell35, cell: (_item, index) => (currentPage - 1) * itemsPerPage + index + 1 },
    { id: "name", header: "Name", label: "Name", sort: sortOf("name"), cell: (item) => <span className="font-medium text-emerald-700 hover:underline">{item.name}</span> },
    { id: "code", header: "Code", label: "Code", sort: sortOf("code"), cell: (item) => <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{item.code}</code> },
    { id: "category", header: "Category", label: "Category", sort: sortOf("category"), cell: (item) => item.category },
    { id: "description", header: "Description", label: "Description", cellClassName: "text-slate-600 max-w-md truncate", cell: (item) => item.description || "-" },
    { id: "columns", header: "Columns", label: "Columns", sort: sortOf("columns"), cellClassName: "text-slate-600", cell: (item) => item.columnCount },
    { id: "templates", header: "Templates", label: "Templates", sort: sortOf("templates"), cellClassName: "text-slate-600", cell: (item) => item.templateCount },
    {
      id: "status",
      header: "Status",
      label: "Status",
      sort: sortOf("status"),
      cell: (item) => (item.enabled ? <Badge color="emerald" size="sm">Enabled</Badge> : <Badge color="slate" size="sm">Disabled</Badge>),
    },
    { id: "modifiedDate", header: "Modified Date", label: "Modified Date", cellClassName: "text-slate-600", cell: (item) => when(item.updatedAt) },
  ];
  const action: DataTableAction<ReportTypeListItem> = {
    header: "Action",
    cell: (item) => (
      <button
        ref={getButtonRef(item.code)}
        onClick={(e) => handleDropdownToggle(item.code, e)}
        className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-slate-100 transition-colors"
        aria-label="More actions"
      >
        <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" />
      </button>
    ),
  };
  const { layout, control } = useCustomColumnLayout("reportTypes", columns, action);
  const openItem = items.find((current) => current.code === openDropdownId);
  const statusOptions = [
    { label: "All", value: "All" },
    { label: "Enabled", value: "Enabled" },
    { label: "Disabled", value: "Disabled" },
  ];
  const categoryOptions = [{ label: "All", value: "" }, ...categories.map((category) => ({ label: category, value: category }))];

  return (
    <div className="h-full flex flex-col gap-6">
      <PageHeader title="Report Types" breadcrumbItems={reportBreadcrumbs(navigate, "Report Types", true)} />
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex-1 overflow-auto p-4 md:p-5">
            <div className="compact-filter-stack flex-1 flex flex-col gap-4 md:gap-5 min-h-0">
              <div className="bg-white w-full">
                <div className="flex md:hidden flex-col gap-1.5 w-full">
                  <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search report types..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        className="w-full h-10 pl-10 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                      {searchQuery && (
                        <button onClick={() => { setSearchQuery(""); setCurrentPage(1); }} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <Button variant="outline" onClick={() => setIsFilterDrawerOpen(true)} className="whitespace-nowrap gap-2">
                      <IconFilter2 className="h-4 w-4" />
                      Filters
                    </Button>
                  </div>
                </div>

                <ConfiguredDesktopFilters
                  trailing={<div className="hidden md:block">{control}</div>}
                  search={
                    <input
                      aria-label="Search"
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      placeholder="Search report types..."
                      className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                    />
                  }
                  filters={[
                    { id: "statusFilter", label: "Status", value: String(statusFilter), options: statusOptions, onChange: (value) => { setStatusFilter(value as StatusFilter); setCurrentPage(1); } },
                    { id: "categoryFilter", label: "Category", value: categoryFilter, options: categoryOptions, onChange: (value) => { setCategoryFilter(value); setCurrentPage(1); } },
                  ]}
                >
                  <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4 items-end">
                    <div className="sm:col-span-1 lg:col-span-4">
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Search</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search report types..."
                          value={searchQuery}
                          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                          className="w-full h-9 pl-10 pr-4 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-1 lg:col-span-4">
                      <Select label="Status" value={statusFilter} onChange={(value) => { setStatusFilter(value as StatusFilter); setCurrentPage(1); }} options={statusOptions} placeholder="All" />
                    </div>
                    <div className="sm:col-span-1 lg:col-span-4">
                      <Select label="Category" value={categoryFilter} onChange={(value) => { setCategoryFilter(String(value)); setCurrentPage(1); }} options={categoryOptions} placeholder="All" />
                    </div>
                  </div>
                  <div className="hidden md:flex justify-start mt-3 gap-2">
                    <ClearFiltersButton onClearSearch={() => setSearchQuery("")} onClear={clearFilters} disabled={!hasActiveFilters} />
                    {control}
                  </div>
                </ConfiguredDesktopFilters>
              </div>

              <div className="flex-1 overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col">
                <DataTable
                  rows={items}
                  getRowKey={(item) => item.code}
                  isLoading={isLoading}
                  columns={layout.columns}
                  columnLayout={layout}
                  action={action}
                  onRowClick={(item) => navigate(typePath(item.code))}
                  expandedRow={{
                    isExpanded: (item) => expandedCode === item.code,
                    render: (item) => <ExpandedReportTypeRow type={item} visibleColumnsLength={10} />,
                    asRow: false,
                  }}
                  emptyState={<TableEmptyState title="No items found" description="Try adjusting your search" />}
                  pagination={
                    totalItems > 0 ? (
                      <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
                    ) : undefined
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <PortalDropdownMenu isOpen={!!openDropdownId} onClose={closeDropdown} position={dropdownPosition}>
        <div className="py-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (openDropdownId) navigate(typePath(openDropdownId));
              closeDropdown();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <IconInfoCircle className="h-3.5 w-3.5" />
            <span>View Detail</span>
          </button>
          {canManage && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (openItem) {
                  setSelectedItem(openItem);
                  setToggleReason("");
                  setToggleError("");
                  setShowToggleModal(true);
                }
                closeDropdown();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
            >
              {openItem?.enabled ? (<><PowerOff className="h-3.5 w-3.5" /><span>Disable</span></>) : (<><Power className="h-3.5 w-3.5" /><span>Enable</span></>)}
            </button>
          )}
        </div>
      </PortalDropdownMenu>

      <AlertModal
        isOpen={showToggleModal}
        onClose={closeToggle}
        onConfirm={handleConfirmToggle}
        type="warning"
        title={`${selectedItem?.enabled ? "Disable" : "Enable"} Report Type?`}
        description={
          <div className="space-y-3">
            <p>Are you sure you want to {selectedItem?.enabled ? "disable" : "enable"} <strong>{selectedItem?.name}</strong>?</p>
            <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 inline shrink-0" />{" "}
                <span className="font-semibold">Warning:</span>{" "}
                {selectedItem?.enabled
                  ? "No new template or report can use this type. Reports already made are not affected; schedules of its templates are suspended."
                  : "New templates and reports can use this type again."}
              </p>
            </div>
            <div>
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={toggleReason}
                maxLength={1000}
                rows={2}
                onChange={(e) => { setToggleReason(e.target.value); setToggleError(""); }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                placeholder="Recorded with your name and the time"
              />
              {toggleError && <p role="alert" className="mt-1.5 text-xs text-red-600">{toggleError}</p>}
            </div>
          </div>
        }
        confirmText={selectedItem?.enabled ? "Disable" : "Enable"}
        cancelText="Cancel"
        isLoading={isSubmitting}
        showCancel
      />

      <FilterDrawer isOpen={isFilterDrawerOpen} onClose={() => setIsFilterDrawerOpen(false)} onClear={clearFilters} onApply={() => setIsFilterDrawerOpen(false)}>
        <FilterAccordionItem label="Status" isExpanded={expandedSections.has("status")} onToggle={() => toggleSection("status")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {statusOptions.map((opt) => (
              <button key={opt.value} onClick={() => { setStatusFilter(opt.value as StatusFilter); setCurrentPage(1); }} className={getOptionClassName(statusFilter === opt.value)}>
                <span className="text-xs">{opt.label}</span>
                {statusFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Category" isExpanded={expandedSections.has("category")} onToggle={() => toggleSection("category")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {categoryOptions.map((opt) => (
              <button key={opt.value || "all"} onClick={() => { setCategoryFilter(opt.value); setCurrentPage(1); }} className={getOptionClassName(categoryFilter === opt.value)}>
                <span className="text-xs">{opt.label}</span>
                {categoryFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </div>
  );
};
