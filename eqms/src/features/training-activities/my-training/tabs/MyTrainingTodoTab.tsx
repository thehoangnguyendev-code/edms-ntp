import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, pickerDateToIso } from "@/features/report/shared/ReportListToolbar";
import { myTrainingApi } from "@/services/api/myTraining";
import type { TrainingTask } from "@/services/api/trainingActivities";
import { METHOD_LABEL, STATUS_COLOR, STATUS_LABEL, day } from "../../shared/trainingLabels";

export function MyTrainingTodoTab({ onTotal }: { onTotal: (total: number) => void }) {
  const navigate = useNavigate();
  const drag = useTableDragScroll();
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const extraParams = useMemo(() => ({ method: method || undefined, status: status || undefined, fromDate: pickerDateToIso(from) || undefined, toDate: pickerDateToIso(to) || undefined }), [method, status, from, to]);
  const table = useServerTable<TrainingTask>({ fetcher: myTrainingApi.tasks, defaultSortBy: "dueDate", extraParams, syncToUrl: false });
  useEffect(() => { if (!table.isLoading) onTotal(table.totalItems); }, [table.isLoading, table.totalItems, onTotal]);
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });
  const columns: DataTableColumn<TrainingTask>[] = [
    { id: "no", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "number", header: "Training Number", sort: sorted("trainingNumber"), cell: (t) => <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => navigate(`/training-management/activities/${t.activityId}/participate`)}>{t.trainingNumber}</button> },
    { id: "title", header: "Training Title", sort: sorted("trainingTitle"), cell: (t) => <div className="max-w-80 whitespace-normal">{t.trainingTitle}</div> },
    { id: "topics", header: "Topics", sort: sorted("topics"), cell: (t) => <div className="max-w-80 whitespace-normal">{t.topics ?? "—"}</div> },
    { id: "method", header: "Method", sort: sorted("method"), cell: (t) => METHOD_LABEL[t.method] ?? t.method },
    { id: "when", header: "Scheduled", sort: sorted("scheduledOn"), cell: (t) => day(t.scheduledOn) },
    { id: "due", header: "Due", sort: sorted("dueDate"), cell: (t) => day(t.dueDate) },
    { id: "status", header: "Status", sort: sorted("status"), cell: (t) => <Badge color={STATUS_COLOR[t.status] ?? "slate"}>{STATUS_LABEL[t.status] ?? t.status}</Badge> },
  ];
  const { layout, control } = useCustomColumnLayout("training.mine.tasks", columns);
  const change = (setter: (value: string) => void) => (value: string) => { setter(value); table.setCurrentPage(1); };
  return <ReportListToolbar
    searchPlaceholder="Search Training Number, Training Title or topic…" search={table.searchQuery}
    onSearch={(value) => { table.setSearchQuery(value); table.setCurrentPage(1); }}
    filters={[
      { id: "method", label: "Method", value: method, options: [{ label: "All", value: "" }, ...Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))], onChange: change(setMethod) },
      { id: "status", label: "Status", value: status, options: [{ label: "All", value: "" }, ...["NOTIFIED", "IN_PROGRESS"].map((value) => ({ value, label: STATUS_LABEL[value] }))], onChange: change(setStatus) },
    ]}
    dates={[{ id: "scheduled", label: "Scheduled date", from, to, onChange: (a, b) => { setFrom(a); setTo(b); table.setCurrentPage(1); } }]}
    hasActiveFilters={Boolean(method || status || from || to || table.searchQuery)}
    onClear={() => { setMethod(""); setStatus(""); setFrom(""); setTo(""); table.setSearchQuery(""); table.setCurrentPage(1); }}
    customControl={control} framed={false} flush
  >
    <DataTable rows={table.items} getRowKey={(t) => t.participantId} columns={columns} columnLayout={layout}
      scrollerRef={drag.scrollerRef} scrollProps={drag.dragEvents} isDragging={drag.isDragging}
      isLoading={table.isLoading} loadingContent={<SectionLoading text="Loading training tasks…" />}
      emptyState={<TableEmptyState title="Nothing to do" description="No training tasks match the current filters." />}
      pagination={<TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} />} />
  </ReportListToolbar>;
}
