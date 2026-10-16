import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormModal } from "@/components/ui/modal/FormModal";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { trainingError, trainingMatrixApi, type TrainingMatrixDetail, type TrainingMatrixRow, type TrainingMatrixVersionRef } from "@/services/api/trainingActivities";
import { day, trainingBreadcrumbs } from "./trainingLabels";

const STATUS_LABEL: Record<string, string> = { DRAFT: "Draft", PENDING_APPROVAL: "Waiting for approval", EFFECTIVE: "Effective", OBSOLETE: "Obsolete" };
const rowName = (r: TrainingMatrixRow) => (r.topicId ? `${r.topicCode} — ${r.topicName}` : `${r.documentNumber} — ${r.documentName}`);

/** The versions of one matrix, and what changed between a version and the one before it. */
export function TrainingMatrixHistoryView() {
  const { matrixId = "" } = useParams();
  const navigate = useNavigate();
  const [matrix, setMatrix] = useState<TrainingMatrixDetail>();
  const [error, setError] = useState("");
  const [diff, setDiff] = useState<Awaited<ReturnType<typeof trainingMatrixApi.compare>>>();

  useEffect(() => {
    trainingMatrixApi.get(matrixId).then(setMatrix).catch((e) => setError(trainingError(e)));
  }, [matrixId]);

  const compare = async (v: TrainingMatrixVersionRef) => {
    const previous = matrix?.versions.find((x) => x.versionNo === v.versionNo - 1);
    if (!previous) return;
    try {
      setDiff(await trainingMatrixApi.compare(previous.id, v.id));
    } catch (e) {
      setError(trainingError(e));
    }
  };
  const columns: DataTableColumn<TrainingMatrixVersionRef>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => i + 1 },
    { id: "version", header: "Version", cell: (v) => <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => navigate(`/training-management/matrix-versions/${v.id}`)}>Version {v.versionNo}</button> },
    { id: "status", header: "Status", cell: (v) => <Badge color={v.status === "EFFECTIVE" ? "emerald" : v.status === "OBSOLETE" ? "slate" : "amber"}>{STATUS_LABEL[v.status]}</Badge> },
    { id: "reason", header: "What changed", cell: (v) => <div className="max-w-80 whitespace-normal">{v.changeReason || "—"}</div> },
    { id: "prepared", header: "Prepared by", cell: (v) => v.preparedByName ?? "—" },
    { id: "approved", header: "Approved by", cell: (v) => v.approvedByName ?? "—" },
    { id: "effective", header: "Effective", cell: (v) => day(v.effectiveAt) },
    { id: "compare", header: "", cell: (v) => (v.versionNo > 1 && ["EFFECTIVE", "OBSOLETE"].includes(v.status) ? <Button size="sm" variant="outline" onClick={() => void compare(v)}>Compare with previous</Button> : null) },
  ];
  const title = "Training Matrix Versions";
  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader title={title} breadcrumbItems={trainingBreadcrumbs(navigate, "matrices", title)} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!matrix ? !error && <SectionLoading text="Loading versions…" /> : <DataTable rows={matrix.versions} getRowKey={(v) => v.id} columns={columns} />}
      <FormModal isOpen={!!diff} onClose={() => setDiff(undefined)} title={diff ? `Version ${diff.from} to version ${diff.to}` : ""} showCancel={false} confirmText="Close" onConfirm={() => setDiff(undefined)} size="xl">
        {diff && (
          <div className="space-y-4 text-sm">
            <section><h4 className="font-semibold">Added ({diff.added.length})</h4><ul className="list-disc pl-5">{diff.added.map((r, i) => <li key={i}>{rowName(r)}</li>)}</ul></section>
            <section><h4 className="font-semibold">Removed ({diff.removed.length})</h4><ul className="list-disc pl-5">{diff.removed.map((r, i) => <li key={i}>{rowName(r)}</li>)}</ul></section>
            <section><h4 className="font-semibold">Changed positions or annual flag ({diff.changed.length})</h4><ul className="list-disc pl-5">{diff.changed.map((r, i) => <li key={i}>{rowName(r)}</li>)}</ul></section>
          </div>
        )}
      </FormModal>
    </div>
  );
}
