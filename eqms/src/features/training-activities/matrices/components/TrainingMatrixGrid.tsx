import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import type { TrainingMatrixRow, TrainingPosition } from "@/services/api/trainingActivities";
import { TabBlock } from "../../shared/TrainingDetailLayout";

type Line = { row: TrainingMatrixRow; index: number };

/** The three groups of rows of APD.0011 (SOP.0003 5.3.1): the training of the whole factory, of the department, and the SOP for each position. */
const GROUPS: { id: TrainingMatrixRow["rowGroup"]; title: string; hint: string }[] = [
  { id: "FACTORY_GENERAL", title: "General training of the whole factory", hint: "For example occupational safety, fire safety, GMP overview, data integrity." },
  { id: "DEPARTMENT_GENERAL", title: "General training of the department", hint: "Topics the department requires of its positions." },
  { id: "SOP", title: "SOP for each position", hint: "The procedures each position must be trained on." },
];

const rowTitle = (r: TrainingMatrixRow) => (r.topicId ? `${r.topicCode} — ${r.topicName}` : `${r.documentNumber} — ${r.documentName}`);

/**
 * The matrix of a department as APD.0011 shows it: rows are topics or SOP in three groups, columns are the positions, with the column "Annual training required".
 * The number and the topic stay in view while the positions scroll. The same columns serve the three groups.
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
  const columns: DataTableColumn<Line>[] = [
    { id: "no", header: "No.", locked: true, cell: (x) => x.index + 1 },
    { id: "topic", header: "Topic or SOP", locked: true, cell: (x) => <div className="max-w-72 whitespace-normal font-medium text-slate-900">{rowTitle(x.row)}</div> },
    { id: "annual", header: "Annual", cell: (x) => <Checkbox checked={x.row.annualRequired} disabled={!editing} onChange={(c) => onAnnual(x.index, c)} /> },
    ...positions.map<DataTableColumn<Line>>((p) => ({
      id: `pos-${p.id}`,
      header: p.name,
      label: p.name,
      cell: (x) => <Checkbox checked={x.row.positionIds.includes(p.id)} disabled={!editing} onChange={() => onToggle(x.index, p.id)} />,
    })),
    { id: "count", header: "Positions", cell: (x) => x.row.positionIds.length },
    ...(editing ? [{ id: "remove", header: "", cell: (x: Line) => <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => onRemove(x.index)}>Remove</button> }] : []),
  ];
  const { layout, control } = useCustomColumnLayout("training.matrix.grid", columns);
  const lines = useMemo(() => rows.map((row, index) => ({ row, index })), [rows]);
  const needle = search.trim().toLowerCase();
  const visible = needle ? lines.filter((x) => rowTitle(x.row).toLowerCase().includes(needle)) : lines;

  return (
    <div className="space-y-4">
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
        {control}
        <span className="text-xs text-slate-500">{rows.length} row{rows.length !== 1 ? "s" : ""} × {positions.length} position{positions.length !== 1 ? "s" : ""}</span>
      </div>
      {GROUPS.map((g) => {
        const part = visible.filter((x) => x.row.rowGroup === g.id);
        if (part.length === 0 && (needle || rows.length > 0)) return null;
        return (
          <TabBlock key={g.id} title={`${g.title} (${part.length})`}>
            <p className="px-4 py-3 text-xs text-slate-500">{g.hint}</p>
            <DataTable rows={part} getRowKey={(x) => `${x.row.topicId ?? x.row.documentId}`} columns={columns} columnLayout={layout} emptyState={<p className="p-4 text-sm text-slate-500">No row in this group.</p>} />
          </TabBlock>
        );
      })}
      {needle && visible.length === 0 && <p className="text-sm text-slate-500">Nothing matches the search.</p>}
    </div>
  );
}
