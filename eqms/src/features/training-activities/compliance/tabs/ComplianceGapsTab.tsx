import { TrainingPersonName } from "../../shared/TrainingPersonName";
import { useCallback, useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Badge } from "@/components/ui/badge/Badge";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { trainingComplianceApi, trainingError, type TrainingGap } from "@/services/api/trainingActivities";
import { day } from "@/features/training-activities/shared/trainingLabels";

const STATUS_LABEL: Record<string, string> = { MISSING: "Not trained", DUE: "Annual training due", OK: "Trained" };
const STATUS_COLOR: Record<string, "red" | "amber" | "emerald"> = { MISSING: "red", DUE: "amber", OK: "emerald" };

/** Every requirement of the effective matrix for every person of the department, one line each, with what is missing or due. */
export function ComplianceGapsTab({ departmentId, departmentFilter }: { departmentId: string; departmentFilter: ReportSelectFilter }) {
  const [status, setStatus] = usePersistedState("training.compliance.gaps.status", "");
  const [error, setError] = useState("");

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      trainingComplianceApi.coverage(params as Record<string, string | number | undefined>).catch((e) => {
        setError(trainingError(e));
        throw e;
      }),
    [],
  );
  const extra = useMemo(() => ({ departmentId: departmentId || undefined, status: status || undefined }), [departmentId, status]);
  const table = useServerTable<TrainingGap>({ persistKey: "training.compliance.gaps", liveTypes: ["TRAINING"], fetcher, defaultSortBy: "status", extraParams: extra, initialItemsPerPage: 10, syncToUrl: false });

  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });

  const columns: DataTableColumn<TrainingGap>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "employeeCode", header: "Employee ID", sort: sorted("employeeCode"), cell: (g) => g.employeeCode ?? "—" },
    { id: "name", header: "Full Name", sort: sorted("fullName"), cell: (g) => <TrainingPersonName fullName={g.fullName} avatar={g.avatar} /> },
    { id: "position", header: "Position", sort: sorted("positionName"), cell: (g) => g.positionName ?? "—" },
    { id: "topic", header: "Required training", sort: sorted("title"), cell: (g) => <div className="max-w-80 whitespace-normal">{g.code ? `${g.code} — ` : ""}{g.title}</div> },
    { id: "annual", header: "Annual", sort: sorted("annualRequired"), cell: (g) => (g.annualRequired ? "Yes" : "No") },
    { id: "last", header: "Last trained", sort: sorted("lastDone"), cell: (g) => day(g.lastDone) },
    { id: "status", header: "Status", sort: sorted("status"), cell: (g) => <Badge color={STATUS_COLOR[g.status]}>{STATUS_LABEL[g.status]}</Badge> },
  ];
  const { layout, control } = useCustomColumnLayout("training.compliance.coverage", columns);
  const filters: ReportSelectFilter[] = [
    departmentFilter,
    { id: "status", label: "Status", value: status, options: [{ label: "All", value: "" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ label, value }))], onChange: (v) => { setStatus(v); table.setCurrentPage(1); } },
  ];

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ReportListToolbar
        searchPlaceholder="Search employee or training…"
        search={table.searchQuery}
        onSearch={(v) => { table.setSearchQuery(v); table.setCurrentPage(1); }}
        filters={filters}
        dates={[]}
        hasActiveFilters={Boolean(status || table.searchQuery)}
        onClear={() => { setStatus(""); table.setSearchQuery(""); table.setCurrentPage(1); }}
        customControl={control}
        framed={false}
        flush
      >
        <DataTable
          rows={table.items}
          getRowKey={(g) => `${g.pid}|${g.code}|${g.title}`}
          isLoading={table.isLoading}
          loadingContent={<SectionLoading text="Loading…" />}
          columns={columns}
          columnLayout={layout}
          emptyState={<TableEmptyState title="Nothing to show" description="People must hold a Job Role (job assignment) and the department needs an effective matrix." />}
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
