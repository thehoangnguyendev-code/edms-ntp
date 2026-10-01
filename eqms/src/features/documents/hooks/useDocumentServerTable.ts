import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { useSearchParams } from "react-router-dom";
import { useDebounce } from "@/hooks";
import { useToast } from "@/components/ui/toast";
import { documentApi } from "@/services/api/documents";
import type { SelectOption } from "@/components/ui/select/Select";
import type { User } from "@/types";
import type {
  DocumentFiltersLookup,
  DocumentListItem,
  DocumentViewType,
} from "@/features/documents/document-list/types";

type SortDirection = "asc" | "desc";

type SortConfig = {
  key: string;
  direction: SortDirection;
};

const ALL_OPTION: SelectOption = { label: "All", value: "All" };

const toSelectOptions = (items: { label: string; value: string }[]) =>
  items.map((item) => ({ label: item.label, value: item.value }));

const readString = (params: URLSearchParams, key: string, fallback = "") => {
  const value = params.get(key);
  return value && value.trim() ? value : fallback;
};

const readNumber = (params: URLSearchParams, key: string, fallback: number) => {
  const value = params.get(key);
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const readSortConfig = (params: URLSearchParams): SortConfig => ({
  key: readString(params, "sortBy", "created"),
  direction: readString(params, "sortDirection", "desc") === "asc" ? "asc" : "desc",
});

interface UseDocumentServerTableOptions {
  viewType: DocumentViewType;
  currentUser: User | null;
}

export function useDocumentServerTable({ viewType, currentUser }: UseDocumentServerTableOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestSeqRef = useRef(0);
  const { showToast } = useToast();

  // URL is the source of truth for every committed filter. The only local state is
  // the search draft, which lets typing stay responsive until its debounce completes.
  const urlSearch = readString(searchParams, "search");
  const [searchQuery, setSearchQueryDraft] = useState(urlSearch);
  const statusFilter = readString(searchParams, "status", "All");
  const typeFilter = readString(searchParams, "documentType", "All");
  const businessUnitFilter = readString(searchParams, "businessUnit", "All");
  const departmentFilter = readString(searchParams, "department", "All");
  const relatedDocumentFilter = readString(searchParams, "relatedDocument", "All");
  const correlatedDocumentFilter = readString(searchParams, "correlatedDocument", "All");
  const templateFilter = readString(searchParams, "isTemplate", "All");
  const authorFilter = viewType === "owned-by-me"
    ? currentUser?.id ?? "All"
    : readString(searchParams, "authorId", "All");
  const createdFromDate = readString(searchParams, "createdFrom");
  const createdToDate = readString(searchParams, "createdTo");
  const effectiveFromDate = readString(searchParams, "effectiveFrom");
  const effectiveToDate = readString(searchParams, "effectiveTo");
  const validFromDate = readString(searchParams, "validFrom");
  const validToDate = readString(searchParams, "validTo");
  const currentPage = readNumber(searchParams, "page", 1);
  const itemsPerPage = Math.min(readNumber(searchParams, "limit", 10), 50);
  const sortConfig = readSortConfig(searchParams);

  const updateSearchParams = useCallback((updates: Record<string, string | null | undefined>, replace = true) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === "") next.delete(key);
        else next.set(key, value);
      }
      return next;
    }, { replace });
  }, [setSearchParams]);

  const updateFilter = useCallback((key: string, value: string) => {
    updateSearchParams({ [key]: value === "All" ? null : value, page: null });
  }, [updateSearchParams]);

  const setSearchQuery = useCallback((value: string) => {
    setSearchQueryDraft(value);
  }, []);
  const setStatusFilter = useCallback((value: string) => updateFilter("status", value), [updateFilter]);
  const applyFilters = useCallback((values: Record<string, string>) => {
    const allowed = new Set(['status', 'documentType', 'businessUnit', 'department', 'authorId',
      'relatedDocument', 'correlatedDocument', 'isTemplate', 'createdFrom', 'createdTo',
      'effectiveFrom', 'effectiveTo', 'validFrom', 'validTo']);
    if (viewType === 'owned-by-me') allowed.delete('authorId');
    const updates = Object.fromEntries(Object.entries(values).filter(([key]) => allowed.has(key))
      .map(([key, value]) => [key, value === 'All' || value === '' ? null : value]));
    updateSearchParams({ ...updates, page: null });
  }, [updateSearchParams, viewType]);
  const setTypeFilter = useCallback((value: string) => updateFilter("documentType", value), [updateFilter]);
  const setBusinessUnitFilter = useCallback((value: string) => updateFilter("businessUnit", value), [updateFilter]);
  const setDepartmentFilter = useCallback((value: string) => updateFilter("department", value), [updateFilter]);
  const setRelatedDocumentFilter = useCallback((value: string) => updateFilter("relatedDocument", value), [updateFilter]);
  const setCorrelatedDocumentFilter = useCallback((value: string) => updateFilter("correlatedDocument", value), [updateFilter]);
  const setTemplateFilter = useCallback((value: string) => updateFilter("isTemplate", value), [updateFilter]);
  const setAuthorFilter = useCallback((value: string) => updateFilter("authorId", value), [updateFilter]);
  const setCreatedFromDate = useCallback((value: string) => updateFilter("createdFrom", value), [updateFilter]);
  const setCreatedToDate = useCallback((value: string) => updateFilter("createdTo", value), [updateFilter]);
  const setEffectiveFromDate = useCallback((value: string) => updateFilter("effectiveFrom", value), [updateFilter]);
  const setEffectiveToDate = useCallback((value: string) => updateFilter("effectiveTo", value), [updateFilter]);
  const setValidFromDate = useCallback((value: string) => updateFilter("validFrom", value), [updateFilter]);
  const setValidToDate = useCallback((value: string) => updateFilter("validTo", value), [updateFilter]);
  const setCurrentPage = useCallback((page: number) => {
    updateSearchParams({ page: page > 1 ? String(page) : null }, false);
  }, [updateSearchParams]);
  const setItemsPerPage = useCallback((limit: number) => {
    const normalizedLimit = Math.min(Math.max(limit, 1), 50);
    updateSearchParams({ limit: normalizedLimit === 10 ? null : String(normalizedLimit), page: null }, false);
  }, [updateSearchParams]);

  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLookupLoading, setIsLookupLoading] = useState(true);
  const [filtersLookup, setFiltersLookup] = useState<DocumentFiltersLookup>({
    statuses: [],
    documentTypes: [],
    businessUnits: [],
    departments: [],
    authors: [],
  });
  const [refreshTick, setRefreshTick] = useState(0);

  const debouncedSearch = useDebounce(searchQuery, 400);
  // Requests always use the committed URL value. Typing changes only the draft;
  // the debounce below commits it to the URL, which then triggers the request.
  const effectiveSearch = urlSearch;
  const debouncedSearchValue = debouncedSearch.trim();

  // Apply Browser Back/Forward (and a URL opened directly) to the search input
  // before passive effects run, so an old debounced value cannot overwrite it.
  useLayoutEffect(() => {
    setSearchQueryDraft(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    let cancelled = false;

    const loadFilters = async () => {
      setIsLookupLoading(true);
      try {
        const response = await documentApi.getDocumentFilters();
        if (cancelled) return;
        setFiltersLookup(response);
      } catch (lookupError) {
        if (import.meta.env.DEV) {
          console.error("Failed to load document filter lookups", lookupError);
        }
        if (!cancelled) {
          setFiltersLookup({
            statuses: [],
            documentTypes: [],
            businessUnits: [],
            departments: [],
            authors: [],
          });
        }
      } finally {
        if (!cancelled) {
          setIsLookupLoading(false);
        }
      }
    };

    void loadFilters();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  const querySignature = useMemo(() => JSON.stringify({
    viewType,
    refreshTick,
    search: effectiveSearch,
    statusFilter,
    typeFilter,
    businessUnitFilter,
    departmentFilter,
    relatedDocumentFilter,
    correlatedDocumentFilter,
    templateFilter,
    authorFilter: viewType === "owned-by-me" ? currentUser?.id ?? authorFilter : authorFilter,
    createdFromDate,
    createdToDate,
    effectiveFromDate,
    effectiveToDate,
    validFromDate,
    validToDate,
    sortBy: sortConfig.key,
    sortDirection: sortConfig.direction,
    currentPage,
    itemsPerPage,
  }), [
    viewType,
    refreshTick,
    effectiveSearch,
    statusFilter,
    typeFilter,
    businessUnitFilter,
    departmentFilter,
    relatedDocumentFilter,
    correlatedDocumentFilter,
    templateFilter,
    authorFilter,
    createdFromDate,
    createdToDate,
    effectiveFromDate,
    effectiveToDate,
    validFromDate,
    validToDate,
    sortConfig.key,
    sortConfig.direction,
    currentPage,
    itemsPerPage,
    currentUser?.id,
  ]);

  useEffect(() => {
    // A Back/Forward URL update replaces the draft in a layout effect. Until
    // debounce catches up, its previous value must never be written back over
    // the browser-selected URL.
    if (searchQuery !== debouncedSearch) return;
    if (debouncedSearchValue === urlSearch) return;
    updateSearchParams({ search: debouncedSearchValue || null, page: null });
  }, [debouncedSearch, debouncedSearchValue, searchQuery, updateSearchParams, urlSearch]);

  useEffect(() => {
    let cancelled = false;
    const seq = ++requestSeqRef.current;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await documentApi.getDocumentsPage({
          scope: viewType,
          search: effectiveSearch || undefined,
          status: statusFilter === "All" ? undefined : statusFilter,
          documentType: typeFilter === "All" ? undefined : typeFilter,
          businessUnit: businessUnitFilter === "All" ? undefined : businessUnitFilter,
          department: departmentFilter === "All" ? undefined : departmentFilter,
          relatedDocument: relatedDocumentFilter === "All" ? undefined : relatedDocumentFilter,
          correlatedDocument: correlatedDocumentFilter === "All" ? undefined : correlatedDocumentFilter,
          isTemplate: templateFilter === "All" ? undefined : templateFilter,
          authorId: viewType === "owned-by-me" ? (currentUser?.id || undefined) : (authorFilter === "All" ? undefined : authorFilter),
          createdFrom: createdFromDate || undefined,
          createdTo: createdToDate || undefined,
          effectiveFrom: effectiveFromDate || undefined,
          effectiveTo: effectiveToDate || undefined,
          validFrom: validFromDate || undefined,
          validTo: validToDate || undefined,
          sortBy: sortConfig.key,
          sortDirection: sortConfig.direction,
          page: currentPage,
          limit: Math.min(itemsPerPage, 50),
        });

        if (cancelled || seq !== requestSeqRef.current) return;

        setDocuments(response.data);
        setTotalItems(response.pagination.total);
        setTotalPages(response.pagination.totalPages || 1);
      } catch (loadError) {
        if (cancelled || seq !== requestSeqRef.current) return;
        if (import.meta.env.DEV) {
          console.error("Failed to load documents", loadError);
        }
        setDocuments([]);
        setTotalItems(0);
        setTotalPages(1);
        setError("Unable to load documents from server.");
      } finally {
        if (!cancelled && seq === requestSeqRef.current) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    querySignature,
    viewType,
    debouncedSearch,
    statusFilter,
    typeFilter,
    businessUnitFilter,
    departmentFilter,
    relatedDocumentFilter,
    correlatedDocumentFilter,
    templateFilter,
    authorFilter,
    createdFromDate,
    createdToDate,
    effectiveFromDate,
    effectiveToDate,
    validFromDate,
    validToDate,
    sortConfig.key,
    sortConfig.direction,
    currentPage,
    itemsPerPage,
    currentUser?.id,
  ]);

  const handleSort = (key: string) => {
    const direction = sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    updateSearchParams({
      sortBy: key === "created" ? null : key,
      sortDirection: direction === "desc" ? null : direction,
      page: null,
    });
  };

  const clearFilters = () => {
    setSearchQueryDraft("");
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const reload = () => setRefreshTick((prev) => prev + 1);

  // Any document changed by anyone (a Reviewer completing review, a DCO publishing ...) changes what this list shows
  // (status, actions, counts): refetch the current page so it is never stale until a manual reload.
  useEntityChanged(["DOCUMENT", "REVISION"], () => reload(), { debounceMs: 1000 });

  const exportDocuments = async () => {
    setIsExporting(true);
    try {
      const blob = await documentApi.exportDocumentsPage({
        scope: viewType,
        search: effectiveSearch || undefined,
        status: statusFilter === "All" ? undefined : statusFilter,
        documentType: typeFilter === "All" ? undefined : typeFilter,
        businessUnit: businessUnitFilter === "All" ? undefined : businessUnitFilter,
        department: departmentFilter === "All" ? undefined : departmentFilter,
        relatedDocument: relatedDocumentFilter === "All" ? undefined : relatedDocumentFilter,
        correlatedDocument: correlatedDocumentFilter === "All" ? undefined : correlatedDocumentFilter,
        isTemplate: templateFilter === "All" ? undefined : templateFilter,
        authorId: viewType === "owned-by-me" ? (currentUser?.id || undefined) : (authorFilter === "All" ? undefined : authorFilter),
        createdFrom: createdFromDate || undefined,
        createdTo: createdToDate || undefined,
        effectiveFrom: effectiveFromDate || undefined,
        effectiveTo: effectiveToDate || undefined,
        validFrom: validFromDate || undefined,
        validTo: validToDate || undefined,
        sortBy: sortConfig.key,
        sortDirection: sortConfig.direction,
      });

      const fileName = `documents-${viewType}-${new Date().toISOString().slice(0, 10)}.csv`;
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);

      showToast({
        type: "success",
        title: "Export complete",
        message: "Documents have been exported successfully.",
      });
    } catch (exportError) {
      if (import.meta.env.DEV) {
        console.error("Failed to export documents", exportError);
      }
      showToast({
        type: "error",
        title: "Export failed",
        message: "Unable to export documents from server.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const statusOptions = useMemo<SelectOption[]>(() => [
    ALL_OPTION,
    ...filtersLookup.statuses.map((item) => ({ label: item.label, value: item.value || item.code || item.label })),
  ], [filtersLookup.statuses]);

  const typeOptions = useMemo<SelectOption[]>(() => [
    ALL_OPTION,
    ...toSelectOptions(filtersLookup.documentTypes),
  ], [filtersLookup.documentTypes]);

  const businessUnitOptions = useMemo<SelectOption[]>(() => [
    ALL_OPTION,
    ...toSelectOptions(filtersLookup.businessUnits),
  ], [filtersLookup.businessUnits]);

  const departmentOptions = useMemo<SelectOption[]>(() => [
    ALL_OPTION,
    ...toSelectOptions(filtersLookup.departments),
  ], [filtersLookup.departments]);

  const authorOptions = useMemo<SelectOption[]>(() => {
    const currentUserLabel = (currentUser as any)?.employeeCode
      ? `${(currentUser as any).employeeCode} - ${currentUser?.fullName}`
      : currentUser?.fullName || currentUser?.username;

    if (viewType === "owned-by-me") {
      const label = currentUserLabel || "Current User";
      const value = currentUser?.id || authorFilter || "current-user";
      return [{ label, value }];
    }

    const options = [
      ALL_OPTION,
      ...filtersLookup.authors.map((item) => ({ label: item.label, value: item.value })),
    ];

    if (currentUser?.id && !options.some((option) => option.value === currentUser.id)) {
      options.splice(1, 0, {
        label: currentUserLabel || currentUser.username,
        value: currentUser.id,
      });
    }

    return options;
  }, [viewType, filtersLookup.authors, currentUser, authorFilter]);

  const searchAuthors = useCallback(async (query: string): Promise<SelectOption[]> => {
    const response = await documentApi.getDocumentFilters(query);
    return response.authors.map((item) => ({ label: item.label, value: item.value }));
  }, []);

  return {
    searchQuery,
    applyFilters,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    businessUnitFilter,
    setBusinessUnitFilter,
    departmentFilter,
    setDepartmentFilter,
    relatedDocumentFilter,
    setRelatedDocumentFilter,
    correlatedDocumentFilter,
    setCorrelatedDocumentFilter,
    templateFilter,
    setTemplateFilter,
    authorFilter,
    setAuthorFilter,
    createdFromDate,
    setCreatedFromDate,
    createdToDate,
    setCreatedToDate,
    effectiveFromDate,
    setEffectiveFromDate,
    effectiveToDate,
    setEffectiveToDate,
    validFromDate,
    setValidFromDate,
    validToDate,
    setValidToDate,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalItems,
    totalPages,
    documents,
    isLoading,
    isExporting,
    isLookupLoading,
    error,
    sortConfig,
    handleSort,
    clearFilters,
    exportDocuments,
    reload,
    statusOptions,
    typeOptions,
    businessUnitOptions,
    departmentOptions,
    authorOptions,
    searchAuthors,
    authorFilterDisabled: viewType === "owned-by-me",
    currentAuthorLabel: viewType === "owned-by-me"
      ? (currentUser?.fullName || currentUser?.username || "Current User")
      : undefined,
  };
}
