import { ClearFiltersButton } from "@/components/ui/filter/ClearFiltersButton";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MoreVertical, Download, X, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { usePortalDropdown, useTableDragScroll, useDebounce, PortalDropdownPosition } from "@/hooks";
import { Badge } from "@/components/ui/badge/Badge";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { cn } from "@/components/ui/utils";
import { Select } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { formatDateTime } from "@/utils/format";
import { auditTrailApi } from "@/services/api/auditTrail";
import { AuditExportModal } from "@/features/audit-trail/components/AuditExportModal";
import { getAuditActionBadgeClass, formatAuditActionLabel } from "@/features/audit-trail/utils/actionBadge";
import { getDefaultAuditTrailDateRange } from "@/features/audit-trail/utils/dateRange";
import { buildChangeSummary, buildEntityLabel } from "@/features/audit-trail/utils/recordSummary";
import { USER_MANAGEMENT_ROUTES } from "@/features/security-authorization/user-management/constants";
import type { AuditTrailRecord, AuditAction, AuditModule } from "@/features/audit-trail/types";
import { IconInfoCircle } from "@tabler/icons-react";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { useBranding } from "@/components/branding/BrandLogo";
import { AuditTimeline } from "@/features/audit-trail/components/timeline/AuditTimeline";
import { normalizeTimelineStyle } from "@/features/audit-trail/components/timeline/auditTimelineModel";
import { tr } from "@/i18n";
export type { AuditTrailRecord };

interface DropdownMenuProps {
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
}) => {
  return (
    <PortalDropdownMenu isOpen={isOpen} onClose={onClose} position={position} minWidth={200}>
      <div className="py-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
        >
          <span className="flex h-4 w-4 items-center justify-center">
            <IconInfoCircle className="h-4 w-4" />
          </span>
          <span className="font-medium">{tr("View Details")}</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExport();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
        >
          <Download className="h-4 w-4 flex-shrink-0" />
          <span className="font-medium">{tr("Export")}</span>
        </button>
      </div>
    </PortalDropdownMenu>
  );
};

export interface AuditTrailTabProps {
  records?: AuditTrailRecord[];
  auditEntries?: AuditTrailRecord[];
  documentId?: string;
  documentNumber?: string;
  entityId?: string;
  entityType?: string;
  includeChildren?: boolean;
  emptyMessage?: string;
}

const normalizeText = (value: unknown) => String(value ?? "").toLowerCase().trim();

const hasESignature = (record: AuditTrailRecord) =>
  record.electronicSignatureApplied === true ||
  record.metadata?.electronicSignatureApplied === true ||
  Boolean(record.signatureId || record.metadata?.signatureId || record.metadata?.signature_id);

const buildUserOptionsFromRecords = (records: AuditTrailRecord[]) => {
  const unique = new Map<string, { label: string; value: string }>();
  records.forEach((record) => {
    const user = record.user;
    const value = user?.employeeCode || user?.id || record.userId || "";
    if (!value) {
      return;
    }
    const label = user?.fullName || record.fullName || user?.employeeCode || "Unknown user";
    const key = value.toLowerCase().trim();
    if (!unique.has(key)) {
      unique.set(key, { label, value });
    }
  });
  return [{ label: "All", value: "" }, ...Array.from(unique.values()).sort((left, right) => left.label.localeCompare(right.label))];
};

const getActionOptions = (records: AuditTrailRecord[]) => {
  const actions = Array.from(
    new Set(
      records
        .map((record) => record.action)
        .filter((value): value is AuditAction => Boolean(value))
    )
  ).sort((a, b) => a.localeCompare(b));

  return [
    { label: "All", value: "All" },
    ...actions.map((action) => ({ label: formatAuditActionLabel(action), value: action })),
  ];
};

const DEFAULT_ACTION_OPTIONS = [
  { label: "All", value: "All" },
  { label: "Create", value: "Create" },
  { label: "Update", value: "Update" },
  { label: "Delete", value: "Delete" },
  { label: "Replace", value: "Replace" },
  { label: "Approve", value: "Approve" },
  { label: "Reject", value: "Reject" },
  { label: "Review", value: "Review" },
  { label: "Publish", value: "Publish" },
  { label: "Login", value: "Login" },
  { label: "Logout", value: "Logout" },
  { label: tr("Failed Login"), value: "Failed Login" },
  { label: "Export", value: "Export" },
  { label: "Download", value: "Download" },
  { label: "View", value: "View" },
  { label: "Open", value: "Open" },
  { label: "Preview", value: "Preview" },
  { label: tr("Open Preview"), value: "Open Preview" },
  { label: "View Page", value: "View Page" },
  { label: tr("Close Preview"), value: "Close Preview" },
  { label: "Upload", value: "Upload" },
  { label: tr("Download Evidence"), value: "Download Evidence" },
  { label: tr("Add Working Note"), value: "Add Working Note" },
  { label: tr("Delete Working Note"), value: "Delete Working Note" },
  { label: "Cancel", value: "Cancel" },
  { label: "Obsoleted", value: "Obsoleted" },
  { label: "Submit", value: "Submit" },
  { label: tr("Open Edit Online"), value: "Open Edit Online" },
  { label: tr("Upload to Office Online"), value: "Upload to Office Online" },
  { label: tr("Edit Online Synced Back to MinIO"), value: "Edit Online Synced Back to MinIO" },
  { label: tr("Edit Online Session Closed"), value: "Edit Online Session Closed" },
];

export const AuditTrailTab: React.FC<AuditTrailTabProps> = ({
  records,
  auditEntries,
  documentId,
  documentNumber,
  entityId,
  entityType,
  includeChildren = false,
    emptyMessage = tr("No audit trail records available."),
}) => {
  // Memoized so its reference stays stable across re-renders when records/auditEntries are
  // undefined — otherwise the `[] ` fallback creates a new array every render, and effects that
  // depend on it (e.g. loading the User filter options) would re-fire continuously instead of
  // once, leaving that dropdown's loading spinner stuck spinning.
  const sourceRecords = useMemo(() => records ?? auditEntries ?? [], [records, auditEntries]);
  const navigate = useNavigate();
  // The administrator chooses, in Configuration (General), whether the Audit Trail tab of a record is a table or a timeline, and the look of the timeline.
  // The Audit Trail module itself is not this component and stays a table.
  const { auditTabView, auditTabTimelineStyle } = useBranding();
  const timeline = auditTabView === "TIMELINE";
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<AuditAction | "All">("All");
  const [userFilter, setUserFilter] = useState("");
  const [userOptions, setUserOptions] = useState<{ label: string; value: string }[]>([
    { label: "All", value: "" },
  ]);
  const [isUserOptionsLoading, setIsUserOptionsLoading] = useState(false);
  const [eSignatureFilter, setESignatureFilter] = useState<"All" | "Yes" | "No">("All");
  // Same server sort keys as the standalone audit register, including batch/child timelines.
  const [sortConfig, setSortConfig] = useState<{ key: "timestamp" | "user" | "action"; direction: "asc" | "desc" }>({
    key: "timestamp",
    direction: "desc",
  });
  const handleSort = (key: typeof sortConfig.key) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };
  const defaultAuditTrailDateRange = useMemo(() => getDefaultAuditTrailDateRange(), []);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [exportingRecord, setExportingRecord] = useState<AuditTrailRecord | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);
  const { openId: openDropdownId, position: dropdownPosition, getRef, toggle: handleDropdownToggle, close: closeDropdown } = usePortalDropdown();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();

  const scopedEntityId = entityId || documentId;
  // Scoped tabs use the object's existing authorization gate rather than global audit.view.
  const shouldFetchServer = Boolean(scopedEntityId || documentNumber);
  const [dateFrom, setDateFrom] = useState(() => (records === undefined && auditEntries === undefined ? defaultAuditTrailDateRange.startDate : ""));
  const [dateTo, setDateTo] = useState(() => (records === undefined && auditEntries === undefined ? defaultAuditTrailDateRange.endDate : ""));

  const [internalRecords, setInternalRecords] = useState<AuditTrailRecord[]>([]);
  /** A timeline is read by scrolling: the pages it has loaded so far, older ones added at its end. */
  const [timelineRecords, setTimelineRecords] = useState<AuditTrailRecord[]>([]);
  const pageSize = timeline ? 20 : itemsPerPage;
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!shouldFetchServer) {
      setIsLoading(false);
      setLoadError(null);
      return;
    }

    let alive = true;
    setIsLoading(true);
    setLoadError(null);

    const params = {
        searchQuery: debouncedSearchQuery,
        action: actionFilter as any,
        user: userFilter,
        eSignatureOnly: eSignatureFilter === "All" ? undefined : eSignatureFilter === "Yes",
        dateFrom,
        dateTo,
        page: currentPage,
        limit: pageSize,
        documentNumber,
        entityId: scopedEntityId || undefined,
        sortBy: timeline ? "timestamp" : sortConfig.key,
        sortDirection: timeline ? "desc" : sortConfig.direction,
      };
    const request = scopedEntityId && entityType
      ? auditTrailApi.getEntityPage(entityType, scopedEntityId, { ...params, includeChildren })
      : auditTrailApi.getAuditTrail({ ...params, module: entityType as AuditModule | string | undefined });
    request
      .then((response) => {
        if (!alive) return;
        setInternalRecords(response.data || []);
        setTimelineRecords((previous) => {
          const page = response.data || [];
          if (currentPage === 1) return page;
          const known = new Set(previous.map((record) => record.id));
          return [...previous, ...page.filter((record) => !known.has(record.id))];
        });
        setTotalItems(response.pagination?.total || 0);
        setTotalPages(response.pagination?.totalPages || 1);
      })
      .catch((error) => {
        if (!alive) return;
        setInternalRecords([]);
        if (currentPage === 1) setTimelineRecords([]);
        setTotalItems(0);
        setTotalPages(1);
        setLoadError(error instanceof Error ? error.message : "Failed to load audit logs");
      })
      .finally(() => {
        if (alive) setIsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [
    shouldFetchServer,
    debouncedSearchQuery,
    actionFilter,
    userFilter,
    eSignatureFilter,
    dateFrom,
    dateTo,
    currentPage,
    pageSize,
    timeline,
    documentNumber,
    scopedEntityId,
    entityType,
    includeChildren,
    sortConfig,
    sourceRecords,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, actionFilter, userFilter, eSignatureFilter, dateFrom, dateTo, itemsPerPage]);

  const actionOptions = useMemo(() => {
    if (!shouldFetchServer) {
      return getActionOptions(sourceRecords);
    }
    const dynamicActions = Array.from(
      new Set(internalRecords.map((record) => record.action).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    const combined = [...DEFAULT_ACTION_OPTIONS];
    dynamicActions.forEach((action) => {
      if (!combined.some((option) => option.value === action)) {
        combined.push({ label: formatAuditActionLabel(action), value: action });
      }
    });
    return combined;
  }, [shouldFetchServer, sourceRecords, internalRecords]);

  useEffect(() => {
    let alive = true;

    if (sourceRecords.length > 0) {
      setIsUserOptionsLoading(false);
      setUserOptions(buildUserOptionsFromRecords(sourceRecords));
      return () => {
        alive = false;
      };
    }

    setIsUserOptionsLoading(true);

    auditTrailApi
      .getAuditTrailUsers({
        module: entityType,
        documentNumber,
        entityId: scopedEntityId || undefined,
      })
      .then((options) => {
        if (!alive) return;
        setUserOptions([{ label: "All", value: "" }, ...options]);
      })
      .catch(() => {
        if (!alive) return;
        setUserOptions([{ label: "All", value: "" }]);
      })
      .finally(() => {
        if (alive) setIsUserOptionsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [entityType, documentNumber, scopedEntityId, sourceRecords]);

  const recordsList = timeline ? timelineRecords : internalRecords;
  const openDetails = (record: AuditTrailRecord) => window.open(`/audit-trail/${encodeURIComponent(record.id)}`, "_blank", "noopener,noreferrer");
  const exportRecord = (record: AuditTrailRecord) => {
    setExportingRecord(record);
    setIsExportModalOpen(true);
  };
  const loadOlder = useCallback(() => setCurrentPage((page) => page + 1), []);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayTotalItems = totalItems;
  const displayTotalPages = totalPages;
  const shouldShowEmpty = displayTotalItems === 0;

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Filters section - max 3 fields per row, equal width */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pb-2">
        <div className="w-full">
          <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block capitalize">{tr("Search")}</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder={tr("Search audit trail...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-10 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={tr("Clear search")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="w-full">
          <Select
            label={tr("Action Type")}
            value={actionFilter}
            onChange={(value) => setActionFilter(String(value) as AuditAction | "All")}
            options={actionOptions}
            placeholder={tr("All")}
          />
        </div>

        <div className="w-full">
          <Select
            label={tr("User")}
            value={userFilter}
            onChange={(value) => setUserFilter(String(value))}
            options={userOptions}
            placeholder={tr("All")}
            enableSearch={true}
            isLoading={isUserOptionsLoading}
            loadingText="Loading users..."
          />
        </div>

        <div className="w-full">
          <Select
            label={tr("E-Signature")}
            value={eSignatureFilter}
            onChange={(value) => setESignatureFilter(value as "All" | "Yes" | "No")}
            options={[
              { label: "All", value: "All" },
              { label: "Yes", value: "Yes" },
              { label: "No", value: "No" },
            ]}
            placeholder={tr("All")}
          />
        </div>

        <div className="w-full">
          <DateRangePicker
            label={tr("Date Range")}
            startDate={dateFrom}
            endDate={dateTo}
            onStartDateChange={setDateFrom}
            onEndDateChange={setDateTo}
            placeholder={tr("Select date range")}
            includeTime
          />
        </div>

        <div className="w-full flex items-end">
          <ClearFiltersButton onClearSearch={() => setSearchQuery("")} onClear={() => {
              setSearchQuery("");
              setActionFilter("All");
              setUserFilter("");
              setESignatureFilter("All");
              setDateFrom(defaultAuditTrailDateRange.startDate);
              setDateTo(defaultAuditTrailDateRange.endDate);
              setCurrentPage(1);
            }} />
        </div>
      </div>

      <div className="flex-1 flex flex-col relative">
        <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white transition-all duration-300 relative">
          {isLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/40 backdrop-blur-[4px] transition-all duration-300">
              <SectionLoading text="Loading..." minHeight="150px" />
            </div>
          )}
          {timeline && !shouldShowEmpty ? (
            <AuditTimeline
              records={recordsList}
              style={normalizeTimelineStyle(auditTabTimelineStyle)}
              total={displayTotalItems}
              isLoading={isLoading}
              hasMore={currentPage < displayTotalPages}
              onLoadMore={loadOlder}
              onOpenDetails={openDetails}
              onExport={exportRecord}
            />
          ) : (
          <div
            ref={scrollerRef}
            className={cn(
              "overflow-x-auto",
              isDragging ? "cursor-grabbing select-none" : "cursor-grab"
            )}
            {...dragEvents}
          >
            {shouldShowEmpty ? (
              <div className="py-12 text-center">
                {loadError && /403|forbidden|permission/i.test(loadError) ? (
                  <TableEmptyState
                    title={tr("Access Denied")}
                    description={tr("You don't have permission to view the audit trail for this record.")}
                  />
                ) : (
                  <TableEmptyState
                    title={tr("No Audit Records Found")}
                    description={loadError || emptyMessage}
                  />
                )}
              </div>
            ) : (
              <TableMarkup.Root className="w-full min-w-[1600px]">
                <TableMarkup.Head className="sticky top-0 z-30">
                  <TableMarkup.Row>
                    <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell35}>
                      {tr("No.")}
                    </TableMarkup.HeaderCell>
                    {[
                      { label: "Timestamp", key: "timestamp" as const },
                      { label: "User", key: "user" as const },
                      { label: tr("Employee ID") },
                      { label: tr("Access Profile") },
                      { label: "Position" },
                      { label: "Department" },
                      { label: "Action", key: "action" as const },
                      { label: "Entity" },
                      { label: tr("Change Summary") },
                      { label: tr("E-Signature") },
                      { label: tr("IP Address") },
                      { label: tr("Device / Browser") },
                    ].map(({ label, key }) => (
                      <TableMarkup.HeaderCell
                        key={label}
                        onClick={key ? () => handleSort(key) : undefined}
                        className={cn(
                          "sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap text-left",
                          key && "cursor-pointer transition-colors hover:bg-slate-100 hover:text-slate-700 group",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span className="truncate">{label}</span>
                          {key && (
                            <div className="flex flex-shrink-0 flex-col text-slate-500 transition-colors group-hover:text-slate-700">
                              <ChevronUp
                                className={cn(
                                  "-mb-1 h-3 w-3",
                                  sortConfig.key === key && sortConfig.direction === "asc" && "text-emerald-600",
                                )}
                              />
                              <ChevronDown
                                className={cn(
                                  "h-3 w-3",
                                  sortConfig.key === key && sortConfig.direction === "desc" && "text-emerald-600",
                                )}
                              />
                            </div>
                          )}
                        </div>
                      </TableMarkup.HeaderCell>
                    ))}
                    <TableMarkup.HeaderCell className="sticky top-0 z-30 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap text-center right-0 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]">
                      {tr("Action")}
                    </TableMarkup.HeaderCell>
                  </TableMarkup.Row>
                </TableMarkup.Head>

                <TableMarkup.Body className="divide-y divide-slate-200 bg-white">
                  {recordsList.map((record, index) => {
                    const user = record.user;
                    const fullName = user?.fullName || record.fullName || "-";
                    const employeeId = user?.employeeCode || "-";
                    const profileId = user?.id || "";
                    const accessProfileNames = user?.accessProfileNames ?? [];
                    const position = user?.position || "-";
                    const department = user?.department || "-";
                    const action = record.action || "-";
                    const entity = buildEntityLabel(record);
                    const changeSummary = buildChangeSummary(record).replace(/\n/g, "; ");
                    const signature = hasESignature(record) ? "Yes" : "No";
                    const device = record.device || "-";
                    const rowNumber = startIndex + index + 1;

                    return (
                      <TableMarkup.Row key={record.id} className="hover:bg-slate-50/80 transition-colors group">
                        <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-center text-slate-700 font-medium">
                          {rowNumber}
                        </TableMarkup.Cell>

                        <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                          {formatDateTime(record.timestamp) || "-"}
                        </TableMarkup.Cell>

                        <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                          {fullName}
                        </TableMarkup.Cell>

                        <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                          {profileId ? (
                            <button
                              type="button"
                              onClick={() => navigate(USER_MANAGEMENT_ROUTES.PROFILE(profileId))}
                              className="font-medium text-emerald-600 transition-colors hover:text-emerald-700"
                            >
                              {employeeId}
                            </button>
                          ) : (
                            <span className="text-emerald-600">{employeeId}</span>
                          )}
                        </TableMarkup.Cell>

                        <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                          {accessProfileNames.length === 0 ? (
                            <Badge size="sm" color="amber" title={tr("No Access Profile was assigned at the time of this event.")}>
                              {tr("Unassigned")}
                            </Badge>
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              <Badge size="sm" color="slate">
                                {accessProfileNames[0]}
                              </Badge>
                              {accessProfileNames.length > 1 && (
                                <span className="text-2xs text-slate-500 font-medium">+{accessProfileNames.length - 1}</span>
                              )}
                            </span>
                          )}
                        </TableMarkup.Cell>

                        <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                          {position}
                        </TableMarkup.Cell>

                        <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                          {department}
                        </TableMarkup.Cell>

                        <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                          <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", getAuditActionBadgeClass(action))}>
                            {formatAuditActionLabel(action)}
                          </span>
                        </TableMarkup.Cell>

                        <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                          <div className="max-w-[240px] truncate" title={entity}>
                            {entity}
                          </div>
                        </TableMarkup.Cell>

                        <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm text-slate-700">
                          <div className="max-w-[340px] truncate" title={changeSummary}>
                            {changeSummary}
                          </div>
                        </TableMarkup.Cell>

                        <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                              signature === "Yes"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                            )}
                          >
                            {signature}
                          </span>
                        </TableMarkup.Cell>

                        <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                          <div className="max-w-[220px] truncate" title={record.ipAddress || "-"}>
                            {record.ipAddress || "-"}
                          </div>
                        </TableMarkup.Cell>

                        <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                          <div className="max-w-[260px] truncate" title={device}>
                            {device}
                          </div>
                        </TableMarkup.Cell>

                        <TableMarkup.Cell
                          onClick={(e) => e.stopPropagation()}
                          className="sticky right-0 bg-white py-3 px-4 text-xs sm:text-sm text-center z-30 whitespace-nowrap before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[1px] before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50"
                        >
                          <button
                            ref={getRef(record.id)}
                            onClick={(e) => handleDropdownToggle(record.id, e)}
                            className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-slate-100 transition-colors"
                            aria-label={tr("More actions")}
                          >
                            <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" />
                          </button>
                        </TableMarkup.Cell>
                      </TableMarkup.Row>
                    );
                  })}
                </TableMarkup.Body>
              </TableMarkup.Root>
            )}
          </div>
          )}

          {!timeline && displayTotalItems > 0 && (
            <div className="border-t border-slate-200">
              <TablePagination
                currentPage={currentPage}
                totalPages={displayTotalPages}
                totalItems={displayTotalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                showItemCount
              />
            </div>
          )}
        </div>
      </div>

      {openDropdownId && recordsList.find((record) => record.id === openDropdownId) && (
        <DropdownMenu
          isOpen={true}
          onClose={() => closeDropdown()}
          onViewDetails={() => {
            const record = recordsList.find((item) => item.id === openDropdownId);
            if (record) {
              closeDropdown();
              window.open(`/audit-trail/${encodeURIComponent(record.id)}`, "_blank", "noopener,noreferrer");
            }
          }}
          onExport={() => {
            const record = recordsList.find((item) => item.id === openDropdownId);
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
    </div>
  );
};
