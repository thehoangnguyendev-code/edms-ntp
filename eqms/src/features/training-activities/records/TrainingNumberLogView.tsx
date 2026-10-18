import { useCallback, useEffect, useMemo, useState } from "react";
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
import { trainingError, trainingRecordsApi, type TrainingNumberLogRow } from "@/services/api/trainingActivities";
import { KIND_LABEL, STATUS_COLOR, STATUS_LABEL, day, trainingBreadcrumbs, TRAINING_PAGES } from "../shared/trainingLabels";

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 8 }, (_v, i) => String(THIS_YEAR - i));

/** The Training Number register of a department and a year (FRM.0044): every number issued, including cancelled ones. It is read from the activities, never typed. */
export function TrainingNumberLogView() {
  const navigate = useNavigate();
  const drag = useTableDragScroll();
  const [departments, setDepartments] = useState<{ label: string; value: string }[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [year, setYear] = useState(String(THIS_YEAR));
  const [error, setError] = useState("");

  useEffect(() => {
    dictionaryApi.getDepartments().then((list) => setDepartments(list.map((d) => ({ label: d.name, value: d.id })))).catch(() => setDepartments([]));
  }, []);

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      trainingRecordsApi.numberLog(params as Record<string, string | number | undefined>).catch((e) => {
        setError(trainingError(e));
        throw e;
      }),
    [],
  );
  const extraParams = useMemo(() => ({ departmentId: departmentId || undefined, year: Number(year) || undefined }), [departmentId, year]);
  const table = useServerTable<TrainingNumberLogRow>({ fetcher, defaultSortBy: "serial", defaultSortDirection: "asc", extraParams, initialItemsPerPage: 10 });
  useEffect(() => setError(""), [table.items]);

  const columns: DataTableColumn<TrainingNumberLogRow>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "date", header: "Date", cell: (r) => day(r.createdAt) },
    { id: "number", header: "Training Number", cell: (r) => <span className="font-medium text-slate-900">{r.trainingNumber}</span> },
    { id: "kind", header: "Type", cell: (r) => KIND_LABEL[r.kind] ?? r.kind },
    { id: "title", header: "Training Title", cell: (r) => <div className="max-w-80 whitespace-normal">{r.trainingTitle}</div> },
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
  const { layout, control } = useCustomColumnLayout("training.numberlog.list", columns);
  const reset = (apply: () => void) => {
    apply();
    table.setCurrentPage(1);
  };
  const filters: ReportSelectFilter[] = [
    { id: "department", label: "Department", value: departmentId, options: [{ label: "My department", value: "" }, ...departments], onChange: (v) => reset(() => setDepartmentId(v)) },
    { id: "year", label: "Year", value: year, options: YEARS.map((y) => ({ label: y, value: y })), onChange: (v) => reset(() => setYear(v)) },
  ];

  return (
    <div className="flex h-full w-full min-w-0 flex-1 flex-col gap-4 md:gap-6">
      <PageHeader title={TRAINING_PAGES.numberLog.title} breadcrumbItems={trainingBreadcrumbs(navigate, "numberLog")} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ReportListToolbar
        searchPlaceholder="Search Training Number, topic or SOP…"
        search={table.searchQuery}
        onSearch={(value) => { table.setSearchQuery(value); table.setCurrentPage(1); }}
        filters={filters}
        dates={[]}
        hasActiveFilters={Boolean(departmentId || year !== String(THIS_YEAR) || table.searchQuery)}
        onClear={() => { setDepartmentId(""); setYear(String(THIS_YEAR)); table.setSearchQuery(""); table.setCurrentPage(1); }}
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
