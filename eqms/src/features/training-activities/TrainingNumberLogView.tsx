import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Badge } from "@/components/ui/badge/Badge";
import { Select } from "@/components/ui/select/Select";
import { FormField, Input } from "@/components/ui/form/ResponsiveForm";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { dictionaryApi } from "@/services/api/dictionary";
import { trainingError, trainingRecordsApi, type TrainingNumberLogRow } from "@/services/api/trainingActivities";
import { KIND_LABEL, STATUS_COLOR, STATUS_LABEL, day, trainingBreadcrumbs, TRAINING_PAGES } from "./trainingLabels";

/** The Training Number log of a department and a year (FRM.0044): every number issued, including cancelled ones. It is read from the activities, never typed. */
export function TrainingNumberLogView() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<{ label: string; value: string }[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [rows, setRows] = useState<TrainingNumberLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    dictionaryApi.getDepartments().then((list) => setDepartments(list.map((d) => ({ label: d.name, value: d.id })))).catch(() => setDepartments([]));
  }, []);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    trainingRecordsApi
      .numberLog({ departmentId: departmentId || undefined, year: Number(year) || undefined, page, limit })
      .then((r) => {
        if (!alive) return;
        setRows(r.data);
        setTotal(r.pagination.total);
        setPages(r.pagination.totalPages);
      })
      .catch((e) => {
        if (!alive) return;
        setRows([]);
        setError(trainingError(e));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [departmentId, year, page, limit]);

  const columns: DataTableColumn<TrainingNumberLogRow>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (page - 1) * limit + i + 1 },
    { id: "date", header: "Date", cell: (r) => day(r.createdAt) },
    { id: "number", header: "Training Number", cell: (r) => <span className="font-medium">{r.trainingNumber}</span> },
    { id: "kind", header: "Type", cell: (r) => KIND_LABEL[r.kind] ?? r.kind },
    { id: "title", header: "Topic", cell: (r) => <div className="max-w-80 whitespace-normal">{r.title}</div> },
    { id: "document", header: "SOP", cell: (r) => (r.documentNumber ? `${r.documentNumber}${r.revisionNumber ? ` Rev ${r.revisionNumber}` : ""}` : "—") },
    { id: "sessions", header: "Sessions", cell: (r) => r.sessions },
    { id: "status", header: "Status", cell: (r) => <Badge color={STATUS_COLOR[r.status] ?? "slate"}>{STATUS_LABEL[r.status] ?? r.status}</Badge> },
    {
      id: "note",
      header: "Notes",
      cell: (r) => (
        <div className="max-w-60 whitespace-normal">
          {[r.cancelReason ? `Cancelled: ${r.cancelReason}` : "", r.postponements ? `Postponed ${r.postponements} time(s)` : ""].filter(Boolean).join("; ") || "—"}
        </div>
      ),
    },
  ];
  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader title={TRAINING_PAGES.numberLog.title} breadcrumbItems={trainingBreadcrumbs(navigate, "numberLog")} />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <FormField label="Department">
          <Select
            value={departmentId}
            onChange={(v) => {
              setDepartmentId(v);
              setPage(1);
            }}
            options={[{ label: "My department", value: "" }, ...departments]}
          />
        </FormField>
        <FormField label="Year">
          <Input
            type="number"
            value={year}
            min={2000}
            max={2100}
            onChange={(e) => {
              setYear(e.target.value);
              setPage(1);
            }}
          />
        </FormField>
      </div>
      <DataTable
        rows={rows}
        getRowKey={(r) => r.trainingNumber}
        columns={columns}
        isLoading={loading}
        loadingContent={<SectionLoading text="Loading the log…" />}
        emptyState={<TableEmptyState title="No Training Numbers" description="No number was issued for this department and year." />}
        pagination={
          total > 0 ? <TablePagination currentPage={page} totalPages={pages} totalItems={total} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={setLimit} /> : undefined
        }
      />
    </div>
  );
}
