import { TableMarkup } from "@/components/ui/table/TablePrimitives";
import { Badge } from "@/components/ui/badge";
import { EXPAND_CONTENT_MOTION, useExpandTransition } from "@/components/ui/table/expandMotion";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { Fragment, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search, Trash2, X } from "lucide-react";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import type { TrainingMatrixRow, TrainingPosition } from "@/services/api/trainingActivities";

type Line = { row: TrainingMatrixRow; index: number };
type Change = { kind: "added" | "changed"; positions: Set<string>; annual: boolean };
const MotionRow = motion.create(TableMarkup.Row);

const keyOf = (r: TrainingMatrixRow) => (r.topicText ? `T${r.topicText.trim().replace(/\s+/g, " ").toLowerCase()}` : `D${r.documentId}`);

/** The three groups of rows of APD.0011 (SOP.0003 5.3.1): the training of the whole factory, of the department, and the SOP for each Work Position. */
const GROUPS: { id: TrainingMatrixRow["rowGroup"]; title: string }[] = [
  { id: "FACTORY_GENERAL", title: "General training of the whole factory" },
  { id: "DEPARTMENT_GENERAL", title: "General training of the department" },
  { id: "SOP", title: "SOP for each Work Position" },
];

const rowCode = (r: TrainingMatrixRow) => (r.topicText ? "" : r.documentNumber) ?? "";
const rowName = (r: TrainingMatrixRow) => (r.topicText ? r.topicText : r.documentName) ?? "";

// Widths of the three columns that stay in view while the positions scroll; the offsets keep them side by side.
const W_NO = 48;
const W_CODE = 120;
// Below md the first columns and the annual column do not stay in view: three pinned columns would fill a phone screen and leave no room for the Work Positions.
const STICKY_NO = { left: 0 };
const STICKY_CODE = { left: W_NO };
const W_REMOVE = 40;
const W_ANNUAL = 84;
// The annual column stays at the right edge (left of the remove button while editing) so it is seen without scrolling to the end.
const stickyAnnual = (editing: boolean) => ({ right: editing ? W_REMOVE : 0 });
const STICKY_REMOVE = { right: 0 };
const STICKY_TITLE = { left: W_NO + W_CODE };
// Widths: narrower on a phone (the numbers of md are W_NO, W_CODE, 260 and W_ANNUAL, W_REMOVE).

/**
 * The matrix of a department laid out as the form APD.0011 shows it: No, Code, Subject / Title, the work positions side by side under one
 * heading, and "Annual training required (Yes / No)". Rows are in the three groups of SOP.0003 5.3.1. The first three columns and the headings stay in
 * view while the table scrolls; pointing at a cell lights its row and its position so that the crossing is easy to read.
 */
export function TrainingMatrixGrid({ rows, positions: allPositions, editing, onToggle, onAnnual, onRemove, onAllEmployees, onLock, canLock, lockedPositionIds, baseline, baselineNo }: {
  rows: TrainingMatrixRow[];
  positions: TrainingPosition[];
  editing: boolean;
  onToggle: (index: number, positionId: string) => void;
  onAnnual: (index: number, annual: boolean) => void;
  onRemove: (index: number) => void;
  /** Ticks or unticks the column All employees of a row (a row that Quality Assurance requires cannot be unticked). */
  onAllEmployees?: (index: number, value: boolean) => void;
  /** Quality Assurance locks a row for all employees (the head of department cannot take it out) or unlocks it. */
  onLock?: (index: number, value: boolean) => void;
  canLock?: boolean;
  /** The Work Positions whose column the person cannot change (senior management: built by QA, SOP.0003 5.3.1). */
  lockedPositionIds?: string[];
  /** The rows of the version this one replaces. When given, what was added, removed or changed since then is marked. */
  baseline?: TrainingMatrixRow[];
  baselineNo?: number;
}) {
  const expandTransition = useExpandTransition();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const expandContent = (content: React.ReactNode) => <motion.div {...EXPAND_CONTENT_MOTION} transition={expandTransition} className="overflow-hidden">{content}</motion.div>;
  const [search, setSearch] = useState("");
  const [hotCol, setHotCol] = useState<string>();
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [onlyPosition, setOnlyPosition] = useState("");
  const [onlyAnnual, setOnlyAnnual] = useState("");
  // Choosing a Work Position shows the rows of that Work Position and only its column.
  const positions = useMemo(() => (onlyPosition ? allPositions.filter((p) => p.id === onlyPosition) : allPositions), [allPositions, onlyPosition]);
  const [onlyChanged, setOnlyChanged] = useState("");
  const diff = useMemo(() => {
    if (!baseline) return undefined;
    const before = new Map(baseline.map((r) => [keyOf(r), r]));
    const changes = new Map<string, Change>();
    for (const r of rows) {
      const old = before.get(keyOf(r));
      if (!old) { changes.set(keyOf(r), { kind: "added", positions: new Set(r.positionIds), annual: false }); continue; }
      const moved = new Set([...r.positionIds.filter((x) => !old.positionIds.includes(x)), ...old.positionIds.filter((x) => !r.positionIds.includes(x))]);
      const annual = old.annualRequired !== r.annualRequired;
      if (moved.size > 0 || annual) changes.set(keyOf(r), { kind: "changed", positions: moved, annual });
    }
    const now = new Set(rows.map(keyOf));
    return { changes, removed: baseline.filter((r) => !now.has(keyOf(r))) };
  }, [baseline, rows]);
  const lines = useMemo<Line[]>(() => rows.map((row, index) => ({ row, index })), [rows]);
  const needle = search.trim().toLowerCase();
  const visible = lines.filter((x) =>
    (!needle || `${rowCode(x.row)} ${rowName(x.row)}`.toLowerCase().includes(needle))
    && (!onlyPosition || x.row.positionIds.includes(onlyPosition))
    && (!onlyAnnual || x.row.annualRequired)
    && (!onlyChanged || diff?.changes.has(keyOf(x.row))));
  const filters: ReportSelectFilter[] = [
    { id: "jobRole", label: "Work Position", value: onlyPosition, options: [{ label: "All", value: "" }, ...allPositions.map((p) => ({ label: p.name, value: p.id }))], onChange: setOnlyPosition },
    { id: "annual", label: "Annual Training", value: onlyAnnual, options: [{ label: "All", value: "" }, { label: "Annual only", value: "yes" }], onChange: setOnlyAnnual },
    ...(diff ? [{ id: "changes", label: "Changes", value: onlyChanged, options: [{ label: "All", value: "" }, { label: "Changed since the previous version", value: "yes" }], onChange: setOnlyChanged }] : []),
  ];
  const filtered = Boolean(needle || onlyPosition || onlyAnnual || onlyChanged);
  const toggleGroup = (id: string) => setCollapsed(collapsed.includes(id) ? collapsed.filter((x) => x !== id) : [...collapsed, id]);
  const perPosition = useMemo(() => Object.fromEntries(positions.map((p) => [p.id, rows.filter((r) => r.positionIds.includes(p.id)).length])), [rows, positions]);
  const span = 5 + positions.length + (editing ? 1 : 0);
  const colTint = (id: string) => (hotCol === id ? "bg-emerald-50" : "");

  return (
    <ReportListToolbar
      framed={false}
      flush
      bare
      searchPlaceholder="Search a Training Topic or an SOP…"
      search={search}
      onSearch={setSearch}
      filters={filters}
      hasActiveFilters={Boolean(needle || onlyPosition || onlyAnnual || onlyChanged)}
      onClear={() => { setSearch(""); setOnlyPosition(""); setOnlyAnnual(""); setOnlyChanged(""); }}
    >
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5 text-slate-600"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-3 w-3" strokeWidth={3} /></span>The Work Position must be trained on this row</span>
      </div>
      {diff && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="font-medium">Compared with version {baselineNo}: {[...diff.changes.values()].filter((c) => c.kind === "added").length} added, {diff.removed.length} removed, {[...diff.changes.values()].filter((c) => c.kind === "changed").length} changed. Changed cells have an amber ring.</p>
          {diff.removed.length > 0 && <p className="mt-1">Removed: {diff.removed.map((r) => `${rowCode(r)} ${rowName(r)}`.trim()).join("; ")}</p>}
        </div>
      )}

      <div ref={scrollerRef} {...dragEvents} className={`max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm [container-type:inline-size] ${isDragging ? "cursor-grabbing select-none" : "cursor-grab"}`} onMouseLeave={() => { dragEvents.onMouseLeave(); setHotCol(undefined); }}>
        <TableMarkup.Root className={`w-max min-w-full border-separate border-spacing-0 text-sm ${editing ? "[--matrix-fixed-width:460px] md:[--matrix-fixed-width:648px]" : "[--matrix-fixed-width:420px] md:[--matrix-fixed-width:608px]"}`} style={{ "--matrix-role-count": Math.max(positions.length, 1) } as React.CSSProperties}>
          <TableMarkup.ColumnGroup>
            <TableMarkup.Column /><TableMarkup.Column /><TableMarkup.Column /><TableMarkup.Column />
            {Array.from({ length: Math.max(positions.length, 1) }, (_, index) => (
              <TableMarkup.Column key={index} className="w-[max(80px,calc((100cqw-var(--matrix-fixed-width))/var(--matrix-role-count)))] md:w-[max(112px,calc((100cqw-var(--matrix-fixed-width))/var(--matrix-role-count)))]" />
            ))}
            <TableMarkup.Column />
            {editing && <TableMarkup.Column />}
          </TableMarkup.ColumnGroup>
          <TableMarkup.Head className="sticky top-0 z-30">
            <TableMarkup.Row>
              <TableMarkup.HeaderCell rowSpan={2} style={STICKY_NO} className="w-8 min-w-8 md:w-12 md:min-w-12 md:sticky z-40 border-b border-r border-slate-200 bg-slate-50 px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide md:px-2 md:text-xs text-slate-600">No</TableMarkup.HeaderCell>
              <TableMarkup.HeaderCell rowSpan={2} style={STICKY_CODE} className="w-[84px] min-w-[84px] md:w-[120px] md:min-w-[120px] md:sticky z-40 border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide md:px-3 md:text-xs text-slate-600">Code</TableMarkup.HeaderCell>
              <TableMarkup.HeaderCell rowSpan={2} style={STICKY_TITLE} className="w-36 min-w-36 md:w-[260px] md:min-w-[260px] md:sticky z-40 border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide md:px-3 md:text-xs text-slate-600">Subject / Title</TableMarkup.HeaderCell>
              <TableMarkup.HeaderCell rowSpan={2} title="Every employee of the department, with or without a Work Position (SOP.0003 5.3.1)" className="w-24 min-w-24 max-w-24 border-b border-r border-slate-200 bg-blue-50 px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-normal text-blue-900 md:text-xs">All<br />employees</TableMarkup.HeaderCell>
              <TableMarkup.HeaderCell colSpan={Math.max(positions.length, 1)} className="border-b border-r border-slate-200 bg-emerald-600 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-white"><span className={`sticky left-0 block w-[min(100%,100cqw)] whitespace-nowrap text-center md:left-[428px] ${editing ? "md:w-[min(100%,calc(100cqw-580px))]" : "md:w-[min(100%,calc(100cqw-540px))]"}`}>Work Position</span></TableMarkup.HeaderCell>
              <TableMarkup.HeaderCell rowSpan={2} style={stickyAnnual(editing)} className="w-16 min-w-16 md:w-[84px] md:min-w-[84px] md:sticky md:shadow-[inset_1px_0_0_0_#e2e8f0] z-40 border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide md:px-3 md:text-xs text-slate-600">Annual training<br />required</TableMarkup.HeaderCell>
              {editing && <TableMarkup.HeaderCell rowSpan={2} style={STICKY_REMOVE} className="w-10 min-w-10 md:sticky z-40 border-b border-r border-slate-200 bg-slate-50 px-2"><span className="sr-only">Remove</span></TableMarkup.HeaderCell>}
            </TableMarkup.Row>
            <TableMarkup.Row>
              {positions.map((p) => (
                <TableMarkup.HeaderCell key={p.id} onMouseEnter={() => setHotCol(p.id)} title={p.name} className={`w-20 min-w-20 border-b border-r border-slate-200 px-1 py-2 align-middle md:w-28 md:min-w-28 md:px-2 ${hotCol === p.id ? "bg-emerald-100" : "bg-emerald-50"}`}>
                  <div className="flex min-h-12 w-full md:min-h-14 items-center justify-center">
                    <span className="whitespace-normal break-words text-center text-[10px] font-semibold leading-4 text-emerald-900 md:text-[11px] [overflow-wrap:anywhere]">{p.name}{p.seniorManagement ? " (QA)" : ""}</span>
                  </div>
                </TableMarkup.HeaderCell>
              ))}
            </TableMarkup.Row>
          </TableMarkup.Head>
          <TableMarkup.Body>
            {GROUPS.map((g) => {
              const part = visible.filter((x) => x.row.rowGroup === g.id);
              if (part.length === 0 && (filtered || rows.length > 0)) return null;
              const closed = collapsed.includes(g.id);
              return (
                <Fragment key={g.id}>
                  <TableMarkup.Row>
                    <TableMarkup.Cell colSpan={span} className="border-b border-slate-200 bg-emerald-50/70 px-3 py-2">
                      <div className="sticky left-3 flex w-[min(100%,56rem)] flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <button type="button" aria-expanded={!closed} aria-label={`${closed ? "Expand" : "Collapse"} ${g.title}`} onClick={() => toggleGroup(g.id)} className="self-center text-emerald-800"><motion.span className="block" animate={{ rotate: closed ? -90 : 0 }} transition={expandTransition}><ChevronDown className="h-4 w-4" /></motion.span></button>
                        <span className="text-xs font-semibold text-emerald-900 md:text-sm">{g.title}</span>
                        <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-xs font-medium text-emerald-800">{part.length}</span>
                      </div>
                    </TableMarkup.Cell>
                  </TableMarkup.Row>
                  <AnimatePresence initial={false}>
                  {part.length === 0 && !closed && <MotionRow key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={expandTransition}><TableMarkup.Cell colSpan={span} className="px-4 text-xs text-slate-400">{expandContent(<div className="py-3">No row in this group.</div>)}</TableMarkup.Cell></MotionRow>}
                  {!closed && part.map((x) => {
                    const change = diff?.changes.get(keyOf(x.row));
                    return (
                    <MotionRow key={keyOf(x.row)} className="group" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={expandTransition}>
                      <TableMarkup.Cell style={STICKY_NO} className="w-8 min-w-8 md:w-12 md:min-w-12 md:sticky z-20 border-b border-r border-slate-200 bg-white px-2 text-center text-xs tabular-nums text-slate-500 group-hover:bg-emerald-50">{expandContent(<div className="py-1.5">{x.index + 1}</div>)}</TableMarkup.Cell>
                      <TableMarkup.Cell style={STICKY_CODE} className="w-[84px] min-w-[84px] md:w-[120px] md:min-w-[120px] md:sticky z-20 border-b border-r border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 md:px-3 md:text-xs group-hover:bg-emerald-50">{expandContent(<div className="py-1.5">{rowCode(x.row)}</div>)}</TableMarkup.Cell>
                      <TableMarkup.Cell style={STICKY_TITLE} className="w-36 min-w-36 md:w-[260px] md:min-w-[260px] md:sticky z-20 border-b border-r border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-900 md:px-3 md:text-xs group-hover:bg-emerald-50">{expandContent(<div className="whitespace-normal py-1.5 leading-snug">{x.row.locked && <span className="mr-1.5 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">Required by QA</span>}{editing && canLock && x.row.allEmployees && onLock && <button type="button" onClick={() => onLock(x.index, !x.row.locked)} className="mr-1.5 rounded-full border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-50">{x.row.locked ? "Unlock" : "Lock for QA"}</button>}{change?.kind === "added" && <span className="mr-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">New</span>}{rowName(x.row)}</div>)}</TableMarkup.Cell>
                      <TableMarkup.Cell className="border-b border-r border-slate-200 bg-blue-50/40 p-0 text-center group-hover:bg-blue-50">
                        {expandContent(editing && (!x.row.locked || canLock) ? (
                          <button type="button" role="checkbox" aria-checked={Boolean(x.row.allEmployees)} aria-label={`All employees: ${rowCode(x.row)} ${rowName(x.row)}`} onClick={() => onAllEmployees?.(x.index, !x.row.allEmployees)}
                            className="mx-auto flex h-8 w-9 md:h-9 md:w-11 items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${x.row.allEmployees ? "border-blue-600 bg-blue-500 text-white shadow-sm" : "border-slate-300 bg-white text-transparent hover:border-blue-400"}`}><Check className="h-3 w-3" strokeWidth={3} /></span>
                          </button>
                        ) : (
                          <span className="mx-auto flex h-8 w-9 md:h-9 md:w-11 items-center justify-center" title={x.row.locked ? "Required of all employees by Quality Assurance" : undefined} aria-label={x.row.allEmployees ? "All employees" : "Not for all employees"}>
                            {x.row.allEmployees ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white"><Check className="h-3 w-3" strokeWidth={3} /></span> : <span className="h-1 w-1 rounded-full bg-slate-300" />}
                          </span>
                        ))}
                      </TableMarkup.Cell>
                      {positions.map((p) => {
                        const on = x.row.positionIds.includes(p.id);
                        return (
                          <TableMarkup.Cell key={p.id} onMouseEnter={() => setHotCol(p.id)} className={`border-b border-r border-slate-200 p-0 text-center group-hover:bg-emerald-50/70 ${colTint(p.id)} ${change?.kind === "changed" && change.positions.has(p.id) ? "outline outline-2 -outline-offset-2 outline-amber-400" : ""}`}>
                            {expandContent(editing && !x.row.allEmployees && !lockedPositionIds?.includes(p.id) ? (
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={on}
                                aria-label={`${rowCode(x.row)} ${rowName(x.row)} — ${p.name}`}
                                onClick={() => onToggle(x.index, p.id)}
                                className="mx-auto flex h-8 w-9 md:h-9 md:w-11 items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                              >
                                <span className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${on ? "scale-100 border-emerald-600 bg-emerald-500 text-white shadow-sm" : "border-slate-300 bg-white text-transparent hover:border-emerald-400"}`}><Check className="h-3 w-3" strokeWidth={3} /></span>
                              </button>
                            ) : (
                              <span className="mx-auto flex h-8 w-9 md:h-9 md:w-11 items-center justify-center" aria-label={on ? "Required" : "Not required"}>
                                {on ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-3 w-3" strokeWidth={3} /></span> : <span className="h-1 w-1 rounded-full bg-slate-300" />}
                              </span>
                            ))}
                          </TableMarkup.Cell>
                        );
                      })}
                      <TableMarkup.Cell style={stickyAnnual(editing)} className={`w-16 min-w-16 md:w-[84px] md:min-w-[84px] md:sticky md:shadow-[inset_1px_0_0_0_#e2e8f0] z-20 border-b border-r border-slate-200 bg-white px-3 text-center group-hover:bg-emerald-50 ${change?.annual ? "outline outline-2 -outline-offset-2 outline-amber-400" : ""}`}>
                        {expandContent(editing && (!x.row.locked || canLock) ? (
                          <button type="button" role="switch" aria-checked={x.row.annualRequired} aria-label={`Annual training required: ${rowName(x.row)}`} onClick={() => onAnnual(x.index, !x.row.annualRequired)}
                            className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                            <Badge color={x.row.annualRequired ? "emerald" : "slate"} className="min-w-10 justify-center">{x.row.annualRequired ? "Yes" : "No"}</Badge>
                          </button>
                        ) : (
                          <Badge color={x.row.annualRequired ? "emerald" : "slate"} className="min-w-10 justify-center">{x.row.annualRequired ? "Yes" : "No"}</Badge>
                        ))}
                      </TableMarkup.Cell>
                      {editing && <TableMarkup.Cell style={STICKY_REMOVE} className="w-10 min-w-10 md:sticky z-20 border-b border-r border-slate-200 bg-white px-2 text-center group-hover:bg-emerald-50">{expandContent(<button type="button" aria-label={`Remove ${rowName(x.row)}`} onClick={() => onRemove(x.index)} disabled={x.row.locked && !canLock} title={x.row.locked && !canLock ? "Required of all employees by Quality Assurance: it cannot be taken out" : undefined} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"><Trash2 className="h-4 w-4" /></button>)}</TableMarkup.Cell>}
                    </MotionRow>
                    );
                  })}
                  </AnimatePresence>
                </Fragment>
              );
            })}
          </TableMarkup.Body>
          <TableMarkup.Foot className="sticky bottom-0 z-30">
            <TableMarkup.Row>
              <TableMarkup.Cell colSpan={3} style={{ left: 0 }} className="md:sticky z-40 border-r border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">Rows required of the Work Position</TableMarkup.Cell>
              <TableMarkup.Cell aria-hidden="true" className="border-r border-slate-200 bg-blue-50" />
              {positions.map((p) => <TableMarkup.Cell key={p.id} className={`border-r border-slate-200 py-2 text-center text-xs font-semibold tabular-nums text-emerald-800 ${hotCol === p.id ? "bg-emerald-100" : "bg-emerald-50"}`}>{perPosition[p.id]}</TableMarkup.Cell>)}
              <TableMarkup.Cell style={stickyAnnual(editing)} className="w-16 min-w-16 md:w-[84px] md:min-w-[84px] md:sticky md:shadow-[inset_1px_0_0_0_#e2e8f0] z-20 border-r border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-semibold tabular-nums text-slate-600">{rows.filter((r) => r.annualRequired).length}</TableMarkup.Cell>
              {editing && <TableMarkup.Cell style={STICKY_REMOVE} className="w-10 min-w-10 md:sticky z-20 border-r border-slate-200 bg-slate-50" />}
            </TableMarkup.Row>
          </TableMarkup.Foot>
        </TableMarkup.Root>
      </div>
      <p className="px-1 text-xs text-slate-500">{rows.length} row{rows.length !== 1 ? "s" : ""} × {allPositions.length} Work Position{allPositions.length !== 1 ? "s" : ""}</p>
      {filtered && visible.length === 0 && <p className="text-sm text-slate-500">Nothing matches the search or the filters.</p>}
    </div>
    </ReportListToolbar>
  );
}
