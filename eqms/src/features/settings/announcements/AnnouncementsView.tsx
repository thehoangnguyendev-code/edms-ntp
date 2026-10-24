import { ClearFiltersButton } from "@/components/ui/filter/ClearFiltersButton";
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical, Plus, Search, X } from "lucide-react";
import {
  IconFilter2,
  IconPencilMinus,
  IconPower,
  IconTrash,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Select } from "@/components/ui/select/Select";
import {
  DataTable,
  useCustomColumnLayout,
  type DataTableAction,
  type DataTableColumn,
} from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TABLE_STYLES } from "@/components/ui/table/TablePrimitives";
import {
  FullPageLoading,
  SectionLoading,
} from "@/components/ui/loading/Loading";
import {
  FilterDrawer,
  FilterAccordionItem,
} from "@/components/ui/filter/FilterDrawer";
import { FilterOptionButton } from "@/components/ui/filter/FilterOptionButton";
import { ConfiguredDesktopFilters } from "@/components/ui/filter/ConfiguredDesktopFilters";
import { FilterSearchInput } from "@/components/ui/filter/FilterSearchInput";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { FormModal } from "@/components/ui/modal/FormModal";
import { useToast } from "@/components/ui/toast/Toast";
import { useDebounce, usePortalDropdown } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { announcementApi } from "@/services/api/announcements";
import { getApiErrorMessage } from "@/utils/apiError";
import { ROUTES } from "@/app/routes.constants";
import { systemAnnouncements } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import {
  SEVERITY_FILTER_OPTIONS,
  STATE_FILTER_OPTIONS,
  dateToInstant,
  type AnnouncementSortKey,
  type SeverityFilter,
  type StateFilter,
} from "./announcementFilters";
import type { Announcement, AnnouncementState } from "./types";
import { displayDateTime } from "@/utils/format";

const STATE_BADGE: Record<
  AnnouncementState,
  { color: "emerald" | "blue" | "slate" | "amber"; label: string }
> = {
  ACTIVE: { color: "emerald", label: "Active" },
  SCHEDULED: { color: "blue", label: "Scheduled" },
  EXPIRED: { color: "slate", label: "Expired" },
  DISABLED: { color: "amber", label: "Switched off" },
};
const SEVERITY_BADGE = {
  INFO: "blue",
  WARNING: "amber",
  CRITICAL: "red",
} as const;
const SEVERITY_LABEL = {
  INFO: "Information",
  WARNING: "Warning",
  CRITICAL: "Critical",
} as const;
const formatTime = (value?: string) =>
  value ? displayDateTime(value) : "—";

/**
 * System Announcements: the announcements shown to every user after signing in. Search, filters, sorting and paging all run on
 * the server; the columns can be shown, hidden, pinned and reordered per user.
 */
export const AnnouncementsView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["settings.announcement.manage"]);
  const menu = usePortalDropdown();

  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 400);
  const [stateFilter, setStateFilter] = useState<StateFilter>("ALL");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("ALL");
  const [startsFrom, setStartsFrom] = useState("");
  const [startsTo, setStartsTo] = useState("");
  const [endsFrom, setEndsFrom] = useState("");
  const [endsTo, setEndsTo] = useState("");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["state"]),
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: AnnouncementSortKey;
    direction: "asc" | "desc";
  }>({ key: "startsAt", direction: "desc" });

  const [deleting, setDeleting] = useState<Announcement>();
  const [busy, setBusy] = useState(false);
  const actionRow = rows.find((row) => row.id === menu.openId);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    announcementApi
      .list({
        search: debouncedSearch.trim() || undefined,
        state: stateFilter,
        severity: severityFilter,
        startsFrom: dateToInstant(startsFrom, "start"),
        startsTo: dateToInstant(startsTo, "end"),
        endsFrom: dateToInstant(endsFrom, "start"),
        endsTo: dateToInstant(endsTo, "end"),
        page: currentPage,
        limit: itemsPerPage,
        sortBy: sortConfig.key,
        sortDirection: sortConfig.direction,
      })
      .then((page) => {
        if (!active) return;
        setRows(page.data);
        setTotalItems(page.pagination.total);
        setTotalPages(page.pagination.totalPages || 1);
        if (page.pagination.page !== currentPage)
          setCurrentPage(page.pagination.page);
      })
      .catch((e) => {
        if (!active) return;
        setRows([]);
        setTotalItems(0);
        setError(getApiErrorMessage(e, "Unable to load announcements."));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setHasLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [
    currentPage,
    itemsPerPage,
    debouncedSearch,
    stateFilter,
    severityFilter,
    startsFrom,
    startsTo,
    endsFrom,
    endsTo,
    sortConfig,
    reloadKey,
  ]);

  // A different search, filter or page size starts again from the first page.
  useEffect(() => {
    setCurrentPage(1);
  }, [
    debouncedSearch,
    stateFilter,
    severityFilter,
    startsFrom,
    startsTo,
    endsFrom,
    endsTo,
    itemsPerPage,
  ]);

  const toggleSection = (id: string) =>
    setExpandedSections((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clearFilters = () => {
    setSearchQuery("");
    setStateFilter("ALL");
    setSeverityFilter("ALL");
    setStartsFrom("");
    setStartsTo("");
    setEndsFrom("");
    setEndsTo("");
    setCurrentPage(1);
  };

  const handleSort = (key: AnnouncementSortKey) => {
    setSortConfig((previous) => ({
      key,
      direction:
        previous.key === key && previous.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };
  const sort = (key: AnnouncementSortKey) => ({
    direction: sortConfig.key === key ? sortConfig.direction : undefined,
    onSort: () => handleSort(key),
  });

  const toggle = async (row: Announcement) => {
    setBusy(true);
    try {
      await announcementApi.setEnabled(row.id, !row.enabled, row.version);
      showToast({
        type: "success",
        title: row.enabled ? "Switched off" : "Switched on",
        message: row.title,
      });
    } catch (e) {
      const conflict =
        (e as { response?: { status?: number } })?.response?.status === 409;
      showToast({
        type: "error",
        title: "Unable to change",
        message: conflict
          ? "Someone else changed this announcement. The list was reloaded."
          : getApiErrorMessage(e, "The change could not be saved."),
      });
    } finally {
      setBusy(false);
      reload();
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await announcementApi.remove(deleting.id);
      showToast({
        type: "success",
        title: "Announcement deleted",
        message: deleting.title,
      });
      setDeleting(undefined);
      reload();
    } catch (e) {
      showToast({
        type: "error",
        title: "Unable to delete",
        message: getApiErrorMessage(
          e,
          "The announcement could not be deleted.",
        ),
      });
    } finally {
      setBusy(false);
    }
  };

  const isInitialLoading = loading && !hasLoaded;
  const isTableLoading = loading && hasLoaded;

  const columns: DataTableColumn<Announcement>[] = [
    {
      id: "no",
      header: "No.",
      label: "No.",
      locked: true,
      headerClassName: TABLE_STYLES.headerCell35,
      cellClassName: TABLE_STYLES.cell30,
      cell: (_row, index) => (currentPage - 1) * itemsPerPage + index + 1,
    },
    {
      id: "title",
      header: "Announcement",
      label: "Announcement",
      sort: sort("title"),
      cell: (row) => (
        <div className="max-w-96 whitespace-normal">
          {canManage ? (
            <button
              type="button"
              className="text-left font-medium text-emerald-600 hover:underline"
              onClick={() =>
                navigate(ROUTES.SETTINGS.ANNOUNCEMENTS_EDIT(row.id))
              }
            >
              {row.title}
            </button>
          ) : (
            <span className="font-medium text-slate-900">{row.title}</span>
          )}
          <span className="line-clamp-1 block text-xs text-slate-500">
            {row.message}
          </span>
        </div>
      ),
    },
    {
      id: "severity",
      header: "Severity",
      label: "Severity",
      sort: sort("severity"),
      cell: (row) => (
        <Badge color={SEVERITY_BADGE[row.severity]}>
          {SEVERITY_LABEL[row.severity]}
        </Badge>
      ),
    },
    {
      id: "state",
      header: "Status",
      label: "Status",
      sort: sort("state"),
      cell: (row) => (
        <Badge color={STATE_BADGE[row.state].color}>
          {STATE_BADGE[row.state].label}
        </Badge>
      ),
    },
    {
      id: "starts",
      header: "Starts",
      label: "Starts",
      sort: sort("startsAt"),
      cellClassName: "whitespace-nowrap",
      cell: (row) => formatTime(row.startsAt),
    },
    {
      id: "ends",
      header: "Ends",
      label: "Ends",
      sort: sort("endsAt"),
      cellClassName: "whitespace-nowrap",
      cell: (row) => formatTime(row.endsAt),
    },
    {
      id: "updatedAt",
      header: "Updated",
      label: "Updated",
      sort: sort("updatedAt"),
      cellClassName: "whitespace-nowrap",
      cell: (row) => formatTime(row.updatedAt ?? row.createdAt),
    },
    {
      id: "updatedBy",
      header: "Updated by",
      label: "Updated by",
      sort: sort("updatedBy"),
      cell: (row) => row.updatedBy ?? row.createdBy ?? "—",
    },
    {
      id: "createdBy",
      header: "Created by",
      label: "Created by",
      sort: sort("createdBy"),
      cell: (row) => row.createdBy ?? "—",
    },
  ];

  const action: DataTableAction<Announcement> | undefined = canManage
    ? {
        cell: (row) => (
          <button
            type="button"
            ref={menu.getRef(row.id)}
            aria-label="More actions"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8"
            onClick={(event) => menu.toggle(row.id, event)}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        ),
      }
    : undefined;

  const { layout, control } = useCustomColumnLayout(
    "settings.announcements",
    columns,
    action,
  );

  const searchInput = (
    <FilterSearchInput
      aria-label="Search announcements"
      placeholder="Title, message or person…"
      value={searchQuery}
      onChange={setSearchQuery}
    />
  );

  return (
    <div className="flex h-full min-w-0 flex-col gap-4 md:gap-6">
      {isInitialLoading && <FullPageLoading text="Loading announcements..." />}

      <PageHeader
        title="System Announcements"
        breadcrumbItems={systemAnnouncements(navigate)}
        actions={
          canManage ? (
            <Button
              size="sm"
              className="gap-2 whitespace-nowrap"
              onClick={() => navigate(ROUTES.SETTINGS.ANNOUNCEMENTS_NEW)}
            >
              <Plus className="h-4 w-4" />
              New Announcement
            </Button>
          ) : undefined
        }
      />

      <div className="flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-1 flex-col p-4 md:p-5">
          <div className="flex w-full flex-col">
            <div className="mb-4 flex w-full flex-col gap-1.5 md:hidden">
              <label className="block text-xs font-medium text-slate-700 sm:text-sm">
                Search
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search announcements..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="block h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-9 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setIsFilterDrawerOpen(true)}
                  className="h-10 gap-2 whitespace-nowrap"
                >
                  <IconFilter2 className="h-4 w-4" />
                  Filters
                </Button>
              </div>
            </div>

            <ConfiguredDesktopFilters
              search={searchInput}
              trailing={control}
              filters={[
                {
                  id: "state",
                  label: "Status",
                  value: stateFilter,
                  options: STATE_FILTER_OPTIONS,
                  defaultValue: "ALL",
                  onChange: (value) => setStateFilter(value as StateFilter),
                },
                {
                  id: "severity",
                  label: "Severity",
                  value: severityFilter,
                  options: SEVERITY_FILTER_OPTIONS,
                  defaultValue: "ALL",
                  onChange: (value) =>
                    setSeverityFilter(value as SeverityFilter),
                },
              ]}
              dates={[
                {
                  id: "starts",
                  label: "Starts",
                  from: startsFrom,
                  to: startsTo,
                  onFromChange: setStartsFrom,
                  onToChange: setStartsTo,
                },
                {
                  id: "ends",
                  label: "Ends",
                  from: endsFrom,
                  to: endsTo,
                  onFromChange: setEndsFrom,
                  onToChange: setEndsTo,
                },
              ]}
            >
              <div className="hidden items-end gap-4 pb-4 md:grid md:grid-cols-2 md:pb-5 lg:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Title, message or person…"
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <Select
                  label="Status"
                  value={stateFilter}
                  onChange={(value) => setStateFilter(value as StateFilter)}
                  options={STATE_FILTER_OPTIONS}
                  placeholder="All"
                />
                <Select
                  label="Severity"
                  value={severityFilter}
                  onChange={(value) =>
                    setSeverityFilter(value as SeverityFilter)
                  }
                  options={SEVERITY_FILTER_OPTIONS}
                  placeholder="All"
                />
                <DateRangePicker
                  label="Starts"
                  startDate={startsFrom}
                  endDate={startsTo}
                  onStartDateChange={setStartsFrom}
                  onEndDateChange={setStartsTo}
                  placeholder="Select date range"
                />
                <DateRangePicker
                  label="Ends"
                  startDate={endsFrom}
                  endDate={endsTo}
                  onStartDateChange={setEndsFrom}
                  onEndDateChange={setEndsTo}
                  placeholder="Select date range"
                />
                <div className="flex items-end gap-2">
                  <ClearFiltersButton onClearSearch={() => setSearchQuery("")} onClear={clearFilters} />
                  {control}
                </div>
              </div>
            </ConfiguredDesktopFilters>

            <FilterDrawer
              isOpen={isFilterDrawerOpen}
              onClose={() => setIsFilterDrawerOpen(false)}
              onClear={clearFilters}
              onApply={() => setIsFilterDrawerOpen(false)}
            >
              <FilterAccordionItem
                label="Status"
                isExpanded={expandedSections.has("state")}
                onToggle={() => toggleSection("state")}
              >
                <div className="flex flex-wrap gap-2 pb-3">
                  {STATE_FILTER_OPTIONS.map((option) => (
                    <FilterOptionButton
                      key={option.value}
                      label={option.label}
                      isSelected={stateFilter === option.value}
                      onClick={() => setStateFilter(option.value)}
                    />
                  ))}
                </div>
              </FilterAccordionItem>
              <FilterAccordionItem
                label="Severity"
                isExpanded={expandedSections.has("severity")}
                onToggle={() => toggleSection("severity")}
              >
                <div className="flex flex-wrap gap-2 pb-3">
                  {SEVERITY_FILTER_OPTIONS.map((option) => (
                    <FilterOptionButton
                      key={option.value}
                      label={option.label}
                      isSelected={severityFilter === option.value}
                      onClick={() => setSeverityFilter(option.value)}
                    />
                  ))}
                </div>
              </FilterAccordionItem>
              <FilterAccordionItem
                label="Starts"
                isExpanded={expandedSections.has("starts")}
                onToggle={() => toggleSection("starts")}
              >
                <div className="pb-4 pt-2">
                  <DateRangePicker
                    label="Starts"
                    startDate={startsFrom}
                    endDate={startsTo}
                    onStartDateChange={setStartsFrom}
                    onEndDateChange={setStartsTo}
                    placeholder="Select date range"
                  />
                </div>
              </FilterAccordionItem>
              <FilterAccordionItem
                label="Ends"
                isExpanded={expandedSections.has("ends")}
                onToggle={() => toggleSection("ends")}
              >
                <div className="pb-4 pt-2">
                  <DateRangePicker
                    label="Ends"
                    startDate={endsFrom}
                    endDate={endsTo}
                    onStartDateChange={setEndsFrom}
                    onEndDateChange={setEndsTo}
                    placeholder="Select date range"
                  />
                </div>
              </FilterAccordionItem>
            </FilterDrawer>
          </div>

          <div className="relative flex flex-1 flex-col">
            {isTableLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/40 backdrop-blur-[4px] transition-all duration-300">
                <SectionLoading text="Searching..." minHeight="150px" />
              </div>
            )}
            <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-300">
              <DataTable
                rows={rows}
                getRowKey={(row) => row.id}
                columns={layout.columns}
                columnLayout={layout}
                action={action}
                isLoading={loading}
                emptyState={
                  <TableEmptyState
                    title={
                      error
                        ? "Unable to load announcements"
                        : "No Announcements Found"
                    }
                    description={
                      error ||
                      "Announcements shown to users after sign-in appear here. Try changing your search or filters."
                    }
                  />
                }
                pagination={
                  totalItems > 0 ? (
                    <div className="border-t border-slate-200">
                      <TablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        isLoading={isTableLoading}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                        itemsPerPageOptions={[10, 20, 50]}
                      />
                    </div>
                  ) : undefined
                }
              />
            </div>
          </div>
        </div>
      </div>

      <PortalDropdownMenu
        isOpen={!!actionRow}
        onClose={menu.close}
        position={menu.position}
        minWidth={200}
      >
        {actionRow && (
          <div className="py-1">
            <DropdownMenuItem
              icon={<IconPencilMinus className="h-4 w-4" />}
              onClick={() => {
                navigate(ROUTES.SETTINGS.ANNOUNCEMENTS_EDIT(actionRow.id));
                menu.close();
              }}
            >
              Edit Announcement
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<IconPower className="h-4 w-4" />}
              disabled={busy || actionRow.state === "EXPIRED"}
              onClick={() => {
                void toggle(actionRow);
                menu.close();
              }}
            >
              {actionRow.enabled ? "Switch off" : "Switch on"}
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<IconTrash className="h-4 w-4" />}
              onClick={() => {
                setDeleting(actionRow);
                menu.close();
              }}
            >
              Delete
            </DropdownMenuItem>
          </div>
        )}
      </PortalDropdownMenu>

      <FormModal
        isOpen={!!deleting}
        onClose={() => setDeleting(undefined)}
        title="Delete Announcement"
        description={`Delete “${deleting?.title ?? ""}”? Users will no longer see it. The deletion is recorded in the audit trail.`}
        confirmText="Delete"
        confirmVariant="destructive"
        isLoading={busy}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
};
