import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import type { TrainingActivityDetail } from "@/services/api/trainingActivities";

type Department = NonNullable<TrainingActivityDetail["selfReadingDepartments"]>[number];

/**
 * Step 3 of the workspace of a self-reading: the confirmation of the head of each department (APD.0108). A head confirms a department only when every person of it has signed or was recorded as
 * not having read; when every department that has readers is confirmed, the trainer can finish the training (the button is in the header of the page) and QA is told with all the lists.
 */
export function WorkspaceReadingResultsStep({ departments, canFinish, finished, onConfirm, formatTime }: {
  departments: Department[];
  /** The server offers Finish Training: every head has confirmed. */
  canFinish: boolean;
  finished: boolean;
  /** The head signs for the departments of which they are the head and that are ready. */
  onConfirm: () => void;
  formatTime: (value?: string | null) => string;
}) {
  const drag = useTableDragScroll();
  const withReaders = departments.filter((d) => d.waiting + d.verified > 0);
  const confirmed = withReaders.filter((d) => d.waiting === 0).length;
  const columns: DataTableColumn<Department>[] = [
    { id: "no", header: "No.", locked: true, cell: (_d, i) => i + 1 },
    { id: "department", header: "Department", cell: (d) => <span className="font-medium text-slate-900">{d.departmentName}</span> },
    { id: "head", header: "Head", cell: (d) => d.headName ?? <span className="text-slate-500">No head set</span> },
    { id: "read", header: "Signed", cell: (d) => `${d.waiting + d.verified} of ${d.people}` },
    { id: "invited", header: "Not signed", cell: (d) => (d.invited > 0 ? <Badge color="amber">{d.invited}</Badge> : 0) },
    {
      id: "confirmation",
      header: "Head's e-signature",
      cell: (d) => {
        if (d.waiting + d.verified === 0) return <Badge color="slate">Nobody read</Badge>;
        if (d.waiting === 0) {
          return (
            <div className="whitespace-normal">
              <Badge color="emerald">Signed electronically</Badge>
              <div className="mt-1 text-xs text-slate-600">{d.signedByName ?? "—"}{d.signedAt ? ` · ${formatTime(d.signedAt)}` : ""}</div>
            </div>
          );
        }
        if (d.invited > 0) return <Badge color="amber">Waiting for {d.invited} to sign</Badge>;
        return d.mine && !finished
          ? <Button size="sm" variant="outline-emerald" onClick={onConfirm}>Confirm with e-signature</Button>
          : <Badge color="blue">Waiting for the head</Badge>;
      },
    },
  ];
  return (
    <>
      <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${canFinish || finished ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
        {finished
          ? "The training is finished and QA was told, with the list APD.0108 of every department."
          : canFinish
            ? "Every head of department confirmed. The trainer can now finish the training (button Finish Training at the top): QA is told, with the list APD.0108 of every department."
            : `${confirmed} of ${withReaders.length} department(s) confirmed by the head. Finish Training appears when every head has confirmed, and nobody is left to sign.`}
      </div>
      <DataTable
        rows={departments} getRowKey={(d) => d.departmentId || d.departmentName} columns={columns}
        scrollerRef={drag.scrollerRef} scrollProps={drag.dragEvents} isDragging={drag.isDragging}
        emptyState={<p className="py-6 text-center text-sm text-slate-500">No person on the list.</p>}
      />
    </>
  );
}
