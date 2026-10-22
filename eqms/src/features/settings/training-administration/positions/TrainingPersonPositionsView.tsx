import { TrainingPersonName } from "@/features/training-activities/shared/TrainingPersonName";
import { useCallback, useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Select } from "@/components/ui/select/Select";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { trainingError, trainingMatrixApi, type TrainingPersonPosition, type TrainingPosition } from "@/services/api/trainingActivities";
import { trainingAdministrationBase } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { useEffect } from "react";

/** The position of each person, as Training Management uses it for the matrix. The user table keeps only text, so a person is mapped by hand: nothing is guessed. */
export function TrainingPersonPositionsView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [unmatched, setUnmatched] = usePersistedState("training.admin.positions.unmatched", "");
  const [positions, setPositions] = useState<TrainingPosition[]>([]);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => { trainingMatrixApi.positions().then(setPositions).catch(() => setPositions([])); }, []);
  const fetcher = useCallback((params: Record<string, string | number | boolean | undefined>) => trainingMatrixApi.personPositions(params).catch((e) => { setError(trainingError(e)); throw e; }), []);
  const extra = useMemo(() => ({ unmatchedOnly: unmatched === "yes" ? true : undefined }), [unmatched]);
  const table = useServerTable<TrainingPersonPosition>({ persistKey: "training.admin.positions", liveTypes: ["TRAINING"], fetcher, defaultSortBy: "fullName", extraParams: extra, initialItemsPerPage: 10 });

  const apply = async (row: TrainingPersonPosition, positionId: string) => {
    try {
      await trainingMatrixApi.setPersonPosition(row.personId, positionId);
      showToast({ type: "success", title: "Position set", message: row.fullName });
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: "The position was not set", message: trainingError(e) });
    }
  };
  const options = positions.map((p) => ({ label: `${p.name}${p.departmentName ? ` (${p.departmentName})` : ""}`, value: p.id }));
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });

  const columns: DataTableColumn<TrainingPersonPosition>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "employeeCode", header: "Employee ID", sort: sorted("employeeCode"), cell: (r) => r.employeeCode ?? "—" },
    { id: "name", header: "Full Name", sort: sorted("fullName"), cell: (r) => <TrainingPersonName fullName={r.fullName} avatar={r.avatar} /> },
    { id: "department", header: "Department", sort: sorted("department"), cell: (r) => r.department ?? "—" },
    { id: "text", header: "Position in the user table", sort: sorted("positionText"), cell: (r) => r.positionText ?? "—" },
    { id: "mapped", header: "Position for training", sort: sorted("positionName"), cell: (r) => (r.positionName ? <Badge color="emerald">{r.positionName}</Badge> : <Badge color="amber">Not set</Badge>) },
    {
      id: "set",
      header: "Set position",
      cell: (r) => (
        <div className="flex w-80 max-w-full items-center gap-2">
          <div className="flex-1"><Select value={choice[r.personId] ?? r.suggestedPositionId ?? ""} onChange={(v) => setChoice({ ...choice, [r.personId]: v })} options={options} placeholder="Choose" /></div>
          <Button size="sm" variant="outline-emerald" disabled={!(choice[r.personId] ?? r.suggestedPositionId)} onClick={() => void apply(r, (choice[r.personId] ?? r.suggestedPositionId) as string)}>Set</Button>
        </div>
      ),
    },
  ];
  const { layout, control } = useCustomColumnLayout("training.person.positions", columns);
  const filters: ReportSelectFilter[] = [{ id: "unmatched", label: "Show", value: unmatched, options: [{ label: "All", value: "" }, { label: "Without a position", value: "yes" }], onChange: (v) => { setUnmatched(v); table.setCurrentPage(1); } }];
  const crumbs = [...trainingAdministrationBase(navigate), { label: "Person Positions", isActive: true }];
  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader title="Person Positions" breadcrumbItems={crumbs} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ReportListToolbar searchPlaceholder="Search name or employee code…" search={table.searchQuery} onSearch={(v) => { table.setSearchQuery(v); table.setCurrentPage(1); }}
        filters={filters} dates={[]} hasActiveFilters={Boolean(unmatched)} onClear={() => { setUnmatched(""); table.setCurrentPage(1); }} customControl={control}>
        <DataTable rows={table.items} getRowKey={(r) => r.personId} isLoading={table.isLoading} loadingContent={<SectionLoading text="Loading people…" />} columns={columns} columnLayout={layout}
          emptyState={<TableEmptyState title="No People" description="Try changing your search or filter." />}
          pagination={table.totalItems > 0 ? <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} /> : undefined} />
      </ReportListToolbar>
    </div>
  );
}
