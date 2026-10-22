import { ConfiguredDesktopFilters } from "@/components/ui/filter/ConfiguredDesktopFilters";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { AlertTriangle, Check, ChevronRight, MoreVertical, Power, PowerOff, Search, X } from "lucide-react";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { Badge } from "@/components/ui/badge/Badge";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { FilterAccordionItem, FilterDrawer } from "@/components/ui/filter/FilterDrawer";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { DataTable, useCustomColumnLayout, type DataTableAction, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { cn } from "@/components/ui/utils";
import { IconFilter2, IconInfoCircle, IconPencilMinus } from "@tabler/icons-react";
import { usePortalDropdown } from "@/hooks";
import { useToast } from "@/components/ui/toast";
import { useDictionaryServerTable, type DictionaryServerQuery } from "@/features/settings/dictionaries/hooks/useDictionaryServerTable";
import { usePermissions } from "@/hooks/usePermissions";
import { TABLE_STYLES } from "@/components/ui/table/TablePrimitives";
import { reportError } from "@/services/api/reportTemplates";
import { reportNameFormatsApi, type ReportNameFormatListItem } from "@/services/api/reportNameFormats";
import { pickerDateToIso } from "../shared/ReportListToolbar";
import { ExpandedReportNameFormatRow } from "./ExpandedReportNameFormatRow";

type StatusFilter = "All" | "Active" | "Inactive";
/** What the server calls each status filter. */
const SERVER_STATUS: Record<StatusFilter, "ALL" | "ENABLED" | "DISABLED"> = { All: "ALL", Active: "ENABLED", Inactive: "DISABLED" };
const formatPath = (id: string, view = false) => `/settings/report-name-formats/${id}${view ? "?mode=view" : ""}`;
const when = (value?: string) => (value ? new Date(value).toLocaleString() : "-");

/**
 * List/filter table for Report Name Formats, built like the Document Name Formats table: filters above, the table in its own card, a row that expands
 * to show the parts of the format, a three-dot menu, and the same pagination. New/Edit open the dedicated page.
 */
export const ReportNameFormatsTab: React.FC = () => {
  const navigate = useNavigate();
  const { openId: openDropdownId, position: dropdownPosition, getRef: getButtonRef, toggle: handleDropdownToggle, close: closeDropdown } = usePortalDropdown();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["reports.name_format.manage"]);
  const { showToast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ReportNameFormatListItem | null>(null);
  const [toggleReason, setToggleReason] = useState("");
  const [toggleError, setToggleError] = useState("");
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [modifiedFromDate, setModifiedFromDate] = useState("");
  const [modifiedToDate, setModifiedToDate] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["status", "date"]));
  const [expandedFormatId, setExpandedFormatId] = useState<string | null>(null);

  const handleExpandFormat = (id: string) => setExpandedFormatId((prev) => (prev === id ? null : id));

  // A stable function: the table loads again when the fetcher changes.
  const fetcher = useCallback(
    (params: DictionaryServerQuery) =>
      reportNameFormatsApi.list({
        status: params.status as "ALL" | "ENABLED" | "DISABLED",
        search: params.search as string | undefined,
        sortBy: params.sortBy as string,
        sortDirection: params.sortDirection as "asc" | "desc",
        page: params.page as number,
        limit: params.limit as number,
        modifiedFrom: params.modifiedFrom as string | undefined,
        modifiedTo: params.modifiedTo as string | undefined,
      }),
    [],
  );
  const extraParams = useMemo(
    () => ({
      status: SERVER_STATUS[statusFilter],
      modifiedFrom: pickerDateToIso(modifiedFromDate) || undefined,
      modifiedTo: pickerDateToIso(modifiedToDate) || undefined,
    }),
    [statusFilter, modifiedFromDate, modifiedToDate],
  );
  const {
    searchQuery, setSearchQuery, currentPage, setCurrentPage, itemsPerPage, setItemsPerPage,
    totalPages, totalItems, items, isLoading, sortConfig, handleSort, reload,
  } = useDictionaryServerTable<ReportNameFormatListItem>({
    fetcher,
    defaultSortBy: "name",
    extraParams,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, modifiedFromDate, modifiedToDate, setCurrentPage]);

  const closeToggle = () => {
    setShowToggleModal(false);
    setSelectedItem(null);
    setToggleReason("");
    setToggleError("");
  };

  const handleConfirmToggleStatus = async () => {
    const item = selectedItem;
    if (!item) return;
    if (!toggleReason.trim()) {
      setToggleError("A reason is required. It is recorded with your name and the time.");
      return;
    }
    setIsSubmitting(true);
    try {
      await reportNameFormatsApi.setActive(item.id, item.version, !item.active, toggleReason.trim());
      closeToggle();
      reload();
      showToast({
        type: "success",
        title: item.active ? "Format Deactivated" : "Format Activated",
        message: `"${item.name}" was ${item.active ? "deactivated" : "activated"} successfully.`,
      });
    } catch (error) {
      setToggleError(reportError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setModifiedFromDate("");
    setModifiedToDate("");
    setCurrentPage(1);
  };
  const hasActiveFilters = searchQuery.length > 0 || statusFilter !== "All" || modifiedFromDate.length > 0 || modifiedToDate.length > 0;

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const getOptionClassName = (isActive: boolean) =>
    cn(
      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all",
      isActive ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
    );

  const sortOf = (key: string) => ({ direction: sortConfig.key === key ? sortConfig.direction : undefined, onSort: () => handleSort(key) });
  const nameFormatsColumns: DataTableColumn<ReportNameFormatListItem>[] = [
    {
      id: "expand",
      header: "",
      label: "Expand",
      locked: true,
      cell: (item) => (
        <div onClick={(e) => e.stopPropagation()}>
          <button type="button" aria-label="Expand" onClick={() => handleExpandFormat(item.id)} className="inline-flex items-center justify-center h-5 w-5 rounded-lg transition-colors hover:bg-slate-200">
            <ChevronRight className={cn("h-3.5 w-3.5 text-slate-500 transition-transform", expandedFormatId === item.id ? "rotate-90" : "rotate-0")} />
          </button>
        </div>
      ),
    },
    { id: "no", header: "No.", label: "No.", headerClassName: TABLE_STYLES.headerCell35, cell: (_item, index) => (currentPage - 1) * itemsPerPage + index + 1 },
    {
      id: "name",
      header: "Name",
      label: "Name",
      sort: sortOf("name"),
      cell: (item) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-emerald-700 hover:underline">{item.name}</span>
          {item.example && <span className="text-2xs sm:text-xs text-slate-500">e.g. {item.example}</span>}
        </div>
      ),
    },
    { id: "code", header: "Code", label: "Code", sort: sortOf("code"), cell: (item) => <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{item.code}</code> },
    { id: "separator", header: "Separator", label: "Separator", cell: (item) => <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{item.separator.trim() === "" ? "(space)" : item.separator}</code> },
    { id: "description", header: "Description", label: "Description", cellClassName: "text-slate-600 max-w-md truncate", cell: (item) => item.description || "-" },
    {
      id: "isActive",
      header: "Status",
      label: "Status",
      sort: sortOf("status"),
      cell: (item) => (item.active ? <Badge color="emerald" size="sm">Active</Badge> : <Badge color="slate" size="sm">Inactive</Badge>),
    },
    { id: "modifiedDate", header: "Modified Date", label: "Modified Date", cellClassName: "text-slate-600", sort: sortOf("updatedAt"), cell: (item) => when(item.updatedAt) },
  ];
  const nameFormatsAction: DataTableAction<ReportNameFormatListItem> = {
    header: "Action",
    cell: (item) => (
      <button
        ref={getButtonRef(item.id)}
        onClick={(e) => handleDropdownToggle(item.id, e)}
        className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-slate-100 transition-colors"
        aria-label="More actions"
      >
        <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" />
      </button>
    ),
  };
  const { layout: nameFormatsLayout, control: nameFormatsControl } = useCustomColumnLayout("reportNameFormats", nameFormatsColumns, nameFormatsAction);
  const openItem = items.find((current) => current.id === openDropdownId);

  const statusOptions = [
    { label: "All", value: "All" },
    { label: "Active", value: "Active" },
    { label: "Inactive", value: "Inactive" },
  ];

  return (
    <div className="compact-filter-stack flex-1 flex flex-col gap-4 md:gap-5 min-h-0">
      <div className="bg-white w-full">
        <div className="flex md:hidden flex-col gap-1.5 w-full">
          <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search formats..."
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
          trailing={<div className="hidden md:block">{nameFormatsControl}</div>}
          search={
            <input
              aria-label="Search"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search formats..."
              className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
            />
          }
          filters={[
            {
              id: "statusFilter",
              label: "Status",
              value: String(statusFilter),
              options: statusOptions,
              onChange: (value) => { setStatusFilter(value as StatusFilter); setCurrentPage(1); },
            },
          ]}
          dates={[
            {
              id: "modifiedFromDate",
              label: "Modified Date Range",
              from: modifiedFromDate,
              to: modifiedToDate,
              onFromChange: (v) => { setModifiedFromDate(v); setCurrentPage(1); },
              onToChange: (v) => { setModifiedToDate(v); setCurrentPage(1); },
            },
          ]}
        >
          <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4 items-end">
            <div className="sm:col-span-1 lg:col-span-4">
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search formats..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full h-9 pl-10 pr-4 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="sm:col-span-1 lg:col-span-4">
              <Select
                label="Status"
                value={statusFilter}
                onChange={(value) => { setStatusFilter(value as StatusFilter); setCurrentPage(1); }}
                options={statusOptions}
                placeholder="All"
              />
            </div>
            <div className="sm:col-span-1 lg:col-span-4">
              <DateRangePicker
                label="Modified Date Range"
                startDate={modifiedFromDate}
                endDate={modifiedToDate}
                onStartDateChange={(v) => { setModifiedFromDate(v); setCurrentPage(1); }}
                onEndDateChange={(v) => { setModifiedToDate(v); setCurrentPage(1); }}
                placeholder="Select range"
              />
            </div>
          </div>

          <div className="hidden md:flex justify-start mt-3 gap-2">
            <Button size="sm" variant="outline" onClick={clearFilters} disabled={!hasActiveFilters} className="gap-2">
              Clear Filters
            </Button>
            {nameFormatsControl}
          </div>
        </ConfiguredDesktopFilters>
      </div>

      <div className="flex-1 overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col">
        <DataTable
          rows={items}
          getRowKey={(item) => item.id}
          isLoading={isLoading}
          columns={nameFormatsLayout.columns}
          columnLayout={nameFormatsLayout}
          action={nameFormatsAction}
          onRowClick={(item) => navigate(formatPath(item.id, !canManage))}
          expandedRow={{
            isExpanded: (item) => expandedFormatId === item.id,
            render: (item) => <ExpandedReportNameFormatRow format={item} isExpanded={true} visibleColumnsLength={9} />,
            asRow: false,
          }}
          emptyState={<TableEmptyState title="No items found" description="Try adjusting your search" />}
          pagination={
            totalItems > 0 ? (
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
              />
            ) : undefined
          }
        />
      </div>

      <PortalDropdownMenu isOpen={!!openDropdownId} onClose={closeDropdown} position={dropdownPosition}>
        <div className="py-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (openDropdownId) navigate(formatPath(openDropdownId, true));
              closeDropdown();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <IconInfoCircle className="h-3.5 w-3.5" />
            <span>View Detail</span>
          </button>
          {canManage && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (openDropdownId) navigate(formatPath(openDropdownId));
                  closeDropdown();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <IconPencilMinus className="h-3.5 w-3.5" />
                <span>Edit Report Name Format</span>
              </button>
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
                {openItem?.active ? (<><PowerOff className="h-3.5 w-3.5" /><span>Disable</span></>) : (<><Power className="h-3.5 w-3.5" /><span>Enable</span></>)}
              </button>
            </>
          )}
        </div>
      </PortalDropdownMenu>

      <AlertModal
        isOpen={showToggleModal}
        onClose={closeToggle}
        onConfirm={handleConfirmToggleStatus}
        type="warning"
        title={`${selectedItem?.active ? "Deactivate" : "Activate"} Report Name Format?`}
        description={
          <div className="space-y-3">
            <p>Are you sure you want to {selectedItem?.active ? "deactivate" : "activate"} <strong>{selectedItem?.name}</strong>?</p>
            <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 inline shrink-0" />{" "}
                <span className="font-semibold">Warning:</span>{" "}
                {selectedItem?.active
                  ? "New report templates will have no name format and will be named by typing. Templates that already have a name keep it."
                  : "Only one format is active at a time. This format will name every new report template, and the format that is active now will be deactivated. Templates that already have a name keep it."}
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
        confirmText={selectedItem?.active ? "Deactivate" : "Activate"}
        cancelText="Cancel"
        isLoading={isSubmitting}
        showCancel
      />

      <FilterDrawer isOpen={isFilterDrawerOpen} onClose={() => setIsFilterDrawerOpen(false)} onClear={clearFilters} onApply={() => setIsFilterDrawerOpen(false)}>
        <FilterAccordionItem label="Status" isExpanded={expandedSections.has("status")} onToggle={() => toggleSection("status")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setStatusFilter(opt.value as StatusFilter); setCurrentPage(1); }}
                className={getOptionClassName(statusFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {statusFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Modified Date Range" isExpanded={expandedSections.has("date")} onToggle={() => toggleSection("date")}>
          <div className="pt-2 pb-4">
            <DateRangePicker
              label=""
              startDate={modifiedFromDate}
              endDate={modifiedToDate}
              onStartDateChange={(v) => { setModifiedFromDate(v); setCurrentPage(1); }}
              onEndDateChange={(v) => { setModifiedToDate(v); setCurrentPage(1); }}
              placeholder="Select range"
            />
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </div>
  );
};
