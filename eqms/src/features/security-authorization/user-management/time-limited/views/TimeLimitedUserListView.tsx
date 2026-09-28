import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical, Search, X, ChevronUp, ChevronDown, Plus } from "lucide-react";
import { IconBan, IconFilter2, IconInfoCircle, IconPencilMinus, IconX } from "@tabler/icons-react";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Select } from "@/components/ui/select/Select";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { usePortalDropdown } from "@/hooks";
import { cn } from "@/components/ui/utils";
import { authApi } from "@/services/api/auth";
import { settingsApi } from "@/services/api/settings";
import { formatDateTime } from "@/utils/format";
import { ROUTES } from "@/app/routes.constants";
import { timeLimitedUsers } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { useDictionaryServerTable } from "@/features/settings/dictionaries/hooks/useDictionaryServerTable";
import type { TimeLimitedUserGrant } from "../../types";

const COLUMNS: { id: string; label: string; sortable: boolean }[] = [
  { id: "fullName", label: "Full Name", sortable: true },
  { id: "username", label: "Username", sortable: true },
  { id: "email", label: "Email", sortable: true },
  { id: "startDate", label: "Start Date", sortable: true },
  { id: "endDate", label: "End Date", sortable: true },
  { id: "windowState", label: "Status", sortable: false },
  { id: "notifyEmailOnExpiry", label: "Notify on Expiry", sortable: false },
  { id: "createdAt", label: "Created", sortable: true },
];

const WINDOW_STATE_LABEL: Record<string, { label: string; color: "emerald" | "amber" | "slate" | "rose" }> = {
  PENDING: { label: "Pending", color: "amber" },
  IN_WINDOW: { label: "Active", color: "emerald" },
  EXPIRED: { label: "Expired", color: "slate" },
  CANCELLED: { label: "Cancelled", color: "rose" },
};

/**
 * "Time-Limited User" admin screen -- restricts a user account to being login-eligible only
 * within a chosen date range, with an optional expiry e-mail. Mirrors Logged in Users/User
 * Management's search/table/pagination UI exactly; all filtering/search (debounced)/sort/
 * pagination happen server-side (GET /settings/users/time-limited-grants). One row per grant --
 * selecting several users in one "Create New" submission never merges into a single row.
 */
export const TimeLimitedUserListView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canEdit = hasPermissionAlias("settings.user.edit");
  const { openId: openDropdownId, position: dropdownPosition, getRef, toggle: handleDropdownToggle, close: closeDropdown } = usePortalDropdown();

  // dd/MM/yyyy (DateRangePicker's own format) -> yyyy-MM-dd (what the server expects) -- same
  // convention as User Management/Logged in Users' date-range filters.
  const toApiDate = (value: string) => {
    if (!value) return "";
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return value;
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  };

  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [startDateFrom, setStartDateFrom] = useState("");
  const [startDateTo, setStartDateTo] = useState("");
  const [endDateFrom, setEndDateFrom] = useState("");
  const [endDateTo, setEndDateTo] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["status", "startDate", "endDate", "created"]),
  );
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const {
    searchQuery, setSearchQuery, currentPage, setCurrentPage, itemsPerPage, setItemsPerPage,
    totalPages, totalItems, items, isLoading, sortConfig, handleSort, reload,
  } = useDictionaryServerTable<TimeLimitedUserGrant>({
    fetcher: settingsApi.getTimeLimitedUserGrants,
    defaultSortBy: "createdAt",
    defaultSortDirection: "desc",
    extraParams: {
      status: statusFilter !== "All" ? statusFilter : undefined,
      startDateFrom: startDateFrom || undefined,
      startDateTo: startDateTo || undefined,
      endDateFrom: endDateFrom || undefined,
      endDateTo: endDateTo || undefined,
      createdFrom: createdFrom || undefined,
      createdTo: createdTo || undefined,
    },
  });

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setStartDateFrom("");
    setStartDateTo("");
    setEndDateFrom("");
    setEndDateTo("");
    setCreatedFrom("");
    setCreatedTo("");
    setCurrentPage(1);
  };

  const [cancelModal, setCancelModal] = useState<{ isOpen: boolean; grantId: string; userName: string }>({
    isOpen: false,
    grantId: "",
    userName: "",
  });

  const handleViewDetail = (grant: TimeLimitedUserGrant) => {
    navigate(ROUTES.SECURITY.TIME_LIMITED_USERS_DETAIL(grant.id));
    closeDropdown();
  };

  const handleEdit = (grant: TimeLimitedUserGrant) => {
    navigate(ROUTES.SECURITY.TIME_LIMITED_USERS_EDIT(grant.id));
    closeDropdown();
  };

  const handleCancel = (grant: TimeLimitedUserGrant) => {
    setCancelModal({ isOpen: true, grantId: grant.id, userName: grant.fullName });
    closeDropdown();
  };

  const confirmCancel = async (data: { username: string; password: string; reason: string }) => {
    if (!cancelModal.grantId) return;
    const signatureResponse = await authApi.verifyESignature({ username: data.username, password: data.password });
    await settingsApi.cancelTimeLimitedUserGrant(cancelModal.grantId, {
      reason: data.reason,
      signatureToken: signatureResponse.signatureToken,
    });
    reload();
    showToast({
      type: "success",
      title: "Grant Cancelled",
      message: `Time-limited access for ${cancelModal.userName} has been cancelled.`,
    });
    setCancelModal({ isOpen: false, grantId: "", userName: "" });
  };

  const startIndex = (currentPage - 1) * itemsPerPage;
  const activeGrant = items.find((g) => g.id === openDropdownId);

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title="Time-Limited User"
        breadcrumbItems={timeLimitedUsers(navigate)}
        actions={
          canEdit && (
            <Button
              size="sm"
              onClick={() => navigate(ROUTES.SECURITY.TIME_LIMITED_USERS_NEW)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              New
            </Button>
          )
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col">
        {/* Filter Section */}
        <div className="px-4 pt-4 md:p-5 flex flex-col">
          <div className="px-1.5 -mx-1.5 pb-1.5 -mb-1.5">
            <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
              <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search name, username, email..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="block w-full pl-10 pr-9 h-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(""); setCurrentPage(1); }} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400">
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

            <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              <div className="w-full lg:col-span-1">
                <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block transition-colors">Search</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors">
                    <Search className="h-4 w-4 text-slate-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search name, username, email..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="block w-full pl-10 pr-10 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <Select
                label="Status"
                value={statusFilter}
                onChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}
                options={[
                  { label: "All Status", value: "All" },
                  { label: "Active", value: "ACTIVE" },
                  { label: "Cancelled", value: "CANCELLED" },
                  { label: "Expired", value: "EXPIRED" },
                ]}
              />

              <DateRangePicker
                label="Start Date Range"
                startDate={startDateFrom}
                endDate={startDateTo}
                onStartDateChange={(value) => setStartDateFrom(toApiDate(value))}
                onEndDateChange={(value) => setStartDateTo(toApiDate(value))}
                onApply={({ startDate, endDate }) => {
                  setStartDateFrom(toApiDate(startDate));
                  setStartDateTo(toApiDate(endDate));
                  setCurrentPage(1);
                }}
                placeholder="Select date range"
              />

              <DateRangePicker
                label="End Date Range"
                startDate={endDateFrom}
                endDate={endDateTo}
                onStartDateChange={(value) => setEndDateFrom(toApiDate(value))}
                onEndDateChange={(value) => setEndDateTo(toApiDate(value))}
                onApply={({ startDate, endDate }) => {
                  setEndDateFrom(toApiDate(startDate));
                  setEndDateTo(toApiDate(endDate));
                  setCurrentPage(1);
                }}
                placeholder="Select date range"
              />

              <DateRangePicker
                label="Created Range"
                startDate={createdFrom}
                endDate={createdTo}
                onStartDateChange={(value) => setCreatedFrom(toApiDate(value))}
                onEndDateChange={(value) => setCreatedTo(toApiDate(value))}
                onApply={({ startDate, endDate }) => {
                  setCreatedFrom(toApiDate(startDate));
                  setCreatedTo(toApiDate(endDate));
                  setCurrentPage(1);
                }}
                placeholder="Select date range"
              />

              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="h-9 px-4 gap-2 font-medium transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="px-4 md:px-5 pb-4 md:pb-5 flex-1 flex flex-col relative">
          {isLoading && (
            <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center transition-all duration-300">
              <SectionLoading text="Searching..." minHeight="150px" />
            </div>
          )}

          <div className={cn("border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white transition-all duration-300", isLoading && "blur-[2px] opacity-80")}>
            {items.length > 0 ? (
              <>
                <div className="flex-1 overflow-x-auto overflow-y-hidden">
                  <table className="w-full min-w-max border-spacing-0 text-left">
                    <thead className="sticky top-0 z-30">
                      <tr>
                        <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap text-center">
                          No.
                        </th>
                        {COLUMNS.map((col) => {
                          const isSorted = sortConfig.key === col.id;
                          return (
                            <th
                              key={col.id}
                              onClick={col.sortable ? () => handleSort(col.id) : undefined}
                              className={cn(
                                "sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap transition-colors",
                                col.sortable && "cursor-pointer hover:bg-slate-100 hover:text-slate-700 group",
                              )}
                            >
                              <div className="flex items-center justify-between gap-2 w-full">
                                <span className="truncate">{col.label}</span>
                                {col.sortable && (
                                  <div className="flex flex-col text-slate-500 flex-shrink-0 group-hover:text-slate-700 transition-colors">
                                    <ChevronUp className={cn("h-3 w-3 -mb-1", isSorted && sortConfig.direction === "asc" ? "text-emerald-600" : "")} />
                                    <ChevronDown className={cn("h-3 w-3", isSorted && sortConfig.direction === "desc" ? "text-emerald-600" : "")} />
                                  </div>
                                )}
                              </div>
                            </th>
                          );
                        })}
                        <th className="sticky top-0 right-0 z-30 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap text-center before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {items.map((g, index) => {
                        const windowState = WINDOW_STATE_LABEL[g.windowState] ?? { label: g.windowState, color: "slate" as const };
                        return (
                          <tr key={g.id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="py-3 px-4 text-xs sm:text-sm text-slate-500 font-medium whitespace-nowrap text-center">
                              {startIndex + index + 1}
                            </td>
                            <td className="py-3 px-4 text-xs sm:text-sm font-medium text-slate-900 whitespace-nowrap">{g.fullName}</td>
                            <td className="py-3 px-4 text-xs sm:text-sm text-slate-700 whitespace-nowrap">{g.username}</td>
                            <td className="py-3 px-4 text-xs sm:text-sm text-slate-700 whitespace-nowrap">{g.email}</td>
                            <td className="py-3 px-4 text-xs sm:text-sm text-slate-700 whitespace-nowrap">{formatDateTime(g.startAt)}</td>
                            <td className="py-3 px-4 text-xs sm:text-sm text-slate-700 whitespace-nowrap">{formatDateTime(g.endAt)}</td>
                            <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                              <Badge size="sm" color={windowState.color}>{windowState.label}</Badge>
                            </td>
                            <td className="py-3 px-4 text-xs sm:text-sm text-slate-700 whitespace-nowrap">{g.notifyEmailOnExpiry ? "Yes" : "No"}</td>
                            <td className="py-3 px-4 text-xs sm:text-sm text-slate-700 whitespace-nowrap">{formatDateTime(g.createdAt)}</td>
                            <td
                              onClick={(e) => e.stopPropagation()}
                              className="sticky right-0 z-10 bg-white py-3 px-4 text-center whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50 transition-colors"
                            >
                              <button
                                ref={getRef(g.id)}
                                onClick={(e) => handleDropdownToggle(g.id, e, { menuWidth: 200, menuHeight: 180 })}
                                className="inline-flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                              >
                                <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                  showItemCount={true}
                />
              </>
            ) : (
              <TableEmptyState
                title="No Time-Limited User Grants"
                description="We couldn't find any time-limited access grants matching your search."
              />
            )}
          </div>
        </div>
      </div>

      <PortalDropdownMenu isOpen={openDropdownId !== null} onClose={closeDropdown} position={dropdownPosition} minWidth={200}>
        <div className="py-1 whitespace-nowrap">
          <button
            onClick={() => {
              if (activeGrant) handleViewDetail(activeGrant);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
          >
            <IconInfoCircle className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium text-slate-500">View Detail</span>
          </button>
          {activeGrant?.status === "ACTIVE" && (
            <button
              onClick={() => {
                if (activeGrant && canEdit) handleEdit(activeGrant);
              }}
              disabled={!canEdit}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors",
                !canEdit && "opacity-50 cursor-not-allowed hover:bg-transparent",
              )}
            >
              <IconPencilMinus className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium text-slate-500">Edit Time-Limited</span>
            </button>
          )}
          {activeGrant?.status === "ACTIVE" && (
            <button
              onClick={() => {
                if (activeGrant) handleCancel(activeGrant);
              }}
              disabled={!canEdit}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 active:bg-rose-100 transition-colors",
                !canEdit && "opacity-50 cursor-not-allowed hover:bg-transparent",
              )}
            >
              <IconX className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium">Cancel Grant</span>
            </button>
          )}
        </div>
      </PortalDropdownMenu>

      <ESignatureModal
        isOpen={cancelModal.isOpen}
        onClose={() => setCancelModal({ isOpen: false, grantId: "", userName: "" })}
        onConfirm={confirmCancel}
        actionTitle={`Cancel time-limited access: ${cancelModal.userName}`}
        meaningDisplayName="Time-Limited User Grant Cancellation"
        meaningCode="TIME_LIMITED_USER_GRANT"
      />

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
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[
              { label: "All Status", value: "All" },
              { label: "Active", value: "ACTIVE" },
              { label: "Cancelled", value: "CANCELLED" },
              { label: "Expired", value: "EXPIRED" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setStatusFilter(opt.value); setCurrentPage(1); }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all",
                  statusFilter === opt.value
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                <span className="text-xs">{opt.label}</span>
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Start Date Range"
          isExpanded={expandedSections.has("startDate")}
          onToggle={() => toggleSection("startDate")}
        >
          <div className="pt-2 pb-4">
            <DateRangePicker
              label=""
              startDate={startDateFrom}
              endDate={startDateTo}
              onStartDateChange={(value) => setStartDateFrom(toApiDate(value))}
              onEndDateChange={(value) => setStartDateTo(toApiDate(value))}
              onApply={({ startDate, endDate }) => {
                setStartDateFrom(toApiDate(startDate));
                setStartDateTo(toApiDate(endDate));
                setCurrentPage(1);
              }}
              placeholder="Select date range"
            />
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="End Date Range"
          isExpanded={expandedSections.has("endDate")}
          onToggle={() => toggleSection("endDate")}
        >
          <div className="pt-2 pb-4">
            <DateRangePicker
              label=""
              startDate={endDateFrom}
              endDate={endDateTo}
              onStartDateChange={(value) => setEndDateFrom(toApiDate(value))}
              onEndDateChange={(value) => setEndDateTo(toApiDate(value))}
              onApply={({ startDate, endDate }) => {
                setEndDateFrom(toApiDate(startDate));
                setEndDateTo(toApiDate(endDate));
                setCurrentPage(1);
              }}
              placeholder="Select date range"
            />
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Created Range"
          isExpanded={expandedSections.has("created")}
          onToggle={() => toggleSection("created")}
        >
          <div className="pt-2 pb-4">
            <DateRangePicker
              label=""
              startDate={createdFrom}
              endDate={createdTo}
              onStartDateChange={(value) => setCreatedFrom(toApiDate(value))}
              onEndDateChange={(value) => setCreatedTo(toApiDate(value))}
              onApply={({ startDate, endDate }) => {
                setCreatedFrom(toApiDate(startDate));
                setCreatedTo(toApiDate(endDate));
                setCurrentPage(1);
              }}
              placeholder="Select date range"
            />
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </div>
  );
};
