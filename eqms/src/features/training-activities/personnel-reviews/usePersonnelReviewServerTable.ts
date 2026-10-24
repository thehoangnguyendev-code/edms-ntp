import { useCallback, useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { trainingError, trainingReviewsApi, type TrainingPersonnelReviewSummary } from "@/services/api/trainingActivities";
import { useDateRange, useDepartmentNameOptions } from "../shared/useListFilters";

/**
 * The list of training reviews: the filters, the dates, the search, the sort and the paging, all done by the server. It is the counterpart of `useDocumentServerTable`
 * for this list, so the screen only draws what the hook gives. Every filter is remembered for the screen.
 */
export function usePersonnelReviewServerTable() {
  const [statusFilter, setStatusFilterState] = usePersistedState("training.reviews.status", "");
  const [kindFilter, setKindFilterState] = usePersistedState("training.reviews.kind", "");
  const [departmentFilter, setDepartmentFilterState] = usePersistedState("training.reviews.department", "");
  const departmentOptions = useDepartmentNameOptions();
  const eventRange = useDateRange("training.reviews.event", "Event Date Range");
  const openedRange = useDateRange("training.reviews.opened", "Opened Date Range");
  const [error, setError] = useState("");

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      trainingReviewsApi.list(params).catch((e) => {
        setError(trainingError(e));
        throw e;
      }),
    [],
  );
  const extraParams = useMemo(
    () => ({
      status: statusFilter || undefined,
      kind: kindFilter || undefined,
      department: departmentFilter || undefined,
      ...eventRange.params("eventFrom", "eventTo"),
      ...openedRange.params("createdFrom", "createdTo"),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statusFilter, kindFilter, departmentFilter, eventRange.from, eventRange.to, openedRange.from, openedRange.to],
  );
  const table = useServerTable<TrainingPersonnelReviewSummary>({
    persistKey: "training.reviews",
    liveTypes: ["TRAINING"],
    fetcher,
    defaultSortBy: "createdAt",
    defaultSortDirection: "desc",
    extraParams,
    initialItemsPerPage: 10,
  });

  // A change of a filter or of the search sends the list back to its first page.
  const setSearchQuery = (value: string) => { table.setSearchQuery(value); table.setCurrentPage(1); };
  const setStatusFilter = (value: string) => { setStatusFilterState(value); table.setCurrentPage(1); };
  const setKindFilter = (value: string) => { setKindFilterState(value); table.setCurrentPage(1); };
  const setDepartmentFilter = (value: string) => { setDepartmentFilterState(value); table.setCurrentPage(1); };
  const clearFilters = () => {
    setStatusFilterState("");
    setKindFilterState("");
    setDepartmentFilterState("");
    eventRange.clear();
    openedRange.clear();
    table.setCurrentPage(1);
  };
  const hasActiveFilters = Boolean(statusFilter || kindFilter || departmentFilter || eventRange.isSet || openedRange.isSet || table.searchQuery);

  return {
    searchQuery: table.searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    kindFilter,
    setKindFilter,
    departmentFilter,
    setDepartmentFilter,
    departmentOptions,
    eventRange,
    openedRange,
    currentPage: table.currentPage,
    setCurrentPage: table.setCurrentPage,
    itemsPerPage: table.itemsPerPage,
    setItemsPerPage: table.setItemsPerPage,
    totalItems: table.totalItems,
    totalPages: table.totalPages,
    reviews: table.items,
    isLoading: table.isLoading,
    error,
    sortConfig: table.sortConfig,
    handleSort: table.handleSort,
    clearFilters,
    hasActiveFilters,
  };
}
