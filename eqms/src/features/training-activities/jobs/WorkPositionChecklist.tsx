import { useViewState, useViewFilterChange } from "@/hooks/useViewState";
import { useEffect, useId, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { SearchInput } from "@/components/ui/form/SearchInput";
import { Select } from "@/components/ui/select/Select";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { useDebounce } from "@/hooks/useDebounce";
import { trainingMatrixApi, type TrainingPosition } from "@/services/api/trainingActivities";
import { tr } from "@/i18n";

const ALL = "ALL";

/**
 * The Work Positions that can be given, as a list that is ticked, grouped by department. Search, the department filter and the pages are done by the server;
 * a Work Position that is already held is not offered.
 */
export function WorkPositionChecklist({ selectedIds, excludedIds, onToggle, departmentId }: {
  selectedIds: string[];
  /** Held already: not offered again. */
  excludedIds: string[];
  onToggle: (position: TrainingPosition) => void;
  /** Only this department is offered; the department filter is then not shown. */
  departmentId?: string;
}) {
  const baseId = useId();
  const [query, setQuery] = useState("");
  const [chosenDepartment, setDepartment] = useState(ALL);
  const department = departmentId ?? chosenDepartment;
  const [page, setPage] = useViewState("WorkPositionChecklist.page", 1);
  const [limit, setLimit] = useState(20);
  const [rows, setRows] = useState<TrainingPosition[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [total, setTotal] = useState({ items: 0, pages: 0 });
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [attempt, setAttempt] = useState(0);
  const search = useDebounce(query, SEARCH_DEBOUNCE_MS);
  const excluded = excludedIds.join(",");

  useViewFilterChange(() => setPage(1), [search, department, excluded]);
  useEffect(() => {
    let cancelled = false;
    setState("loading");
    trainingMatrixApi
      .positionsPage({ search: search.trim() || undefined, departmentId: department === ALL ? undefined : department, exclude: excluded || undefined, page, limit })
      .then((result) => {
        if (cancelled) return;
        setRows(result.data);
        setDepartments(result.departments);
        setTotal({ items: result.pagination.total, pages: result.pagination.totalPages });
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [search, department, excluded, page, limit, attempt]);

  const groups: [string, TrainingPosition[]][] = [];
  rows.forEach((p) => {
    const name = p.departmentName ?? "";
    const last = groups[groups.length - 1];
    if (last && last[0] === name) last[1].push(p);
    else groups.push([name, [p]]);
  });
  const searchId = `${baseId}-search`;

  return (
    <div className="space-y-3">
      <div className={departmentId ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]"}>
        <div className="min-w-0">
          <label htmlFor={searchId} className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">{tr("Search")}</label>
          <SearchInput value={query} onChange={setQuery} placeholder="Search by Work Position, code or department..." inputProps={{ id: searchId }} />
        </div>
        {!departmentId && (
          <div className="min-w-0">
            <Select
              label={tr("Department")}
              value={department}
              onChange={setDepartment}
              options={[{ label: tr("All departments"), value: ALL }, ...departments.map((d) => ({ label: d.name, value: d.id }))]}
            />
          </div>
        )}
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="max-h-96 overflow-y-auto">
          {state === "loading" && (
            <div className="space-y-3 p-3" role="status" aria-label={tr("Loading...")}>
              {[0, 1, 2, 3].map((n) => <div key={n} className="h-5 animate-pulse rounded bg-slate-100" />)}
            </div>
          )}
          {state === "error" && (
            <p role="alert" className="px-3 py-8 text-center text-sm text-red-700">
              {tr("The Work Positions could not be loaded.")}{" "}
              <button type="button" className="font-medium underline" onClick={() => setAttempt((a) => a + 1)}>{tr("Try again")}</button>
            </p>
          )}
          {state === "ready" && rows.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">{tr("No matching Work Position")}</p>}
          {state === "ready" && groups.map(([name, list]) => (
            <section key={name} aria-label={name}>
              <h4 className="sticky top-0 z-10 truncate border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{name}</h4>
              <ul>
                {list.map((p) => {
                  const checked = selectedIds.includes(p.id);
                  const id = `${baseId}-${p.id}`;
                  return (
                    <li key={p.id} className={`flex min-h-11 items-center gap-3 border-b border-slate-100 px-3 ${checked ? "bg-emerald-50/60" : "hover:bg-slate-50"}`}>
                      <Checkbox id={id} checked={checked} onChange={() => onToggle(p)} />
                      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-x-3 py-2.5 text-sm text-slate-800 sm:flex-row sm:items-center sm:justify-between">
                        <span className="min-w-0 break-words">{p.name}</span>
                        <span className="min-w-0 break-all text-xs text-slate-400 sm:shrink-0">{p.code}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
        {total.items > 0 && (
          <TablePagination
            currentPage={page}
            totalPages={total.pages}
            totalItems={total.items}
            itemsPerPage={limit}
            onPageChange={setPage}
            onItemsPerPageChange={setLimit}
            isLoading={state === "loading"}
          />
        )}
      </div>
    </div>
  );
}
