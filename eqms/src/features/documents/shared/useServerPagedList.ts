import { useEffect, useRef, useState } from "react";

export interface ServerPage<T> {
  data: T[];
  pagination?: { page?: number; limit?: number; total?: number; totalPages?: number };
}

/**
 * Loads one page of a list from the server whenever the request parameters change.
 *
 * Search, sort and paging all happen on the server; `fetchPage` closes over the current parameters and `deps` lists them
 * (plus anything else that should trigger a reload). Only the newest request may update the state, so a slow earlier
 * response can never overwrite a later one. `items` keeps showing the previous page while the next one loads.
 */
export function useServerPagedList<T>(
  fetchPage: () => Promise<ServerPage<T>>,
  deps: ReadonlyArray<unknown>,
  enabled = true,
) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const sequence = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setTotal(0);
      setTotalPages(1);
      setLoading(false);
      return;
    }
    const requestId = ++sequence.current;
    setLoading(true);
    setError(null);
    fetchPage()
      .then((response) => {
        if (requestId !== sequence.current) return;
        const data = Array.isArray(response?.data) ? response.data : [];
        setItems(data);
        setTotal(response?.pagination?.total ?? data.length);
        setTotalPages(Math.max(1, response?.pagination?.totalPages ?? 1));
      })
      .catch((err) => {
        if (requestId !== sequence.current) return;
        console.error("Failed to load list page", err);
        setError("Failed to load the list.");
        setItems([]);
        setTotal(0);
        setTotalPages(1);
      })
      .finally(() => {
        if (requestId !== sequence.current) return;
        setLoading(false);
        setHasLoadedOnce(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { items, total, totalPages, loading, error, hasLoadedOnce };
}
