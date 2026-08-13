import { useEffect, useMemo, useState } from "react";
import { useDebounce } from "@/hooks";
import { useToast } from "@/components/ui/toast";
import { useTranslation } from "@/i18n";

export type DictionaryServerPageResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type DictionaryServerSortDirection = "asc" | "desc";

export type DictionaryServerQuery = Record<string, string | number | undefined>;

type SortConfig = {
  key: string;
  direction: DictionaryServerSortDirection;
};

interface UseDictionaryServerTableOptions<T> {
  fetcher: (params: DictionaryServerQuery) => Promise<DictionaryServerPageResponse<T>>;
  defaultSortBy: string;
  defaultSortDirection?: DictionaryServerSortDirection;
  extraParams?: DictionaryServerQuery;
  searchDelayMs?: number;
  initialItemsPerPage?: number;
}

export function useDictionaryServerTable<T>({
  fetcher,
  defaultSortBy,
  defaultSortDirection = "asc",
  extraParams = {},
  searchDelayMs = 300,
  initialItemsPerPage = 10,
}: UseDictionaryServerTableOptions<T>) {
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: defaultSortBy,
    direction: defaultSortDirection,
  });
  const [items, setItems] = useState<T[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  const debouncedSearch = useDebounce(searchQuery, searchDelayMs);
  const extraParamsSignature = useMemo(() => JSON.stringify(extraParams ?? {}), [extraParams]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const reload = () => setRefreshToken((prev) => prev + 1);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const response = await fetcher({
          ...extraParams,
          search: debouncedSearch.trim() || undefined,
          page: currentPage,
          limit: itemsPerPage,
          sortBy: sortConfig.key || defaultSortBy,
          sortDirection: sortConfig.direction,
        });

        if (cancelled) return;

        setItems(response.data);
        setTotalItems(response.pagination.total);
        setTotalPages(response.pagination.totalPages || 1);

        if (response.pagination.page !== currentPage) {
          setCurrentPage(response.pagination.page);
        }
      } catch (error) {
        if (cancelled) return;
        if (import.meta.env.DEV) {
          console.error("Failed to load dictionary table data", error);
        }
        setItems([]);
        setTotalItems(0);
        setTotalPages(1);
        showToast({
          type: "error",
          message: t("dictionary.loadFailed"),
        });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    debouncedSearch,
    currentPage,
    itemsPerPage,
    sortConfig.key,
    sortConfig.direction,
    defaultSortBy,
    extraParamsSignature,
    refreshToken,
    fetcher,
    showToast,
    t,
  ]);

  return {
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    totalItems,
    items,
    isLoading,
    sortConfig,
    handleSort,
    reload,
  };
}
