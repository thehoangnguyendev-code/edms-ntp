import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { trainingError, trainingLegacyApi, type TrainingLegacyPerson } from "@/services/api/trainingActivities";

/**
 * "Persons Trained" of a historical activity (Legacy Import): the persons who were at the paper training and the signatories of the revisions that are users of the system. Their training
 * records are written when the evidence is filed (the import is signed), so a row that says "Not written" is a person whose revision has no training completion date.
 */
export function LegacyPeopleTab({ activityId }: { activityId: string }) {
  const [rows, setRows] = useState<TrainingLegacyPerson[]>([]);
  const [status, setStatus] = useState<"FILED" | "VERIFIED" | null | undefined>();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    trainingLegacyApi
      .people(activityId, { page, limit })
      .then((result) => {
        if (!alive) return;
        setRows(result.data);
        setStatus(result.evidenceStatus);
        setTotal(result.pagination.total);
        setTotalPages(result.pagination.totalPages);
        setError("");
      })
      .catch((e) => alive && setError(trainingError(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [activityId, page, limit]);

  const columns: DataTableColumn<TrainingLegacyPerson>[] = [
    { id: "no", header: "No.", locked: true, cell: (_r, i) => (page - 1) * limit + i + 1 },
    { id: "code", header: "Employee ID", cell: (r) => r.employeeCode ?? "—" },
    { id: "name", header: "Full Name", cell: (r) => <span className="font-medium">{r.fullName}</span> },
    { id: "department", header: "Department", cell: (r) => r.department ?? "—" },
    { id: "position", header: "Position", cell: (r) => r.position ?? "—" },
    {
      id: "role",
      header: "Named As",
      cell: (r) => (r.role === "TRAINEE" ? "Trained on paper" : `Signatory of ${r.documentNumber ?? ""} Rev ${r.revisionNumber ?? ""}`),
    },
    {
      id: "record",
      header: "Training Record",
      cell: (r) => (
        <Badge color={r.recordWritten ? "emerald" : r.recordVoided ? "red" : "amber"}>{r.recordWritten ? "Written" : r.recordVoided ? "Voided" : "Not written"}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Persons who were trained on paper{total ? ` (${total})` : ""}</h3>
        <p className="text-xs text-slate-500">
          {status
            ? "The evidence is filed: the training records of these persons are written."
            : "No evidence is filed for this training yet."}
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <DataTable
        rows={rows}
        getRowKey={(r) => `${r.role}-${r.personId}-${r.documentNumber ?? ""}-${r.revisionNumber ?? ""}`}
        isLoading={loading}
        loadingContent={<SectionLoading text="Loading…" />}
        columns={columns}
        emptyState={<TableEmptyState title="Nobody named" description="No person was named with the paper record of this training." />}
        pagination={
          total > 0 ? (
            <TablePagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              itemsPerPage={limit}
              onPageChange={setPage}
              onItemsPerPageChange={(value) => {
                setLimit(value);
                setPage(1);
              }}
            />
          ) : undefined
        }
      />
    </div>
  );
}
