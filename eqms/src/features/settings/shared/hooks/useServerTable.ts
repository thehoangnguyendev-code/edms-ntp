import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDebounce } from "@/hooks";
import { useToast } from "@/components/ui/toast";

export type ServerPageResponse<T> = { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
export type ServerQuery = Record<string, string | number | boolean | undefined>;
type SortConfig = { key: string; direction: "asc" | "desc" };

export function useServerTable<T>({ fetcher, defaultSortBy, defaultSortDirection = "asc", extraParams = {}, searchDelayMs = 300, initialItemsPerPage = 10 }: {
  fetcher: (params: ServerQuery) => Promise<ServerPageResponse<T>>;
  defaultSortBy: string; defaultSortDirection?: "asc" | "desc"; extraParams?: ServerQuery;
  searchDelayMs?: number; initialItemsPerPage?: number;
}) {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("search") ?? "");
  const [currentPage, setCurrentPage] = useState(() => Math.max(1, Number(searchParams.get("page")) || 1));
  const [itemsPerPage, setItemsPerPage] = useState(() => Number(searchParams.get("limit")) || initialItemsPerPage);
  const [sortConfig, setSortConfig] = useState<SortConfig>(() => ({ key: searchParams.get("sortBy") ?? defaultSortBy, direction: searchParams.get("sortDirection") === "desc" ? "desc" : defaultSortDirection }));
  const [items, setItems] = useState<T[]>([]); const [totalItems, setTotalItems] = useState(0); const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true); const [refreshToken, setRefreshToken] = useState(0);
  const debouncedSearch = useDebounce(searchQuery, searchDelayMs);
  const extraParamsSignature = useMemo(() => JSON.stringify(extraParams), [extraParams]);
  useLayoutEffect(() => {
    setSearchQuery(searchParams.get("search") ?? "");
    setCurrentPage(Math.max(1, Number(searchParams.get("page")) || 1));
    setItemsPerPage(Number(searchParams.get("limit")) || initialItemsPerPage);
    setSortConfig({ key: searchParams.get("sortBy") ?? defaultSortBy, direction: searchParams.get("sortDirection") === "desc" ? "desc" : defaultSortDirection });
  }, [searchParams, initialItemsPerPage, defaultSortBy, defaultSortDirection]);
  useEffect(() => {
    if (searchQuery !== debouncedSearch) return;
    const params = new URLSearchParams();
    // Keep route-specific filters (for example Countries' region) intact while
    // this shared hook owns the common table parameters.
    for (const [key, value] of searchParams) {
      if (!["search", "page", "limit", "sortBy", "sortDirection"].includes(key)) {
        params.append(key, value);
      }
    }
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (currentPage > 1) params.set("page", String(currentPage));
    if (itemsPerPage !== initialItemsPerPage) params.set("limit", String(itemsPerPage));
    if (sortConfig.key !== defaultSortBy) params.set("sortBy", sortConfig.key);
    if (sortConfig.direction !== defaultSortDirection) params.set("sortDirection", sortConfig.direction);
    if (params.toString() !== searchParams.toString()) setSearchParams(params, { replace: true });
  }, [searchQuery, debouncedSearch, currentPage, itemsPerPage, sortConfig, initialItemsPerPage, defaultSortBy, defaultSortDirection, searchParams, setSearchParams]);
  const handleSort = (key: string) => setSortConfig((previous) => ({ key, direction: previous.key === key && previous.direction === "asc" ? "desc" : "asc" }));
  const reload = () => setRefreshToken((previous) => previous + 1);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await fetcher({ ...extraParams, search: debouncedSearch.trim() || undefined, page: currentPage, limit: itemsPerPage, sortBy: sortConfig.key || defaultSortBy, sortDirection: sortConfig.direction });
        if (cancelled) return;
        setItems(response.data); setTotalItems(response.pagination.total); setTotalPages(response.pagination.totalPages || 1);
        if (response.pagination.page !== currentPage) setCurrentPage(response.pagination.page);
      } catch (error) {
        if (cancelled) return;
        if (import.meta.env.DEV) console.error("Failed to load settings table data", error);
        setItems([]); setTotalItems(0); setTotalPages(1);
        showToast({ type: "error", message: "Unable to load data. Please try again." });
      } finally { if (!cancelled) setIsLoading(false); }
    };
    void load(); return () => { cancelled = true; };
  }, [debouncedSearch, currentPage, itemsPerPage, sortConfig.key, sortConfig.direction, defaultSortBy, extraParamsSignature, refreshToken, fetcher, showToast]);
  return { searchQuery, setSearchQuery, currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, totalPages, totalItems, items, isLoading, sortConfig, handleSort, reload };
}
