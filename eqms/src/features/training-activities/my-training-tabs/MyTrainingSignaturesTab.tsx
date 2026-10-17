import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, pickerDateToIso } from "@/features/report/shared/ReportListToolbar";
import { myTrainingApi } from "@/services/api/myTraining";
import type { TrainingMyApproval } from "@/services/api/trainingActivities";
import { STATUS_LABEL, STEP_LABEL, day } from "../trainingLabels";

const OBJECT_LABEL: Record<string, string> = {
  TRAINING_ACTIVITY: "Training activity", TRAINING_MATRIX_VERSION: "Training matrix", TRAINING_JOB_ASSIGNMENT: "Job assignment",
  TRAINING_SPECIMEN_SIGNATURE: "Specimen signature", TRAINING_RECORD_EXPORT: "Record export", TRAINING_TRAINER_EXCEPTION: "Trainer exception",
  TRAINING_LEGACY_EVIDENCE: "Legacy evidence", TRAINING_REQUIREMENT: "Training requirement",
};
const SIGNATURE_STEPS: Record<string, string> = { ...STEP_LABEL, RECEIVER_ACCEPT: "Accept your job assignment" };

export function MyTrainingSignaturesTab({ onTotal }: { onTotal: (total: number) => void }) {
  const navigate = useNavigate();
  const drag = useTableDragScroll();
  const [objectType, setObjectType] = useState("");
  const [stepCode, setStepCode] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const extraParams = useMemo(() => ({ objectType: objectType || undefined, stepCode: stepCode || undefined, fromDate: pickerDateToIso(from) || undefined, toDate: pickerDateToIso(to) || undefined }), [objectType, stepCode, from, to]);
  const table = useServerTable<TrainingMyApproval>({ fetcher: myTrainingApi.approvals, defaultSortBy: "assignedAt", extraParams, syncToUrl: false });
  useEffect(() => { if (!table.isLoading) onTotal(table.totalItems); }, [table.isLoading, table.totalItems, onTotal]);
  const open = (a: TrainingMyApproval) => navigate(a.objectType === "TRAINING_MATRIX_VERSION" ? `/training-management/matrix-versions/${a.objectId}` : a.objectType === "TRAINING_JOB_ASSIGNMENT" ? `/training-management/job-assignments/${a.objectId}` : a.objectType === "TRAINING_SPECIMEN_SIGNATURE" ? "/training-management/specimen-signatures" : a.objectType === "TRAINING_RECORD_EXPORT" ? "/training-management/record-exports" : a.objectType === "TRAINING_TRAINER_EXCEPTION" && a.activityId ? `/training-management/activities/${a.activityId}/approve` : a.objectType === "TRAINING_LEGACY_EVIDENCE" ? "/training-management/legacy-evidence" : a.objectType === "TRAINING_REQUIREMENT" ? `/training-management/requirements/${a.objectId}` : `/training-management/activities/${a.objectId}/${a.stepCode === "CONTENT_REVIEW" ? "review" : a.stepCode === "CONTENT_APPROVE" ? "approve" : a.stepCode === "ACTIVITY_COMPLETE" ? "confirm" : ""}`.replace(/\/$/, ""));
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });
  const columns: DataTableColumn<TrainingMyApproval>[] = [
    { id: "no", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "number", header: "Training Number", sort: sorted("trainingNumber"), cell: (a) => <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => open(a)}>{a.trainingNumber}</button> },
    { id: "title", header: "Title", sort: sorted("title"), cell: (a) => <div className="max-w-80 whitespace-normal">{a.title}</div> },
    { id: "step", header: "Step", sort: sorted("stepCode"), cell: (a) => SIGNATURE_STEPS[a.stepCode] ?? a.stepCode },
    { id: "status", header: "Status", sort: sorted("status"), cell: (a) => STATUS_LABEL[a.status] ?? a.status.replace(/_/g, " ").toLowerCase() },
    { id: "since", header: "Waiting since", sort: sorted("assignedAt"), cell: (a) => day(a.assignedAt) },
  ];
  const { layout, control } = useCustomColumnLayout("training.mine.signatures", columns);
  return <ReportListToolbar
    searchPlaceholder="Search reference number or title…" search={table.searchQuery}
    onSearch={(value) => { table.setSearchQuery(value); table.setCurrentPage(1); }}
    filters={[
      { id: "objectType", label: "Type", value: objectType, options: [{ label: "All", value: "" }, ...Object.entries(OBJECT_LABEL).map(([value, label]) => ({ value, label }))], onChange: (v) => { setObjectType(v); table.setCurrentPage(1); } },
      { id: "stepCode", label: "Step", value: stepCode, options: [{ label: "All", value: "" }, ...Object.entries(SIGNATURE_STEPS).map(([value, label]) => ({ value, label }))], onChange: (v) => { setStepCode(v); table.setCurrentPage(1); } },
    ]}
    dates={[{ id: "assigned", label: "Waiting since", from, to, onChange: (a, b) => { setFrom(a); setTo(b); table.setCurrentPage(1); } }]}
    hasActiveFilters={Boolean(objectType || stepCode || from || to || table.searchQuery)}
    onClear={() => { setObjectType(""); setStepCode(""); setFrom(""); setTo(""); table.setSearchQuery(""); table.setCurrentPage(1); }}
    customControl={control} framed={false} flush
  >
    <DataTable rows={table.items} getRowKey={(a) => a.id} columns={columns} columnLayout={layout}
      scrollerRef={drag.scrollerRef} scrollProps={drag.dragEvents} isDragging={drag.isDragging}
      isLoading={table.isLoading} loadingContent={<SectionLoading text="Loading signature requests…" />}
      emptyState={<TableEmptyState title="Nothing waiting" description="No signature requests match the current filters." />}
      pagination={<TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} />} />
  </ReportListToolbar>;
}
