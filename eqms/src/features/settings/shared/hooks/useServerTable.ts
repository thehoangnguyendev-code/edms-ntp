import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDebounce } from "@/hooks";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { persistedKey, readPersisted, writePersisted } from "@/hooks/usePersistedState";
import { useEntityChanged, type ChangedEntityType } from "@/features/realtime/useEntityChanged";

export type ServerPageResponse<T> = { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
export type ServerQuery = Record<string, string | number | boolean | undefined>;
type SortConfig = { key: string; direction: "asc" | "desc" };

const TABLE_PARAMS = ["search", "page", "limit", "sortBy", "sortDirection"];
type SavedTable = { search: string; page: number; limit: number; sort: SortConfig };

/** The direction written in the address; only a list that sorts ascending by default may leave it out, so "asc" must be read as asc and not as the default. */
const readDirection = (value: string | null, fallback: "asc" | "desc"): "asc" | "desc" => (value === "asc" || value === "desc" ? value : fallback);

export function useServerTable<T>({ fetcher, defaultSortBy, defaultSortDirection = "asc", extraParams = {}, searchDelayMs = 300, initialItemsPerPage = 10, syncToUrl = true, persistKey, liveTypes }: {
  fetcher: (params: ServerQuery) => Promise<ServerPageResponse<T>>;
  defaultSortBy: string; defaultSortDirection?: "asc" | "desc"; extraParams?: ServerQuery;
  searchDelayMs?: number; initialItemsPerPage?: number;
  /** Disable for independent tables inside tabs that share one route. */
  syncToUrl?: boolean;
  /** Keeps search, page, page size and sort for the browser tab, so coming back from a detail screen finds the list as it was left. */
  persistKey?: string;
  /** Refreshes the rows by itself, without a loading flash, when the server announces that one of these entity types changed. */
  liveTypes?: ChangedEntityType[];
}) {
  const { user } = useAuth() as { user?: { id?: string } | null };
  const storageKey = persistKey ? persistedKey(user?.id, persistKey) : undefined;
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  // The address wins when it carries the table state (a shared link); otherwise the state saved for this tab is used.
  const urlHasState = syncToUrl && TABLE_PARAMS.some((name) => searchParams.has(name));
  const saved = useState<SavedTable | undefined>(() => (urlHasState ? undefined : readPersisted<SavedTable>(storageKey)))[0];
  const [searchQuery, setSearchQuery] = useState(() => syncToUrl && urlHasState ? searchParams.get("search") ?? "" : saved?.search ?? "");
  const [currentPage, setCurrentPage] = useState(() => syncToUrl && urlHasState ? Math.max(1, Number(searchParams.get("page")) || 1) : saved?.page ?? 1);
  const [itemsPerPage, setItemsPerPage] = useState(() => syncToUrl && urlHasState ? Number(searchParams.get("limit")) || initialItemsPerPage : saved?.limit ?? initialItemsPerPage);
  const [sortConfig, setSortConfig] = useState<SortConfig>(() => syncToUrl && urlHasState
    ? { key: searchParams.get("sortBy") ?? defaultSortBy, direction: readDirection(searchParams.get("sortDirection"), defaultSortDirection) }
    : saved?.sort ?? { key: defaultSortBy, direction: defaultSortDirection });
  const [items, setItems] = useState<T[]>([]); const [totalItems, setTotalItems] = useState(0); const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true); const [refreshToken, setRefreshToken] = useState(0);
  const debouncedSearch = useDebounce(searchQuery, searchDelayMs);
  const extraParamsSignature = useMemo(() => JSON.stringify(extraParams), [extraParams]);
  useLayoutEffect(() => {
    if (!syncToUrl) return;
    // An address without table state keeps what the screen holds when that state is saved for the tab (the Back button of a detail screen goes to the bare list address).
    if (storageKey && !TABLE_PARAMS.some((name) => searchParams.has(name))) return;
    setSearchQuery(searchParams.get("search") ?? "");
    setCurrentPage(Math.max(1, Number(searchParams.get("page")) || 1));
    setItemsPerPage(Number(searchParams.get("limit")) || initialItemsPerPage);
    setSortConfig({ key: searchParams.get("sortBy") ?? defaultSortBy, direction: readDirection(searchParams.get("sortDirection"), defaultSortDirection) });
  }, [searchParams, initialItemsPerPage, defaultSortBy, defaultSortDirection, syncToUrl]);
  useEffect(() => {
    if (!syncToUrl) return;
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
  }, [searchQuery, debouncedSearch, currentPage, itemsPerPage, sortConfig, initialItemsPerPage, defaultSortBy, defaultSortDirection, searchParams, setSearchParams, syncToUrl]);
  useEffect(() => {
    if (searchQuery !== debouncedSearch) return;
    writePersisted(storageKey, { search: debouncedSearch, page: currentPage, limit: itemsPerPage, sort: sortConfig } satisfies SavedTable);
  }, [storageKey, searchQuery, debouncedSearch, currentPage, itemsPerPage, sortConfig]);
  const handleSort = (key: string) => setSortConfig((previous) => ({ key, direction: previous.key === key && previous.direction === "asc" ? "desc" : "asc" }));
  const silentRef = useRef(false);
  const reload = () => setRefreshToken((previous) => previous + 1);
  // A change announced by the server refreshes the rows in place: no loading state, the table does not flash.
  useEntityChanged(liveTypes ?? [], () => { silentRef.current = true; setRefreshToken((previous) => previous + 1); }, { enabled: Boolean(liveTypes?.length), debounceMs: 800 });
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (silentRef.current) silentRef.current = false; else setIsLoading(true);
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
