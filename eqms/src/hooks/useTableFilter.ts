import { useState, useMemo, useCallback } from 'react';

export interface UseTableFilterOptions<T> {
  /** Initial page size (default: 10) */
  defaultPageSize?: number;
  /** Custom filter function — return true if item should be visible */
  filterFn?: (item: T, search: string) => boolean;
}

export interface UseTableFilterReturn<T> {
  // --- Search ---
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // --- Pagination ---
  currentPage: number;
  setCurrentPage: (page: number) => void;
  itemsPerPage: number;
  setItemsPerPage: (size: number) => void;
  totalPages: number;

  // --- Derived data ---
  /** Matches the current search query (full, unpaginated) */
  filteredItems: T[];
  /** The slice for the current page */
  paginatedItems: T[];

  /** Reset search + pagination to initial state */
  resetFilter: () => void;
}

/**
 * Generic search + pagination hook for data tables.
 *
 * Replaces the repetitive filter/pagination pattern inside Dictionary tabs
 * and can be used wherever simple text-filter + paginate is needed.
 *
 * @example
 * ```tsx
 * const { searchQuery, setSearchQuery, paginatedItems, currentPage,
 *         setCurrentPage, totalPages, itemsPerPage, setItemsPerPage }
 *   = useTableFilter(MOCK_DEPARTMENTS, {
 *       filterFn: (item, q) =>
 *         item.name.toLowerCase().includes(q) ||
 *         item.abbreviation.toLowerCase().includes(q),
 *     });
 * ```
 */
export function useTableFilter<T>(
  data: T[],
  options: UseTableFilterOptions<T> = {}
): UseTableFilterReturn<T> {
  const { defaultPageSize = 10, filterFn } = options;

  const [searchQuery, setSearchQueryInternal] = useState('');
  const [currentPage, setCurrentPageInternal] = useState(1);
  const [itemsPerPage, setItemsPerPageInternal] = useState(defaultPageSize);

  // Reset to page 1 when search changes
  const setSearchQuery = useCallback((q: string) => {
    setSearchQueryInternal(q);
    setCurrentPageInternal(1);
  }, []);

  // Reset to page 1 when page size changes
  const setItemsPerPage = useCallback((size: number) => {
    setItemsPerPageInternal(size);
    setCurrentPageInternal(1);
  }, []);

  const setCurrentPage = useCallback((page: number) => {
    setCurrentPageInternal(page);
  }, []);

  const filteredItems = useMemo(() => {
    if (!filterFn) return searchQuery.trim() ? data : data;
    const q = searchQuery.toLowerCase().trim();
    return data.filter((item) => filterFn(item, q));
  }, [data, searchQuery, filterFn]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const resetFilter = useCallback(() => {
    setSearchQueryInternal('');
    setCurrentPageInternal(1);
    setItemsPerPageInternal(defaultPageSize);
  }, [defaultPageSize]);

  return {
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    filteredItems,
    paginatedItems,
    resetFilter,
  };
}
