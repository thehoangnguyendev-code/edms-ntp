import { ConfiguredDesktopFilters } from '@/components/ui/filter/ConfiguredDesktopFilters';
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical, Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { IconFilter2, IconLogout } from "@tabler/icons-react";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { DataTable, useCustomColumnLayout, type DataTableAction, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { AlertModal } from "@/components/ui/modal";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { useToast } from "@/components/ui/toast/Toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { usePortalDropdown } from "@/hooks";
import { cn } from "@/components/ui/utils";
import { settingsApi } from "@/services/api/settings";
import { formatDateTime } from "@/utils/format";
import { loggedInUsers } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { useDictionaryServerTable } from "@/features/settings/dictionaries/hooks/useDictionaryServerTable";
import type { LoggedInSession } from "../../types";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

/**
 * "Logged in Users" -- mirrors User Management's search/table/pagination UI exactly. All
 * filtering, search (debounced), sorting and pagination happen server-side (GET
 * /settings/users/sessions via UserManagementService#getLoggedInSessions); this component only
 * renders what comes back and triggers the "Logout Immediately" action.
 *
 * "Logout Immediately" uses a confirmation-only flow and revokes every active session for the
 * selected user. The backend records the actor and action in the audit log and audit trail.
 */
export const LoggedInUsersView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, logout } = useAuth();
  const { hasPermissionAlias } = usePermissions();
  const canForceLogout = hasPermissionAlias("settings.user.force_logout");
  const { openId: openDropdownId, position: dropdownPosition, getRef, toggle: handleDropdownToggle, close: closeDropdown } = usePortalDropdown();

  // dd/MM/yyyy (DateRangePicker's own format) -> yyyy-MM-dd (what the server expects) -- same
  // convention as User Management's date-range filters.
  const toApiDate = (value: string) => {
    if (!value) return "";
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return value;
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  };

  const [lastLoginFrom, setLastLoginFrom] = useState("");
  const [lastLoginTo, setLastLoginTo] = useState("");
  const [sessionStartedFrom, setSessionStartedFrom] = useState("");
  const [sessionStartedTo, setSessionStartedTo] = useState("");
  const [lastActivityFrom, setLastActivityFrom] = useState("");
  const [lastActivityTo, setLastActivityTo] = useState("");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["lastLogin", "sessionStarted", "lastActivity"]),
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
  } = useDictionaryServerTable<LoggedInSession>({
    fetcher: settingsApi.getLoggedInSessions,
    defaultSortBy: "lastActivityAt",
    defaultSortDirection: "desc",
    extraParams: {
      lastLoginFrom: lastLoginFrom || undefined,
      lastLoginTo: lastLoginTo || undefined,
      sessionStartedFrom: sessionStartedFrom || undefined,
      sessionStartedTo: sessionStartedTo || undefined,
      lastActivityFrom: lastActivityFrom || undefined,
      lastActivityTo: lastActivityTo || undefined,
    },
  });

  const clearFilters = () => {
    setSearchQuery("");
    setLastLoginFrom("");
    setLastLoginTo("");
    setSessionStartedFrom("");
    setSessionStartedTo("");
    setLastActivityFrom("");
    setLastActivityTo("");
    setCurrentPage(1);
  };

  const [forceLogoutModal, setForceLogoutModal] = useState<{ isOpen: boolean; userId: string; userName: string }>({
    isOpen: false,
    userId: "",
    userName: "",
  });
  const [isForceLoggingOut, setIsForceLoggingOut] = useState(false);

  const handleForceLogout = (session: LoggedInSession) => {
    setForceLogoutModal({ isOpen: true, userId: session.userId, userName: session.fullName });
    closeDropdown();
  };

  const confirmForceLogout = async () => {
    if (!forceLogoutModal.userId) return;
    setIsForceLoggingOut(true);
    try {
      await settingsApi.forceLogoutUser(forceLogoutModal.userId, {
        reason: "Administrator confirmed immediate logout from Logged in Users.",
      });
      const loggedOutCurrentUser = forceLogoutModal.userId === user?.id;
      setForceLogoutModal({ isOpen: false, userId: "", userName: "" });

      if (loggedOutCurrentUser) {
        // The server has already revoked this session. Clear the SPA session immediately rather
        // than reloading the table with credentials that are no longer valid.
        await logout();
        return;
      }

      reload();
      showToast({
        type: "success",
        title: "Force Logout",
        message: `${forceLogoutModal.userName} has been logged out of every session.`,
      });
    } catch {
      showToast({
        type: "error",
        title: "Force Logout Failed",
        message: "Unable to log out this user. Please try again.",
      });
    } finally {
      setIsForceLoggingOut(false);
    }
  };

  const startIndex = (currentPage - 1) * itemsPerPage;
  const activeSession = items.find((s) => s.sessionId === openDropdownId);

  type SessionRow = (typeof items)[number];
  const sessionColumns: DataTableColumn<SessionRow>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, cell: (_session, index) => startIndex + index + 1 },
    { id: "fullName", header: "Full Name", label: "Full Name", sort: { direction: sortConfig.key === "fullName" ? sortConfig.direction : undefined, onSort: () => handleSort("fullName") }, cell: (s) => <span className="font-medium text-slate-900">{s.fullName}</span> },
    { id: "username", header: "Username", label: "Username", sort: { direction: sortConfig.key === "username" ? sortConfig.direction : undefined, onSort: () => handleSort("username") }, cell: (s) => s.username },
    { id: "email", header: "Email", label: "Email", sort: { direction: sortConfig.key === "email" ? sortConfig.direction : undefined, onSort: () => handleSort("email") }, cell: (s) => s.email },
    { id: "online", header: "Online", label: "Online", cell: (s) => <Badge size="sm" color={s.online ? "emerald" : "slate"}>{s.online ? "Online" : "Offline"}</Badge> },
    { id: "lastLogin", header: "Last Login", label: "Last Login", sort: { direction: sortConfig.key === "lastLogin" ? sortConfig.direction : undefined, onSort: () => handleSort("lastLogin") }, cell: (s) => (s.lastLoginAt ? formatDateTime(s.lastLoginAt) : "-") },
    { id: "deviceName", header: "Device", label: "Device", sort: { direction: sortConfig.key === "deviceName" ? sortConfig.direction : undefined, onSort: () => handleSort("deviceName") }, cellClassName: "max-w-xs truncate", cell: (s) => <span title={s.userAgent ?? undefined}>{s.deviceName || s.userAgent || "-"}</span> },
    { id: "ipAddress", header: "IP Address", label: "IP Address", sort: { direction: sortConfig.key === "ipAddress" ? sortConfig.direction : undefined, onSort: () => handleSort("ipAddress") }, cell: (s) => s.ipAddress || "-" },
    { id: "createdAt", header: "Session Started", label: "Session Started", sort: { direction: sortConfig.key === "createdAt" ? sortConfig.direction : undefined, onSort: () => handleSort("createdAt") }, cell: (s) => formatDateTime(s.createdAt) },
    { id: "lastActivityAt", header: "Last Activity", label: "Last Activity", sort: { direction: sortConfig.key === "lastActivityAt" ? sortConfig.direction : undefined, onSort: () => handleSort("lastActivityAt") }, cell: (s) => formatDateTime(s.lastActivityAt) },
  ];
  const sessionAction: DataTableAction<SessionRow> = {
    header: "Action",
    cell: (s) => (
      <button
        ref={getRef(s.sessionId)}
        onClick={(e) => handleDropdownToggle(s.sessionId, e)}
        className="inline-flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
      >
        <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4" />
      </button>
    ),
  };
  const { layout: sessionLayout, control: sessionControl } = useCustomColumnLayout("time-limited-users.logged-in", sessionColumns, sessionAction);

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      <PageHeader title="Logged in Users" breadcrumbItems={loggedInUsers(navigate)} />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col">
        {/* Filter Section */}
        <div className="compact-filter-section px-4 pt-4 md:p-5 flex flex-col">
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
                    placeholder="Search name, username, email, IP..."
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

<ConfiguredDesktopFilters
  trailing={<div className="hidden md:block">{sessionControl}</div>}
  search={
    <input
      aria-label="Search"
      value={searchQuery}
      onChange={(e) => {
        setSearchQuery(e.target.value);
        setCurrentPage(1);
      }}
      placeholder={"Search name, username, email, IP..."}
      className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
    />
  }
  filters={[]}
  dates={[
    {
      id: "lastLoginFrom",
      label: "Last Login Range",
      from: lastLoginFrom,
      to: lastLoginTo,
      onFromChange: (value) => setLastLoginFrom(toApiDate(value)),
      onToChange: (value) => setLastLoginTo(toApiDate(value)),
      onApply: ({ startDate, endDate }) => {
        setLastLoginFrom(toApiDate(startDate));
        setLastLoginTo(toApiDate(endDate));
        setCurrentPage(1);
      },
    },
    {
      id: "sessionStartedFrom",
      label: "Session Started Range",
      from: sessionStartedFrom,
      to: sessionStartedTo,
      onFromChange: (value) => setSessionStartedFrom(toApiDate(value)),
      onToChange: (value) => setSessionStartedTo(toApiDate(value)),
      onApply: ({ startDate, endDate }) => {
        setSessionStartedFrom(toApiDate(startDate));
        setSessionStartedTo(toApiDate(endDate));
        setCurrentPage(1);
      },
    },
    {
      id: "lastActivityFrom",
      label: "Last Activity Range",
      from: lastActivityFrom,
      to: lastActivityTo,
      onFromChange: (value) => setLastActivityFrom(toApiDate(value)),
      onToChange: (value) => setLastActivityTo(toApiDate(value)),
      onApply: ({ startDate, endDate }) => {
        setLastActivityFrom(toApiDate(startDate));
        setLastActivityTo(toApiDate(endDate));
        setCurrentPage(1);
      },
    },
  ]}
>
<div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              <div className="w-full lg:col-span-1">
                <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block transition-colors">Search</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors">
                    <Search className="h-4 w-4 text-slate-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search name, username, email, IP..."
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

              <DateRangePicker
                label="Last Login Range"
                startDate={lastLoginFrom}
                endDate={lastLoginTo}
                onStartDateChange={(value) => setLastLoginFrom(toApiDate(value))}
                onEndDateChange={(value) => setLastLoginTo(toApiDate(value))}
                onApply={({ startDate, endDate }) => {
                  setLastLoginFrom(toApiDate(startDate));
                  setLastLoginTo(toApiDate(endDate));
                  setCurrentPage(1);
                }}
                placeholder="Select date range"
              />

              <DateRangePicker
                label="Session Started Range"
                startDate={sessionStartedFrom}
                endDate={sessionStartedTo}
                onStartDateChange={(value) => setSessionStartedFrom(toApiDate(value))}
                onEndDateChange={(value) => setSessionStartedTo(toApiDate(value))}
                onApply={({ startDate, endDate }) => {
                  setSessionStartedFrom(toApiDate(startDate));
                  setSessionStartedTo(toApiDate(endDate));
                  setCurrentPage(1);
                }}
                placeholder="Select date range"
              />

              <DateRangePicker
                label="Last Activity Range"
                startDate={lastActivityFrom}
                endDate={lastActivityTo}
                onStartDateChange={(value) => setLastActivityFrom(toApiDate(value))}
                onEndDateChange={(value) => setLastActivityTo(toApiDate(value))}
                onApply={({ startDate, endDate }) => {
                  setLastActivityFrom(toApiDate(startDate));
                  setLastActivityTo(toApiDate(endDate));
                  setCurrentPage(1);
                }}
                placeholder="Select date range"
              />

              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="h-9 px-4 gap-2 font-medium transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap"
                >
                  Clear Filters
                </Button>
                {sessionControl}
              </div>
            </div>
</ConfiguredDesktopFilters>
          </div>
        </div>

        {/* Table Section */}
        <div className="px-4 md:px-5 pb-4 md:pb-5 flex-1 flex flex-col relative">
          {isLoading && (
            <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center transition-all duration-300">
              <SectionLoading text="Searching..." minHeight="150px" />
            </div>
          )}

          <div className={cn("flex-1 flex flex-col transition-all duration-300", isLoading && "blur-[2px] opacity-80")}>
            <DataTable
              rows={items}
              getRowKey={(session) => session.sessionId}
              columns={sessionLayout.columns}
              columnLayout={sessionLayout}
              action={sessionAction}
              emptyState={
                <TableEmptyState
                  title="No Logged in Users"
                  description="We couldn't find any live sessions matching your search."
                />
                }
              pagination={
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                  showItemCount={true}
                />
              }
            />
          </div>
        </div>
      </div>

      <PortalDropdownMenu isOpen={openDropdownId !== null} onClose={closeDropdown} position={dropdownPosition} minWidth={200}>
        <div className="py-1 whitespace-nowrap">
          {canForceLogout && (
            <button
              onClick={() => activeSession && handleForceLogout(activeSession)}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
            >
              <IconLogout className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium text-slate-500">Logout Immediately</span>
            </button>
          )}
        </div>
      </PortalDropdownMenu>

      <AlertModal
        isOpen={forceLogoutModal.isOpen}
        onClose={() => setForceLogoutModal({ isOpen: false, userId: "", userName: "" })}
        onConfirm={confirmForceLogout}
        type="warning"
        title={`Log out ${forceLogoutModal.userName} immediately?`}
        description="This will revoke every active session for this user. The action is recorded in the audit trail."
        confirmText="Log Out Now"
        isLoading={isForceLoggingOut}
      />

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={clearFilters}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
        <FilterAccordionItem
          label="Last Login Range"
          isExpanded={expandedSections.has("lastLogin")}
          onToggle={() => toggleSection("lastLogin")}
        >
          <div className="pt-2 pb-4">
            <DateRangePicker
              label=""
              startDate={lastLoginFrom}
              endDate={lastLoginTo}
              onStartDateChange={(value) => setLastLoginFrom(toApiDate(value))}
              onEndDateChange={(value) => setLastLoginTo(toApiDate(value))}
              onApply={({ startDate, endDate }) => {
                setLastLoginFrom(toApiDate(startDate));
                setLastLoginTo(toApiDate(endDate));
                setCurrentPage(1);
              }}
              placeholder="Select date range"
            />
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Session Started Range"
          isExpanded={expandedSections.has("sessionStarted")}
          onToggle={() => toggleSection("sessionStarted")}
        >
          <div className="pt-2 pb-4">
            <DateRangePicker
              label=""
              startDate={sessionStartedFrom}
              endDate={sessionStartedTo}
              onStartDateChange={(value) => setSessionStartedFrom(toApiDate(value))}
              onEndDateChange={(value) => setSessionStartedTo(toApiDate(value))}
              onApply={({ startDate, endDate }) => {
                setSessionStartedFrom(toApiDate(startDate));
                setSessionStartedTo(toApiDate(endDate));
                setCurrentPage(1);
              }}
              placeholder="Select date range"
            />
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Last Activity Range"
          isExpanded={expandedSections.has("lastActivity")}
          onToggle={() => toggleSection("lastActivity")}
        >
          <div className="pt-2 pb-4">
            <DateRangePicker
              label=""
              startDate={lastActivityFrom}
              endDate={lastActivityTo}
              onStartDateChange={(value) => setLastActivityFrom(toApiDate(value))}
              onEndDateChange={(value) => setLastActivityTo(toApiDate(value))}
              onApply={({ startDate, endDate }) => {
                setLastActivityFrom(toApiDate(startDate));
                setLastActivityTo(toApiDate(endDate));
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
