import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

interface UseDocumentServerTableOptions {
  viewType: DocumentViewType;
  currentUser: User | null;
}

export function useDocumentServerTable({ viewType, currentUser }: UseDocumentServerTableOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestSeqRef = useRef(0);
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState(() => readString(searchParams, "search"));
  const [statusFilter, setStatusFilter] = useState(() => readString(searchParams, "status", "All"));
  const [typeFilter, setTypeFilter] = useState(() => readString(searchParams, "documentType", "All"));
  const [businessUnitFilter, setBusinessUnitFilter] = useState(() => readString(searchParams, "businessUnit", "All"));
  const [departmentFilter, setDepartmentFilter] = useState(() => readString(searchParams, "department", "All"));
  const [relatedDocumentFilter, setRelatedDocumentFilter] = useState(() => readString(searchParams, "relatedDocument", "All"));
  const [correlatedDocumentFilter, setCorrelatedDocumentFilter] = useState(() => readString(searchParams, "correlatedDocument", "All"));
  const [templateFilter, setTemplateFilter] = useState(() => readString(searchParams, "isTemplate", "All"));
  const [authorFilter, setAuthorFilter] = useState(() => {
    if (viewType === "owned-by-me") {
      return readString(searchParams, "authorId", currentUser?.id ?? "All");
    }
    return readString(searchParams, "authorId", "All");
  });
  const [createdFromDate, setCreatedFromDate] = useState(() => readString(searchParams, "createdFrom"));
  const [createdToDate, setCreatedToDate] = useState(() => readString(searchParams, "createdTo"));
  const [effectiveFromDate, setEffectiveFromDate] = useState(() => readString(searchParams, "effectiveFrom"));
  const [effectiveToDate, setEffectiveToDate] = useState(() => readString(searchParams, "effectiveTo"));
  const [validFromDate, setValidFromDate] = useState(() => readString(searchParams, "validFrom"));
  const [validToDate, setValidToDate] = useState(() => readString(searchParams, "validTo"));
  const [currentPage, setCurrentPage] = useState(() => readNumber(searchParams, "page", 1));
  const [itemsPerPage, setItemsPerPage] = useState(() => Math.min(readNumber(searchParams, "limit", 10), 50));
  const [sortConfig, setSortConfig] = useState<SortConfig>(() => ({
    key: readString(searchParams, "sortBy", "created"),
    direction: readString(searchParams, "sortDirection", "desc") === "asc" ? "asc" : "desc",
  }));

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

  const debouncedSearch = useDebounce(searchQuery, 300);
  const effectiveSearch = searchQuery.trim() === "" ? "" : debouncedSearch.trim();

  useEffect(() => {
    if (viewType === "owned-by-me") {
      if (currentUser?.id && authorFilter !== currentUser.id) {
        setAuthorFilter(currentUser.id);
      }
    } else {
      const paramAuthor = searchParams.get("authorId");
      if (!paramAuthor && authorFilter !== "All") {
        setAuthorFilter("All");
      }
    }
  }, [viewType, currentUser?.id, searchParams, authorFilter]);

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
    const params = new URLSearchParams();
    params.set("scope", viewType);

    if (effectiveSearch) params.set("search", effectiveSearch);
    if (statusFilter && statusFilter !== "All") params.set("status", statusFilter);
    if (typeFilter && typeFilter !== "All") params.set("documentType", typeFilter);
    if (businessUnitFilter && businessUnitFilter !== "All") params.set("businessUnit", businessUnitFilter);
    if (departmentFilter && departmentFilter !== "All") params.set("department", departmentFilter);
    if (relatedDocumentFilter && relatedDocumentFilter !== "All") params.set("relatedDocument", relatedDocumentFilter);
    if (correlatedDocumentFilter && correlatedDocumentFilter !== "All") params.set("correlatedDocument", correlatedDocumentFilter);
    if (templateFilter && templateFilter !== "All") params.set("isTemplate", templateFilter);
    if (authorFilter && authorFilter !== "All") params.set("authorId", viewType === "owned-by-me" ? (currentUser?.id ?? authorFilter) : authorFilter);
    if (createdFromDate) params.set("createdFrom", createdFromDate);
    if (createdToDate) params.set("createdTo", createdToDate);
    if (effectiveFromDate) params.set("effectiveFrom", effectiveFromDate);
    if (effectiveToDate) params.set("effectiveTo", effectiveToDate);
    if (validFromDate) params.set("validFrom", validFromDate);
    if (validToDate) params.set("validTo", validToDate);
    if (sortConfig.key && sortConfig.key !== "title") params.set("sortBy", sortConfig.key);
    if (sortConfig.direction !== "asc") params.set("sortDirection", sortConfig.direction);
    if (currentPage > 1) params.set("page", String(currentPage));
    if (itemsPerPage !== 10) params.set("limit", String(Math.min(itemsPerPage, 50)));

    const nextQuery = params.toString();
    if (nextQuery !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [
    viewType,
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
    searchParams,
    setSearchParams,
  ]);

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
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setTypeFilter("All");
    setBusinessUnitFilter("All");
    setDepartmentFilter("All");
    setRelatedDocumentFilter("All");
    setCorrelatedDocumentFilter("All");
    setTemplateFilter("All");
    setAuthorFilter(viewType === "owned-by-me" ? (currentUser?.id ?? "") : "All");
    setCreatedFromDate("");
    setCreatedToDate("");
    setEffectiveFromDate("");
    setEffectiveToDate("");
    setValidFromDate("");
    setValidToDate("");
    setSortConfig({ key: "created", direction: "desc" });
    setCurrentPage(1);
    setItemsPerPage(10);
  };

  const reload = () => setRefreshTick((prev) => prev + 1);

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
