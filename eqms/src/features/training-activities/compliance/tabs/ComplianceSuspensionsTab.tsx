import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Badge } from "@/components/ui/badge/Badge";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { trainingError, trainingFollowUpApi, type TrainingSuspension } from "@/services/api/trainingActivities";
import { TrainingPersonName } from "../../shared/TrainingPersonName";
import { localized, when } from "../../shared/trainingLabels";
import { tr } from "@/i18n";
import { statusColors } from "@/components/ui/badge/statusColors";
import type { BadgeColor } from "@/components/ui/badge/Badge";

const STATUS_LABEL: Record<string, string> = localized({ OPEN: "Work suspended", CLEARED: "Cleared" });
const STATUS_COLOR = statusColors("OPEN", "CLEARED") as Record<string, BadgeColor>;
// RESUMED_BY_HEAD is no longer possible: a flag ends only when the retraining is passed. Flags that were resumed by hand earlier stay in the list with their reason, as records.
const BASIS_LABEL: Record<string, string> = { RETRAINED_PASSED: "Qualified after retraining", RESUMED_BY_HEAD: "Resumed by the head of the unit" };

/**
 * People whose work is suspended because they did not pass an assessment (SOP.0003 5.3.7). It is a flag, nothing else is blocked. It ends only when the retraining is passed;
 * nobody can resume the work by hand (owner decision 2026-11-23). The retraining is arranged from the training activity (Supplementary training).
 */
export function ComplianceSuspensionsTab({ departmentId, departmentFilter }: { departmentId: string; departmentFilter: ReportSelectFilter }) {
  const navigate = useNavigate();
  const [status, setStatus] = usePersistedState("training.compliance.suspensions.status", "OPEN");
  const [error, setError] = useState("");
  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      trainingFollowUpApi.suspensions(params as Record<string, string | number | undefined>).catch((e) => { setError(trainingError(e)); throw e; }),
    [],
  );
  const extra = useMemo(() => ({ departmentId: departmentId || undefined, status: status || undefined }), [departmentId, status]);
  const table = useServerTable<TrainingSuspension>({ persistKey: "training.compliance.suspensions", liveTypes: ["TRAINING"], fetcher, defaultSortBy: "raisedAt", defaultSortDirection: "desc", extraParams: extra, initialItemsPerPage: 10, syncToUrl: false });
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });

  const columns: DataTableColumn<TrainingSuspension>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "employeeCode", header: tr("Employee ID"), sort: sorted("employeeCode"), cell: (s) => s.employeeCode ?? "—" },
    { id: "name", header: "Full Name", sort: sorted("fullName"), cell: (s) => <TrainingPersonName fullName={s.fullName} avatar={s.avatar} /> },
    { id: "position", header: "Position", sort: sorted("position"), cell: (s) => s.position ?? "—" },
    { id: "training", header: tr("Training Number"), sort: sorted("trainingNumber"), cell: (s) => <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => navigate(`/training-management/activities/${s.activityId}`)}>{s.trainingNumber}</button> },
    { id: "topic", header: "Training", sort: sorted("topic"), cell: (s) => <div className="max-w-72 whitespace-normal">{s.topicText ?? "—"}</div> },
    { id: "percent", header: "Score", sort: sorted("percent"), cell: (s) => (s.percent == null ? "—" : `${s.percent}%`) },
    { id: "raised", header: tr("Suspended On"), sort: sorted("raisedAt"), cell: (s) => when(s.raisedAt) },
    { id: "status", header: "Status", sort: sorted("status"), cell: (s) => <Badge color={STATUS_COLOR[s.status]}>{STATUS_LABEL[s.status]}</Badge> },
    {
      id: "cleared", header: tr("How it ended"), sort: sorted("clearedAt"),
      cell: (s) => (s.status === "OPEN" ? "—" : (
        <div className="max-w-72 whitespace-normal">
          <div>{BASIS_LABEL[s.clearBasis ?? ""] ?? s.clearBasis}{s.clearTrainingNumber ? ` (${s.clearTrainingNumber})` : ""}</div>
          <div className="text-xs text-slate-500">{when(s.clearedAt)}{s.clearedByName ? ` · ${s.clearedByName}` : ""}{s.clearReason ? ` · ${s.clearReason}` : ""}</div>
        </div>
      )),
    },
  ];
  const { layout, control } = useCustomColumnLayout("training.compliance.suspensions", columns);
  const filters: ReportSelectFilter[] = [
    departmentFilter,
    { id: "status", label: "Status", value: status, options: [{ label: "All", value: "" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ label, value }))], onChange: (v) => { setStatus(v); table.setCurrentPage(1); } },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">{tr("A person who does not pass an assessment is retrained. Until the retraining is passed, the work that depends on the training is suspended; this is only a flag and a notice, no other function is blocked. The flag ends by itself when the person passes the retraining.")}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ReportListToolbar
        searchPlaceholder={tr("Search employee, training or training number…")}
        search={table.searchQuery}
        onSearch={(v) => { table.setSearchQuery(v); table.setCurrentPage(1); }}
        filters={filters} dates={[]} hasActiveFilters={Boolean(status !== "OPEN" || table.searchQuery)}
        onClear={() => { setStatus("OPEN"); table.setSearchQuery(""); table.setCurrentPage(1); }}
        customControl={control} framed={false} flush
      >
        <DataTable
          rows={table.items} getRowKey={(s) => s.id} isLoading={table.isLoading}
          columns={columns} columnLayout={layout}
          emptyState={<TableEmptyState title={tr("No suspended work")} description={tr("Nobody of the department is waiting for retraining.")} />}
          pagination={table.totalItems > 0 ? <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} /> : undefined}
        />
      </ReportListToolbar>
    </div>
  );
}
