import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Badge } from "@/components/ui/badge/Badge";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { dictionaryApi } from "@/services/api/dictionary";
import { trainingComplianceApi, trainingError, type TrainingComplianceSummary, type TrainingGap } from "@/services/api/trainingActivities";
import { day, trainingBreadcrumbs, TRAINING_PAGES } from "./trainingLabels";

const STATUS_LABEL: Record<string, string> = { MISSING: "Not trained", DUE: "Annual training due", OK: "Trained" };
const STATUS_COLOR: Record<string, "red" | "amber" | "emerald"> = { MISSING: "red", DUE: "amber", OK: "emerald" };

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

/** Who is trained on what the effective matrix requires, for one department. Everything is computed by the server from the matrix, the positions and the records. */
export function TrainingComplianceView() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<{ label: string; value: string }[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [summary, setSummary] = useState<TrainingComplianceSummary>();
  const [error, setError] = useState("");

  useEffect(() => {
    dictionaryApi.getDepartments().then((l) => setDepartments(l.map((d) => ({ label: d.name, value: d.id })))).catch(() => setDepartments([]));
  }, []);
  useEffect(() => {
    setSummary(undefined);
    trainingComplianceApi.summary(departmentId || undefined).then(setSummary).catch((e) => setError(trainingError(e)));
  }, [departmentId]);

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      trainingComplianceApi.coverage(params as Record<string, string | number | undefined>).catch((e) => {
        setError(trainingError(e));
        throw e;
      }),
    [],
  );
  const extra = useMemo(() => ({ departmentId: departmentId || undefined, status: status || undefined }), [departmentId, status]);
  const table = useServerTable<TrainingGap>({ fetcher, defaultSortBy: "status", extraParams: extra, initialItemsPerPage: 10 });

  const columns: DataTableColumn<TrainingGap>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "name", header: "Employee", cell: (g) => <div><div className="font-medium">{g.fullName}</div><div className="text-xs text-slate-500">{g.employeeCode ?? ""}</div></div> },
    { id: "position", header: "Position", cell: (g) => g.positionName ?? "—" },
    { id: "topic", header: "Required training", cell: (g) => <div className="max-w-80 whitespace-normal">{g.code ? `${g.code} — ` : ""}{g.title}</div> },
    { id: "annual", header: "Annual", cell: (g) => (g.annualRequired ? "Yes" : "No") },
    { id: "last", header: "Last trained", cell: (g) => day(g.lastDone) },
    { id: "status", header: "Status", cell: (g) => <Badge color={STATUS_COLOR[g.status]}>{STATUS_LABEL[g.status]}</Badge> },
  ];
  const { layout, control } = useCustomColumnLayout("training.compliance.coverage", columns);
  const filters: ReportSelectFilter[] = [
    { id: "department", label: "Department", value: departmentId, options: [{ label: "My department", value: "" }, ...departments], onChange: (v) => { setDepartmentId(v); table.setCurrentPage(1); } },
    {
      id: "status",
      label: "Status",
      value: status,
      options: [{ label: "All", value: "" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ label, value }))],
      onChange: (v) => { setStatus(v); table.setCurrentPage(1); },
    },
  ];
  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader title={TRAINING_PAGES.compliance.title} breadcrumbItems={trainingBreadcrumbs(navigate, "compliance")} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!summary ? (
        <SectionLoading text="Loading…" />
      ) : !summary.hasEffectiveMatrix ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">This department has no effective training matrix, so there is nothing to measure yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Trained" value={summary.percentTrained == null ? "—" : `${summary.percentTrained}%`} hint={`${summary.ok} of ${summary.required} requirements`} />
          <Stat label="Not trained" value={summary.missing} />
          <Stat label="Annual training due" value={summary.due} />
          <Stat label="People with a position" value={summary.people} hint={summary.peopleWithoutPosition ? `${summary.peopleWithoutPosition} without a position` : undefined} />
          <Stat label="Overdue trainings" value={summary.overdueActivities} />
          <Stat label="Due in 14 days" value={summary.dueSoonActivities} />
        </div>
      )}
      <ReportListToolbar
        searchPlaceholder="Search employee or training…"
        search={table.searchQuery}
        onSearch={(v) => { table.setSearchQuery(v); table.setCurrentPage(1); }}
        filters={filters}
        dates={[]}
        hasActiveFilters={Boolean(status || departmentId || table.searchQuery)}
        onClear={() => { setStatus(""); setDepartmentId(""); table.setSearchQuery(""); table.setCurrentPage(1); }}
        customControl={control}
      >
        <DataTable
          rows={table.items}
          getRowKey={(g) => `${g.pid}|${g.code}|${g.title}`}
          isLoading={table.isLoading}
          loadingContent={<SectionLoading text="Loading…" />}
          columns={columns}
          columnLayout={layout}
          emptyState={<TableEmptyState title="Nothing to show" description="Positions must be set for people and the department needs an effective matrix." />}
          pagination={
            table.totalItems > 0 ? (
              <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} />
            ) : undefined
          }
        />
      </ReportListToolbar>
    </div>
  );
}
