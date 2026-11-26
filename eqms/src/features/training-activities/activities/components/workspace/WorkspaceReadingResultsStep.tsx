import { Badge } from "@/components/ui/badge/Badge";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { Button } from "@/components/ui/button/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import type { TrainingActivityDetail } from "@/services/api/trainingActivities";
import { tr, trFormat } from "@/i18n";

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
    { id: "no", header: tr("No."), locked: true, cell: (_d, i) => i + 1 },
    { id: "department", header: tr("Department"), cell: (d) => <span className="font-medium text-slate-900">{d.departmentName}</span> },
    { id: "head", header: tr("Head"), cell: (d) => d.headName ?? <span className="text-slate-500">{tr("No head set")}</span> },
    { id: "read", header: tr("Signed"), cell: (d) => trFormat("{done} of {total}", { done: d.waiting + d.verified, total: d.people }) },
    { id: "invited", header: tr("Not signed"), cell: (d) => (d.invited > 0 ? <Badge color="amber">{d.invited}</Badge> : 0) },
    {
      id: "confirmation",
      header: tr("Head's e-signature"),
      cell: (d) => {
        if (d.waiting + d.verified === 0) return <Badge color="slate">{tr("Nobody read")}</Badge>;
        if (d.waiting === 0) {
          return (
            <div className="whitespace-normal">
              <Badge color="emerald">{tr("Signed electronically")}</Badge>
              <div className="mt-1 text-xs text-slate-600">{d.signedByName ?? "—"}{d.signedAt ? ` · ${formatTime(d.signedAt)}` : ""}</div>
            </div>
          );
        }
        if (d.invited > 0) return <Badge color="amber">{trFormat("Waiting for {count} to sign", { count: d.invited })}</Badge>;
        return d.mine && !finished
          ? <Button size="sm" variant="outline-emerald" onClick={onConfirm}>{tr("Confirm with e-signature")}</Button>
          : <Badge color="blue">{tr("Waiting for the head")}</Badge>;
      },
    },
  ];
  return (
    <>
      <WarningBanner
        variant={canFinish || finished ? "success" : "info"}
        description={
          finished
            ? tr("The training is finished and QA was told, with the list APD.0108 of every department.")
            : canFinish
              ? tr("Every head of department confirmed. The trainer can now finish the training (button Finish Training at the top): QA is told, with the list APD.0108 of every department.")
              : trFormat("{confirmed} of {total} department(s) confirmed by the head. Finish Training appears when every head has confirmed, and nobody is left to sign.", { confirmed, total: withReaders.length })
        }
      />
      <DataTable
        rows={departments} getRowKey={(d) => d.departmentId || d.departmentName} columns={columns}
        scrollerRef={drag.scrollerRef} scrollProps={drag.dragEvents} isDragging={drag.isDragging}
        emptyState={<p className="py-6 text-center text-sm text-slate-500">{tr("No person on the list.")}</p>}
      />
    </>
  );
}
