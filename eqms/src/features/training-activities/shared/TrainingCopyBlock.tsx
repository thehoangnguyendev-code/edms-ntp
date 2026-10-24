import { useCallback, useEffect, useState } from "react";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { useToast } from "@/components/ui/toast/Toast";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { dictionaryApi } from "@/services/api/dictionary";
import { trainingCopyApi, trainingError, type TrainingCopyLog, type TrainingCopyRow, type TrainingCopyType } from "@/services/api/trainingActivities";
import { Input } from "./TrainingFields";
import { TabBlock } from "./TrainingDetailLayout";
import { day } from "./trainingLabels";

/**
 * The log of the copies of a requirement or a job assignment (SOP.0003 5.3.2 and 5.3.10): which departments were sent a copy, by whom and when, and who received it.
 * The log records the fact; each row is kept as it was written.
 */
export function TrainingCopyBlock({ type, objectId, title = "Copies Sent To Departments" }: { type: TrainingCopyType; objectId: string; title?: string }) {
  const { showToast } = useToast();
  const [log, setLog] = useState<TrainingCopyLog>();
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { trainingCopyApi.list(type, objectId).then(setLog).catch(() => setLog(undefined)); }, [type, objectId]);
  useEffect(load, [load]);
  useEntityChanged(["TRAINING"], load);

  const receive = async (row: TrainingCopyRow) => {
    setBusy(true);
    try {
      await trainingCopyApi.receive(row.id);
      load();
    } catch (e) {
      showToast({ type: "error", title: "The action was not done", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };
  const columns: DataTableColumn<TrainingCopyRow>[] = [
    { id: "no", header: "No.", locked: true, cell: (_r, i) => i + 1 },
    { id: "department", header: "Department", cell: (r) => r.departmentName },
    { id: "sent", header: "Sent", cell: (r) => <div><div>{r.sentByName}</div><div className="text-xs text-slate-500">{day(r.sentAt)}</div></div> },
    { id: "received", header: "Received", cell: (r) => (r.receivedAt ? <div><div>{r.receivedByName}</div><div className="text-xs text-slate-500">{day(r.receivedAt)}</div></div> : <span className="text-amber-700">Not yet</span>) },
    { id: "note", header: "Note", cell: (r) => <div className="max-w-64 whitespace-normal text-xs text-slate-600">{r.note ?? "—"}</div> },
    { id: "action", header: "Action", cell: (r) => (r.canReceive ? <Button size="sm" disabled={busy} onClick={() => void receive(r)}>Confirm received</Button> : null) },
  ];
  if (!log) return null;
  if (log.rows.length === 0 && !log.canSend) return null;
  return (
    <>
      <TabBlock title={title} action={log.canSend ? <Button size="sm" variant="default" onClick={() => setSending(true)}>Send a Copy</Button> : undefined}>
        <DataTable rows={log.rows} getRowKey={(r) => r.id} columns={columns} emptyState={<p className="p-4 text-sm text-slate-500">No copy sent yet.</p>} />
      </TabBlock>
      {sending && <SendDialog type={type} objectId={objectId} sentTo={log.rows.map((r) => r.departmentId)} onClose={() => setSending(false)} onSent={(next) => { setLog(next); setSending(false); }} />}
    </>
  );
}

function SendDialog({ type, objectId, sentTo, onClose, onSent }: { type: TrainingCopyType; objectId: string; sentTo: string[]; onClose: () => void; onSent: (log: TrainingCopyLog) => void }) {
  const { showToast } = useToast();
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { dictionaryApi.getDepartments().then((l) => setDepartments(l.filter((d) => !sentTo.includes(d.id)).map((d) => ({ id: d.id, name: d.name })))).catch(() => setDepartments([])); }, [sentTo]);
  const toggle = (id: string) => setChosen((old) => { const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const send = async () => {
    setBusy(true);
    try {
      onSent(await trainingCopyApi.send(type, objectId, [...chosen], note.trim() || undefined));
    } catch (e) {
      showToast({ type: "error", title: "The copy was not sent", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormModal isOpen onClose={onClose} onConfirm={() => void send()} title="Send a Copy" description="Record that a copy was sent to the departments concerned. Each department confirms when it receives it." confirmText="Record sending" isLoading={busy} confirmDisabled={chosen.size === 0} size="md">
      <div className="grid gap-4">
        <FormField label="Departments" required>
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
            {departments.length === 0 ? <p className="text-sm text-slate-500">Every department already has a copy.</p> : departments.map((d) => (
              <Checkbox key={d.id} checked={chosen.has(d.id)} onChange={() => toggle(d.id)} label={d.name} />
            ))}
          </div>
        </FormField>
        <FormField label="Note"><Input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></FormField>
      </div>
    </FormModal>
  );
}
