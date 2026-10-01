import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { MoreVertical, Search, X } from "lucide-react";
import {
  IconDownload,
  IconEye,
  IconFileCheck,
  IconFilter2,
  IconInfoCircle,
  IconShare3,
  IconThumbDown,
  IconThumbUp,
  IconX,
} from "@tabler/icons-react";
import { ROUTES } from "@/app/routes.constants";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Select } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import {
  FilterDrawer,
  FilterAccordionItem,
} from "@/components/ui/filter/FilterDrawer";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { uncontrolledCopies as uncontrolledCopiesBreadcrumbs } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { cn } from "@/components/ui/utils";
import { CopyDesktopFilters } from '@/components/ui/filter/CopyDesktopFilters';
import { useBranding } from '@/components/branding/BrandLogo';
import {
  useDebounce,
  useNavigateWithLoading,
  usePortalDropdown,
  useTableDragScroll,
} from "@/hooks";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { formatDateTime } from "@/utils/format";
import { formatDocumentDisplayLabel } from "@/features/documents/shared/documentDisplay";
import { getStatusBadgeColor } from "@/utils/status";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import {
  uncontrolledCopyApi,
  type UncontrolledCopy,
} from "@/services/api/uncontrolledCopy";
import { useUncontrolledCopyActions } from "./useUncontrolledCopyActions";

export type UncontrolledCopiesViewType = "all" | "pending" | "distributed";

const VIEW_TITLES: Record<UncontrolledCopiesViewType, string> = {
  all: "All Uncontrolled Copies",
  pending: "Pending Approval",
  distributed: "Distributed Uncontrolled Copies",
};

/** Machine status code each fixed tab filters on (the "all" tab uses the user's status filter). */
const VIEW_STATUS: Record<UncontrolledCopiesViewType, string | undefined> = {
  all: undefined,
  pending: "REQUESTED",
  distributed: "DISTRIBUTED",
};

type UncontrolledCopySortKey =
  | "created"
  | "number"
  | "document"
  | "status"
  | "validUntil"
  | "requested"
  | "approved"
  | "distributed";

/** DateRangePicker yields dd/MM/yyyy[ HH:mm:ss]; the API filter takes yyyy-MM-dd. */
const toIsoDate = (value: string) => {
  const match = value?.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
};

const formatOptional = (value?: string | null) =>
  value ? formatDateTime(value) : "-";

/**
 * Uncontrolled Copies register. Mirrors ControlledCopiesView's list/filter/table shape, minus the batch rows and
 * the recall / reconciliation / expiry-date columns that do not apply to an untracked reference copy.
 */
export const UncontrolledCopiesView: React.FC<{
  viewType?: UncontrolledCopiesViewType;
}> = ({ viewType = "all" }) => {
  const { compactDesktopFilters = false } = useBranding();
  const { navigateTo } = useNavigateWithLoading();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<UncontrolledCopy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState(
    () => searchParams.get("search") ?? "",
  );
  const debouncedSearch = useDebounce(searchQuery, 400);
  const [statusFilter, setStatusFilter] = useState(
    () => searchParams.get("status") ?? "ALL",
  );
  const [statusOptions, setStatusOptions] = useState<
    { label: string; value: string }[]
  >([{ label: "All States", value: "ALL" }]);
  const [createdFrom, setCreatedFrom] = useState(
    () => searchParams.get("createdFrom") ?? "",
  );
  const [createdTo, setCreatedTo] = useState(
    () => searchParams.get("createdTo") ?? "",
  );
  const [validFrom, setValidFrom] = useState(
    () => searchParams.get("validFrom") ?? "",
  );
  const [validTo, setValidTo] = useState(
    () => searchParams.get("validTo") ?? "",
  );
  const [approvedFrom, setApprovedFrom] = useState(
    () => searchParams.get("approvedFrom") ?? "",
  );
  const [approvedTo, setApprovedTo] = useState(
    () => searchParams.get("approvedTo") ?? "",
  );
  const [distributedFrom, setDistributedFrom] = useState(
    () => searchParams.get("distributedFrom") ?? "",
  );
  const [distributedTo, setDistributedTo] = useState(
    () => searchParams.get("distributedTo") ?? "",
  );
  const [currentPage, setCurrentPage] = useState(() =>
    Math.max(1, Number(searchParams.get("page")) || 1),
  );
  const [itemsPerPage, setItemsPerPage] = useState(() =>
    Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20)),
  );
  const [sortConfig, setSortConfig] = useState<{
    key: UncontrolledCopySortKey;
    direction: "asc" | "desc";
  }>({
    key: (searchParams.get("sortBy") as UncontrolledCopySortKey) ?? "created",
    direction: searchParams.get("sortDirection") === "asc" ? "asc" : "desc",
  });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["status", "dates"]),
  );
  const toggleSection = (section: string) =>
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });

  useLayoutEffect(() => {
    setSearchQuery(searchParams.get("search") ?? "");
    setStatusFilter(searchParams.get("status") ?? "ALL");
    setCreatedFrom(searchParams.get("createdFrom") ?? "");
    setCreatedTo(searchParams.get("createdTo") ?? "");
    setValidFrom(searchParams.get("validFrom") ?? "");
    setValidTo(searchParams.get("validTo") ?? "");
    setApprovedFrom(searchParams.get("approvedFrom") ?? "");
    setApprovedTo(searchParams.get("approvedTo") ?? "");
    setDistributedFrom(searchParams.get("distributedFrom") ?? "");
    setDistributedTo(searchParams.get("distributedTo") ?? "");
    setCurrentPage(Math.max(1, Number(searchParams.get("page")) || 1));
    setItemsPerPage(
      Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20)),
    );
    setSortConfig({
      key: (searchParams.get("sortBy") as UncontrolledCopySortKey) ?? "created",
      direction: searchParams.get("sortDirection") === "asc" ? "asc" : "desc",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (searchQuery !== debouncedSearch) return;
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (viewType === "all" && statusFilter !== "ALL")
      params.set("status", statusFilter);
    if (createdFrom) params.set("createdFrom", createdFrom);
    if (createdTo) params.set("createdTo", createdTo);
    if (validFrom) params.set("validFrom", validFrom);
    if (validTo) params.set("validTo", validTo);
    if (approvedFrom) params.set("approvedFrom", approvedFrom);
    if (approvedTo) params.set("approvedTo", approvedTo);
    if (distributedFrom) params.set("distributedFrom", distributedFrom);
    if (distributedTo) params.set("distributedTo", distributedTo);
    if (sortConfig.key !== "created") params.set("sortBy", sortConfig.key);
    if (sortConfig.direction !== "desc")
      params.set("sortDirection", sortConfig.direction);
    if (currentPage > 1) params.set("page", String(currentPage));
    if (itemsPerPage !== 20) params.set("limit", String(itemsPerPage));
    if (params.toString() !== searchParams.toString())
      setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchQuery,
    debouncedSearch,
    statusFilter,
    createdFrom,
    createdTo,
    validFrom,
    validTo,
    approvedFrom,
    approvedTo,
    distributedFrom,
    distributedTo,
    sortConfig,
    currentPage,
    itemsPerPage,
    viewType,
  ]);

  const handleSort = (key: UncontrolledCopySortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };

  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  // Refetch this page (server-side filters/sort/pagination stay exactly as-is) whenever anyone's
  // action changes a record this list would show -- same realtime pattern ControlledCopiesView
  // already uses.
  useEntityChanged(["UNCONTROLLED_COPY"], reload, { debounceMs: 1200 });
  const { runAction, distributeBatch, openFile, busyId, signatureModal } =
    useUncontrolledCopyActions(reload);

  useEffect(() => {
    uncontrolledCopyApi
      .getUncontrolledCopyFilters()
      .then((filters) =>
        setStatusOptions([
          { label: "All States", value: "ALL" },
          ...filters.statuses.map((s) => ({ label: s.label, value: s.code })),
        ]),
      )
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [viewType]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const status =
      VIEW_STATUS[viewType] ??
      (statusFilter !== "ALL" ? statusFilter : undefined);
    uncontrolledCopyApi
      .getUncontrolledCopies({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch.trim() || undefined,
        status,
        createdFrom: toIsoDate(createdFrom),
        createdTo: toIsoDate(createdTo),
        validFrom: toIsoDate(validFrom),
        validTo: toIsoDate(validTo),
        approvedFrom: toIsoDate(approvedFrom),
        approvedTo: toIsoDate(approvedTo),
        distributedFrom: toIsoDate(distributedFrom),
        distributedTo: toIsoDate(distributedTo),
        sortBy: sortConfig.key,
        sortDirection: sortConfig.direction,
      })
      .then((page) => {
        if (!active) return;
        setRows(page.data ?? []);
        setTotalItems(page.pagination?.total ?? 0);
        setTotalPages(Math.max(page.pagination?.totalPages ?? 1, 1));
      })
      .catch((err) => {
        if (!active) return;
        setRows([]);
        setError(extractApiMessage(err, "Unable to load uncontrolled copies."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    viewType,
    statusFilter,
    debouncedSearch,
    createdFrom,
    createdTo,
    validFrom,
    validTo,
    approvedFrom,
    approvedTo,
    distributedFrom,
    distributedTo,
    currentPage,
    itemsPerPage,
    sortConfig,
    reloadKey,
  ]);

  const distributable = useMemo(
    () => rows.filter((r) => r.capabilities.canDistribute),
    [rows],
  );
  const selectedRows = useMemo(
    () =>
      rows.filter((r) => selectedIds.has(r.id) && r.capabilities.canDistribute),
    [rows, selectedIds],
  );
  const showSelection = distributable.length > 0;

  const toggleSelected = (id: string, checked: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setCreatedFrom("");
    setCreatedTo("");
    setValidFrom("");
    setValidTo("");
    setApprovedFrom("");
    setApprovedTo("");
    setDistributedFrom("");
    setDistributedTo("");
    setCurrentPage(1);
  };

  const openCopy = openId ? rows.find((r) => r.id === openId) : undefined;
  const sort = (key: UncontrolledCopySortKey) => ({
    direction: sortConfig.key === key ? sortConfig.direction : undefined,
    onSort: () => handleSort(key),
  });
  const columns: DataTableColumn<UncontrolledCopy>[] = [
    {
      id: "rowNumber",
      header: "No.",
      headerClassName: "w-16",
      cell: (_, index) => (currentPage - 1) * itemsPerPage + index + 1,
    },
    {
      id: "number",
      header: "Document Number",
      sort: sort("number"),
      cell: (copy) => (
        <button
          type="button"
          onClick={() =>
            navigateTo(ROUTES.DOCUMENTS.UNCONTROLLED_COPIES.DETAIL(copy.id), {
              state: { from: `${location.pathname}${location.search}` },
            })
          }
          className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline text-left"
        >
          {copy.uncontrolledCopyNumber}
        </button>
      ),
    },
    {
      id: "document",
      header: "Document Name",
      sort: sort("document"),
      cellClassName: "font-medium text-slate-900",
      cell: (copy) =>
        formatDocumentDisplayLabel(copy.documentNumber, copy.documentTitle),
    },
    {
      id: "revision",
      header: "Document Revision",
      cellClassName: "font-medium text-slate-900",
      cell: (copy) =>
        [copy.documentTitle, copy.revisionNumber].filter(Boolean).join("_") ||
        "-",
    },
    {
      id: "recipient",
      header: "Recipient",
      cell: (copy) =>
        copy.externalRecipient
          ? `${copy.externalRecipient} (via ${copy.recipientName || copy.recipientEmail || "-"})`
          : copy.recipientName || copy.recipientEmail || "-",
    },
    {
      id: "requestedBy",
      header: "Requested By",
      cell: (copy) => copy.requestedByName || "-",
    },
    {
      id: "requestedAt",
      header: "Requested Date",
      sort: sort("requested"),
      cell: (copy) => formatOptional(copy.requestedAt),
    },
    {
      id: "approvedBy",
      header: "Approved By",
      cell: (copy) => copy.approvedByName || "-",
    },
    {
      id: "approvedAt",
      header: "Approved Date",
      sort: sort("approved"),
      cell: (copy) => formatOptional(copy.approvedAt),
    },
    {
      id: "distributedBy",
      header: "Distributed By",
      cell: (copy) => copy.distributedByName || "-",
    },
    {
      id: "distributedAt",
      header: "Distributed Date",
      sort: sort("distributed"),
      cell: (copy) => formatOptional(copy.distributedAt),
    },
    {
      id: "downloads",
      header: "Downloads",
      cell: (copy) => (copy.downloadCount > 0 ? `${copy.downloadCount}x` : "-"),
    },
    {
      id: "status",
      header: "Status",
      sort: sort("status"),
      cell: (copy) => (
        <Badge
          color={getStatusBadgeColor(copy.status, copy.statusCode) ?? "slate"}
        >
          {copy.status}
        </Badge>
      ),
    },
    {
      id: "validUntil",
      header: "Valid Until",
      sort: sort("validUntil"),
      cell: (copy) => formatOptional(copy.validUntil),
    },
  ];

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6 w-full flex-1">
      <PageHeader
        title={VIEW_TITLES[viewType]}
        breadcrumbItems={uncontrolledCopiesBreadcrumbs(navigateTo, viewType)}
        actions={
          selectedRows.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="whitespace-nowrap gap-1.5"
              onClick={() => distributeBatch(selectedRows)}
            >
              <IconShare3 className="h-4 w-4" />
              Distribute Selected ({selectedRows.length})
            </Button>
          ) : undefined
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col">
        <div className="p-4 md:p-5 flex-1 flex flex-col">
          <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
            <label className="text-xs sm:text-sm font-medium text-slate-700 block">
              Search
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Copy #, document #, title, reason..."
                  className="w-full h-10 pl-10 pr-9 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400 bg-white"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400"
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

          {compactDesktopFilters && <CopyDesktopFilters
            search={<input aria-label="Search uncontrolled copies" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} placeholder="Search uncontrolled copies..." className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm" />}
            status={viewType === 'all' ? statusFilter : VIEW_STATUS[viewType] ?? 'ALL'} statusOptions={statusOptions}
            statusLocked={viewType !== 'all'} allStatus="ALL"
            dates={[
              { id: 'created', label: 'Requested Date Range', from: createdFrom, to: createdTo },
              { id: 'valid', label: 'Valid Until Date Range', from: validFrom, to: validTo },
              { id: 'approved', label: 'Approved Date Range', from: approvedFrom, to: approvedTo },
              { id: 'distributed', label: 'Distributed Date Range', from: distributedFrom, to: distributedTo },
            ]}
            onApply={draft => {
              if (viewType === 'all') setStatusFilter(draft.status);
              setCreatedFrom(draft.createdFrom); setCreatedTo(draft.createdTo);
              setValidFrom(draft.validFrom); setValidTo(draft.validTo);
              setApprovedFrom(draft.approvedFrom); setApprovedTo(draft.approvedTo);
              setDistributedFrom(draft.distributedFrom); setDistributedTo(draft.distributedTo);
              setCurrentPage(1);
            }} />}
          <div className={cn("hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-end pb-4 md:pb-5", compactDesktopFilters && "md:!hidden")}>
            <div>
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Copy #, document #, title, reason..."
                  className="w-full h-9 pl-10 pr-9 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400 bg-white"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
                Status
              </label>
              <Select
                value={
                  viewType === "all"
                    ? statusFilter
                    : (VIEW_STATUS[viewType] ?? "ALL")
                }
                onChange={(value) => {
                  setStatusFilter(String(value));
                  setCurrentPage(1);
                }}
                options={statusOptions}
                placeholder="All States"
                disabled={viewType !== "all"}
              />
            </div>
            <div>
              <DateRangePicker
                label="Requested Date Range"
                startDate={createdFrom}
                endDate={createdTo}
                onStartDateChange={(val) => {
                  setCreatedFrom(val);
                  setCurrentPage(1);
                }}
                onEndDateChange={(val) => {
                  setCreatedTo(val);
                  setCurrentPage(1);
                }}
                placeholder="Select date range"
              />
            </div>
            <div>
              <DateRangePicker
                label="Valid Until Date Range"
                startDate={validFrom}
                endDate={validTo}
                onStartDateChange={(val) => {
                  setValidFrom(val);
                  setCurrentPage(1);
                }}
                onEndDateChange={(val) => {
                  setValidTo(val);
                  setCurrentPage(1);
                }}
                placeholder="Select date range"
              />
            </div>
            <div>
              <DateRangePicker
                label="Approved Date Range"
                startDate={approvedFrom}
                endDate={approvedTo}
                onStartDateChange={(val) => {
                  setApprovedFrom(val);
                  setCurrentPage(1);
                }}
                onEndDateChange={(val) => {
                  setApprovedTo(val);
                  setCurrentPage(1);
                }}
                placeholder="Select date range"
              />
            </div>
            <div>
              <DateRangePicker
                label="Distributed Date Range"
                startDate={distributedFrom}
                endDate={distributedTo}
                onStartDateChange={(val) => {
                  setDistributedFrom(val);
                  setCurrentPage(1);
                }}
                onEndDateChange={(val) => {
                  setDistributedTo(val);
                  setCurrentPage(1);
                }}
                placeholder="Select date range"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="h-9 px-4 gap-2 font-medium hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap"
              >
                Clear Filters
              </Button>
            </div>
          </div>

          <FilterDrawer
            isOpen={isFilterDrawerOpen}
            onClose={() => setIsFilterDrawerOpen(false)}
            onClear={clearFilters}
            onApply={() => setIsFilterDrawerOpen(false)}
          >
            <FilterAccordionItem
              label="Status"
              isExpanded={expandedSections.has("status")}
              onToggle={() => toggleSection("status")}
              disabled={viewType !== "all"}
            >
              <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
                {(viewType === "all"
                  ? statusOptions
                  : statusOptions.filter(
                      (opt) => opt.value === VIEW_STATUS[viewType],
                    )
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setStatusFilter(opt.value);
                      setCurrentPage(1);
                    }}
                    className={cn(
                      "text-left px-3 py-2 rounded-lg text-sm border transition-colors",
                      statusFilter === opt.value
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-medium"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </FilterAccordionItem>
            <FilterAccordionItem
              label="Requested Date Range"
              isExpanded={expandedSections.has("dates")}
              onToggle={() => toggleSection("dates")}
            >
              <div className="pt-1 pb-4">
                <DateRangePicker
                  startDate={createdFrom}
                  endDate={createdTo}
                  onStartDateChange={(val) => {
                    setCreatedFrom(val);
                    setCurrentPage(1);
                  }}
                  onEndDateChange={(val) => {
                    setCreatedTo(val);
                    setCurrentPage(1);
                  }}
                  placeholder="Select date range"
                />
              </div>
            </FilterAccordionItem>
            <FilterAccordionItem
              label="Approved Date Range"
              isExpanded={expandedSections.has("approvedDates")}
              onToggle={() => toggleSection("approvedDates")}
            >
              <div className="pt-1 pb-4">
                <DateRangePicker
                  startDate={approvedFrom}
                  endDate={approvedTo}
                  onStartDateChange={(val) => {
                    setApprovedFrom(val);
                    setCurrentPage(1);
                  }}
                  onEndDateChange={(val) => {
                    setApprovedTo(val);
                    setCurrentPage(1);
                  }}
                  placeholder="Select date range"
                />
              </div>
            </FilterAccordionItem>
            <FilterAccordionItem
              label="Distributed Date Range"
              isExpanded={expandedSections.has("distributedDates")}
              onToggle={() => toggleSection("distributedDates")}
            >
              <div className="pt-1 pb-4">
                <DateRangePicker
                  startDate={distributedFrom}
                  endDate={distributedTo}
                  onStartDateChange={(val) => {
                    setDistributedFrom(val);
                    setCurrentPage(1);
                  }}
                  onEndDateChange={(val) => {
                    setDistributedTo(val);
                    setCurrentPage(1);
                  }}
                  placeholder="Select date range"
                />
              </div>
            </FilterAccordionItem>
            <FilterAccordionItem
              label="Valid Until Date Range"
              isExpanded={expandedSections.has("validDates")}
              onToggle={() => toggleSection("validDates")}
            >
              <div className="pt-1 pb-4">
                <DateRangePicker
                  startDate={validFrom}
                  endDate={validTo}
                  onStartDateChange={(val) => {
                    setValidFrom(val);
                    setCurrentPage(1);
                  }}
                  onEndDateChange={(val) => {
                    setValidTo(val);
                    setCurrentPage(1);
                  }}
                  placeholder="Select date range"
                />
              </div>
            </FilterAccordionItem>
          </FilterDrawer>

          <div className="flex-1 flex flex-col relative">
            <DataTable
              rows={rows}
              columns={columns}
              getRowKey={(copy) => copy.id}
              isLoading={loading}
              loadingContent={
                <SectionLoading text="Loading uncontrolled copies..." />
              }
              emptyState={
                <TableEmptyState
                  title={
                    error
                      ? "Unable to load uncontrolled copies"
                      : "No Uncontrolled Copies Found"
                  }
                  description={
                    error || "No uncontrolled copies match your filters."
                  }
                />
              }
              scrollerRef={scrollerRef}
              scrollProps={dragEvents}
              isDragging={isDragging}
              selection={{
                visible: showSelection,
                cell: (copy) =>
                  copy.capabilities.canDistribute ? (
                    <Checkbox
                      checked={selectedIds.has(copy.id)}
                      onChange={(checked) => toggleSelected(copy.id, checked)}
                    />
                  ) : null,
              }}
              action={{
                cell: (copy) => (
                  <button
                    ref={getRef(copy.id)}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggle(copy.id, event);
                    }}
                    disabled={busyId === copy.id}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50 md:h-8 md:w-8"
                    aria-label="More actions"
                  >
                    <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </button>
                ),
              }}
              pagination={
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(value) => {
                    setItemsPerPage(value);
                    setCurrentPage(1);
                  }}
                />
              }
            />
          </div>
        </div>
      </div>

      {openCopy && (
        <PortalDropdownMenu
          isOpen
          onClose={close}
          position={position}
          minWidth={200}
        >
          <div className="py-1">
            <DropdownMenuItem
              icon={<IconInfoCircle className="h-4 w-4" />}
              onClick={() => {
                navigateTo(
                  ROUTES.DOCUMENTS.UNCONTROLLED_COPIES.DETAIL(openCopy.id),
                  {
                    state: { from: `${location.pathname}${location.search}` },
                  },
                );
                close();
              }}
            >
              View Details
            </DropdownMenuItem>
            {openCopy.capabilities.canApprove && (
              <DropdownMenuItem
                icon={<IconThumbUp className="h-4 w-4" />}
                onClick={() => {
                  void runAction(openCopy, "approve");
                  close();
                }}
              >
                Approve
              </DropdownMenuItem>
            )}
            {openCopy.capabilities.canReject && (
              <DropdownMenuItem
                icon={<IconThumbDown className="h-4 w-4" />}
                onClick={() => {
                  void runAction(openCopy, "reject");
                  close();
                }}
              >
                Reject
              </DropdownMenuItem>
            )}
            {openCopy.capabilities.canGenerate && (
              <DropdownMenuItem
                icon={<IconFileCheck className="h-4 w-4" />}
                onClick={() => {
                  void runAction(openCopy, "generate");
                  close();
                }}
              >
                Generate Copy
              </DropdownMenuItem>
            )}
            {openCopy.capabilities.canDistribute && (
              <DropdownMenuItem
                icon={<IconShare3 className="h-4 w-4" />}
                onClick={() => {
                  void runAction(openCopy, "distribute");
                  close();
                }}
              >
                Distribute
              </DropdownMenuItem>
            )}
            {openCopy.capabilities.canPreview && (
              <DropdownMenuItem
                icon={<IconEye className="h-4 w-4" />}
                onClick={() => {
                  void openFile(openCopy, "preview");
                  close();
                }}
              >
                Preview
              </DropdownMenuItem>
            )}
            {openCopy.capabilities.canDownload && (
              <DropdownMenuItem
                icon={<IconDownload className="h-4 w-4" />}
                onClick={() => {
                  void openFile(openCopy, "download");
                  close();
                }}
              >
                Download
              </DropdownMenuItem>
            )}
            {openCopy.capabilities.canCancel && (
              <DropdownMenuItem
                icon={<IconX className="h-4 w-4" />}
                onClick={() => {
                  void runAction(openCopy, "cancel");
                  close();
                }}
              >
                Cancel Request
              </DropdownMenuItem>
            )}
          </div>
        </PortalDropdownMenu>
      )}

      {signatureModal}
    </div>
  );
};
