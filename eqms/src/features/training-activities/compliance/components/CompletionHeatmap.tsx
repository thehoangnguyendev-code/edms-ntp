import { TableMarkup } from "@/components/ui/table/TablePrimitives";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Check, Clock, Minus, RefreshCw, TriangleAlert, X } from "lucide-react";
import { Progress } from "@/components/ui/progress/Progress";
import type { CompletionCell, CompletionColumn, CompletionPerson, CompletionState } from "@/services/api/trainingActivities";

/** How a cell of each state looks: the whole cell is tinted and carries an icon and the name of the state, so it reads at a glance. */
export const STATE_STYLE: Record<CompletionState, { label: string; fill: string; text: string; icon: ReactNode }> = {
  QUALIFIED: { label: "Qualified", fill: "bg-emerald-50 hover:bg-emerald-100", text: "text-emerald-700", icon: <Check className="h-4 w-4" strokeWidth={3} /> },
  IN_PROGRESS: { label: "In progress", fill: "bg-sky-50 hover:bg-sky-100", text: "text-sky-700", icon: <Clock className="h-4 w-4" /> },
  UPDATE_NEEDED: { label: "Update needed", fill: "bg-amber-50 hover:bg-amber-100", text: "text-amber-700", icon: <TriangleAlert className="h-4 w-4" /> },
  DUE: { label: "Annual due", fill: "bg-orange-50 hover:bg-orange-100", text: "text-orange-700", icon: <RefreshCw className="h-4 w-4" /> },
  REQUIRED: { label: "Required", fill: "bg-red-50 hover:bg-red-100", text: "text-red-700", icon: <X className="h-4 w-4" strokeWidth={3} /> },
  NOT_REQUIRED: { label: "Not required", fill: "", text: "text-slate-300", icon: <Minus className="h-4 w-4" /> },
};
const STATE_ORDER = Object.keys(STATE_STYLE) as CompletionState[];
const GROUP_TAG: Record<CompletionColumn["group"], string> = { FACTORY_GENERAL: "Factory", DEPARTMENT_GENERAL: "Department", SOP: "SOP" };

/** The key of the colours: each state as the cell shows it. */
export function CompletionKey() {
  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Legend">
      <li className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Legend</li>
      {STATE_ORDER.map((s) => (
        <li key={s} className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-medium ${STATE_STYLE[s].fill.split(" ")[0]} ${s === "NOT_REQUIRED" ? "bg-slate-50 text-slate-500" : STATE_STYLE[s].text}`}>
          <span className="[&_svg]:h-3 [&_svg]:w-3">{STATE_STYLE[s].icon}</span>{STATE_STYLE[s].label}
        </li>
      ))}
    </ul>
  );
}

/** Every person is one row of this height, so the rows that are in view can be worked out from the scroll position. */
const ROW_H = 64;
const OVERSCAN = 6;
/** The next page is asked for when the scroll is this close to the end. */
const NEAR_END = 360;
const W_NO = 56;
const W_NAME = 230;
const W_DONE = 190;
const SHADOW = "shadow-[4px_0_6px_-4px_rgba(15,23,42,0.18)]";

/**
 * Persons against the rows of the effective matrix. Each column heads with the code over the title, each cell is filled with the colour of its state and
 * names it; a person reads across, a row of the matrix reads down. Nothing is calculated here: every state comes from the server.
 */
export function CompletionHeatmap({ people, columns, firstNo, onPick, loading, loadingMore, onNearEnd }: {
  people: CompletionPerson[];
  columns: CompletionColumn[];
  firstNo: number;
  onPick: (person: CompletionPerson, column: CompletionColumn, cell: CompletionCell) => void;
  loading?: boolean;
  /** The next page is on its way. */
  loadingMore?: boolean;
  /** The scroll is near the end of what is loaded: the caller loads the next page if there is one. */
  onNearEnd?: () => void;
}) {
  const [hotCol, setHotCol] = useState<string>();
  const box = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLTableSectionElement>(null);
  const frame = useRef(0);
  const [win, setWin] = useState({ top: 0, height: 600 });

  // Reads the scroll position at most once per frame, and asks for more when the end is near.
  const measure = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = box.current;
      if (!el) return;
      setWin((w) => (Math.abs(w.top - el.scrollTop) < ROW_H / 2 && w.height === (el.clientHeight || 600) ? w : { top: el.scrollTop, height: el.clientHeight || 600 }));
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - NEAR_END) onNearEnd?.();
    });
  }, [onNearEnd]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  // A new list (another position, another filter) starts at the top.
  const firstId = people[0]?.personId;
  useLayoutEffect(() => { if (box.current) box.current.scrollTop = 0; }, [firstId]);
  // A page that does not fill the box cannot be scrolled, so it asks for the next one itself.
  useLayoutEffect(() => { measure(); }, [measure, people.length]);

  const headH = head.current?.offsetHeight ?? 0;
  const first = Math.max(0, Math.floor((win.top - headH) / ROW_H) - OVERSCAN);
  const last = Math.min(people.length, Math.ceil((win.top + win.height - headH) / ROW_H) + OVERSCAN);
  const shown = people.slice(first, last);
  const span = 3 + columns.length;
  return (
    <div ref={box} onScroll={measure} className={`max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white transition-opacity ${loading ? "opacity-60" : ""}`} onMouseLeave={() => setHotCol(undefined)} aria-busy={loading}>
      <TableMarkup.Root className="w-full min-w-max border-separate border-spacing-0 text-sm">
        <TableMarkup.Head ref={head} className="sticky top-0 z-30">
          <TableMarkup.Row>
            <TableMarkup.HeaderCell style={{ left: 0, minWidth: W_NO, width: W_NO }} className="sticky z-40 border-b border-r border-slate-200 bg-slate-50 px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">No</TableMarkup.HeaderCell>
            <TableMarkup.HeaderCell style={{ left: W_NO, minWidth: W_NAME, width: W_NAME }} className="sticky z-40 border-b border-r border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Employee</TableMarkup.HeaderCell>
            <TableMarkup.HeaderCell style={{ left: W_NO + W_NAME, minWidth: W_DONE, width: W_DONE }} className={`sticky z-40 border-b border-r border-slate-300 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 ${SHADOW}`}>Completed</TableMarkup.HeaderCell>
            {columns.map((c) => (
              <TableMarkup.HeaderCell key={c.rowId} onMouseEnter={() => setHotCol(c.rowId)} title={`${c.code ? `${c.code} — ` : ""}${c.title}${c.annual ? " (annual)" : ""}`}
                style={{ minWidth: 150 }} className={`border-b border-r border-slate-100 px-3 py-2.5 text-left align-top font-normal ${hotCol === c.rowId ? "bg-emerald-50" : "bg-white"}`}>
                <div className="truncate text-xs font-semibold text-emerald-800">{c.code ?? "—"}</div>
                <div className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-600">{c.title}</div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span>{GROUP_TAG[c.group]}</span>
                  {c.annual && <span className="inline-flex items-center gap-0.5 text-emerald-700"><RefreshCw className="h-3 w-3" />Annual</span>}
                </div>
              </TableMarkup.HeaderCell>
            ))}
          </TableMarkup.Row>
        </TableMarkup.Head>
        <TableMarkup.Body>
          {first > 0 && <TableMarkup.Row aria-hidden="true" style={{ height: first * ROW_H }}><TableMarkup.Cell colSpan={span} className="p-0" /></TableMarkup.Row>}
          {shown.map((p, k) => {
            const i = first + k;
            const pct = p.required ? Math.round((p.done / p.required) * 100) : 0;
            return (
              <TableMarkup.Row key={p.personId} className="group" style={{ height: ROW_H }}>
                <TableMarkup.Cell style={{ left: 0 }} className="sticky z-20 h-16 border-b border-r border-slate-100 bg-white px-2 text-center text-xs tabular-nums text-slate-500 group-hover:bg-slate-50">{firstNo + i}</TableMarkup.Cell>
                <TableMarkup.Cell style={{ left: W_NO }} className="sticky z-20 h-16 overflow-hidden border-b border-r border-slate-100 bg-white px-4 group-hover:bg-slate-50">
                  <div className="truncate font-medium text-slate-900" title={p.fullName}>{p.fullName}</div>
                  <div className="flex items-center gap-x-2 whitespace-nowrap text-xs text-slate-500">{p.employeeCode ?? ""}{(p.openReviews?.length ?? 0) > 0 && <span className="rounded bg-amber-100 px-1.5 text-amber-800" title="A training review of this person is still open">Review open</span>}</div>
                </TableMarkup.Cell>
                <TableMarkup.Cell style={{ left: W_NO + W_NAME }} className={`sticky z-20 h-16 border-b border-r border-slate-300 bg-white px-4 group-hover:bg-slate-50 ${SHADOW}`}>
                  <Progress value={pct} size="sm" variant={pct === 100 ? "emerald" : pct >= 60 ? "info" : "warning"} />
                  <div className="mt-1 whitespace-nowrap text-xs tabular-nums text-slate-600">{p.done} / {p.required}{p.eligibleForAssignment && <span className="ml-1 font-medium text-emerald-700">· ready</span>}</div>
                </TableMarkup.Cell>
                {columns.map((c) => {
                  const cell = p.cells[c.rowId];
                  const st = cell ? STATE_STYLE[cell.status] : undefined;
                  if (!cell || !st) return <TableMarkup.Cell key={c.rowId} className="border-b border-r border-slate-100 text-center text-slate-300">—</TableMarkup.Cell>;
                  if (cell.status === "NOT_REQUIRED") return <TableMarkup.Cell key={c.rowId} onMouseEnter={() => setHotCol(c.rowId)} className={`border-b border-r border-slate-100 text-center text-slate-300 ${hotCol === c.rowId ? "bg-emerald-50/50" : ""}`} aria-label="Not required">—</TableMarkup.Cell>;
                  return (
                    <TableMarkup.Cell key={c.rowId} onMouseEnter={() => setHotCol(c.rowId)} className="border-b border-r border-white p-0">
                      <button type="button" title={`${st.label}: ${c.title}`} aria-label={`${st.label}: ${p.fullName}, ${c.title}`} onClick={() => onPick(p, c, cell)}
                        className={`flex h-16 w-full items-center justify-center gap-1.5 px-2 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 ${st.fill} ${st.text}`}>
                        {st.icon}<span className="whitespace-nowrap">{st.label}</span>
                      </button>
                    </TableMarkup.Cell>
                  );
                })}
              </TableMarkup.Row>
            );
          })}
          {last < people.length && <TableMarkup.Row aria-hidden="true" style={{ height: (people.length - last) * ROW_H }}><TableMarkup.Cell colSpan={span} className="p-0" /></TableMarkup.Row>}
          {loadingMore && <TableMarkup.Row><TableMarkup.Cell colSpan={span} className="px-4 py-3 text-center text-xs text-slate-500">Loading more people…</TableMarkup.Cell></TableMarkup.Row>}
        </TableMarkup.Body>
      </TableMarkup.Root>
    </div>
  );
}
