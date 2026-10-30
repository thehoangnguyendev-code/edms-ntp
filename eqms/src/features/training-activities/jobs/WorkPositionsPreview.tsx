import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { FilterSearchInput } from "@/components/ui/filter/FilterSearchInput";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useDebounce } from "@/hooks/useDebounce";
import { trainingJobsApi, trainingMatrixApi } from "@/services/api/trainingActivities";

type Position = { id: string; name: string; carried: boolean; department?: string };

export function WorkPositionsPreview({ assignmentId, personId, personName, positions, totalCount, fallback, limit = 2 }: {
  assignmentId?: string; personId?: string; personName: string; positions?: Position[]; totalCount?: number; fallback?: string | null; limit?: number;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [retry, setRetry] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(search, 300);
  useEffect(() => {
    if (!open || search !== debouncedSearch) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    const request = personId ? trainingMatrixApi.personPositionDetails(personId, debouncedSearch, page)
      : trainingJobsApi.positions(assignmentId!, debouncedSearch, page);
    request.then((response) => {
      if (!cancelled) {
        setResults((previous) => page === 1 ? response.data : [...previous, ...response.data]);
        setHasMore(response.pagination.page < response.pagination.totalPages);
      }
    }).catch(() => { if (!cancelled) setError(true); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [assignmentId, personId, search, debouncedSearch, open, page, retry]);
  useEffect(() => {
    if (!open || loading || error || !hasMore || !sentinelRef.current || !listRef.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); setPage((previous) => previous + 1); }
    }, { root: listRef.current, rootMargin: "120px" });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [open, loading, error, hasMore, results]);
  const shown = positions?.slice(0, limit) ?? [];
  const count = totalCount ?? positions?.length ?? 0;
  const remaining = Math.max(0, count - shown.length);
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 whitespace-normal">
        {shown.map((position) => <Badge key={position.id} color="slate" className="max-w-full whitespace-normal break-words">{position.name}{position.carried ? " (held before)" : ""}</Badge>)}
        {!positions && fallback && <span className="max-w-56 truncate text-xs text-slate-700" title={fallback}>{fallback}</span>}
        {positions?.length === 0 && <span className="text-slate-400">—</span>}
        {(remaining > 0 || (!positions && Boolean(fallback))) && <button type="button" onClick={() => { setSearch(""); setPage(1); setResults([]); setHasMore(false); setOpen(true); }} className="rounded-md px-1 py-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500" aria-label={`View all work positions for ${personName}`}>{positions ? `+${remaining}` : "View positions"}</button>}
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title="Work Positions" subtitle={positions ? `${personName} · ${count} positions` : personName} bodyClassName="flex flex-col overflow-hidden p-0 md:p-0">
        <div className="shrink-0 border-b border-slate-200 bg-white p-4">
          <FilterSearchInput aria-label="Search work positions" value={search} onChange={(value) => { setSearch(value); setPage(1); setResults([]); setHasMore(false); }} placeholder="Search work positions…" />
        </div>
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4" aria-busy={loading}>
          {results.length > 0 && <ol data-record-list className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {results.map((position, index) => <li key={position.id} className="flex items-start gap-3 px-3 py-3"><span className="w-7 shrink-0 text-right text-sm font-medium leading-5 tabular-nums text-slate-500">{index + 1}.</span><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium leading-5 text-slate-800">{position.name}</p>{position.department && <p className="mt-1 text-xs text-slate-500">{position.department}</p>}</div>{position.carried && <Badge color="slate">Held before</Badge>}</li>)}
          </ol>}
          {loading && <SectionLoading text="Loading work positions…" />}
          {error && <p role="alert" className="py-3 text-sm text-red-700">Unable to load work positions. <button type="button" className="underline" onClick={() => setRetry((value) => value + 1)}>Try again</button></p>}
          {!loading && !error && results.length === 0 && search === debouncedSearch && <p className="text-sm text-slate-500">No work positions found.</p>}
          {hasMore && !loading && !error && <div ref={sentinelRef} className="py-3 text-center"><button type="button" onClick={() => setPage((previous) => previous + 1)} className="text-sm font-medium text-emerald-700 underline">Load more</button></div>}
        </div>
      </Drawer>
    </>
  );
}
