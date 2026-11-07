import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/form/SearchInput";
import { cn } from "@/components/ui/utils";

export interface ScrollListPage<T> {
  items: T[];
  total: number;
}

interface ShareScrollListProps<T> {
  ariaLabel: string;
  /** Reads one page from the server; called as the list is scrolled, never for the whole list. */
  fetchPage: (query: { search: string; offset: number; limit: number }) => Promise<ScrollListPage<T>>;
  renderRow: (item: T) => React.ReactNode;
  getKey: (item: T) => string;
  searchPlaceholder: string;
  /** Said when the list is empty and nobody searched. */
  emptyText: string;
  /** A change of this value reads the list again from the top (after something was added or removed). */
  reloadKey?: unknown;
  /** Height of one row: rows are all the same height so the list knows where each one is without reading it. */
  rowHeight?: number;
  /** How many rows show before the list scrolls. */
  visibleRows?: number;
  pageSize?: number;
  /** Beside the search bar (a filter, a "Remove all"). */
  toolbar?: React.ReactNode;
  /** Told how many rows the server has (for a count in a heading, or to show a button only when there is something to remove). */
  onTotal?: (total: number) => void;
  /** Above the search bar. */
  header?: React.ReactNode;
}

const SEARCH_DELAY_MS = 250;

/**
 * A list of at most {@code visibleRows} rows that scrolls, with a search bar. It reads the server one page at a time as the person scrolls: the
 * pages near the rows on screen are kept, the ones far above or below are let go (a spacer keeps the scroll bar true), so a list of thousands
 * is never held whole. Every row has the same height, which is what lets the list know where the row at any position is.
 */
export function ShareScrollList<T>({
  ariaLabel,
  fetchPage,
  renderRow,
  getKey,
  searchPlaceholder,
  emptyText,
  reloadKey,
  rowHeight = 60,
  visibleRows = 6,
  pageSize = 20,
  toolbar,
  onTotal,
  header,
}: ShareScrollListProps<T>) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [pages, setPages] = useState<Record<number, T[]>>({});
  const [total, setTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const asking = useRef<Set<number>>(new Set());
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const totalRef = useRef<((total: number) => void) | undefined>(undefined);
  totalRef.current = onTotal;

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async (page: number, forGeneration: number, q: string) => {
    if (asking.current.has(page)) return;
    asking.current.add(page);
    try {
      const result = await fetchRef.current({ search: q, offset: page * pageSize, limit: pageSize });
      if (forGeneration !== generation.current) return;
      setPages((current) => ({ ...current, [page]: result.items }));
      setTotal(result.total);
      setFailed(false);
      totalRef.current?.(result.total);
    } catch {
      if (forGeneration === generation.current) setFailed(true);
    } finally {
      asking.current.delete(page);
    }
  }, [pageSize]);

  // which pages the rows on screen need, and which pages are far enough away to let go
  const settle = useCallback((forGeneration: number, q: string, knownTotal: number | null) => {
    const top = scroller.current?.scrollTop ?? 0;
    const first = Math.floor(top / rowHeight);
    const last = first + visibleRows - 1;
    const wantFirst = Math.floor(first / pageSize);
    const wantLast = Math.floor(last / pageSize);
    const lastPage = knownTotal === null ? wantLast : Math.max(0, Math.floor((knownTotal - 1) / pageSize));
    const needed: number[] = [];
    for (let p = wantFirst; p <= Math.min(wantLast + 1, lastPage); p += 1) needed.push(p);
    needed.forEach((p) => void load(p, forGeneration, q));
    setPages((current) => {
      const keys = Object.keys(current).map(Number);
      if (keys.every((k) => k >= wantFirst - 1 && k <= wantLast + 1)) return current;
      const kept: Record<number, T[]> = {};
      keys.filter((k) => k >= wantFirst - 1 && k <= wantLast + 1).forEach((k) => { kept[k] = current[k]; });
      return kept;
    });
  }, [load, pageSize, rowHeight, visibleRows]);

  // a new search or a reload reads from the top
  useEffect(() => {
    generation.current += 1;
    asking.current.clear();
    setPages({});
    setTotal(null);
    setFailed(false);
    if (scroller.current) scroller.current.scrollTop = 0;
    void load(0, generation.current, query);
  }, [query, reloadKey, load]);

  const known = total ?? 0;
  const shown = Math.min(Math.max(known, 1), visibleRows);
  const rows = Object.entries(pages).flatMap(([page, items]) => items.map((item, i) => ({ item, index: Number(page) * pageSize + i })));
  const viewportFirst = Math.floor((scroller.current?.scrollTop ?? 0) / rowHeight);
  const missing = total !== null && !failed && rows.length === 0 && known > 0;

  return (
    <div className="space-y-2.5" aria-label={ariaLabel} role="region">
      {header}
      <div className="flex items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder={searchPlaceholder} ariaLabel={searchPlaceholder} className="min-w-0 flex-1" />
        {toolbar}
      </div>

      {failed ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-700">
          <span>Could not load the list.</span>
          <Button size="sm" variant="outline" onClick={() => settle(generation.current, query, total)}>Try again</Button>
        </div>
      ) : total === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-3 text-xs text-slate-500">
          {query ? "Nobody matches your search." : emptyText}
        </p>
      ) : (
        <>
          <div
            ref={scroller}
            onScroll={() => settle(generation.current, query, total)}
            className="relative overflow-y-auto rounded-lg border border-slate-200 bg-white"
            style={{ height: total === null ? rowHeight * 2 : shown * rowHeight + 2 }}
            data-testid="scroll-list"
          >
            <div style={{ height: known * rowHeight, position: "relative" }}>
              {rows.map(({ item, index }) => (
                <div
                  key={getKey(item)}
                  className={cn("absolute inset-x-0 flex items-center border-b border-slate-100 px-3 last:border-b-0")}
                  style={{ top: index * rowHeight, height: rowHeight }}
                >
                  {renderRow(item)}
                </div>
              ))}
              {(total === null || missing || rows.length === 0) && (
                <p className="absolute inset-x-0 px-3 py-4 text-xs text-slate-500" style={{ top: viewportFirst * rowHeight }}>Loading...</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
