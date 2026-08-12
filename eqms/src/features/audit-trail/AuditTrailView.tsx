import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  Download,
  MoreVertical,
  Search,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { auditTrail } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import {
  FullPageLoading,
  SectionLoading,
} from "@/components/ui/loading/Loading";
import { cn } from "@/components/ui/utils";
import { Badge } from "@/components/ui/badge/Badge";
import { formatDateTime } from "@/utils/format";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { IconFilter2, IconInfoCircle } from "@tabler/icons-react";
import {
  PortalDropdownPosition,
  useDebounce,
  usePortalDropdown,
  useTableDragScroll,
} from "@/hooks";
import { auditTrailApi } from "@/services/api/auditTrail";
import { USER_MANAGEMENT_ROUTES } from "@/features/security-authorization/user-management/constants";
import { AuditTrailDetailView } from "./AuditTrailDetailView";
import { AuditExportModal } from "./components/AuditExportModal";
import {
  getAuditActionBadgeClass,
  formatAuditActionLabel,
} from "./utils/actionBadge";
import { getDefaultAuditTrailDateRange } from "./utils/dateRange";
import { formatWorkflowStatusLabel } from "./utils/statusLabel";
import {
  FilterAccordionItem,
  FilterDrawer,
} from "@/components/ui/filter/FilterDrawer";
import { FilterOptionButton } from "@/components/ui/filter/FilterOptionButton";
import type { AuditTrailRecord } from "./types";

const formatSignatureId = (id?: string | null): string => {
  if (!id || !id.trim()) return "";
  const trimmed = id.trim();
  if (trimmed.startsWith("SIG-") || trimmed.startsWith("ESIG-")) return trimmed;
  const cleaned = trimmed.replace(/-/g, "").toUpperCase();
  return `SIG-${cleaned.substring(0, 8)}`;
};

const ACTION_OPTIONS = [
  { label: "All Actions", value: "All" },
  { label: "Create", value: "Create" },
  { label: "Update", value: "Update" },
  { label: "Delete", value: "Delete" },
  { label: "Replace", value: "Replace" },
  { label: "Approve", value: "Approve" },
  { label: "Reject", value: "Reject" },
  { label: "Review", value: "Review" },
  { label: "Publish", value: "Publish" },
  { label: "Archive", value: "Archive" },
  { label: "Restore", value: "Restore" },
  { label: "Login", value: "Login" },
  { label: "Logout", value: "Logout" },
  { label: "Failed Login", value: "Failed Login" },
  { label: "Export", value: "Export" },
  { label: "Download", value: "Download" },
  { label: "View", value: "View" },
  { label: "Open", value: "Open" },
  { label: "Preview", value: "Preview" },
  { label: "Open Preview", value: "Open Preview" },
  { label: "Open Edit Online", value: "Open Edit Online" },
  { label: "View Page", value: "View Page" },
  { label: "Close Preview", value: "Close Preview" },
  { label: "Upload", value: "Upload" },
  { label: "Download Evidence", value: "Download Evidence" },
  { label: "Add Working Note", value: "Add Working Note" },
  { label: "Delete Working Note", value: "Delete Working Note" },
  { label: "Upload to Office Online", value: "Upload to Office Online" },
  {
    label: "Edit Online Synced Back to MinIO",
    value: "Edit Online Synced Back to MinIO",
  },
  { label: "Edit Online Session Closed", value: "Edit Online Session Closed" },
  { label: "Generate", value: "Generate" },
  { label: "Assign", value: "Assign" },
  { label: "Unassign", value: "Unassign" },
  { label: "Enable", value: "Enable" },
  { label: "Disable", value: "Disable" },
  { label: "Cancel", value: "Cancel" },
  { label: "Obsoleted", value: "Obsoleted" },
  { label: "E-Signature Success", value: "E-Signature Success" },
  { label: "E-Signature Failed", value: "E-Signature Failed" },
  { label: "Change Permission", value: "Change Permission" },
  {
    label: "Change System Configuration",
    value: "Change System Configuration",
  },
  { label: "Submit", value: "Submit" },
  { label: "Replace File", value: "Replace File" },
  { label: "Update Metadata", value: "Update Metadata" },
];

const hasESignature = (record: AuditTrailRecord) =>
  record.electronicSignatureApplied === true ||
  record.metadata?.electronicSignatureApplied === true ||
  Boolean(
    record.signatureId ||
    record.metadata?.signatureId ||
    record.metadata?.signature_id,
  );

const mapModuleLabel = (module: string) => {
  switch (module) {
    case "Document":
      return "Document Control";
    case "Revision":
      return "Document Revision";
    case "Controlled Copy":
      return "Controlled Copy";
    default:
      return module || "-";
  }
};

const buildObjectCode = (record: AuditTrailRecord) => {
  const docNum =
    record.metadata?.documentNumber || record.metadata?.document_number;
  const revNum =
    record.metadata?.revisionNumber || record.metadata?.revision_number;
  if (docNum) {
    return revNum ? `${docNum} Rev.${revNum}` : docNum;
  }
  return record.entityName || "-";
};

const buildStatusChange = (record: AuditTrailRecord) => {
  const statusChange = record.changes?.find(
    (c) =>
      c.field?.toLowerCase() === "status" || c.field?.toLowerCase() === "state",
  );
  if (statusChange) {
    return `${formatWorkflowStatusLabel(statusChange.oldValue)} → ${formatWorkflowStatusLabel(statusChange.newValue)}`;
  }
  const oldStatus =
    record.metadata?.oldStatus ||
    record.metadata?.old_status ||
    record.metadata?.fromStatus;
  const newStatus =
    record.metadata?.newStatus ||
    record.metadata?.new_status ||
    record.metadata?.toStatus;
  if (oldStatus || newStatus) {
    return `${formatWorkflowStatusLabel(oldStatus)} → ${formatWorkflowStatusLabel(newStatus)}`;
  }
  return "-";
};

const formatProgressDuration = (seconds?: number | null) => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return "-";
  }
  if (seconds < 60) {
    return `${seconds.toFixed(seconds < 10 ? 2 : 1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
};

interface DropdownMenuProps {
  record: AuditTrailRecord;
  isOpen: boolean;
  onClose: () => void;
  onViewDetails: () => void;
  onExport: () => void;
  position: PortalDropdownPosition;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({
  isOpen,
  onClose,
  onViewDetails,
  onExport,
  position,
}) => (
  <PortalDropdownMenu
    isOpen={isOpen}
    onClose={onClose}
    position={position}
    minWidth={200}
  >
    <div className="py-1">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onViewDetails();
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
      >
        <IconInfoCircle className="h-4 w-4 flex-shrink-0" />
        <span className="font-medium">View Details</span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onExport();
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
      >
        <Download className="h-4 w-4 flex-shrink-0" />
        <span className="font-medium">Export</span>
      </button>
    </div>
  </PortalDropdownMenu>
);

export const AuditTrailView: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [records, setRecords] = useState<AuditTrailRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<AuditTrailRecord | null>(
    null,
  );
  const [exportingRecord, setExportingRecord] =
    useState<AuditTrailRecord | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [userOptions, setUserOptions] = useState<
    { label: string; value: string }[]
  >([{ label: "All Users", value: "" }]);
  const [isUserOptionsLoading, setIsUserOptionsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 350);
  const [actionFilter, setActionFilter] = useState<string>("All");
  const [userFilter, setUserFilter] = useState("");
  const [eSignatureFilter, setESignatureFilter] = useState<
    "All" | "Yes" | "No"
  >("All");
  const defaultDateRange = useMemo(() => getDefaultAuditTrailDateRange(), []);
  const [dateFrom, setDateFrom] = useState(defaultDateRange.startDate);
  const [dateTo, setDateTo] = useState(defaultDateRange.endDate);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: "timestamp" | "user" | "module" | "action" | "entityId";
    direction: "asc" | "desc";
  }>({ key: "timestamp", direction: "desc" });
  const pendingPageResetRef = useRef(false);

  const {
    openId: openDropdownId,
    position: dropdownPosition,
    getRef,
    toggle: handleDropdownToggle,
    close: closeDropdown,
  } = usePortalDropdown();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["action", "user", "signature", "date"]),
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setActionFilter("All");
    setUserFilter("");
    setESignatureFilter("All");
    const defaults = getDefaultAuditTrailDateRange();
    setDateFrom(defaults.startDate);
    setDateTo(defaults.endDate);
    setCurrentPage(1);
  };

  const handleSort = (key: typeof sortConfig.key) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };

  useEffect(() => {
    setSelectedRecord(null);
  }, [location.key]);

  useEffect(() => {
    let alive = true;
    setIsUserOptionsLoading(true);

    auditTrailApi
      .getAuditTrailUsers()
      .then((response) => {
        if (!alive) return;
        setUserOptions([{ label: "All Users", value: "" }, ...response]);
      })
      .catch(() => {
        if (!alive) return;
        setUserOptions([{ label: "All Users", value: "" }]);
      })
      .finally(() => {
        if (alive) {
          setIsUserOptionsLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (currentPage !== 1) {
      pendingPageResetRef.current = true;
      setCurrentPage(1);
    }
  }, [
    debouncedSearchQuery,
    actionFilter,
    userFilter,
    eSignatureFilter,
    dateFrom,
    dateTo,
    itemsPerPage,
    sortConfig,
  ]);

  useEffect(() => {
    if (pendingPageResetRef.current && currentPage !== 1) {
      return;
    }
    if (pendingPageResetRef.current && currentPage === 1) {
      pendingPageResetRef.current = false;
    }

    let alive = true;
    setIsLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const response = await auditTrailApi.getAuditTrail({
          searchQuery: debouncedSearchQuery,
          action: actionFilter as any,
          user: userFilter,
          eSignatureOnly:
            eSignatureFilter === "All" ? undefined : eSignatureFilter === "Yes",
          dateFrom,
          dateTo,
          page: currentPage,
          limit: itemsPerPage,
          sortBy: sortConfig.key,
          sortDirection: sortConfig.direction,
        });

        if (!alive) return;
        setRecords(response.data || []);
        setTotalItems(response.pagination?.total || 0);
        setTotalPages(response.pagination?.totalPages || 1);
      } catch (error) {
        if (!alive) return;
        setRecords([]);
        setTotalItems(0);
        setTotalPages(1);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load audit trail.",
        );
      } finally {
        if (alive) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    debouncedSearchQuery,
    actionFilter,
    userFilter,
    eSignatureFilter,
    dateFrom,
    dateTo,
    currentPage,
    itemsPerPage,
    sortConfig,
  ]);

  const actionOptions = useMemo(() => {
    const dynamicActions = Array.from(
      new Set(records.map((record) => record.action).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));
    const combined = [...ACTION_OPTIONS];
    dynamicActions.forEach((action) => {
      if (!combined.some((option) => option.value === action)) {
        combined.push({ label: formatAuditActionLabel(action), value: action });
      }
    });
    return combined;
  }, [records]);

  const isTableLoading = isLoading && records.length > 0;
  const isInitialLoading = isLoading && records.length === 0;

  if (selectedRecord) {
    return (
      <AuditTrailDetailView
        record={selectedRecord}
        onBack={() => setSelectedRecord(null)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 md:gap-6">
      {(isNavigating || isInitialLoading) && (
        <FullPageLoading text="Loading..." />
      )}

      <PageHeader
        title="All Records"
        breadcrumbItems={auditTrail(navigate)}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const blob = await auditTrailApi.exportAuditTrail({
                  searchQuery: debouncedSearchQuery,
                  action: actionFilter as any,
                  user: userFilter,
                  eSignatureOnly:
                    eSignatureFilter === "All"
                      ? undefined
                      : eSignatureFilter === "Yes",
                  dateFrom,
                  dateTo,
                  sortBy: sortConfig.key,
                  sortDirection: sortConfig.direction,
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              } catch {
                // Best effort export button.
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        }
      />

      {loadError && !isLoading && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <div className="flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-1 flex-col p-4 md:p-5">
          <div className="flex w-full flex-col gap-1.5 pb-4 md:hidden">
            <label className="text-xs sm:text-sm font-medium text-slate-700 block">
              Search
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search audit trail..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-10 h-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button
                variant="outline"
                onClick={() => setIsFilterDrawerOpen(true)}
                className="whitespace-nowrap gap-2 h-10"
              >
                <IconFilter2 className="h-4 w-4" />
                Filters
              </Button>
            </div>
          </div>

          <div className="hidden md:grid grid-cols-1 items-end gap-4 pb-4 md:grid-cols-3 md:pb-5">
            <div className="w-full">
              <label className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">
                Search
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search audit trail..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block h-9 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-10 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-slate-600"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="w-full">
              <Select
                label="Action Type"
                value={actionFilter}
                onChange={(value) => setActionFilter(String(value))}
                options={actionOptions}
                placeholder="All Actions"
              />
            </div>

            <div className="w-full">
              <Select
                label="User"
                value={userFilter}
                onChange={(value) => setUserFilter(String(value))}
                options={userOptions}
                placeholder="All Users"
                isLoading={isUserOptionsLoading}
                loadingText="Loading users..."
              />
            </div>

            <div className="w-full">
              <Select
                label="E-Signature"
                value={eSignatureFilter}
                onChange={(value) =>
                  setESignatureFilter(value as "All" | "Yes" | "No")
                }
                options={[
                  { label: "All", value: "All" },
                  { label: "Yes", value: "Yes" },
                  { label: "No", value: "No" },
                ]}
                placeholder="All"
              />
            </div>

            <div className="w-full">
              <DateRangePicker
                label="Date Range"
                startDate={dateFrom}
                endDate={dateTo}
                onStartDateChange={(value) => {
                  setDateFrom(value);
                  setCurrentPage(1);
                }}
                onEndDateChange={(value) => {
                  setDateTo(value);
                  setCurrentPage(1);
                }}
                placeholder="Select date range"
                includeTime
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="h-9 px-4 gap-2 font-medium transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap"
              >
                Clear Filters
              </Button>
            </div>
          </div>

          <div className="relative flex flex-1 flex-col">
            {isTableLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/40 backdrop-blur-[4px] transition-all duration-300">
                <SectionLoading text="Searching..." minHeight="150px" />
              </div>
            )}

            <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-300">
              <div
                ref={scrollerRef}
                className={cn(
                  "overflow-x-auto",
                  isDragging ? "cursor-grabbing select-none" : "cursor-grab",
                )}
                {...dragEvents}
              >
                {!isLoading && records.length === 0 ? (
                  <div className="py-12 text-center">
                    <TableEmptyState
                      title="No Audit Records Found"
                      description="We couldn't find any audit records matching your filters. Try adjusting your search criteria."
                    />
                  </div>
                ) : (
                  <table className="w-full min-w-[1760px]">
                    <thead className="sticky top-0 z-30">
                      <tr>
                        <th className="sticky top-0 z-20 w-16 whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-center text-2xs md:text-xs font-bold uppercase tracking-wider text-slate-500">
                          No.
                        </th>
                        {[
                          { label: "Timestamp", key: "timestamp" },
                          { label: "User", key: "user" },
                          { label: "Employee ID" },
                          { label: "Role" },
                          { label: "Module", key: "module" },
                          { label: "Object Type" },
                          { label: "Object Code", key: "entityId" },
                          { label: "Action", key: "action" },
                          { label: "Status Change" },
                          { label: "E-Signature" },
                          { label: "Progress Duration" },
                          { label: "IP Address" },
                          { label: "Device / Browser" },
                        ].map(({ label, key }) => (
                          <th
                            key={label}
                            onClick={
                              key
                                ? () => handleSort(key as typeof sortConfig.key)
                                : undefined
                            }
                            className={cn(
                              "sticky top-0 z-20 whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-left text-2xs font-bold uppercase tracking-wider text-slate-500 md:text-xs",
                              key &&
                                "cursor-pointer transition-colors hover:bg-slate-100 hover:text-slate-700 group",
                            )}
                          >
                            <div className="flex w-full items-center justify-between gap-2">
                              <span className="truncate">{label}</span>
                              {key && (
                                <div className="flex flex-shrink-0 flex-col text-slate-500 transition-colors group-hover:text-slate-700">
                                  <ChevronUp
                                    className={cn(
                                      "-mb-1 h-3 w-3",
                                      sortConfig.key === key &&
                                        sortConfig.direction === "asc" &&
                                        "text-emerald-600",
                                    )}
                                  />
                                  <ChevronDown
                                    className={cn(
                                      "h-3 w-3",
                                      sortConfig.key === key &&
                                        sortConfig.direction === "desc" &&
                                        "text-emerald-600",
                                    )}
                                  />
                                </div>
                              )}
                            </div>
                          </th>
                        ))}
                        <th className="sticky right-0 top-0 z-30 whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-center text-2xs md:text-xs font-bold uppercase tracking-wider text-slate-500 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200 bg-white">
                      {records.map((record, index) => {
                        const user = record.user;
                        const fullName =
                          user?.fullName || record.fullName || "-";
                        const employeeId = user?.employeeCode || "-";
                        const profileId = user?.id || "";
                        const role = user?.role || "-";
                        const action = record.action || "-";
                        const signature = hasESignature(record) ? "Yes" : "No";
                        const device = record.device || "-";

                        const moduleLabel = mapModuleLabel(record.module);
                        const objectType =
                          record.metadata?.entityType ||
                          record.metadata?.objectType ||
                          record.module ||
                          "-";
                        const objectCode = buildObjectCode(record);
                        const statusChange = buildStatusChange(record);

                        return (
                          <tr
                            key={record.id}
                            className="group transition-colors hover:bg-slate-50/80"
                          >
                            <td className="whitespace-nowrap px-4 py-3 text-center text-xs font-medium text-slate-700 sm:text-sm">
                              {(currentPage - 1) * itemsPerPage + index + 1}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700 sm:text-sm">
                              {formatDateTime(record.timestamp) || "-"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700 sm:text-sm">
                              {fullName}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs sm:text-sm">
                              {profileId && user?.employeeCode ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate(
                                      USER_MANAGEMENT_ROUTES.PROFILE(profileId),
                                    )
                                  }
                                  className="font-medium text-emerald-600 transition-colors hover:text-emerald-700"
                                >
                                  {employeeId}
                                </button>
                              ) : (
                                <span className="text-slate-500">
                                  {employeeId}
                                </span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700 sm:text-sm">
                              {role}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700 sm:text-sm">
                              {moduleLabel}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700 sm:text-sm">
                              {objectType}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700 sm:text-sm">
                              <div
                                className="max-w-[200px] truncate"
                                title={objectCode}
                              >
                                {objectCode}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700 sm:text-sm">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                                  getAuditActionBadgeClass(action),
                                )}
                              >
                                {formatAuditActionLabel(action)}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700 sm:text-sm">
                              {statusChange}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700 sm:text-sm">
                              <div className="flex flex-col gap-1 items-start">
                                <Badge
                                  color={
                                    signature === "Yes" ? "emerald" : "slate"
                                  }
                                  size="sm"
                                >
                                  {signature}
                                </Badge>
                                {record.signatureId && (
                                  <span
                                    className="text-xs font-medium text-slate-600 whitespace-nowrap"
                                    title={`Full UUID: ${record.signatureId}`}
                                  >
                                    {formatSignatureId(record.signatureId)}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700 sm:text-sm">
                              {formatProgressDuration(
                                record.progressDurationSeconds,
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700 sm:text-sm">
                              <div
                                className="max-w-[220px] truncate"
                                title={record.ipAddress || "-"}
                              >
                                {record.ipAddress || "-"}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700 sm:text-sm">
                              <div
                                className="max-w-[260px] truncate"
                                title={device}
                              >
                                {device}
                              </div>
                            </td>
                            <td
                              onClick={(e) => e.stopPropagation()}
                              className="sticky right-0 z-30 whitespace-nowrap bg-white px-4 py-3 text-center text-xs shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] before:absolute before:bottom-0 before:left-0 before:top-0 before:w-[1px] before:bg-slate-200 group-hover:bg-slate-50 sm:text-sm"
                            >
                              <button
                                ref={getRef(record.id)}
                                onClick={(e) =>
                                  handleDropdownToggle(record.id, e)
                                }
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-slate-100 sm:h-8 sm:w-8"
                                aria-label="More actions"
                              >
                                <MoreVertical className="h-3.5 w-3.5 text-slate-600 sm:h-4 sm:w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {totalItems > 0 && (
                <div className="border-t border-slate-200">
                  <TablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onItemsPerPageChange={setItemsPerPage}
                    showItemCount
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {openDropdownId &&
        records.find((record) => record.id === openDropdownId) && (
          <DropdownMenu
            record={records.find((record) => record.id === openDropdownId)!}
            isOpen={true}
            onClose={() => closeDropdown()}
            onViewDetails={() => {
              const record = records.find((item) => item.id === openDropdownId);
              if (record) {
                closeDropdown();
                setIsNavigating(true);
                setTimeout(() => {
                  setSelectedRecord(record);
                  setIsNavigating(false);
                }, 300);
              }
            }}
            onExport={() => {
              const record = records.find((item) => item.id === openDropdownId);
              if (record) {
                setExportingRecord(record);
                setIsExportModalOpen(true);
                closeDropdown();
              }
            }}
            position={dropdownPosition}
          />
        )}

      {exportingRecord && (
        <AuditExportModal
          isOpen={isExportModalOpen}
          onClose={() => {
            setIsExportModalOpen(false);
            setExportingRecord(null);
          }}
          record={exportingRecord}
        />
      )}

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={handleClearFilters}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
        <FilterAccordionItem
          label="Action Type"
          isExpanded={expandedSections.has("action")}
          onToggle={() => toggleSection("action")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4 max-h-60 overflow-y-auto pr-1">
            {actionOptions.map((opt) => (
              <FilterOptionButton
                key={opt.value}
                label={opt.label}
                isSelected={actionFilter === opt.value}
                onClick={() => {
                  setActionFilter(opt.value);
                  setCurrentPage(1);
                }}
              />
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="User"
          isExpanded={expandedSections.has("user")}
          onToggle={() => toggleSection("user")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4 max-h-60 overflow-y-auto pr-1">
            {isUserOptionsLoading ? (
              <div className="text-xs text-slate-500 py-2">
                Loading users...
              </div>
            ) : (
              userOptions.map((opt) => (
                <FilterOptionButton
                  key={opt.value}
                  label={opt.label}
                  isSelected={userFilter === opt.value}
                  onClick={() => {
                    setUserFilter(opt.value);
                    setCurrentPage(1);
                  }}
                />
              ))
            )}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="E-Signature"
          isExpanded={expandedSections.has("signature")}
          onToggle={() => toggleSection("signature")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[
              { label: "All", value: "All" },
              { label: "Yes", value: "Yes" },
              { label: "No", value: "No" },
            ].map((opt) => (
              <FilterOptionButton
                key={opt.value}
                label={opt.label}
                isSelected={eSignatureFilter === opt.value}
                onClick={() => {
                  setESignatureFilter(opt.value as "All" | "Yes" | "No");
                  setCurrentPage(1);
                }}
              />
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Date Range"
          isExpanded={expandedSections.has("date")}
          onToggle={() => toggleSection("date")}
        >
          <div className="pt-2 pb-4">
            <DateRangePicker
              label=""
              startDate={dateFrom}
              endDate={dateTo}
              onStartDateChange={(value) => {
                setDateFrom(value);
                setCurrentPage(1);
              }}
              onEndDateChange={(value) => {
                setDateTo(value);
                setCurrentPage(1);
              }}
              placeholder="Select date range"
              includeTime
            />
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </div>
  );
};
