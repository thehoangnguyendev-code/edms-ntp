import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MoreVertical, Download, X, ChevronRight, ShieldAlert } from "lucide-react";
import { usePortalDropdown, useTableDragScroll, useDebounce, PortalDropdownPosition } from "@/hooks";
import { Button } from "@/components/ui/button/Button";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { cn } from "@/components/ui/utils";
import { Select } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { EmptyState } from "@/components/ui/page/EmptyState";
import { formatDateTime } from "@/utils/format";
import { auditTrailApi } from "@/services/api/auditTrail";
import { AuditExportModal } from "@/features/audit-trail/components/AuditExportModal";
import { getAuditActionBadgeClass, formatAuditActionLabel } from "@/features/audit-trail/utils/actionBadge";
import { getDefaultAuditTrailDateRange } from "@/features/audit-trail/utils/dateRange";
import { formatWorkflowStatusLabel } from "@/features/audit-trail/utils/statusLabel";
import { USER_MANAGEMENT_ROUTES } from "@/features/security-authorization/user-management/constants";
import type { AuditTrailRecord, AuditAction, AuditModule } from "@/features/audit-trail/types";
import { IconInfoCircle } from "@tabler/icons-react";
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
};

export interface AuditTrailTabProps {
  records?: AuditTrailRecord[];
  auditEntries?: AuditTrailRecord[];
  documentId?: string;
  documentNumber?: string;
  entityId?: string;
  entityType?: string;
  emptyMessage?: string;
}

const normalizeText = (value: unknown) => String(value ?? "").toLowerCase().trim();

const buildChangeSummary = (record: AuditTrailRecord) => {
  if (record.changes && record.changes.length > 0) {
    return record.changes
      .map((change) => {
        const field = change.field || "Field";
        const isStatusField = /status|state/i.test(field);
        const oldValue = isStatusField ? formatWorkflowStatusLabel(change.oldValue) : (change.oldValue || "-");
        const newValue = isStatusField ? formatWorkflowStatusLabel(change.newValue) : (change.newValue || "-");
        return `${field}: ${oldValue} → ${newValue}`;
      })
      .join("; ");
  }
  return record.description || record.reason || record.metadata?.reason || record.metadata?.comment || "-";
};

const buildEntityLabel = (record: AuditTrailRecord) =>
  record.entityName || record.metadata?.entityName || record.metadata?.entityType || record.module || "-";

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
    const label = user?.fullName || record.fullName || value;
    const key = value.toLowerCase().trim();
    if (!unique.has(key)) {
      unique.set(key, { label, value });
    }
  });
  return [{ label: "All Users", value: "" }, ...Array.from(unique.values()).sort((left, right) => left.label.localeCompare(right.label))];
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
    { label: "All Actions", value: "All" },
    ...actions.map((action) => ({ label: formatAuditActionLabel(action), value: action })),
  ];
};

const DEFAULT_ACTION_OPTIONS = [
  { label: "All Actions", value: "All" },
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
  { label: "Failed Login", value: "Failed Login" },
  { label: "Export", value: "Export" },
  { label: "Download", value: "Download" },
  { label: "View", value: "View" },
  { label: "Open", value: "Open" },
  { label: "Preview", value: "Preview" },
  { label: "Open Preview", value: "Open Preview" },
  { label: "View Page", value: "View Page" },
  { label: "Close Preview", value: "Close Preview" },
  { label: "Upload", value: "Upload" },
  { label: "Download Evidence", value: "Download Evidence" },
  { label: "Add Working Note", value: "Add Working Note" },
  { label: "Delete Working Note", value: "Delete Working Note" },
  { label: "Cancel", value: "Cancel" },
  { label: "Obsoleted", value: "Obsoleted" },
  { label: "Submit", value: "Submit" },
  { label: "Open Edit Online", value: "Open Edit Online" },
  { label: "Upload to Office Online", value: "Upload to Office Online" },
  { label: "Edit Online Synced Back to MinIO", value: "Edit Online Synced Back to MinIO" },
  { label: "Edit Online Session Closed", value: "Edit Online Session Closed" },
];

export const AuditTrailTab: React.FC<AuditTrailTabProps> = ({
  records,
  auditEntries,
  documentId,
  documentNumber,
  entityId,
  entityType,
  emptyMessage = "No audit trail records available.",
}) => {
  // Memoized so its reference stays stable across re-renders when records/auditEntries are
  // undefined — otherwise the `[] ` fallback creates a new array every render, and effects that
  // depend on it (e.g. loading the User filter options) would re-fire continuously instead of
  // once, leaving that dropdown's loading spinner stuck spinning.
  const sourceRecords = useMemo(() => records ?? auditEntries ?? [], [records, auditEntries]);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<AuditAction | "All">("All");
  const [userFilter, setUserFilter] = useState("");
  const [userOptions, setUserOptions] = useState<{ label: string; value: string }[]>([
    { label: "All Users", value: "" },
  ]);
  const [isUserOptionsLoading, setIsUserOptionsLoading] = useState(false);
  const [eSignatureFilter, setESignatureFilter] = useState<"All" | "Yes" | "No">("All");
  const defaultAuditTrailDateRange = useMemo(() => getDefaultAuditTrailDateRange(), []);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [exportingRecord, setExportingRecord] = useState<AuditTrailRecord | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const { openId: openDropdownId, position: dropdownPosition, getRef, toggle: handleDropdownToggle, close: closeDropdown } = usePortalDropdown();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();

  const scopedEntityId = entityId || documentId;
  // An explicitly supplied empty list means the parent already queried the
  // object-scoped endpoint and found no records (or the object has no audit
  // history). Do not fall back to the global audit endpoint, which requires
  // audit.view and incorrectly surfaces a 403 in detail tabs.
  const shouldFetchServer = records === undefined && auditEntries === undefined
    && sourceRecords.length === 0 && Boolean(scopedEntityId || documentNumber);
  const [dateFrom, setDateFrom] = useState(() => (shouldFetchServer ? defaultAuditTrailDateRange.startDate : ""));
  const [dateTo, setDateTo] = useState(() => (shouldFetchServer ? defaultAuditTrailDateRange.endDate : ""));

  const [internalRecords, setInternalRecords] = useState<AuditTrailRecord[]>([]);
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

    auditTrailApi
      .getAuditTrail({
        searchQuery: debouncedSearchQuery,
        action: actionFilter as any,
        user: userFilter,
        eSignatureOnly: eSignatureFilter === "All" ? undefined : eSignatureFilter === "Yes",
        dateFrom,
        dateTo,
        page: currentPage,
        limit: itemsPerPage,
        documentNumber,
        entityId: scopedEntityId || undefined,
        module: entityType as AuditModule | string | undefined,
      })
      .then((response) => {
        if (!alive) return;
        setInternalRecords(response.data || []);
        setTotalItems(response.pagination?.total || 0);
        setTotalPages(response.pagination?.totalPages || 1);
      })
      .catch((error) => {
        if (!alive) return;
        setInternalRecords([]);
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
    itemsPerPage,
    documentNumber,
    scopedEntityId,
    entityType,
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
        combined.push({ label: action, value: action });
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
        setUserOptions([{ label: "All Users", value: "" }, ...options]);
      })
      .catch(() => {
        if (!alive) return;
        setUserOptions([{ label: "All Users", value: "" }]);
      })
      .finally(() => {
        if (alive) setIsUserOptionsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [entityType, documentNumber, scopedEntityId, sourceRecords]);

  useEffect(() => {
    if (!shouldFetchServer) {
      return;
    }
    if (!dateFrom && !dateTo) {
      setDateFrom(defaultAuditTrailDateRange.startDate);
      setDateTo(defaultAuditTrailDateRange.endDate);
    }
  }, [shouldFetchServer, dateFrom, dateTo, defaultAuditTrailDateRange]);

  const filteredRecords = useMemo(() => {
    if (shouldFetchServer) {
      return internalRecords;
    }

    const search = normalizeText(debouncedSearchQuery);
    const userFilterNormalized = normalizeText(userFilter);
    return sourceRecords.filter((record) => {
      const user = record.user;
      const fullName = user?.fullName || record.fullName || "";
      const employeeId = user?.employeeCode || record.userId || "";
      const role = user?.role || "";
      const position = user?.position || "";
      const department = user?.department || "";
      const action = record.action || "";
      const entity = buildEntityLabel(record);
      const changeSummary = buildChangeSummary(record);
      const ipAddress = record.ipAddress || "";
      const device = record.device || "";
      const reason = record.reason || "";

      if (actionFilter !== "All" && action !== actionFilter) {
        return false;
      }

      if (userFilterNormalized) {
        const haystack = [
          fullName,
          employeeId,
          role,
          position,
          department,
        ]
          .map(normalizeText)
          .join(" ");
        if (!haystack.includes(userFilterNormalized)) {
          return false;
        }
      }

      if (eSignatureFilter === "Yes" && !hasESignature(record)) {
        return false;
      }
      if (eSignatureFilter === "No" && hasESignature(record)) {
        return false;
      }

      if (dateFrom || dateTo) {
        const timestamp = new Date(record.timestamp).getTime();
        if (!Number.isNaN(timestamp)) {
          if (dateFrom && timestamp < new Date(dateFrom).getTime()) {
            return false;
          }
          if (dateTo) {
            const upperBound = new Date(dateTo);
            upperBound.setHours(23, 59, 59, 999);
            if (timestamp > upperBound.getTime()) {
              return false;
            }
          }
        }
      }

      if (!search) {
        return true;
      }

      const searchHaystack = [
        fullName,
        employeeId,
        role,
        position,
        department,
        action,
        entity,
        changeSummary,
        reason,
        ipAddress,
        device,
        record.id,
      ]
        .map(normalizeText)
        .join(" ");

      return searchHaystack.includes(search);
    });
  }, [shouldFetchServer, sourceRecords, actionFilter, userFilter, eSignatureFilter, dateFrom, dateTo, debouncedSearchQuery]);

  const totalItemsClient = filteredRecords.length;
  const totalPagesClient = Math.max(1, Math.ceil(totalItemsClient / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + itemsPerPage);

  const recordsList = shouldFetchServer ? internalRecords : paginatedRecords;
  const displayTotalItems = shouldFetchServer ? totalItems : totalItemsClient;
  const displayTotalPages = shouldFetchServer ? totalPages : totalPagesClient;
  const shouldShowEmpty = displayTotalItems === 0;

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Filters section - max 3 fields per row, equal width */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pb-2">
        <div className="w-full">
          <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Search</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search audit trail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-10 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
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
        </div>

        <div className="w-full">
          <Select
            label="Action Type"
            value={actionFilter}
            onChange={(value) => setActionFilter(String(value) as AuditAction | "All")}
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
            enableSearch={true}
            isLoading={isUserOptionsLoading}
            loadingText="Loading users..."
          />
        </div>

        <div className="w-full">
          <Select
            label="E-Signature"
            value={eSignatureFilter}
            onChange={(value) => setESignatureFilter(value as "All" | "Yes" | "No")}
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
            onStartDateChange={setDateFrom}
            onEndDateChange={setDateTo}
            placeholder="Select date range"
            includeTime
          />
        </div>

        <div className="w-full flex items-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setActionFilter("All");
              setUserFilter("");
              setESignatureFilter("All");
              setDateFrom(defaultAuditTrailDateRange.startDate);
              setDateTo(defaultAuditTrailDateRange.endDate);
              setCurrentPage(1);
            }}
            className="h-9 px-4 whitespace-nowrap"
          >
            Clear Filter
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative">
        <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white transition-all duration-300 relative">
          {isLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/40 backdrop-blur-[4px] transition-all duration-300">
              <SectionLoading text="Loading..." minHeight="150px" />
            </div>
          )}
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
                  <EmptyState
                    icon={ShieldAlert}
                    title="Access Denied"
                    description="You don't have permission to view the audit trail for this record."
                  />
                ) : (
                  <EmptyState
                    icon={Search}
                    title="No Audit Records Found"
                    description={loadError || emptyMessage}
                  />
                )}
              </div>
            ) : (
              <table className="w-full min-w-[1600px]">
                <thead className="sticky top-0 z-30">
                  <tr>
                    <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-16">
                      No.
                    </th>
                    {[
                      "Timestamp",
                      "User",
                      "Employee ID",
                      "Role",
                      "Position",
                      "Department",
                      "Action",
                      "Entity",
                      "Change Summary",
                      "E-Signature",
                      "IP Address",
                      "Device / Browser",
                    ].map((label) => (
                      <th
                        key={label}
                        className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap text-left"
                      >
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span className="truncate">{label}</span>
                        </div>
                      </th>
                    ))}
                    <th className="sticky top-0 z-30 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap text-center right-0 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 bg-white">
                  {recordsList.map((record, index) => {
                    const user = record.user;
                    const fullName = user?.fullName || record.fullName || "-";
                    const employeeId = user?.employeeCode || record.userId || "-";
                    const profileId = user?.id || "";
                    const role = user?.role || "-";
                    const position = user?.position || "-";
                    const department = user?.department || "-";
                    const action = record.action || "-";
                    const entity = buildEntityLabel(record);
                    const changeSummary = buildChangeSummary(record);
                    const signature = hasESignature(record) ? "Yes" : "No";
                    const device = record.device || "-";
                    const rowNumber = startIndex + index + 1;

                    return (
                      <tr key={record.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-center text-slate-700 font-medium">
                          {rowNumber}
                        </td>

                        <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                          {formatDateTime(record.timestamp) || "-"}
                        </td>

                        <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                          {fullName}
                        </td>

                        <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
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
                        </td>

                        <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                          {role}
                        </td>

                        <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                          {position}
                        </td>

                        <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                          {department}
                        </td>

                        <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                          <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", getAuditActionBadgeClass(action))}>
                            {formatAuditActionLabel(action)}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                          <div className="max-w-[240px] truncate" title={entity}>
                            {entity}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-xs sm:text-sm text-slate-700">
                          <div className="max-w-[340px] truncate" title={changeSummary}>
                            {changeSummary}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
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
                        </td>

                        <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                          <div className="max-w-[220px] truncate" title={record.ipAddress || "-"}>
                            {record.ipAddress || "-"}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                          <div className="max-w-[260px] truncate" title={device}>
                            {device}
                          </div>
                        </td>

                        <td
                          onClick={(e) => e.stopPropagation()}
                          className="sticky right-0 bg-white py-3 px-4 text-xs sm:text-sm text-center z-30 whitespace-nowrap before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[1px] before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50"
                        >
                          <button
                            ref={getRef(record.id)}
                            onClick={(e) => handleDropdownToggle(record.id, e)}
                            className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-slate-100 transition-colors"
                            aria-label="More actions"
                          >
                            <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {displayTotalItems > 0 && (
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
