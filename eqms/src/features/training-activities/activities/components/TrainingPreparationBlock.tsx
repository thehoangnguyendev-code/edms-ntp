import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Select } from "@/components/ui/select/Select";
import { useToast } from "@/components/ui/toast/Toast";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { trainingActivitiesApi, trainingError, trainingPreparationApi, type TrainingPreparationRow, type TrainingPreparationSession, type TrainingPrepItem } from "@/services/api/trainingActivities";
import { Textarea } from "../../shared/TrainingFields";
import { TabBlock } from "../../shared/TrainingDetailLayout";

const ITEM_LABEL: Record<TrainingPrepItem, { label: string; hint: string }> = {
  VENUE: { label: "Venue", hint: "The room or place is ready (HR and Administration)." },
  EQUIPMENT: { label: "Equipment", hint: "The machines, tools and instruments for a practical session." },
  MATERIALS: { label: "Materials", hint: "The documents, slides, tests and forms are ready to use." },
  NOTICE: { label: "Notice", hint: "The trainees and the trainer know the time, the place and the content." },
};
const STATUS_LABEL = { PENDING: "Pending", DONE: "Done", NOT_NEEDED: "Not needed" } as const;
const STATUS_COLOR = { PENDING: "amber", DONE: "emerald", NOT_NEEDED: "slate" } as const;
const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));

type Row = TrainingPreparationRow & { sessionId: string; sessionNo: number };

/**
 * What has to be ready before each session (SOP.0003 5.3.6). It warns; it never blocks a session. The organizer or the conductor sets the state and may give an item to
 * a person; that person is told and can report it done.
 */
export function TrainingPreparationBlock({ activityId, canManage, userId }: { activityId: string; canManage: boolean; userId?: string }) {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<TrainingPreparationSession[]>([]);
  const [editing, setEditing] = useState<Row>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { trainingPreparationApi.get(activityId).then(setSessions).catch(() => setSessions([])); }, [activityId]);
  useEffect(load, [load]);

  const save = async (row: Row, body: { status: string; assignedTo?: string | null; note?: string | null }) => {
    setBusy(true);
    try {
      setSessions(await trainingPreparationApi.update(row.sessionId, row.itemCode, body));
      setEditing(undefined);
    } catch (e) {
      showToast({ type: "error", title: "The change was not saved", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };

  const open = sessions.reduce((sum, s) => sum + (s.sessionStatus === "PLANNED" ? s.open : 0), 0);
  const rows: Row[] = sessions.flatMap((s) => s.items.map((item) => ({ ...item, sessionId: s.sessionId, sessionNo: s.sessionNo })));
  const columns: DataTableColumn<Row>[] = [
    { id: "session", header: "Session", cell: (r) => `S${r.sessionNo}` },
    { id: "item", header: "To prepare", cell: (r) => <div className="max-w-72 whitespace-normal"><div className="font-medium text-slate-900">{ITEM_LABEL[r.itemCode].label}</div><div className="text-xs text-slate-500">{ITEM_LABEL[r.itemCode].hint}</div></div> },
    {
      id: "status",
      header: "State",
      cell: (r) => (canManage || r.assignedTo === userId
        ? <div className="w-36"><Select value={r.status} options={STATUS_OPTIONS} aria-label={`State of ${ITEM_LABEL[r.itemCode].label}, session ${r.sessionNo}`} onChange={(v) => void save(r, { status: v, assignedTo: r.assignedTo ?? null, note: r.note ?? null })} /></div>
        : <Badge color={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge>),
    },
    { id: "who", header: "Given to", cell: (r) => r.assignedToName ?? "—" },
    { id: "note", header: "Note", cell: (r) => <div className="max-w-64 whitespace-normal text-xs text-slate-600">{r.note ?? "—"}</div> },
    { id: "actions", header: "", cell: (r) => (canManage ? <Button size="sm" variant="outline" onClick={() => setEditing(r)}>Assign / note</Button> : null) },
  ];
  if (sessions.length === 0) return null;
  return (
    <>
      <TabBlock title="Preparation">
        <p className="px-4 py-3 text-xs text-slate-500">Before a session: the venue, the equipment, the materials, and the notice to the trainees and the trainer. This list warns; it does not stop a session.</p>
        {open > 0 && <p role="status" className="mx-4 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{open} item{open === 1 ? "" : "s"} still pending for sessions that have not been held.</p>}
        <DataTable rows={rows} getRowKey={(r) => `${r.sessionId}|${r.itemCode}`} columns={columns} />
      </TabBlock>
      {editing && <AssignDialog row={editing} busy={busy} onClose={() => setEditing(undefined)} onSave={(body) => void save(editing, body)} />}
    </>
  );
}

function AssignDialog({ row, busy, onClose, onSave }: { row: Row; busy: boolean; onClose: () => void; onSave: (body: { status: string; assignedTo: string | null; note: string | null }) => void }) {
  const [personId, setPersonId] = useState(row.assignedTo ?? "");
  const [options, setOptions] = useState<{ label: string; value: string }[]>(row.assignedTo && row.assignedToName ? [{ label: row.assignedToName, value: row.assignedTo }] : []);
  const [note, setNote] = useState(row.note ?? "");
  const search = useCallback(async (query: string) => {
    const list = await trainingActivitiesApi.people(query, 20);
    const mapped = list.map((p) => ({ label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`, value: p.id }));
    setOptions(mapped);
    return mapped;
  }, []);
  useEffect(() => { void search(""); }, [search]);
  return (
    <FormModal isOpen onClose={onClose} onConfirm={() => onSave({ status: row.status, assignedTo: personId || null, note: note.trim() || null })} title={`${ITEM_LABEL[row.itemCode].label}, session ${row.sessionNo}`}
      description="Give it to a person, who is told and can report it done, and add a note if it helps." confirmText="Save" isLoading={busy} size="md">
      <div className="grid gap-4">
        <FormField label="Given to"><Select value={personId} onChange={setPersonId} options={options} onSearch={search} placeholder="Search by name" /></FormField>
        <FormField label="Note"><Textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></FormField>
      </div>
    </FormModal>
  );
}
