import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDebounce } from "@/hooks";
import { useToast } from "@/components/ui/toast";
import { useTranslation } from "@/i18n";
import { documentApi } from "@/services/api/documents";
import type { SelectOption } from "@/components/ui/select/Select";
import type { User } from "@/types";
import type { DocumentStatus } from "@/types/document";
import type { DocumentType } from "@/types/documentTypes";
import type { DocumentFiltersLookup } from "@/features/documents/document-list/types";
import type { Revision } from "@/features/documents/document-revisions/views/types";

type SortDirection = "asc" | "desc";

type SortConfig = {
  key: string;
  direction: SortDirection;
};

const ALL_OPTION: SelectOption = { label: "All", value: "All" };
const REVISION_LIST_REFRESH_KEY = "eqms.documents.revisions.refresh";

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

interface UseRevisionServerTableOptions {
  viewType: "all" | "owned-by-me" | "pending-review" | "pending-approval";
  currentUser: User | null;
}

export function useRevisionServerTable({ viewType, currentUser }: UseRevisionServerTableOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestSeqRef = useRef(0);
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState(() => readString(searchParams, "search"));
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "All">(
    () => {
      if (viewType === "pending-review") return "PENDING_REVIEW" as DocumentStatus;
      if (viewType === "pending-approval") return "PENDING_APPROVAL" as DocumentStatus;
      return readString(searchParams, "status", "All") as DocumentStatus | "All";
    }
  );
  const [typeFilter, setTypeFilter] = useState<DocumentType | "All">(
    () => readString(searchParams, "documentType", "All") as DocumentType | "All"
  );
  const [businessUnitFilter, setBusinessUnitFilter] = useState(() => readString(searchParams, "businessUnit", "All"));
  const [departmentFilter, setDepartmentFilter] = useState(() => readString(searchParams, "department", "All"));
  const [relatedDocumentFilter, setRelatedDocumentFilter] = useState(() => readString(searchParams, "relatedDocument", "All"));
  const [correlatedDocumentFilter, setCorrelatedDocumentFilter] = useState(() => readString(searchParams, "correlatedDocument", "All"));
  const [templateFilter, setTemplateFilter] = useState(() => readString(searchParams, "isTemplate", "All"));
  const [authorFilter, setAuthorFilter] = useState(() => {
    if (viewType === "owned-by-me") {
      return readString(searchParams, "authorId", currentUser?.id ?? "All");
    }
    if (viewType === "pending-review" || viewType === "pending-approval") {
      return "All";
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

  const [revisions, setRevisions] = useState<Revision[]>([]);
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
    if (viewType === "pending-review") {
      setStatusFilter("PENDING_REVIEW" as DocumentStatus);
    }
    if (viewType === "pending-approval") {
      setStatusFilter("PENDING_APPROVAL" as DocumentStatus);
    }
    if (viewType === "owned-by-me") {
      if (currentUser?.id && authorFilter !== currentUser.id) {
        setAuthorFilter(currentUser.id);
      }
    }
  }, [viewType, currentUser?.id, authorFilter]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const refreshToken = window.sessionStorage.getItem(REVISION_LIST_REFRESH_KEY);
    if (!refreshToken) {
      return;
    }

    window.sessionStorage.removeItem(REVISION_LIST_REFRESH_KEY);
    setRefreshTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadFilters = async () => {
      setIsLookupLoading(true);
      try {
        const response = await documentApi.getRevisionFilters();
        if (cancelled) return;
        setFiltersLookup(response);
      } catch (lookupError) {
        if (import.meta.env.DEV) {
          console.error("Failed to load revision filter lookups", lookupError);
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
    authorFilter:
      viewType === "owned-by-me"
        ? currentUser?.id ?? authorFilter
        : authorFilter,
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
    if (viewType === "owned-by-me" && currentUser?.id) {
      params.set("authorId", currentUser.id);
    } else if (authorFilter && authorFilter !== "All") {
      params.set("authorId", authorFilter);
    }
    if (createdFromDate) params.set("createdFrom", createdFromDate);
    if (createdToDate) params.set("createdTo", createdToDate);
    if (effectiveFromDate) params.set("effectiveFrom", effectiveFromDate);
    if (effectiveToDate) params.set("effectiveTo", effectiveToDate);
    if (validFromDate) params.set("validFrom", validFromDate);
    if (validToDate) params.set("validTo", validToDate);
    if (sortConfig.key && sortConfig.key !== "revisionName") params.set("sortBy", sortConfig.key);
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
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    let cancelled = false;
    const seq = ++requestSeqRef.current;

    const load = async () => {
      if ((viewType === "owned-by-me" || viewType === "pending-review" || viewType === "pending-approval") && !currentUser?.id) {
        setIsLoading(true);
        setRevisions([]);
        setTotalItems(0);
        setTotalPages(1);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const response = await documentApi.getRevisions({
          search: effectiveSearch || undefined,
          status: statusFilter === "All" ? undefined : statusFilter,
          documentType: typeFilter === "All" ? undefined : typeFilter,
          businessUnit: businessUnitFilter === "All" ? undefined : businessUnitFilter,
          department: departmentFilter === "All" ? undefined : departmentFilter,
          relatedDocument: relatedDocumentFilter === "All" ? undefined : relatedDocumentFilter,
          correlatedDocument: correlatedDocumentFilter === "All" ? undefined : correlatedDocumentFilter,
          isTemplate: templateFilter === "All" ? undefined : templateFilter,
          authorId: viewType === "owned-by-me"
            ? (currentUser?.id || undefined)
            : authorFilter !== "All"
              ? authorFilter
              : undefined,
          createdFrom: createdFromDate || undefined,
          createdTo: createdToDate || undefined,
          effectiveFrom: effectiveFromDate || undefined,
          effectiveTo: effectiveToDate || undefined,
          validFrom: validFromDate || undefined,
          validTo: validToDate || undefined,
          ownedByMe: viewType === "owned-by-me",
          pending: viewType === "pending-review" || viewType === "pending-approval",
          sortBy: sortConfig.key,
          sortDirection: sortConfig.direction,
          page: currentPage,
          limit: Math.min(itemsPerPage, 50),
          cacheBuster: refreshTick,
        });

        if (cancelled || seq !== requestSeqRef.current) return;

        setRevisions(response.data);
        setTotalItems(response.pagination.total);
        setTotalPages(response.pagination.totalPages || 1);
      } catch (loadError) {
        if (cancelled || seq !== requestSeqRef.current) return;
        if (import.meta.env.DEV) {
          console.error("Failed to load revisions", loadError);
        }
        setRevisions([]);
        setTotalItems(0);
        setTotalPages(1);
        setError(t("documentTable.loadRevisionsFailed"));
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
    if (viewType === "pending-review") {
      setStatusFilter("PENDING_REVIEW" as DocumentStatus);
    } else if (viewType === "pending-approval") {
      setStatusFilter("PENDING_APPROVAL" as DocumentStatus);
    } else {
      setStatusFilter("All");
    }
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

  const exportRevisions = async () => {
    setIsExporting(true);
    try {
      const blob = await documentApi.exportRevisions({
        search: effectiveSearch || undefined,
        status: statusFilter === "All" ? undefined : statusFilter,
        documentType: typeFilter === "All" ? undefined : typeFilter,
        businessUnit: businessUnitFilter === "All" ? undefined : businessUnitFilter,
        department: departmentFilter === "All" ? undefined : departmentFilter,
        relatedDocument: relatedDocumentFilter === "All" ? undefined : relatedDocumentFilter,
        correlatedDocument: correlatedDocumentFilter === "All" ? undefined : correlatedDocumentFilter,
        isTemplate: templateFilter === "All" ? undefined : templateFilter,
        authorId: viewType === "owned-by-me"
          ? (currentUser?.id || undefined)
          : authorFilter !== "All"
            ? authorFilter
            : undefined,
        createdFrom: createdFromDate || undefined,
        createdTo: createdToDate || undefined,
        effectiveFrom: effectiveFromDate || undefined,
        effectiveTo: effectiveToDate || undefined,
        validFrom: validFromDate || undefined,
        validTo: validToDate || undefined,
        ownedByMe: viewType === "owned-by-me",
        pending: viewType === "pending-review" || viewType === "pending-approval",
        sortBy: sortConfig.key,
        sortDirection: sortConfig.direction,
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "revisions-export.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (exportError) {
      if (import.meta.env.DEV) {
        console.error("Failed to export revisions", exportError);
      }
      showToast({
        type: "error",
        title: t("documentTable.exportFailedTitle"),
        message: t("documentTable.exportRevisionsFailed"),
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

  const currentUserLabel = (currentUser as any)?.employeeCode
    ? `${(currentUser as any).employeeCode} - ${currentUser?.fullName}`
    : currentUser?.fullName || currentUser?.username;

  const authorOptions = useMemo<SelectOption[]>(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewType, filtersLookup.authors, currentUser, authorFilter, currentUserLabel]);

  const searchAuthors = useCallback(async (query: string): Promise<SelectOption[]> => {
    const response = await documentApi.getRevisionFilters(query);
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
    revisions,
    isLoading,
    isExporting,
    isLookupLoading,
    error,
    sortConfig,
    handleSort,
    clearFilters,
    reload,
    exportRevisions,
    statusOptions,
    typeOptions,
    businessUnitOptions,
    departmentOptions,
    authorOptions,
    searchAuthors,
    authorFilterDisabled: viewType === "owned-by-me",
    currentAuthorLabel: viewType === "owned-by-me"
      ? (currentUserLabel || "Current User")
      : undefined,
  };
}
