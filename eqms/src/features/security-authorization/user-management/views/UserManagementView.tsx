import React, { useState } from "react";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/toast";
import {
  Search,
  Plus,
  MoreVertical,
  KeyRound,
  Download,
  User as UserIcon,
  PauseCircle,
  RotateCcw,
  X,
  ChevronUp,
  ChevronDown,
  Check,
  LogOut,
  UserPen,
  ShieldCheck,
  SquareX,
} from "lucide-react";
import { IconBan, IconBrandTelegram, IconFilter2, IconLogout, IconMailShare, IconMailUp, IconRestore, IconUserX } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { userManagement } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Select } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { FormModal } from "@/components/ui/modal/FormModal";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { cn } from "@/components/ui/utils";
import { ResetPasswordModal } from "../components/ResetPasswordModal";
import { SuspendModal } from "../components/SuspendModal";
import { TerminateModal } from "../components/TerminateModal";
import { User, UserRole, UserStatus, TableColumn } from "../types";
import { DEFAULT_COLUMNS, USER_MANAGEMENT_ROUTES } from "../constants";
import { formatDateNumeric, getInitials } from "@/utils/format";
import {
  FullPageLoading,
  SectionLoading,
} from "@/components/ui/loading/Loading";
import { useUserList } from "../hooks/useUserList";
import {
  usePortalDropdown,
  useNavigateWithLoading,
  useTableDragScroll,
  PortalDropdownPosition,
} from "@/hooks";
import {
  FilterDrawer,
  FilterAccordionItem,
} from "@/components/ui/filter/FilterDrawer";
import { authApi } from "@/services/api/auth";
import { settingsApi } from "@/services/api/settings";
import type { UserActionCapabilitiesResponse } from "@/services/api/settings";
import { subscribeNotificationRealtime } from "@/features/notifications/notificationRealtime";
import { useTranslation } from "@/i18n";

// --- Main Component ---

export const UserManagementView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const toApiDate = (value: string) => {
    if (!value) return "";
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return value;
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  };

  const {
    users,
    filteredUsers,
    currentUsers,
    totalPages,
    totalItems,
    startIndex,
    availableDepartments,
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    positionFilter,
    setPositionFilter,
    statusFilter,
    setStatusFilter,
    onlineFilter,
    setOnlineFilter,
    businessUnitFilter,
    setBusinessUnitFilter,
    departmentFilter,
    setDepartmentFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    setDateRange,
    lastUpdatedFrom,
    setLastUpdatedFrom,
    lastUpdatedTo,
    setLastUpdatedTo,
    setLastUpdatedRange,
    suspendFrom,
    setSuspendFrom,
    suspendTo,
    setSuspendTo,
    setSuspendRange,
    terminateFrom,
    setTerminateFrom,
    terminateTo,
    setTerminateTo,
    setTerminateRange,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    lookupRoles,
    lookupStatuses,
    lookupBusinessUnits,
    lookupDepartments,
    lookupPositions,
    suspendUser,
    terminateUser,
    reinstateUser,
    exportToExcel,
    clearFilters,
    sortConfig,
    handleSort,
    isLoading,
    refreshUsers,
  } = useUserList();

  const [columns, setColumns] = useState<TableColumn[]>([...DEFAULT_COLUMNS]);
  const {
    openId: openDropdownId,
    position: dropdownPosition,
    getRef,
    toggle: handleDropdownToggle,
    close: closeDropdown,
  } = usePortalDropdown();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const { navigateTo, isNavigating } = useNavigateWithLoading();
  const [resetPasswordModal, setResetPasswordModal] = useState({
    isOpen: false,
    userId: "",
    userName: "",
  });
  const [suspendModal, setSuspendModal] = useState({
    isOpen: false,
    userId: "",
    userName: "",
  });
  const [terminateModal, setTerminateModal] = useState({
    isOpen: false,
    userId: "",
    userName: "",
  });
  const [reinstateModal, setReinstateModal] = useState({
    isOpen: false,
    userId: "",
    userName: "",
  });
  const [forceLogoutModal, setForceLogoutModal] = useState({
    isOpen: false,
    userId: "",
    userName: "",
  });
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["role", "status", "online", "businessUnit", "department"]),
  );
  const [isDateFilterApplying, setIsDateFilterApplying] = useState(false);
  const [capabilityByUserId, setCapabilityByUserId] = useState<
    Record<string, UserActionCapabilitiesResponse>
  >({});
  const [externalReasonModal, setExternalReasonModal] = useState<{
    action: "invite" | "disable" | "resend" | "retry" | "remove";
    user: User;
  } | null>(null);
  const [externalReason, setExternalReason] = useState("");
  const [isExternalActionLoading, setIsExternalActionLoading] = useState(false);

  // Visible columns
  const visibleColumns = columns
    .filter((col) => col.visible)
    .sort((a, b) => a.order - b.order);

  const handleResetPassword = (user: User) => {
    setResetPasswordModal({
      isOpen: true,
      userId: user.id,
      userName: user.fullName,
    });
    closeDropdown();
  };

  const handleSuspend = (user: User) => {
    setSuspendModal({ isOpen: true, userId: user.id, userName: user.fullName });
    closeDropdown();
  };

  const handleTerminate = (user: User) => {
    setTerminateModal({
      isOpen: true,
      userId: user.id,
      userName: user.fullName,
    });
    closeDropdown();
  };

  const handleReinstate = (user: User) => {
    setReinstateModal({
      isOpen: true,
      userId: user.id,
      userName: user.fullName,
    });
    closeDropdown();
  };

  const confirmSuspend = (reason: string, suspendedUntil: string, signatureToken: string) => {
    suspendUser(
      suspendModal.userId,
      suspendModal.userName,
      reason,
      suspendedUntil,
      signatureToken,
    );
    setSuspendModal({ isOpen: false, userId: "", userName: "" });
  };

  const confirmTerminate = (reason: string, terminationDate: string, signatureToken: string) => {
    terminateUser(
      terminateModal.userId,
      terminateModal.userName,
      reason,
      terminationDate,
      signatureToken,
    );
    setTerminateModal({ isOpen: false, userId: "", userName: "" });
  };

  const confirmReinstate = () => {
    reinstateUser(reinstateModal.userId, reinstateModal.userName);
    setReinstateModal({ isOpen: false, userId: "", userName: "" });
  };

  const handleForceLogout = (user: User) => {
    setForceLogoutModal({
      isOpen: true,
      userId: user.id,
      userName: user.fullName,
    });
    closeDropdown();
  };

  const openExternalReasonModal = (
    action: "invite" | "disable" | "resend" | "retry" | "remove",
    user: User,
  ) => {
    closeDropdown();
    setExternalReason(
      action === "invite"
        ? "External user onboarding"
        : action === "disable"
          ? "Access disabled by administrator"
          : action === "remove"
            ? "External access no longer required"
            : "External access provisioning",
    );
    setExternalReasonModal({ action, user });
  };

  const submitExternalReason = async () => {
    if (!externalReasonModal || !externalReason.trim()) return;
    const { action, user } = externalReasonModal;
    setIsExternalActionLoading(true);
    try {
      if (action === "invite") {
        await settingsApi.inviteExternalUser(user.id, externalReason.trim());
        showToast({
          type: "success",
          title: t("userManagement.external.inviteQueuedTitle"),
          message: t("userManagement.external.inviteQueuedMessage", { email: user.email }),
        });
      } else if (action === "disable") {
        await settingsApi.disableMicrosoftAccess(
          user.id,
          externalReason.trim(),
        );
        showToast({
          type: "success",
          title: t("userManagement.external.disableQueuedTitle"),
          message: t("userManagement.external.requestQueuedMessage", { name: user.fullName }),
        });
      } else if (action === "resend") {
        await settingsApi.resendExternalInvitation(
          user.id,
          externalReason.trim(),
        );
        showToast({
          type: "success",
          title: t("userManagement.external.resendQueuedTitle"),
          message: t("userManagement.external.requestQueuedMessage", { name: user.email }),
        });
      } else if (action === "retry") {
        await settingsApi.retryExternalProvisioning(
          user.id,
          externalReason.trim(),
        );
        showToast({
          type: "success",
          title: t("userManagement.external.retryQueuedTitle"),
          message: t("userManagement.external.requestQueuedMessage", { name: user.email }),
        });
      } else {
        await settingsApi.removeExternalUser(user.id, externalReason.trim());
        showToast({
          type: "success",
          title: t("userManagement.external.removeQueuedTitle"),
          message: t("userManagement.external.requestQueuedMessage", { name: user.email }),
        });
      }
      setExternalReasonModal(null);
      // Refresh the server-backed state immediately after the mutation. The table badge comes
      // from refreshUsers(), but which menu buttons are valid next comes from capabilityByUserId
      // — that cache must be dropped too, or the menu shows stale (pre-mutation) options until
      // the dropdown happens to be reopened after a full page reload.
      await refreshUsers();
      setCapabilityByUserId((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
    } catch (error: any) {
      showToast({
        type: "error",
        title: t("userManagement.external.failedTitle"),
        message:
          error?.response?.data?.message || t("userManagement.external.failedMessage"),
      });
    } finally {
      setIsExternalActionLoading(false);
    }
  };

  const handleInviteExternal = (user: User) =>
    openExternalReasonModal("invite", user);
  const handleDisableMicrosoftAccess = (user: User) =>
    openExternalReasonModal("disable", user);
  const handleRemoveExternal = (user: User) =>
    openExternalReasonModal("remove", user);

  const loadUserCapabilities = async (userId: string) => {
    try {
      const capabilities = await settingsApi.getUserCapabilities(userId);
      setCapabilityByUserId((prev) => ({ ...prev, [userId]: capabilities }));
    } catch {
      setCapabilityByUserId((prev) => ({
        ...prev,
        [userId]: {
          userId,
          actions: {},
        },
      }));
    }
  };

  const handleActionMenuToggle = (
    userId: string,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (!capabilityByUserId[userId]) {
      void loadUserCapabilities(userId);
    }
    handleDropdownToggle(userId, event, { menuWidth: 240, menuHeight: 500 });
  };

  const confirmForceLogout = async (data: {
    username: string;
    password: string;
    reason: string;
  }) => {
    if (!forceLogoutModal.userId) {
      return;
    }
    const signatureResponse = await authApi.verifyESignature({
      username: data.username,
      password: data.password,
    });
    await settingsApi.forceLogoutUser(forceLogoutModal.userId, {
      reason: data.reason,
      signatureToken: signatureResponse.signatureToken,
    });
    await refreshUsers();
    showToast({
      type: "success",
      title: t("userManagement.forceLogoutTitle"),
      message: t("userManagement.forceLogoutMessage", { name: forceLogoutModal.userName }),
    });
    setForceLogoutModal({ isOpen: false, userId: "", userName: "" });
  };

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

  const getOptionClassName = (isActive: boolean) =>
    cn(
      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all",
      isActive
        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
    );

  const applyDateRange = (
    applyFn: (startDate: string, endDate: string) => void,
    startDate: string,
    endDate: string,
  ) => {
    setIsDateFilterApplying(true);
    applyFn(startDate, endDate);
  };

  React.useEffect(() => {
    if (isDateFilterApplying && !isLoading) {
      setIsDateFilterApplying(false);
    }
  }, [isDateFilterApplying, isLoading]);

  React.useEffect(() => {
    // useUserList already refetches the table (badge) on this event; the per-user capability
    // cache used to gate the "..." menu buttons is separate and must be dropped too, or a status
    // change from another admin / the background reconciliation job leaves stale menu options
    // cached until this admin happens to reopen that row's dropdown after a reload.
    return subscribeNotificationRealtime((event) => {
      if (event.type === "external-identity-status-changed") {
        setCapabilityByUserId({});
      }
    });
  }, []);

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      {/* Header */}
      <PageHeader
        title="User Management"
        breadcrumbItems={userManagement()}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-2 whitespace-nowrap"
              onClick={() => exportToExcel(columns)}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button
              size="sm"
              className="flex items-center gap-2 whitespace-nowrap"
              onClick={() => navigateTo(USER_MANAGEMENT_ROUTES.ADD)}
            >
              <Plus className="h-4 w-4" />
              Add User
            </Button>
          </>
        }
      />

      {/* Unified Content Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col">
        {/* Filter Section */}
        <div className="px-4 pt-4 md:p-5 flex flex-col">
          <div className="px-1.5 -mx-1.5 pb-1.5 -mb-1.5">
            <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
              <label className="text-xs sm:text-sm font-medium text-slate-700 block">
                Search
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by name, username, email..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="block w-full pl-10 pr-9 h-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setCurrentPage(1);
                      }}
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

            <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              <div className="w-full">
                <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block transition-colors">
                  Search
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors">
                    <Search className="h-4 w-4 text-slate-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by name, username, email..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="block w-full pl-10 pr-10 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <Select
                label="Access Profile"
                value={roleFilter}
                onChange={(value) => setRoleFilter(value as UserRole | "All")}
                options={[
                  { label: "All Profiles", value: "All" },
                  ...lookupRoles,
                ]}
              />

              {/* Status Filter */}
              <Select
                label="Status"
                value={statusFilter}
                onChange={(value) =>
                  setStatusFilter(value as UserStatus | "All")
                }
                options={[
                  { label: "All Status", value: "All" },
                  ...lookupStatuses,
                ]}
              />

              <Select
                label="Online Status"
                value={onlineFilter}
                onChange={(value) =>
                  setOnlineFilter(value as "All" | "online" | "offline")
                }
                options={[
                  { label: "All Users", value: "All" },
                  { label: "Online", value: "online" },
                  { label: "Offline", value: "offline" },
                ]}
              />

              {/* Business Unit Filter */}
              <Select
                label="Business Unit"
                value={businessUnitFilter}
                onChange={(value) => {
                  setBusinessUnitFilter(value);
                  setDepartmentFilter("All");
                }}
                options={[
                  { label: "All Units", value: "All" },
                  ...lookupBusinessUnits,
                ]}
              />

              {/* Department Filter */}
              <Select
                label="Department"
                value={departmentFilter}
                onChange={setDepartmentFilter}
                options={availableDepartments.map((dept) => ({
                  label: dept,
                  value: dept,
                }))}
              />

              {/* Position Filter */}
              <Select
                label="Position"
                value={positionFilter}
                onChange={(value) => setPositionFilter(value)}
                options={[
                  { label: "All Positions", value: "" },
                  ...lookupPositions,
                ]}
                placeholder="All Positions"
              />

              {/* Created Date Range Filter */}
              <DateRangePicker
                label="Created Date Range"
                startDate={dateFrom}
                endDate={dateTo}
                onStartDateChange={(value) => setDateFrom(toApiDate(value))}
                onEndDateChange={(value) => setDateTo(toApiDate(value))}
                onApply={({ startDate, endDate }) =>
                  applyDateRange(
                    setDateRange,
                    toApiDate(startDate),
                    toApiDate(endDate),
                  )
                }
                applyLoading={isDateFilterApplying}
                placeholder="Select date range"
              />

              <DateRangePicker
                label="Last Updated Range"
                startDate={lastUpdatedFrom}
                endDate={lastUpdatedTo}
                onStartDateChange={(value) =>
                  setLastUpdatedFrom(toApiDate(value))
                }
                onEndDateChange={(value) => setLastUpdatedTo(toApiDate(value))}
                onApply={({ startDate, endDate }) =>
                  applyDateRange(
                    setLastUpdatedRange,
                    toApiDate(startDate),
                    toApiDate(endDate),
                  )
                }
                applyLoading={isDateFilterApplying}
                placeholder="Select date range"
              />

              {/* Suspended Until Range Filter */}
              <DateRangePicker
                label="Suspended Until Range"
                startDate={suspendFrom}
                endDate={suspendTo}
                onStartDateChange={(value) => setSuspendFrom(toApiDate(value))}
                onEndDateChange={(value) => setSuspendTo(toApiDate(value))}
                onApply={({ startDate, endDate }) =>
                  applyDateRange(
                    setSuspendRange,
                    toApiDate(startDate),
                    toApiDate(endDate),
                  )
                }
                applyLoading={isDateFilterApplying}
                placeholder="Select date range"
              />

              {/* Termination Date Range Filter */}
              <DateRangePicker
                label="Termination Date Range"
                startDate={terminateFrom}
                endDate={terminateTo}
                onStartDateChange={(value) =>
                  setTerminateFrom(toApiDate(value))
                }
                onEndDateChange={(value) => setTerminateTo(toApiDate(value))}
                onApply={({ startDate, endDate }) =>
                  applyDateRange(
                    setTerminateRange,
                    toApiDate(startDate),
                    toApiDate(endDate),
                  )
                }
                applyLoading={isDateFilterApplying}
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

          <div
            className={cn(
              "border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white transition-all duration-300",
              isLoading && "blur-[2px] opacity-80",
            )}
          >
            {currentUsers.length > 0 ? (
              <>
                <div
                  ref={scrollerRef}
                  className={cn(
                    "flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50 hover:scrollbar-thumb-slate-400",
                    isDragging ? "cursor-grabbing select-none" : "cursor-grab",
                  )}
                  {...dragEvents}
                >
                  <table className="w-full min-w-max  border-spacing-0 text-left">
                    <thead className="sticky top-0 z-30">
                      <tr>
                        {visibleColumns.map((col) => {
                          const isSorted = sortConfig.key === col.id;
                          const canSort = col.id !== "no";
                          return (
                            <th
                              key={col.id}
                              onClick={
                                canSort ? () => handleSort(col.id) : undefined
                              }
                              className={cn(
                                "sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap transition-colors",
                                canSort &&
                                  "cursor-pointer hover:bg-slate-100 hover:text-slate-700 group",
                                col.id === "no" && "text-center",
                              )}
                            >
                              <div
                                className={cn(
                                  "flex items-center justify-between gap-2 w-full",
                                  col.id === "no" && "justify-center",
                                )}
                              >
                                <span className="truncate">{col.label}</span>
                                {canSort && (
                                  <div className="flex flex-col text-slate-500 flex-shrink-0 group-hover:text-slate-700 transition-colors">
                                    <ChevronUp
                                      className={cn(
                                        "h-3 w-3 -mb-1",
                                        isSorted &&
                                          sortConfig.direction === "asc"
                                          ? "text-emerald-600"
                                          : "",
                                      )}
                                    />
                                    <ChevronDown
                                      className={cn(
                                        "h-3 w-3",
                                        isSorted &&
                                          sortConfig.direction === "desc"
                                          ? "text-emerald-600"
                                          : "",
                                      )}
                                    />
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
                      {currentUsers.map((user, index) => {
                        const tdClass =
                          "py-3 px-4 text-xs sm:text-sm text-slate-700 whitespace-nowrap";

                        return (
                          <tr
                            key={user.id}
                            className="hover:bg-slate-50/80 transition-colors group"
                          >
                            {visibleColumns.map((col) => (
                              <td
                                key={col.id}
                                className={cn(
                                  tdClass,
                                  col.id === "no" && "text-center",
                                )}
                              >
                                {col.id === "no" && (
                                  <span className="text-slate-500 font-medium">
                                    {startIndex + index + 1}
                                  </span>
                                )}
                                {col.id === "status" && (
                                  <Badge
                                    size="sm"
                                    color={
                                      user.status === "Active"
                                        ? "emerald"
                                        : user.status === "Inactive"
                                          ? "slate"
                                          : user.status === "Pending"
                                            ? "amber"
                                            : user.status === "Suspended"
                                              ? "orange"
                                              : "red"
                                    }
                                    pill
                                  >
                                    {user.status}
                                  </Badge>
                                )}
                                {col.id === "role" && (
                                  <Badge size="sm" color="slate">
                                    {user.role}
                                  </Badge>
                                )}
                                {col.id === "email" && (
                                  <span className="text-slate-700">
                                    {user.email}
                                  </span>
                                )}
                                {col.id === "externalProvisioning" &&
                                  (() => {
                                    if (!user.externalProvisioningStatusLabel) {
                                      return <span className="text-slate-400">—</span>;
                                    }
                                    return (
                                      <Badge
                                        size="sm"
                                        color={
                                          user.externalProvisioningStatusColor as any
                                        }
                                        className="gap-1"
                                        title="Microsoft Entra external-user status"
                                      >
                                        {user.externalProvisioningStatusLabel}
                                      </Badge>
                                    );
                                  })()}
                                {col.id === "phone" && (
                                  <div className="flex items-center gap-2 text-slate-700">
                                    {user.phone}
                                  </div>
                                )}
                                {col.id === "fullName" && (
                                  <div className="flex items-center gap-2.5">
                                    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-100 bg-emerald-50 text-xs font-semibold text-emerald-700">
                                      <span aria-hidden="true">
                                        {getInitials(
                                          user.fullName ||
                                            user.username ||
                                            "User",
                                        )}
                                      </span>
                                      {user.avatar && (
                                        <img
                                          src={user.avatar}
                                          alt=""
                                          className="absolute inset-0 h-full w-full object-cover"
                                          onError={(event) => {
                                            event.currentTarget.style.display =
                                              "none";
                                          }}
                                        />
                                      )}
                                    </div>
                                    <span className="font-medium text-slate-900">
                                      {user.fullName}
                                    </span>
                                  </div>
                                )}
                                {col.id === "employeeCode" && (
                                  <span
                                    className="font-medium text-emerald-600 cursor-pointer hover:underline"
                                    onClick={() =>
                                      navigateTo(
                                        USER_MANAGEMENT_ROUTES.PROFILE(user.id),
                                      )
                                    }
                                  >
                                    {user.employeeCode}
                                  </span>
                                )}
                                {col.id === "suspendedUntil" && (
                                  <span className="text-slate-700">
                                    {user.suspendedUntil
                                      ? formatDateNumeric(user.suspendedUntil)
                                      : "-"}
                                  </span>
                                )}
                                {col.id === "terminationDate" && (
                                  <span className="text-slate-700">
                                    {user.terminationDate
                                      ? formatDateNumeric(user.terminationDate)
                                      : "-"}
                                  </span>
                                )}
                                {col.id === "inSession" && (
                                  <Badge
                                    size="sm"
                                    color={user.online ? "emerald" : "slate"}
                                  >
                                    {user.online ? "Online" : "Offline"}
                                  </Badge>
                                )}
                                {col.id === "lastUpdated" && (
                                  <span className="text-slate-700">
                                    {user.lastUpdated || "-"}
                                  </span>
                                )}
                                {![
                                  "status",
                                  "role",
                                  "email",
                                  "phone",
                                  "fullName",
                                  "employeeCode",
                                  "no",
                                  "suspendedUntil",
                                  "terminationDate",
                                  "inSession",
                                  "lastUpdated",
                                ].includes(col.id) && (
                                  <span className="text-slate-700">
                                    {String(user[col.id as keyof User] ?? "")}
                                  </span>
                                )}
                              </td>
                            ))}
                            <td
                              onClick={(e) => e.stopPropagation()}
                              className="sticky right-0 z-10 bg-white py-3 px-4 text-center whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50 transition-colors"
                            >
                              <button
                                ref={getRef(user.id)}
                                onClick={(e) =>
                                  handleActionMenuToggle(user.id, e)
                                }
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

                {/* Pagination */}
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
                title="No Users Found"
                description="We couldn't find any users matching your filters. Try adjusting your search criteria."
              />
            )}
          </div>
        </div>
      </div>

      {/* Action Menu */}
      <UserActionMenu
        isOpen={openDropdownId !== null}
        onClose={closeDropdown}
        position={dropdownPosition}
        user={users.find((u) => u.id === openDropdownId)}
        capabilities={
          openDropdownId ? capabilityByUserId[openDropdownId] : undefined
        }
        onViewProfile={(id) => navigateTo(USER_MANAGEMENT_ROUTES.PROFILE(id))}
        onResetPassword={handleResetPassword}
        onSuspend={handleSuspend}
        onTerminate={handleTerminate}
        onReinstate={handleReinstate}
        onForceLogout={handleForceLogout}
        onInviteExternal={handleInviteExternal}
        onDisableMicrosoftAccess={handleDisableMicrosoftAccess}
        onResendExternalInvitation={(user) =>
          openExternalReasonModal("resend", user)
        }
        onRetryExternalProvisioning={(user) =>
          openExternalReasonModal("retry", user)
        }
        onRemoveExternalUser={handleRemoveExternal}
      />

      {/* Reset Password Modal */}
      <ResetPasswordModal
        isOpen={resetPasswordModal.isOpen}
        onClose={() =>
          setResetPasswordModal({ isOpen: false, userId: "", userName: "" })
        }
        userId={resetPasswordModal.userId}
        userName={resetPasswordModal.userName}
      />

      {/* Suspend Modal */}
      <SuspendModal
        isOpen={suspendModal.isOpen}
        onClose={() =>
          setSuspendModal({ isOpen: false, userId: "", userName: "" })
        }
        onConfirm={confirmSuspend}
        userName={suspendModal.userName}
      />

      {/* Terminate Modal */}
      <TerminateModal
        isOpen={terminateModal.isOpen}
        onClose={() =>
          setTerminateModal({ isOpen: false, userId: "", userName: "" })
        }
        onConfirm={confirmTerminate}
        userName={terminateModal.userName}
      />

      {/* Reinstate Modal */}
      <AlertModal
        isOpen={reinstateModal.isOpen}
        onClose={() =>
          setReinstateModal({ isOpen: false, userId: "", userName: "" })
        }
        onConfirm={confirmReinstate}
        type="confirm"
        title="Reinstate User"
        description={`Are you sure you want to reinstate ${reinstateModal.userName}? Their account will be set to Active.`}
        confirmText="Yes, Reinstate"
        cancelText="Cancel"
        showCancel
      />

      <FormModal
        isOpen={Boolean(externalReasonModal)}
        onClose={() => setExternalReasonModal(null)}
        onConfirm={() => void submitExternalReason()}
        title={
          externalReasonModal?.action === "invite"
            ? "Invite External User"
            : externalReasonModal?.action === "disable"
              ? "Disable Microsoft Access"
              : externalReasonModal?.action === "resend"
                ? "Resend Invitation"
                : externalReasonModal?.action === "remove"
                  ? "Remove External User"
                  : "Retry Provisioning"
        }
        description={
          externalReasonModal
            ? `Enter the reason for ${externalReasonModal.action === "invite" ? "inviting" : externalReasonModal.action === "disable" ? "disabling Microsoft access for" : externalReasonModal.action === "resend" ? "resending the invitation to" : externalReasonModal.action === "remove" ? "permanently removing" : "retrying provisioning for"} ${externalReasonModal.user.email}.`
            : undefined
        }
        confirmText={externalReasonModal?.action === "remove" ? "Remove Permanently" : "Confirm"}
        isLoading={isExternalActionLoading}
        confirmDisabled={!externalReason.trim()}
        size="md"
      >
        {externalReasonModal?.action === "remove" && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
            This permanently deletes the guest account from Microsoft Entra. The user will lose all Word Online / SharePoint access immediately and must be invited again from scratch to regain it. This action cannot be undone.
          </div>
        )}
        <label
          htmlFor="external-action-reason"
          className="block text-sm font-medium text-slate-700"
        >
          Reason
        </label>
        <textarea
          id="external-action-reason"
          value={externalReason}
          onChange={(event) => setExternalReason(event.target.value)}
          rows={4}
          maxLength={500}
          autoFocus
          placeholder="Describe the reason..."
          className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        />
      </FormModal>

      <ESignatureModal
        isOpen={forceLogoutModal.isOpen}
        onClose={() =>
          setForceLogoutModal({ isOpen: false, userId: "", userName: "" })
        }
        onConfirm={confirmForceLogout}
        actionTitle={`Log out immediately: ${forceLogoutModal.userName}`}
      />

      {isNavigating && <FullPageLoading text="Loading..." />}

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={() => {
          clearFilters();
          setCurrentPage(1);
        }}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
        <FilterAccordionItem
          label="Access Profile"
          isExpanded={expandedSections.has("role")}
          onToggle={() => toggleSection("role")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[{ label: "All Profiles", value: "All" }, ...lookupRoles].map(
              (opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setRoleFilter(opt.value as UserRole | "All");
                    setCurrentPage(1);
                  }}
                  className={getOptionClassName(roleFilter === opt.value)}
                >
                  <span className="text-xs">{opt.label}</span>
                  {roleFilter === opt.value && (
                    <Check size={16} className="text-emerald-500" />
                  )}
                </button>
              ),
            )}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Online Status"
          isExpanded={expandedSections.has("online")}
          onToggle={() => toggleSection("online")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[
              { label: "All Users", value: "All" },
              { label: "Online", value: "online" },
              { label: "Offline", value: "offline" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() =>
                  setOnlineFilter(opt.value as "All" | "online" | "offline")
                }
                className={getOptionClassName(onlineFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {onlineFilter === opt.value && (
                  <Check size={16} className="text-emerald-500" />
                )}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Position"
          isExpanded={expandedSections.has("position")}
          onToggle={() => toggleSection("position")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[{ label: "All Positions", value: "" }, ...lookupPositions].map(
              (opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setPositionFilter(opt.value);
                    setCurrentPage(1);
                  }}
                  className={getOptionClassName(positionFilter === opt.value)}
                >
                  <span className="text-xs">{opt.label}</span>
                  {positionFilter === opt.value && (
                    <Check size={16} className="text-emerald-500" />
                  )}
                </button>
              ),
            )}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Status"
          isExpanded={expandedSections.has("status")}
          onToggle={() => toggleSection("status")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[{ label: "All Status", value: "All" }, ...lookupStatuses].map(
              (opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setStatusFilter(opt.value as UserStatus | "All");
                    setCurrentPage(1);
                  }}
                  className={getOptionClassName(statusFilter === opt.value)}
                >
                  <span className="text-xs">{opt.label}</span>
                  {statusFilter === opt.value && (
                    <Check size={16} className="text-emerald-500" />
                  )}
                </button>
              ),
            )}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Business Unit"
          isExpanded={expandedSections.has("businessUnit")}
          onToggle={() => toggleSection("businessUnit")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {["All", ...lookupBusinessUnits.map((unit) => unit.value)].map(
              (unit) => (
                <button
                  key={unit}
                  onClick={() => {
                    setBusinessUnitFilter(unit);
                    setDepartmentFilter("All");
                    setCurrentPage(1);
                  }}
                  className={getOptionClassName(businessUnitFilter === unit)}
                >
                  <span className="text-xs">
                    {unit === "All"
                      ? "All Units"
                      : lookupBusinessUnits.find((item) => item.value === unit)
                          ?.label || unit}
                  </span>
                  {businessUnitFilter === unit && (
                    <Check size={16} className="text-emerald-500" />
                  )}
                </button>
              ),
            )}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Department"
          isExpanded={expandedSections.has("department")}
          onToggle={() => toggleSection("department")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {availableDepartments.map((dept) => (
              <button
                key={dept}
                onClick={() => {
                  setDepartmentFilter(dept);
                  setCurrentPage(1);
                }}
                className={getOptionClassName(departmentFilter === dept)}
              >
                <span className="text-xs">{dept}</span>
                {departmentFilter === dept && (
                  <Check size={16} className="text-emerald-500" />
                )}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Created Date Range"
          isExpanded={expandedSections.has("createdDate")}
          onToggle={() => toggleSection("createdDate")}
        >
          <div className="pt-2 pb-4">
            <DateRangePicker
              label=""
              startDate={dateFrom}
              endDate={dateTo}
              onStartDateChange={(value) => {
                setDateFrom(toApiDate(value));
                setCurrentPage(1);
              }}
              onEndDateChange={(value) => {
                setDateTo(toApiDate(value));
                setCurrentPage(1);
              }}
              onApply={({ startDate, endDate }) =>
                applyDateRange(
                  setDateRange,
                  toApiDate(startDate),
                  toApiDate(endDate),
                )
              }
              applyLoading={isDateFilterApplying}
              placeholder="Select date range"
            />
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Last Updated Range"
          isExpanded={expandedSections.has("lastUpdated")}
          onToggle={() => toggleSection("lastUpdated")}
        >
          <div className="pt-2 pb-4">
            <DateRangePicker
              label=""
              startDate={lastUpdatedFrom}
              endDate={lastUpdatedTo}
              onStartDateChange={(value) =>
                setLastUpdatedFrom(toApiDate(value))
              }
              onEndDateChange={(value) => setLastUpdatedTo(toApiDate(value))}
              onApply={({ startDate, endDate }) =>
                applyDateRange(
                  setLastUpdatedRange,
                  toApiDate(startDate),
                  toApiDate(endDate),
                )
              }
              applyLoading={isDateFilterApplying}
              placeholder="Select date range"
            />
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Suspended Until Range"
          isExpanded={expandedSections.has("suspendDate")}
          onToggle={() => toggleSection("suspendDate")}
        >
          <div className="pt-2 pb-4">
            <DateRangePicker
              label=""
              startDate={suspendFrom}
              endDate={suspendTo}
              onStartDateChange={(value) => {
                setSuspendFrom(toApiDate(value));
                setCurrentPage(1);
              }}
              onEndDateChange={(value) => {
                setSuspendTo(toApiDate(value));
                setCurrentPage(1);
              }}
              onApply={({ startDate, endDate }) =>
                applyDateRange(
                  setSuspendRange,
                  toApiDate(startDate),
                  toApiDate(endDate),
                )
              }
              applyLoading={isDateFilterApplying}
              placeholder="Select date range"
            />
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Termination Date Range"
          isExpanded={expandedSections.has("terminationDate")}
          onToggle={() => toggleSection("terminationDate")}
        >
          <div className="pt-2 pb-4">
            <DateRangePicker
              label=""
              startDate={terminateFrom}
              endDate={terminateTo}
              onStartDateChange={(value) => {
                setTerminateFrom(toApiDate(value));
                setCurrentPage(1);
              }}
              onEndDateChange={(value) => {
                setTerminateTo(toApiDate(value));
                setCurrentPage(1);
              }}
              onApply={({ startDate, endDate }) =>
                applyDateRange(
                  setTerminateRange,
                  toApiDate(startDate),
                  toApiDate(endDate),
                )
              }
              applyLoading={isDateFilterApplying}
              placeholder="Select date range"
            />
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </div>
  );
};

interface UserActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: PortalDropdownPosition;
  user: User | undefined;
  capabilities?: UserActionCapabilitiesResponse;
  onViewProfile: (id: string) => void;
  onResetPassword: (user: User) => void;
  onSuspend: (user: User) => void;
  onTerminate: (user: User) => void;
  onReinstate: (user: User) => void;
  onForceLogout: (user: User) => void;
  onInviteExternal: (user: User) => void;
  onDisableMicrosoftAccess: (user: User) => void;
  onResendExternalInvitation: (user: User) => void;
  onRetryExternalProvisioning: (user: User) => void;
  onRemoveExternalUser: (user: User) => void;
}

const UserActionMenu: React.FC<UserActionMenuProps> = ({
  isOpen,
  onClose,
  position,
  user,
  capabilities,
  onViewProfile,
  onResetPassword,
  onSuspend,
  onTerminate,
  onReinstate,
  onForceLogout,
  onInviteExternal,
  onDisableMicrosoftAccess,
  onResendExternalInvitation,
  onRetryExternalProvisioning,
  onRemoveExternalUser,
}) => {
  if (!user) return null;

  const isTerminated = user.status === "Terminated";
  const isSuspended = user.status === "Suspended";
  const isInSession = Boolean(user.inSession);
  const can = (action: string) =>
    Boolean(capabilities?.actions?.[action]?.allowed);
  const reason = (action: string) =>
    capabilities?.actions?.[action]?.reason ||
    "Action is not currently allowed";
  const mutationCapabilityLoaded = Boolean(capabilities);
  // Whether each Microsoft-identity action is currently valid (not just permitted) is decided by
  // the server — `can(...)` already reflects both permission AND the user's current provisioning
  // status (see UserManagementService.getUserCapabilities). The FE only renders what it's told;
  // it does not re-derive eligibility from the raw status string.

  return (
    <PortalDropdownMenu
      isOpen={isOpen}
      onClose={onClose}
      position={position}
      minWidth={240}
    >
      <div className="py-1 whitespace-nowrap">
        <button
          onClick={() => {
            onClose();
            onViewProfile(user.id);
          }}
          disabled={mutationCapabilityLoaded && !can("view")}
          title={
            mutationCapabilityLoaded && !can("view")
              ? reason("view")
              : undefined
          }
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
        >
          <UserPen className="h-4 w-4 flex-shrink-0" />
          <span className="font-medium text-slate-500">View/Edit Profile</span>
        </button>
        {!isTerminated && (
          <button
            onClick={() => {
              if (!can("resetPassword")) return;
              onClose();
              onResetPassword(user);
            }}
            disabled={!can("resetPassword")}
            title={!can("resetPassword") ? reason("resetPassword") : undefined}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors",
              !can("resetPassword") &&
                "opacity-50 cursor-not-allowed hover:bg-transparent",
            )}
          >
            <KeyRound className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium text-slate-500">Reset Password</span>
          </button>
        )}

        {!isTerminated && !isSuspended && (
          <button
            onClick={() => {
              if (!can("suspend")) return;
              onClose();
              onSuspend(user);
            }}
            disabled={!can("suspend")}
            title={!can("suspend") ? reason("suspend") : undefined}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors",
              !can("suspend") &&
                "opacity-50 cursor-not-allowed hover:bg-transparent",
            )}
          >
            <PauseCircle className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium text-slate-500">Suspend Account</span>
          </button>
        )}
        {!isTerminated && (
          <button
            onClick={() => {
              if (!can("terminate")) return;
              onClose();
              onTerminate(user);
            }}
            disabled={!can("terminate")}
            title={!can("terminate") ? reason("terminate") : undefined}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors",
              !can("terminate") &&
                "opacity-50 cursor-not-allowed hover:bg-transparent",
            )}
          >
            <IconUserX className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium text-slate-500">
              Terminate Account
            </span>
          </button>
        )}
        {(isSuspended || isTerminated) && (
          <button
            onClick={() => {
              if (!can("reinstate")) return;
              onClose();
              onReinstate(user);
            }}
            disabled={!can("reinstate")}
            title={!can("reinstate") ? reason("reinstate") : undefined}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors",
              !can("reinstate") &&
                "opacity-50 cursor-not-allowed hover:bg-transparent",
            )}
          >
            <RotateCcw className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium text-slate-500">Reinstate User</span>
          </button>
        )}
        {isInSession && (
          <button
            onClick={() => {
              if (!can("forceLogout")) return;
              onClose();
              onForceLogout(user);
            }}
            disabled={!can("forceLogout")}
            title={!can("forceLogout") ? reason("forceLogout") : undefined}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors",
              !can("forceLogout") &&
                "opacity-50 cursor-not-allowed hover:bg-transparent",
            )}
          >
            <IconLogout className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium text-slate-500">
              Log out immediately
            </span>
          </button>
        )}
        {can("inviteExternal") && (
          <button
            onClick={() => {
              onClose();
              onInviteExternal(user);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <IconBrandTelegram className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium text-slate-500">Invite External User</span>
          </button>
        )}
        {can("resendExternalInvitation") && (
          <button
            onClick={() => {
              onClose();
              onResendExternalInvitation(user);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <IconMailUp className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium text-slate-500">Resend Invitation</span>
          </button>
        )}
        {can("disableMicrosoftAccess") && (
          <button
            onClick={() => onDisableMicrosoftAccess(user)}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <IconBan className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium text-slate-500">Disable Microsoft Access</span>
          </button>
        )}
        {can("retryExternalProvisioning") && (
          <button
            onClick={() => onRetryExternalProvisioning(user)}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <IconRestore  className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium text-slate-500">Retry Provisioning</span>
          </button>
        )}
        {can("removeExternalUser") && (
          <button
            onClick={() => onRemoveExternalUser(user)}
            title="Permanently deletes the guest account from Microsoft Entra. This cannot be undone."
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <SquareX className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">Remove External User</span>
          </button>
        )}
      </div>
    </PortalDropdownMenu>
  );
};
