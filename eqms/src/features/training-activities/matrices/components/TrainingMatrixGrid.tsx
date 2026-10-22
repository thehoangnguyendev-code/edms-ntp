import { Fragment, useMemo, useState } from "react";
import { Check, Search, Trash2, X } from "lucide-react";
import type { TrainingMatrixRow, TrainingPosition } from "@/services/api/trainingActivities";

type Line = { row: TrainingMatrixRow; index: number };

/** The three groups of rows of APD.0011 (SOP.0003 5.3.1): the training of the whole factory, of the department, and the SOP for each position. */
const GROUPS: { id: TrainingMatrixRow["rowGroup"]; title: string; hint: string }[] = [
  { id: "FACTORY_GENERAL", title: "General training of the whole factory", hint: "For example occupational safety, fire safety, GMP overview, data integrity." },
  { id: "DEPARTMENT_GENERAL", title: "General training of the department", hint: "Topics the department requires of its positions." },
  { id: "SOP", title: "SOP for each position", hint: "The procedures each position must be trained on." },
];

const rowCode = (r: TrainingMatrixRow) => (r.topicId ? r.topicCode : r.documentNumber) ?? "";
const rowName = (r: TrainingMatrixRow) => (r.topicId ? r.topicName : r.documentName) ?? "";

// Widths of the three columns that stay in view while the positions scroll; the offsets keep them side by side.
const W_NO = 48;
const W_CODE = 120;
const STICKY_NO = { left: 0, minWidth: W_NO, width: W_NO };
const STICKY_CODE = { left: W_NO, minWidth: W_CODE, width: W_CODE };
const STICKY_TITLE = { left: W_NO + W_CODE, minWidth: 260, width: 260 };

/**
 * The matrix of a department laid out as the form APD.0011 shows it: No, SOP No, Subject / SOP title, the work positions side by side under one
 * heading, and "Annual training required (Yes / No)". Rows are in the three groups of SOP.0003 5.3.1. The first three columns and the headings stay in
 * view while the table scrolls; pointing at a cell lights its row and its position so that the crossing is easy to read.
 */
export function TrainingMatrixGrid({ rows, positions, editing, onToggle, onAnnual, onRemove }: {
  rows: TrainingMatrixRow[];
  positions: TrainingPosition[];
  editing: boolean;
  onToggle: (index: number, positionId: string) => void;
  onAnnual: (index: number, annual: boolean) => void;
  onRemove: (index: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [hotCol, setHotCol] = useState<string>();
  const lines = useMemo<Line[]>(() => rows.map((row, index) => ({ row, index })), [rows]);
  const needle = search.trim().toLowerCase();
  const visible = needle ? lines.filter((x) => `${rowCode(x.row)} ${rowName(x.row)}`.toLowerCase().includes(needle)) : lines;
  const perPosition = useMemo(() => Object.fromEntries(positions.map((p) => [p.id, rows.filter((r) => r.positionIds.includes(p.id)).length])), [rows, positions]);
  const span = 4 + positions.length + (editing ? 1 : 0);
  const colTint = (id: string) => (hotCol === id ? "bg-emerald-50" : "");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 md:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a topic or an SOP…"
            aria-label="Search the matrix"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          {search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>}
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-3 w-3" strokeWidth={3} /></span>The position must be trained on this row</span>
        <span className="text-xs text-slate-500">{rows.length} row{rows.length !== 1 ? "s" : ""} × {positions.length} position{positions.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm" onMouseLeave={() => setHotCol(undefined)}>
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-30">
            <tr>
              <th rowSpan={2} style={STICKY_NO} className="sticky z-40 border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">No</th>
              <th rowSpan={2} style={STICKY_CODE} className="sticky z-40 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">SOP No</th>
              <th rowSpan={2} style={STICKY_TITLE} className="sticky z-40 border-b border-r border-slate-300 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 shadow-[4px_0_6px_-4px_rgba(15,23,42,0.18)]">Subject / SOP title</th>
              <th colSpan={Math.max(positions.length, 1)} className="border-b border-emerald-700/30 bg-emerald-600 px-3 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-white">Work position</th>
              <th rowSpan={2} className="border-b border-l border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Annual training<br />required</th>
              {editing && <th rowSpan={2} className="border-b border-slate-200 bg-slate-50 px-2"><span className="sr-only">Remove</span></th>}
            </tr>
            <tr>
              {positions.map((p) => (
                <th key={p.id} onMouseEnter={() => setHotCol(p.id)} title={p.name} className={`h-36 w-11 min-w-11 border-b border-slate-200 px-0 align-bottom ${hotCol === p.id ? "bg-emerald-100" : "bg-emerald-50"}`}>
                  <div className="mx-auto flex h-full w-full items-end justify-center pb-2">
                    <span className="max-h-32 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold text-emerald-900 [writing-mode:vertical-rl] rotate-180">{p.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((g) => {
              const part = visible.filter((x) => x.row.rowGroup === g.id);
              if (part.length === 0 && (needle || rows.length > 0)) return null;
              return (
                <Fragment key={g.id}>
                  <tr>
                    <td colSpan={span} className="border-b border-emerald-100 bg-emerald-50/70 px-3 py-2">
                      <div className="sticky left-3 flex w-[min(100%,56rem)] flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <span className="text-sm font-semibold text-emerald-900">{g.title}</span>
                        <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-xs font-medium text-emerald-800">{part.length}</span>
                        <span className="text-xs text-slate-500">{g.hint}</span>
                      </div>
                    </td>
                  </tr>
                  {part.length === 0 && <tr><td colSpan={span} className="px-4 py-3 text-xs text-slate-400">No row in this group.</td></tr>}
                  {part.map((x) => (
                    <tr key={`${x.row.topicId ?? x.row.documentId}`} className="group">
                      <td style={STICKY_NO} className="sticky z-20 border-b border-r border-slate-100 bg-white px-2 py-1.5 text-center text-xs tabular-nums text-slate-500 group-hover:bg-emerald-50">{x.index + 1}</td>
                      <td style={STICKY_CODE} className="sticky z-20 border-b border-r border-slate-100 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 group-hover:bg-emerald-50">{rowCode(x.row)}</td>
                      <td style={STICKY_TITLE} className="sticky z-20 border-b border-r border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900 shadow-[4px_0_6px_-4px_rgba(15,23,42,0.18)] group-hover:bg-emerald-50"><div className="whitespace-normal leading-snug">{rowName(x.row)}</div></td>
                      {positions.map((p) => {
                        const on = x.row.positionIds.includes(p.id);
                        return (
                          <td key={p.id} onMouseEnter={() => setHotCol(p.id)} className={`border-b border-slate-100 p-0 text-center group-hover:bg-emerald-50/70 ${colTint(p.id)}`}>
                            {editing ? (
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={on}
                                aria-label={`${rowCode(x.row)} ${rowName(x.row)} — ${p.name}`}
                                onClick={() => onToggle(x.index, p.id)}
                                className="mx-auto flex h-9 w-11 items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                              >
                                <span className={`flex h-6 w-6 items-center justify-center rounded-full border transition-all ${on ? "scale-100 border-emerald-600 bg-emerald-500 text-white shadow-sm" : "border-slate-300 bg-white text-transparent hover:border-emerald-400"}`}><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                              </button>
                            ) : (
                              <span className="flex h-9 w-11 items-center justify-center" aria-label={on ? "Required" : "Not required"}>
                                {on ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span> : <span className="h-1 w-1 rounded-full bg-slate-300" />}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="border-b border-l border-slate-100 px-3 text-center group-hover:bg-emerald-50/70">
                        {editing ? (
                          <button type="button" role="switch" aria-checked={x.row.annualRequired} aria-label={`Annual training required: ${rowName(x.row)}`} onClick={() => onAnnual(x.index, !x.row.annualRequired)}
                            className={`inline-flex min-w-12 justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${x.row.annualRequired ? "border-emerald-300 bg-emerald-100 text-emerald-800" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
                            {x.row.annualRequired ? "Yes" : "No"}
                          </button>
                        ) : (
                          <span className={`inline-flex min-w-12 justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${x.row.annualRequired ? "bg-emerald-100 text-emerald-800" : "text-slate-400"}`}>{x.row.annualRequired ? "Yes" : "No"}</span>
                        )}
                      </td>
                      {editing && <td className="border-b border-slate-100 px-2 text-center group-hover:bg-emerald-50/70"><button type="button" aria-label={`Remove ${rowName(x.row)}`} onClick={() => onRemove(x.index)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"><Trash2 className="h-4 w-4" /></button></td>}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0 z-30">
            <tr>
              <td colSpan={3} style={{ left: 0 }} className="sticky z-40 border-t border-r border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">Rows required of the position</td>
              {positions.map((p) => <td key={p.id} className={`border-t border-slate-300 py-2 text-center text-xs font-semibold tabular-nums text-emerald-800 ${hotCol === p.id ? "bg-emerald-100" : "bg-emerald-50"}`}>{perPosition[p.id]}</td>)}
              <td className="border-t border-l border-slate-300 bg-slate-50 py-2 text-center text-xs font-semibold tabular-nums text-slate-600">{rows.filter((r) => r.annualRequired).length}</td>
              {editing && <td className="border-t border-slate-300 bg-slate-50" />}
            </tr>
          </tfoot>
        </table>
      </div>
      {needle && visible.length === 0 && <p className="text-sm text-slate-500">Nothing matches the search.</p>}
    </div>
  );
}
