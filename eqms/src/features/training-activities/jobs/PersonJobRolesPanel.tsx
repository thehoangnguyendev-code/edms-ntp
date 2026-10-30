import { TrainingPersonName } from "@/features/training-activities/shared/TrainingPersonName";
import { useCallback, useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Badge } from "@/components/ui/badge/Badge";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { trainingError, trainingMatrixApi, type TrainingPersonPosition, type TrainingPosition } from "@/services/api/trainingActivities";
import { useEffect } from "react";
import { useDepartmentNameOptions } from "@/features/training-activities/shared/useListFilters";
import { WorkPositionsPreview } from "./WorkPositionsPreview";

/**
 * The Work Positions that each person holds for Training (read only). A role comes from a job assignment signed by both people (APD.0024), or, for people who were there before the system,
 * from the mapping Training Administration made once; it cannot be given from this screen. A person can hold several.
 */
export function PersonJobRolesPanel() {
  const [held, setHeld] = usePersistedState("training.admin.positions.held", "");
  const [departmentFilter, setDepartmentFilter] = usePersistedState("training.admin.positions.department", "");
  const [roleFilter, setRoleFilter] = usePersistedState("training.admin.positions.role", "");
  const departments = useDepartmentNameOptions();
  const [roles, setRoles] = useState<TrainingPosition[]>([]);
  const [error, setError] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => { trainingMatrixApi.positions().then(setRoles).catch(() => setRoles([])); }, []);
  const fetcher = useCallback((params: Record<string, string | number | boolean | undefined>) => trainingMatrixApi.personPositions(params).catch((e) => { setError(trainingError(e)); throw e; }), []);
  const extra = useMemo(() => ({ mapped: held || undefined, department: departmentFilter || undefined, positionId: roleFilter || undefined }), [held, departmentFilter, roleFilter]);
  const table = useServerTable<TrainingPersonPosition>({ persistKey: "training.admin.positions", liveTypes: ["TRAINING"], fetcher, defaultSortBy: "fullName", extraParams: extra, initialItemsPerPage: 10, syncToUrl: false });
  useEffect(() => { if (!table.isLoading) setHasLoaded(true); }, [table.isLoading]);
  const options = roles.map((p) => ({ label: `${p.name}${p.departmentName ? ` (${p.departmentName})` : ""}`, value: p.id }));
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });

  const columns: DataTableColumn<TrainingPersonPosition>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "employeeCode", header: "Employee ID", sort: sorted("employeeCode"), cell: (r) => r.employeeCode ?? "—" },
    { id: "name", header: "Full Name", sort: sorted("fullName"), cell: (r) => <TrainingPersonName fullName={r.fullName} avatar={r.avatar} /> },
    { id: "department", header: "Department", sort: sorted("department"), cell: (r) => r.department ?? "—" },
    { id: "text", header: "Work Position", sort: sorted("positionText"), cell: (r) => r.positionText ?? "—" },
    { id: "roles", header: "Work Positions", sort: sorted("jobRoleNames"), cell: (r) => (r.jobRoleCount > 0 ? <WorkPositionsPreview personId={r.personId} personName={r.fullName} positions={r.firstPositionName ? [r.firstPositionName, r.secondPositionName].filter((name): name is string => Boolean(name)).map((name, index) => ({ id: String(index), name, carried: false })) : undefined} totalCount={r.jobRoleCount} fallback={r.jobRoleNames} /> : <Badge color="amber">None</Badge>) },
    { id: "source", header: "Given By", cell: (r) => (r.sources ?? "").split(", ").filter(Boolean).map((x) => (x === "JOB_ASSIGNMENT" ? "Job assignment" : "Mapped by Training Administration")).join(", ") || "—" },
  ];
  const { layout, control } = useCustomColumnLayout("training.person.positions", columns);
  const filters: ReportSelectFilter[] = [
    { id: "department", label: "Department", value: departmentFilter, options: [{ label: "All", value: "" }, ...departments], onChange: (v) => { setDepartmentFilter(v); table.setCurrentPage(1); } },
    { id: "role", label: "Work Position", value: roleFilter, options: [{ label: "All", value: "" }, ...options], onChange: (v) => { setRoleFilter(v); table.setCurrentPage(1); } },
    { id: "held", label: "Work Positions Held", value: held, options: [{ label: "All", value: "" }, { label: "Without a Work Position", value: "NO" }, { label: "With a Work Position", value: "YES" }], onChange: (v) => { setHeld(v); table.setCurrentPage(1); } },
  ];
  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ReportListToolbar framed={false} searchPlaceholder="Search name, employee code or Work Position…" search={table.searchQuery} onSearch={(v) => { table.setSearchQuery(v); table.setCurrentPage(1); }}
        filters={filters} dates={[]} hasActiveFilters={Boolean(held || departmentFilter || roleFilter || table.searchQuery)} onClear={() => { setHeld(""); setDepartmentFilter(""); setRoleFilter(""); table.setSearchQuery(""); table.setCurrentPage(1); }} customControl={control}>
        <div aria-busy={table.isLoading}>
        <DataTable rows={table.items} getRowKey={(r) => r.personId} isLoading={table.isLoading && !hasLoaded} loadingContent={<SectionLoading text="Loading people…" />} columns={columns} columnLayout={layout}
          emptyState={<TableEmptyState title="No People" description="Try changing your search or filter." />}
          pagination={table.totalItems > 0 ? <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} /> : undefined} />
        </div>
      </ReportListToolbar>
    </div>
  );
}
