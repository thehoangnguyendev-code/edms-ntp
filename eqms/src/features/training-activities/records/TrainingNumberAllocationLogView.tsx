import { useCallback, useEffect, useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Badge } from "@/components/ui/badge/Badge";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { dictionaryApi } from "@/services/api/dictionary";
import { trainingError, trainingRecordsApi, type TrainingNumberAllocationLogRow } from "@/services/api/trainingActivities";
import { KIND_LABEL, KIND_REASON_LABEL, STATUS_COLOR, STATUS_LABEL, day, trainingBreadcrumbs, TRAINING_PAGES } from "../shared/trainingLabels";
import { resettingDates, useDateRange } from "../shared/useListFilters";
import { departmentOptions, useOwnDepartment } from "../shared/useOwnDepartment";

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 8 }, (_v, i) => String(THIS_YEAR - i));

/** The Training Number Allocation Log of a department and a year (FRM.0044): every number issued, including cancelled ones. It is read from the activities, never typed. */
export function TrainingNumberAllocationLogView() {
  const own = useOwnDepartment();
  if (!own.loaded) return <SectionLoading text="Loading the register…" />;
  return <TrainingNumberAllocationLog ownDepartmentId={own.id} />;
}

function TrainingNumberAllocationLog({ ownDepartmentId }: { ownDepartmentId: string }) {
  const navigate = useNavigate();
  const drag = useTableDragScroll();
  const [departments, setDepartments] = useState<{ label: string; value: string }[]>([]);
  const [departmentId, setDepartmentId] = useState(ownDepartmentId);
  const [year, setYear] = usePersistedState("training.numberAllocationLog.year", String(THIS_YEAR));
  const [kind, setKind] = usePersistedState("training.numberAllocationLog.kind", "");
  const [status, setStatus] = usePersistedState("training.numberAllocationLog.status", "");
  const [reason, setReason] = usePersistedState("training.numberAllocationLog.reason", "");
  const issuedRange = useDateRange("training.numberAllocationLog.issued", "Issued Date Range");
  const [error, setError] = useState("");

  useEffect(() => {
    dictionaryApi.getDepartments().then((list) => setDepartments(list.map((d) => ({ label: d.name, value: d.id })))).catch(() => setDepartments([]));
  }, []);

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      trainingRecordsApi.numberAllocationLog(params as Record<string, string | number | undefined>).catch((e) => {
        setError(trainingError(e));
        throw e;
      }),
    [],
  );
  const extraParams = useMemo(() => ({
    departmentId: departmentId || undefined, year: Number(year) || undefined, kind: kind || undefined, status: status || undefined, kindReason: reason || undefined,
    ...issuedRange.params("issuedFrom", "issuedTo"),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [departmentId, year, kind, status, reason, issuedRange.from, issuedRange.to]);
  const table = useServerTable<TrainingNumberAllocationLogRow>({ persistKey: "training.numberAllocationLog", liveTypes: ["TRAINING"], fetcher, defaultSortBy: "number", defaultSortDirection: "asc", extraParams, initialItemsPerPage: 10 });
  useEffect(() => setError(""), [table.items]);

  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });

  const columns: DataTableColumn<TrainingNumberAllocationLogRow>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "department", header: "Department", sort: sorted("department"), cell: (r) => r.departmentName ?? "—" },
    { id: "date", header: "Issued On", sort: sorted("date"), cell: (r) => day(r.createdAt) },
    { id: "number", header: "Training Number", sort: sorted("number"), cell: (r) => <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => navigate(`/training-management/activities/${r.activityId}`)}>{r.trainingNumber}</button> },
    { id: "kind", header: "Type", sort: sorted("kind"), cell: (r) => KIND_LABEL[r.kind] ?? r.kind },
    { id: "title", header: "Training Topic", sort: sorted("title"), cell: (r) => <div className="max-w-80 whitespace-normal">{r.trainingTopics}</div> },
    { id: "document", header: "SOP", sort: sorted("document"), cell: (r) => (r.documentLabel ?? "—") },
    { id: "sessions", header: "Number of Session", sort: sorted("sessions"), cell: (r) => r.sessions },
    { id: "status", header: "Status", sort: sorted("status"), cell: (r) => <Badge color={STATUS_COLOR[r.status] ?? "slate"}>{STATUS_LABEL[r.status] ?? r.status}</Badge> },
    {
      id: "note",
      header: "Remark",
      cell: (r) => (
        <div className="max-w-60 whitespace-normal">
          {[r.cancelReason ? `Cancelled: ${r.cancelReason}` : "", r.postponements ? `Postponed ${r.postponements} time(s)` : ""].filter(Boolean).join("; ") || "—"}
        </div>
      ),
    },
  ];
  const { layout, control } = useCustomColumnLayout("training.numberallocationlog.list", columns);
  const reset = (apply: () => void) => {
    apply();
    table.setCurrentPage(1);
  };
  const filters: ReportSelectFilter[] = [
    { id: "department", label: "Department", value: departmentId, options: departmentOptions(departments, ownDepartmentId), onChange: (v) => reset(() => setDepartmentId(v)) },
    { id: "year", label: "Year", value: year, options: YEARS.map((y) => ({ label: y, value: y })), onChange: (v) => reset(() => setYear(v)) },
    { id: "kind", label: "Type", value: kind, options: [{ label: "All", value: "" }, ...Object.entries(KIND_LABEL).map(([value, label]) => ({ label, value }))], onChange: (v) => reset(() => setKind(v)) },
    { id: "reason", label: "Reason", value: reason, options: [{ label: "All", value: "" }, ...Object.entries(KIND_REASON_LABEL).map(([value, label]) => ({ label, value }))], onChange: (v) => reset(() => setReason(v)) },
    { id: "status", label: "Status", value: status, options: [{ label: "All", value: "" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ label, value }))], onChange: (v) => reset(() => setStatus(v)) },
  ];

  return (
    <div className="flex h-full w-full min-w-0 flex-1 flex-col gap-4 md:gap-6">
      <PageHeader
        title={TRAINING_PAGES.numberAllocationLog.title}
        breadcrumbItems={trainingBreadcrumbs(navigate, "numberAllocationLog")}
      />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ReportListToolbar
        searchPlaceholder="Search Training Number, Training Topic or SOP…"
        search={table.searchQuery}
        onSearch={(value) => { table.setSearchQuery(value); table.setCurrentPage(1); }}
        filters={filters}
        dates={resettingDates([issuedRange.filter], () => table.setCurrentPage(1))}
        hasActiveFilters={Boolean(departmentId !== ownDepartmentId || year !== String(THIS_YEAR) || kind || status || reason || issuedRange.isSet || table.searchQuery)}
        onClear={() => { setDepartmentId(ownDepartmentId); setYear(String(THIS_YEAR)); setKind(""); setStatus(""); setReason(""); issuedRange.clear(); table.setSearchQuery(""); table.setCurrentPage(1); }}
        customControl={control}
      >
        <DataTable
          rows={table.items}
          getRowKey={(r) => r.trainingNumber}
          isLoading={table.isLoading}
          loadingContent={<SectionLoading text="Loading the register…" />}
          emptyState={<TableEmptyState title="No Training Numbers" description="No number was issued for this department and year." />}
          scrollerRef={drag.scrollerRef}
          scrollProps={drag.dragEvents}
          isDragging={drag.isDragging}
          columns={columns}
          columnLayout={layout}
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
