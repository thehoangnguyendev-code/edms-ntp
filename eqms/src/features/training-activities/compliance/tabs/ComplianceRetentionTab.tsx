import { useCallback, useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Badge } from "@/components/ui/badge/Badge";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { trainingError, trainingFollowUpApi, type TrainingRetentionRow } from "@/services/api/trainingActivities";
import { TrainingPersonName } from "../../shared/TrainingPersonName";
import { day } from "../../shared/trainingLabels";

const STATE_LABEL: Record<string, string> = { RETAINED: "Kept", ENDED: "Retention ended" };

/**
 * The personal training records of people who have left must be kept for the years set in Training Properties after the day they left (SOP.0003 5.3.10). This list marks
 * where that time is running or over. It only marks: nothing is deleted; disposing of records after the retention is a separate, approved procedure.
 */
export function ComplianceRetentionTab({ departmentId, departmentFilter }: { departmentId: string; departmentFilter: ReportSelectFilter }) {
  const [state, setState] = usePersistedState("training.compliance.retention.state", "");
  const [error, setError] = useState("");
  const [years, setYears] = useState<number>();

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      trainingFollowUpApi.retention(params as Record<string, string | number | undefined>).then((page) => { setYears(page.retentionYears); return page; }).catch((e) => { setError(trainingError(e)); throw e; }),
    [],
  );
  const extra = useMemo(() => ({ departmentId: departmentId || undefined, state: state || undefined }), [departmentId, state]);
  const table = useServerTable<TrainingRetentionRow>({ persistKey: "training.compliance.retention", liveTypes: ["TRAINING"], fetcher, defaultSortBy: "retainedUntil", extraParams: extra, initialItemsPerPage: 10, syncToUrl: false });
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });

  const columns: DataTableColumn<TrainingRetentionRow>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "employeeCode", header: "Employee ID", sort: sorted("employeeCode"), cell: (r) => r.employeeCode ?? "—" },
    { id: "name", header: "Full Name", sort: sorted("fullName"), cell: (r) => <TrainingPersonName fullName={r.fullName} avatar={r.avatar} /> },
    { id: "position", header: "Position", sort: sorted("position"), cell: (r) => r.position ?? "—" },
    { id: "left", header: "Left On", sort: sorted("terminationDate"), cell: (r) => day(r.terminationDate) },
    { id: "until", header: "Kept Until", sort: sorted("retainedUntil"), cell: (r) => day(r.retainedUntil) },
    { id: "records", header: "Records", sort: sorted("records"), cell: (r) => r.records },
    { id: "state", header: "Status", cell: (r) => <Badge color={r.ended ? "amber" : "emerald"}>{r.ended ? STATE_LABEL.ENDED : STATE_LABEL.RETAINED}</Badge> },
  ];
  const { layout, control } = useCustomColumnLayout("training.compliance.retention", columns);
  const filters: ReportSelectFilter[] = [
    departmentFilter,
    { id: "state", label: "Status", value: state, options: [{ label: "All", value: "" }, ...Object.entries(STATE_LABEL).map(([value, label]) => ({ label, value }))], onChange: (v) => { setState(v); table.setCurrentPage(1); } },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Records of people who have left are kept {years ?? "…"} years after the day they left. A record whose retention has ended is only marked here; it is not deleted, and disposing of it follows a separate procedure with its own approval.
      </p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ReportListToolbar
        searchPlaceholder="Search employee…"
        search={table.searchQuery}
        onSearch={(v) => { table.setSearchQuery(v); table.setCurrentPage(1); }}
        filters={filters} dates={[]} hasActiveFilters={Boolean(state || table.searchQuery)}
        onClear={() => { setState(""); table.setSearchQuery(""); table.setCurrentPage(1); }}
        customControl={control} framed={false} flush
      >
        <DataTable
          rows={table.items} getRowKey={(r) => r.id} isLoading={table.isLoading} loadingContent={<SectionLoading text="Loading…" />}
          columns={columns} columnLayout={layout}
          emptyState={<TableEmptyState title="Nobody has left" description="No person of the department who has left has training records." />}
          pagination={table.totalItems > 0 ? <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} /> : undefined}
        />
      </ReportListToolbar>
    </div>
  );
}
