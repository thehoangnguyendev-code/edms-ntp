import { useCallback, useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { trainingError, trainingPersonnelEventsApi, type TrainingPersonnelEvent } from "@/services/api/trainingActivities";
import { useDateRange, useDepartmentNameOptions } from "../shared/useListFilters";

/**
 * The alerts of the system, listed the same way as the other lists of Training: the filters, the dates, the search, the sort and the paging are done by the server and
 * remembered for the screen. By default only the open alerts are shown.
 */
export function usePersonnelAlertsServerTable() {
  const [statusFilter, setStatusFilterState] = usePersistedState("training.alerts.status", "OPEN");
  const [kindFilter, setKindFilterState] = usePersistedState("training.alerts.kind", "");
  const [departmentFilter, setDepartmentFilterState] = usePersistedState("training.alerts.department", "");
  const departmentOptions = useDepartmentNameOptions();
  const eventRange = useDateRange("training.alerts.event", "Event Date Range");
  const [error, setError] = useState("");

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      trainingPersonnelEventsApi.list(params).then((page) => { setError(""); return page; }).catch((e) => {
        setError(trainingError(e));
        throw e;
      }),
    [],
  );
  const extraParams = useMemo(
    () => ({ status: statusFilter || undefined, kind: kindFilter || undefined, department: departmentFilter || undefined, ...eventRange.params("eventFrom", "eventTo") }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statusFilter, kindFilter, departmentFilter, eventRange.from, eventRange.to],
  );
  const table = useServerTable<TrainingPersonnelEvent>({
    persistKey: "training.alerts",
    liveTypes: ["TRAINING"],
    fetcher,
    defaultSortBy: "eventDate",
    defaultSortDirection: "desc",
    extraParams,
    initialItemsPerPage: 10,
  });

  const setSearchQuery = (value: string) => { table.setSearchQuery(value); table.setCurrentPage(1); };
  const setStatusFilter = (value: string) => { setStatusFilterState(value); table.setCurrentPage(1); };
  const setKindFilter = (value: string) => { setKindFilterState(value); table.setCurrentPage(1); };
  const setDepartmentFilter = (value: string) => { setDepartmentFilterState(value); table.setCurrentPage(1); };
  const clearFilters = () => {
    setStatusFilterState("OPEN");
    setKindFilterState("");
    setDepartmentFilterState("");
    eventRange.clear();
    table.setCurrentPage(1);
  };
  const hasActiveFilters = Boolean(statusFilter !== "OPEN" || kindFilter || departmentFilter || eventRange.isSet || table.searchQuery);

  return {
    searchQuery: table.searchQuery, setSearchQuery,
    statusFilter, setStatusFilter, kindFilter, setKindFilter, departmentFilter, setDepartmentFilter, departmentOptions, eventRange,
    currentPage: table.currentPage, setCurrentPage: table.setCurrentPage, itemsPerPage: table.itemsPerPage, setItemsPerPage: table.setItemsPerPage,
    totalItems: table.totalItems, totalPages: table.totalPages, alerts: table.items, isLoading: table.isLoading, error,
    sortConfig: table.sortConfig, handleSort: table.handleSort, clearFilters, hasActiveFilters, reload: table.reload,
  };
}
