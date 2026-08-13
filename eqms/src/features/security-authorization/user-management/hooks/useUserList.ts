import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/components/ui/toast";
import { settingsApi } from "@/services/api/settings";
import { dictionaryApi } from "@/services/api";
import { subscribeNotificationRealtime } from "@/features/notifications/notificationRealtime";
import type { User, UserRole, UserStatus, TableColumn } from "../types";
import { useDebounce } from "@/hooks";

type LookupOption = { label: string; value: string };

type UserQueryState = {
  search: string;
  role: UserRole | "All";
  position: string;
  status: UserStatus | "All";
  online: "All" | "online" | "offline";
  businessUnit: string;
  department: string;
  dateFrom: string;
  dateTo: string;
  lastUpdatedFrom: string;
  lastUpdatedTo: string;
  suspendFrom: string;
  suspendTo: string;
  terminateFrom: string;
  terminateTo: string;
  sortBy: string;
  sortDirection: "asc" | "desc";
  includeTerminated: boolean;
};

const DEFAULT_QUERY: UserQueryState = {
  search: "",
  role: "All",
  position: "",
  status: "All",
  online: "All",
  businessUnit: "All",
  department: "All",
  dateFrom: "",
  dateTo: "",
  lastUpdatedFrom: "",
  lastUpdatedTo: "",
  suspendFrom: "",
  suspendTo: "",
  terminateFrom: "",
  terminateTo: "",
  sortBy: "employeeCode",
  sortDirection: "asc",
  includeTerminated: false,
};

const DEFAULT_PAGE = 1;
// User Management should show the full normal tenant population on first load.
// The shared pagination still allows 10/20/50 and keeps paging for larger tenants.
const DEFAULT_PAGE_SIZE = 10;

const parsePositiveInt = (value: string | null, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBoolean = (value: string | null) => value === "1" || value === "true" || value === "yes";

const parseQueryState = (params: URLSearchParams) => ({
  search: params.get("search") ?? DEFAULT_QUERY.search,
  role: (params.get("role") as UserRole | "All") ?? DEFAULT_QUERY.role,
  position: params.get("position") ?? DEFAULT_QUERY.position,
  status: (params.get("status") as UserStatus | "All") ?? DEFAULT_QUERY.status,
  online: (params.get("online") as "All" | "online" | "offline") ?? DEFAULT_QUERY.online,
  businessUnit: params.get("businessUnit") ?? DEFAULT_QUERY.businessUnit,
  department: params.get("department") ?? DEFAULT_QUERY.department,
  dateFrom: params.get("dateFrom") ?? DEFAULT_QUERY.dateFrom,
  dateTo: params.get("dateTo") ?? DEFAULT_QUERY.dateTo,
  lastUpdatedFrom: params.get("lastUpdatedFrom") ?? DEFAULT_QUERY.lastUpdatedFrom,
  lastUpdatedTo: params.get("lastUpdatedTo") ?? DEFAULT_QUERY.lastUpdatedTo,
  suspendFrom: params.get("suspendFrom") ?? DEFAULT_QUERY.suspendFrom,
  suspendTo: params.get("suspendTo") ?? DEFAULT_QUERY.suspendTo,
  terminateFrom: params.get("terminateFrom") ?? DEFAULT_QUERY.terminateFrom,
  terminateTo: params.get("terminateTo") ?? DEFAULT_QUERY.terminateTo,
  sortBy: params.get("sortBy") ?? DEFAULT_QUERY.sortBy,
  sortDirection: (params.get("sortDirection") as "asc" | "desc") ?? DEFAULT_QUERY.sortDirection,
  currentPage: parsePositiveInt(params.get("page"), DEFAULT_PAGE),
  itemsPerPage: parsePositiveInt(params.get("limit"), DEFAULT_PAGE_SIZE),
  includeTerminated: parseBoolean(params.get("includeTerminated")),
});

const buildQueryParams = (state: {
  search: string;
  role: UserRole | "All";
  position: string;
  status: UserStatus | "All";
  online: "All" | "online" | "offline";
  businessUnit: string;
  department: string;
  dateFrom: string;
  dateTo: string;
  lastUpdatedFrom: string;
  lastUpdatedTo: string;
  suspendFrom: string;
  suspendTo: string;
  terminateFrom: string;
  terminateTo: string;
  sortBy: string;
  sortDirection: "asc" | "desc";
  currentPage: number;
  itemsPerPage: number;
  includeTerminated: boolean;
}) => {
  const params = new URLSearchParams();

  if (state.search.trim()) params.set("search", state.search.trim());
  if (state.role !== "All") params.set("role", state.role);
  if (state.position.trim()) params.set("position", state.position.trim());
  if (state.status !== "All") params.set("status", state.status);
  if (state.online !== "All") params.set("online", state.online);
  if (state.businessUnit !== "All") params.set("businessUnit", state.businessUnit);
  if (state.department !== "All") params.set("department", state.department);
  if (state.dateFrom.trim()) params.set("dateFrom", state.dateFrom.trim());
  if (state.dateTo.trim()) params.set("dateTo", state.dateTo.trim());
  if (state.lastUpdatedFrom.trim()) params.set("lastUpdatedFrom", state.lastUpdatedFrom.trim());
  if (state.lastUpdatedTo.trim()) params.set("lastUpdatedTo", state.lastUpdatedTo.trim());
  if (state.suspendFrom.trim()) params.set("suspendFrom", state.suspendFrom.trim());
  if (state.suspendTo.trim()) params.set("suspendTo", state.suspendTo.trim());
  if (state.terminateFrom.trim()) params.set("terminateFrom", state.terminateFrom.trim());
  if (state.terminateTo.trim()) params.set("terminateTo", state.terminateTo.trim());
  if (state.sortBy && state.sortBy !== DEFAULT_QUERY.sortBy) params.set("sortBy", state.sortBy);
  if (state.sortDirection !== DEFAULT_QUERY.sortDirection) params.set("sortDirection", state.sortDirection);
  if (state.currentPage > DEFAULT_PAGE) params.set("page", String(state.currentPage));
  if (state.itemsPerPage !== DEFAULT_PAGE_SIZE) params.set("limit", String(state.itemsPerPage));
  if (state.includeTerminated) params.set("includeTerminated", "1");

  return params;
};

export function useUserList() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestSeqRef = useRef(0);
  const urlState = useMemo(() => parseQueryState(searchParams), [searchParams]);
  const [users, setUsers] = useState<User[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(urlState.currentPage);
  const [itemsPerPage, setItemsPerPage] = useState(urlState.itemsPerPage);
  const [isLoading, setIsLoading] = useState(true);
  const [showTerminated, setShowTerminated] = useState(urlState.includeTerminated);
  const [roleFilter, setRoleFilter] = useState<UserRole | "All">(urlState.role);
  const [positionFilter, setPositionFilter] = useState(urlState.position);
  const [statusFilter, setStatusFilter] = useState<UserStatus | "All">(urlState.status);
  const [onlineFilter, setOnlineFilter] = useState<"All" | "online" | "offline">(urlState.online);
  const [businessUnitFilter, setBusinessUnitFilter] = useState(urlState.businessUnit);
  const [departmentFilter, setDepartmentFilter] = useState(urlState.department);
  const [searchQuery, setSearchQueryState] = useState(urlState.search);
  const [dateFrom, setDateFrom] = useState(urlState.dateFrom);
  const [dateTo, setDateTo] = useState(urlState.dateTo);
  const [lastUpdatedFrom, setLastUpdatedFrom] = useState(urlState.lastUpdatedFrom);
  const [lastUpdatedTo, setLastUpdatedTo] = useState(urlState.lastUpdatedTo);
  const [suspendFrom, setSuspendFrom] = useState(urlState.suspendFrom);
  const [suspendTo, setSuspendTo] = useState(urlState.suspendTo);
  const [terminateFrom, setTerminateFrom] = useState(urlState.terminateFrom);
  const [terminateTo, setTerminateTo] = useState(urlState.terminateTo);
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: "asc" | "desc" }>({
    key: urlState.sortBy,
    direction: urlState.sortDirection,
  });

  const [lookupRoles, setLookupRoles] = useState<LookupOption[]>([]);
  const [lookupStatuses, setLookupStatuses] = useState<LookupOption[]>([]);
  const [lookupBusinessUnits, setLookupBusinessUnits] = useState<LookupOption[]>([]);
  const [lookupDepartments, setLookupDepartments] = useState<LookupOption[]>([]);
  const [lookupPositions, setLookupPositions] = useState<LookupOption[]>([]);
  const [allDepartments, setAllDepartments] = useState<{ name: string; businessUnit: string }[]>([]);

  const debouncedSearch = useDebounce(searchQuery, 300);

  const loadLookups = useCallback(async () => {
    try {
      const [filters, departments] = await Promise.all([
        settingsApi.getUserFilters(),
        dictionaryApi.getDepartments(),
      ]);

      setLookupRoles(filters.roles.map((item) => ({ label: item.label, value: item.value })));
      setLookupStatuses(filters.statuses.map((item) => ({ label: item.label, value: item.value })));
      setLookupBusinessUnits(filters.businessUnits.map((item) => ({ label: item.label, value: item.value })));
      setLookupDepartments(filters.departments.map((item) => ({ label: item.label, value: item.value })));
      setLookupPositions(filters.positions.map((item) => ({ label: item.label, value: item.value })));
      setAllDepartments(departments.map((item) => ({ name: item.name, businessUnit: item.businessUnit })));
    } catch (error) {
      if (import.meta.env.DEV) console.error("Failed to load user lookups", error);
      showToast({
        type: "error",
        title: "Load Failed",
        message: "Unable to load filter data from server.",
      });
    }
  }, [showToast]);

  const fetchUsers = useCallback(async (silent = false) => {
    const requestSeq = ++requestSeqRef.current;
    try {
      // Background Entra reconciliation must not replace the table with a
      // loading state every few seconds. Keep the current rows visible while
      // the server refreshes status badges.
      if (!silent) setIsLoading(true);
      const response = await settingsApi.getUsers({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch.trim() || undefined,
        role: roleFilter === "All" ? undefined : roleFilter,
        position: positionFilter || undefined,
        status: statusFilter === "All" ? undefined : statusFilter,
        online: onlineFilter === "All" ? undefined : onlineFilter,
        businessUnit: businessUnitFilter === "All" ? undefined : businessUnitFilter,
        department: departmentFilter === "All" ? undefined : departmentFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        lastUpdatedFrom: lastUpdatedFrom || undefined,
        lastUpdatedTo: lastUpdatedTo || undefined,
        suspendFrom: suspendFrom || undefined,
        suspendTo: suspendTo || undefined,
        terminateFrom: terminateFrom || undefined,
        terminateTo: terminateTo || undefined,
        sortBy: sortConfig.key || DEFAULT_QUERY.sortBy,
        sortDirection: sortConfig.direction,
        includeTerminated: showTerminated || statusFilter === "Terminated",
      });

      if (requestSeq !== requestSeqRef.current) return;
      setUsers(response.data ?? []);
      setTotalItems(response.pagination?.total ?? 0);
      setTotalPages(response.pagination?.totalPages ?? 1);
    } catch (error) {
      if (requestSeq !== requestSeqRef.current) return;
      if (import.meta.env.DEV) console.error("Failed to load users", error);
      if (!silent) {
        showToast({
          type: "error",
          title: "Load Failed",
          message: "Unable to load users from server.",
        });
        setUsers([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } finally {
      if (requestSeq !== requestSeqRef.current) return;
      if (!silent) setIsLoading(false);
    }
  }, [
    currentPage,
    itemsPerPage,
    debouncedSearch,
    roleFilter,
    positionFilter,
    statusFilter,
    onlineFilter,
    businessUnitFilter,
    departmentFilter,
    dateFrom,
    dateTo,
    lastUpdatedFrom,
    lastUpdatedTo,
    suspendFrom,
    suspendTo,
    terminateFrom,
    terminateTo,
    sortConfig.key,
    sortConfig.direction,
    showTerminated,
    showToast,
  ]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  const currentQueryString = useMemo(() => {
    const params = buildQueryParams({
      search: searchQuery,
      role: roleFilter,
      position: positionFilter,
      status: statusFilter,
      online: onlineFilter,
      businessUnit: businessUnitFilter,
      department: departmentFilter,
      dateFrom,
      dateTo,
      lastUpdatedFrom,
      lastUpdatedTo,
      suspendFrom,
      suspendTo,
      terminateFrom,
      terminateTo,
      sortBy: sortConfig.key || DEFAULT_QUERY.sortBy,
      sortDirection: sortConfig.direction,
      currentPage,
      itemsPerPage,
      includeTerminated: showTerminated || statusFilter === "Terminated",
    });
    return params.toString();
  }, [
    searchQuery,
    roleFilter,
    positionFilter,
    statusFilter,
    onlineFilter,
    businessUnitFilter,
    departmentFilter,
    dateFrom,
    dateTo,
    lastUpdatedFrom,
    lastUpdatedTo,
    suspendFrom,
    suspendTo,
    terminateFrom,
    terminateTo,
    sortConfig.key,
    sortConfig.direction,
    currentPage,
    itemsPerPage,
    showTerminated,
  ]);

  useEffect(() => {
    if (searchParams.toString() === currentQueryString) return;
    setSearchParams(currentQueryString, { replace: true });
  }, [currentQueryString, searchParams, setSearchParams]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    // Entra reconciliation is server-driven. Refresh silently only when the
    // backend tells us that a linked account changed; the interval below is
    // retained only as a bounded fallback for webhook/SSE interruptions.
    return subscribeNotificationRealtime((event) => {
      if (event.type === "external-identity-status-changed") {
        void fetchUsers(true);
      }
    });
  }, [fetchUsers]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchUsers(true);
    }, 300000);

    return () => window.clearInterval(intervalId);
  }, [fetchUsers]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };

  const setSearchQuery = (value: string) => {
    setSearchQueryState(value);
    setCurrentPage(1);
  };

  const updateRoleFilter = (value: UserRole | "All") => {
    setRoleFilter(value);
    setCurrentPage(1);
  };

  const updatePositionFilter = (value: string) => {
    setPositionFilter(value);
    setCurrentPage(1);
  };

  const updateStatusFilter = (value: UserStatus | "All") => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const updateOnlineFilter = (value: "All" | "online" | "offline") => {
    setOnlineFilter(value);
    setCurrentPage(1);
  };

  const updateBusinessUnitFilter = (value: string) => {
    setBusinessUnitFilter(value);
    setDepartmentFilter("All");
    setPositionFilter("");
    setCurrentPage(1);
  };

  const updateDepartmentFilter = (value: string) => {
    setDepartmentFilter(value);
    setPositionFilter("");
    setCurrentPage(1);
  };

  const updateDateFrom = (value: string) => {
    setDateFrom(value);
    setCurrentPage(1);
  };

  const updateDateTo = (value: string) => {
    setDateTo(value);
    setCurrentPage(1);
  };

  const updateDateRange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
    setCurrentPage(1);
  };

  const updateLastUpdatedFrom = (value: string) => {
    setLastUpdatedFrom(value);
    setCurrentPage(1);
  };

  const updateLastUpdatedTo = (value: string) => {
    setLastUpdatedTo(value);
    setCurrentPage(1);
  };

  const updateLastUpdatedRange = (from: string, to: string) => {
    setLastUpdatedFrom(from);
    setLastUpdatedTo(to);
    setCurrentPage(1);
  };

  const updateSuspendFrom = (value: string) => {
    setSuspendFrom(value);
    setCurrentPage(1);
  };

  const updateSuspendTo = (value: string) => {
    setSuspendTo(value);
    setCurrentPage(1);
  };

  const updateSuspendRange = (from: string, to: string) => {
    setSuspendFrom(from);
    setSuspendTo(to);
    setCurrentPage(1);
  };

  const updateTerminateFrom = (value: string) => {
    setTerminateFrom(value);
    setCurrentPage(1);
  };

  const updateTerminateTo = (value: string) => {
    setTerminateTo(value);
    setCurrentPage(1);
  };

  const updateTerminateRange = (from: string, to: string) => {
    setTerminateFrom(from);
    setTerminateTo(to);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchQueryState("");
    setRoleFilter("All");
    setPositionFilter("");
    setStatusFilter("All");
    setOnlineFilter("All");
    setBusinessUnitFilter("All");
    setDepartmentFilter("All");
    setDateFrom("");
    setDateTo("");
    setLastUpdatedFrom("");
    setLastUpdatedTo("");
    setSuspendFrom("");
    setSuspendTo("");
    setTerminateFrom("");
    setTerminateTo("");
    setShowTerminated(false);
    setSortConfig({
      key: DEFAULT_QUERY.sortBy,
      direction: DEFAULT_QUERY.sortDirection,
    });
    setCurrentPage(1);
  };

  const exportToExcel = async (_columns: TableColumn[]) => {
    try {
      const blob = await settingsApi.exportUsers({
        search: debouncedSearch.trim() || undefined,
        role: roleFilter === "All" ? undefined : roleFilter,
        position: positionFilter || undefined,
        status: statusFilter === "All" ? undefined : statusFilter,
        online: onlineFilter === "All" ? undefined : onlineFilter,
        businessUnit: businessUnitFilter === "All" ? undefined : businessUnitFilter,
        department: departmentFilter === "All" ? undefined : departmentFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        lastUpdatedFrom: lastUpdatedFrom || undefined,
        lastUpdatedTo: lastUpdatedTo || undefined,
        suspendFrom: suspendFrom || undefined,
        suspendTo: suspendTo || undefined,
        terminateFrom: terminateFrom || undefined,
        terminateTo: terminateTo || undefined,
        includeTerminated: showTerminated || statusFilter === "Terminated",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `users_export_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast({
        type: "success",
        title: "Export Successful",
        message: `Exported ${totalItems} users to CSV`,
      });
    } catch (error) {
      showToast({ type: "error", title: "Export Failed", message: String(error) });
    }
  };

  const suspendUser = async (userId: string, userName: string, reason: string, suspendedUntil: string, signatureToken: string) => {
    try {
      await settingsApi.suspendUser(userId, { reason, suspendedUntil, signatureToken });
      await fetchUsers();
      showToast({ type: "warning", title: "User Suspended", message: `${userName} has been suspended.` });
    } catch (error) {
      showToast({ type: "error", title: "Suspend Failed", message: String(error) });
    }
  };

  const terminateUser = async (userId: string, userName: string, reason: string, terminationDate: string, signatureToken: string) => {
    try {
      await settingsApi.terminateUser(userId, { reason, terminationDate, signatureToken });
      await fetchUsers();
      showToast({ type: "error", title: "Employee Terminated", message: `${userName} has been terminated.` });
    } catch (error) {
      showToast({ type: "error", title: "Terminate Failed", message: String(error) });
    }
  };

  const reinstateUser = async (userId: string, userName: string) => {
    try {
      await settingsApi.reinstateUser(userId);
      await fetchUsers();
      showToast({ type: "success", title: "User Reinstated", message: `${userName} has been reinstated as Active.` });
    } catch (error) {
      showToast({ type: "error", title: "Reinstate Failed", message: String(error) });
    }
  };

  const startIndex = (currentPage - 1) * itemsPerPage;

  const terminatedCount = useMemo(() => users.filter((u) => u.status === "Terminated").length, [users]);

  const availableDepartments = useMemo(() => {
    if (businessUnitFilter === "All") {
      const depts = lookupDepartments.length > 0
        ? lookupDepartments.map((d) => d.value)
        : Array.from(new Set(allDepartments.map((dept) => dept.name)));
      return ["All", ...depts];
    }

    const depts = allDepartments
      .filter((dept) => dept.businessUnit === businessUnitFilter)
      .map((dept) => dept.name);
    return ["All", ...depts];
  }, [businessUnitFilter, lookupDepartments, allDepartments]);

  return {
    users,
    filteredUsers: users,
    currentUsers: users,
    totalPages,
    totalItems,
    startIndex,
    terminatedCount,
    availableDepartments,
    showTerminated,
    setShowTerminated,
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter: updateRoleFilter,
    positionFilter,
    setPositionFilter: updatePositionFilter,
    statusFilter,
    setStatusFilter: updateStatusFilter,
    onlineFilter,
    setOnlineFilter: updateOnlineFilter,
    businessUnitFilter,
    setBusinessUnitFilter: updateBusinessUnitFilter,
    departmentFilter,
    setDepartmentFilter: updateDepartmentFilter,
    dateFrom,
    setDateFrom: updateDateFrom,
    dateTo,
    setDateTo: updateDateTo,
    setDateRange: updateDateRange,
    lastUpdatedFrom,
    setLastUpdatedFrom: updateLastUpdatedFrom,
    lastUpdatedTo,
    setLastUpdatedTo: updateLastUpdatedTo,
    setLastUpdatedRange: updateLastUpdatedRange,
    suspendFrom,
    setSuspendFrom: updateSuspendFrom,
    suspendTo,
    setSuspendTo: updateSuspendTo,
    setSuspendRange: updateSuspendRange,
    terminateFrom,
    setTerminateFrom: updateTerminateFrom,
    terminateTo,
    setTerminateTo: updateTerminateTo,
    setTerminateRange: updateTerminateRange,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage: (value: number) => {
      setItemsPerPage(value);
      setCurrentPage(1);
    },
    isLoading,
    suspendUser,
    terminateUser,
    reinstateUser,
    exportToExcel,
    clearFilters,
    sortConfig,
    handleSort,
    lookupRoles,
    lookupStatuses,
    lookupBusinessUnits,
    lookupDepartments,
    lookupPositions,
    refreshUsers: fetchUsers,
  };
}
