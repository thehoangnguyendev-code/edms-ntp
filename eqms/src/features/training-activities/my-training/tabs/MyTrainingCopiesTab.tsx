import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { useToast } from "@/components/ui/toast/Toast";
import { trainingCopyApi, trainingError, type TrainingMyCopy } from "@/services/api/trainingActivities";
import { day } from "../../shared/trainingLabels";
import { tr } from "@/i18n";

const TYPE_LABEL = { TRAINING_REQUIREMENT: "Training Requirement", TRAINING_JOB_ASSIGNMENT: "Job Assignment" } as const;

/** The copies sent to the department of the person. The person confirms each one when it arrives. */
export function MyTrainingCopiesTab() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  // Sorted, paged and limited to the kinds of copy the person may read by the server.
  const table = useServerTable<TrainingMyCopy>({ persistKey: "training.my.copies", liveTypes: ["TRAINING"], fetcher: trainingCopyApi.mine, defaultSortBy: "sent", defaultSortDirection: "desc", initialItemsPerPage: 10, syncToUrl: false });
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });

  const receive = async (row: TrainingMyCopy) => {
    setBusy(true);
    try {
      await trainingCopyApi.receive(row.id);
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: tr("The action was not done"), message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };
  const columns: DataTableColumn<TrainingMyCopy>[] = [
    { id: "no", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "type", header: "Type", sort: sorted("type"), cell: (r) => TYPE_LABEL[r.objectType] },
    {
      id: "name",
      header: "Reference",
      sort: sorted("reference"),
      cell: (r) => <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => navigate(r.objectType === "TRAINING_REQUIREMENT" ? `/training-management/requirements/${r.objectId}` : `/training-management/job-assignments/${r.objectId}`)}>{r.objectName}</button>,
    },
    { id: "from", header: tr("From department"), sort: sorted("fromDepartment"), cell: (r) => r.fromDepartment ?? "—" },
    { id: "sent", header: "Sent", sort: sorted("sent"), cell: (r) => <div><div>{r.sentByName}</div><div className="text-xs text-slate-500">{day(r.sentAt)}</div></div> },
    { id: "note", header: "Note", sort: sorted("note"), cell: (r) => <div className="max-w-64 whitespace-normal text-xs text-slate-600">{r.note ?? "—"}</div> },
    {
      id: "state",
      header: "State",
      sort: sorted("state"),
      cell: (r) => (r.receivedAt
        ? <div><Badge color="emerald">{tr("Received")}</Badge><div className="mt-1 text-xs text-slate-500">{r.receivedByName}, {day(r.receivedAt)}</div></div>
        : <Button size="sm" variant="outline-emerald" disabled={busy} onClick={() => void receive(r)}>{tr("Confirm received")}</Button>),
    },
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <DataTable rows={table.items} getRowKey={(r) => r.id} columns={columns} isLoading={table.isLoading} pagination={<TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} />} emptyState={<TableEmptyState title={tr("No copy")} description={tr("Copies of requirements and job assignments sent to your department appear here.")} />} />
    </div>
  );
}
