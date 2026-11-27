import { useEffect, useState } from 'react';
import { useDebounce } from '@/hooks';
import { getApiErrorMessage } from '@/utils/apiError';
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { useViewState, useViewFilterChange } from "@/hooks/useViewState";

type Direction = 'asc' | 'desc';

interface Loaded<R> {
  data: R[];
  pagination: { total: number; totalPages: number };
}

/** What every server-side list of these screens keeps: search (debounced), filters, sort and page. The server does all of it. */
export function useServerList<R, K extends string>(
  load: (args: { search?: string; filters: Record<string, string>; sortBy: K; sortDirection: Direction; page: number; limit: number }) => Promise<Loaded<R>>,
  initial: { sort: K; direction?: Direction; filters: Record<string, string> },
  failure: string,
  viewKey = "notification-list",
) {
  const [search, setSearch] = useViewState(`${viewKey}.search`, '');
  const debounced = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const [filters, setFilters] = useViewState<Record<string, string>>(`${viewKey}.filters`, initial.filters);
  const [sort, setSort] = useViewState<{ key: K; direction: Direction }>(`${viewKey}.sort`, { key: initial.sort, direction: initial.direction ?? 'asc' });
  const [page, setPage] = useViewState(`${viewKey}.page`, 1);
  const [pageSize, setPageSize] = useViewState(`${viewKey}.pageSize`, 10);
  const [rows, setRows] = useState<R[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState('');
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    let live = true;
    setLoading(true);
    load({ search: debounced.trim() || undefined, filters, sortBy: sort.key, sortDirection: sort.direction, page, limit: pageSize })
      .then((data) => {
        if (!live) return;
        setRows(data.data);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.totalPages || 1);
        setError('');
      })
      .catch((e) => {
        if (!live) return;
        setRows([]);
        setTotal(0);
        setError(getApiErrorMessage(e, failure));
      })
      .finally(() => {
        if (!live) return;
        setLoading(false);
        setHasLoaded(true);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, filterKey, sort, page, pageSize]);

  useViewFilterChange(() => setPage(1), [debounced, filterKey, pageSize]);

  const sortFor = (key: K) => ({
    direction: sort.key === key ? sort.direction : undefined,
    onSort: () => {
      setSort((prev) => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
      setPage(1);
    },
  });
  const setFilter = (id: string) => (value: string) => setFilters((prev) => ({ ...prev, [id]: value }));
  const clear = () => {
    setSearch('');
    setFilters(initial.filters);
    setPage(1);
  };
  return { search, setSearch, filters, setFilter, page, setPage, pageSize, setPageSize, rows, total, totalPages, loading, hasLoaded, error, sortFor, clear };
}
