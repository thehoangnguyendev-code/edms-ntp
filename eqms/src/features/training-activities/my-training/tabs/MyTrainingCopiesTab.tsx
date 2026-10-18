import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { trainingCopyApi, trainingError, type TrainingMyCopy } from "@/services/api/trainingActivities";
import { day } from "../../shared/trainingLabels";

const TYPE_LABEL = { TRAINING_REQUIREMENT: "Training Requirement", TRAINING_JOB_ASSIGNMENT: "Job Assignment" } as const;

/** The copies sent to the department of the person. The person confirms each one when it arrives. */
export function MyTrainingCopiesTab() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [rows, setRows] = useState<TrainingMyCopy[]>();
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { trainingCopyApi.mine().then(setRows).catch(() => setRows([])); }, []);
  useEffect(load, [load]);

  const receive = async (row: TrainingMyCopy) => {
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
  const columns: DataTableColumn<TrainingMyCopy>[] = [
    { id: "no", header: "No.", locked: true, cell: (_r, i) => i + 1 },
    { id: "type", header: "Type", cell: (r) => TYPE_LABEL[r.objectType] },
    {
      id: "name",
      header: "Reference",
      cell: (r) => <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => navigate(r.objectType === "TRAINING_REQUIREMENT" ? `/training-management/requirements/${r.objectId}` : `/training-management/job-assignments/${r.objectId}`)}>{r.objectName}</button>,
    },
    { id: "from", header: "From department", cell: (r) => r.fromDepartment ?? "—" },
    { id: "sent", header: "Sent", cell: (r) => <div><div>{r.sentByName}</div><div className="text-xs text-slate-500">{day(r.sentAt)}</div></div> },
    { id: "note", header: "Note", cell: (r) => <div className="max-w-64 whitespace-normal text-xs text-slate-600">{r.note ?? "—"}</div> },
    {
      id: "state",
      header: "State",
      cell: (r) => (r.receivedAt
        ? <div><Badge color="emerald">Received</Badge><div className="mt-1 text-xs text-slate-500">{r.receivedByName}, {day(r.receivedAt)}</div></div>
        : <Button size="sm" variant="outline-emerald" disabled={busy} onClick={() => void receive(r)}>Confirm received</Button>),
    },
  ];
  if (!rows) return <SectionLoading text="Loading…" />;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <DataTable rows={rows} getRowKey={(r) => r.id} columns={columns} emptyState={<TableEmptyState title="No copy" description="Copies of requirements and job assignments sent to your department appear here." />} />
    </div>
  );
}
