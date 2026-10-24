import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconPlayerPlay } from "@tabler/icons-react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Badge } from "@/components/ui/badge/Badge";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { trainingError, trainingFollowUpApi, type TrainingSuspension } from "@/services/api/trainingActivities";
import { Textarea } from "../../shared/TrainingFields";
import { TrainingPersonName } from "../../shared/TrainingPersonName";
import { useTrainingRowMenu } from "../../shared/useTrainingRowMenu";
import { statusChange, when } from "../../shared/trainingLabels";

const STATUS_LABEL: Record<string, string> = { OPEN: "Work suspended", CLEARED: "Cleared" };
const STATUS_COLOR: Record<string, "red" | "emerald"> = { OPEN: "red", CLEARED: "emerald" };
const BASIS_LABEL: Record<string, string> = { RETRAINED_PASSED: "Retraining passed", RESUMED_BY_HEAD: "Resumed by the head of the unit" };

/**
 * People whose work is suspended because they did not pass an assessment (SOP.0003 5.3.7). It is a flag, nothing else is blocked. It ends when the retraining is passed, or
 * when the head of the unit resumes the work with a reason and an electronic signature.
 */
export function ComplianceSuspensionsTab({ departmentId, departmentFilter }: { departmentId: string; departmentFilter: ReportSelectFilter }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [status, setStatus] = usePersistedState("training.compliance.suspensions.status", "OPEN");
  const [error, setError] = useState("");
  const [resuming, setResuming] = useState<TrainingSuspension>();
  const [reason, setReason] = useState("");
  const [signing, setSigning] = useState(false);

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      trainingFollowUpApi.suspensions(params as Record<string, string | number | undefined>).catch((e) => { setError(trainingError(e)); throw e; }),
    [],
  );
  const extra = useMemo(() => ({ departmentId: departmentId || undefined, status: status || undefined }), [departmentId, status]);
  const table = useServerTable<TrainingSuspension>({ persistKey: "training.compliance.suspensions", liveTypes: ["TRAINING"], fetcher, defaultSortBy: "raisedAt", defaultSortDirection: "desc", extraParams: extra, initialItemsPerPage: 10, syncToUrl: false });
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });

  const rowMenu = useTrainingRowMenu(table.items, (s) => (s.canResume ? [{ label: "Resume Work", icon: <IconPlayerPlay className="h-4 w-4" />, onClick: () => { setReason(""); setResuming(s); } }] : []));
  const columns: DataTableColumn<TrainingSuspension>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "employeeCode", header: "Employee ID", sort: sorted("employeeCode"), cell: (s) => s.employeeCode ?? "—" },
    { id: "name", header: "Full Name", sort: sorted("fullName"), cell: (s) => <TrainingPersonName fullName={s.fullName} avatar={s.avatar} /> },
    { id: "position", header: "Position", sort: sorted("position"), cell: (s) => s.position ?? "—" },
    { id: "training", header: "Training Number", sort: sorted("trainingNumber"), cell: (s) => <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => navigate(`/training-management/activities/${s.activityId}`)}>{s.trainingNumber}</button> },
    { id: "topic", header: "Training", sort: sorted("topic"), cell: (s) => <div className="max-w-72 whitespace-normal">{s.topicText ?? "—"}</div> },
    { id: "percent", header: "Score", sort: sorted("percent"), cell: (s) => (s.percent == null ? "—" : `${s.percent}%`) },
    { id: "raised", header: "Suspended On", sort: sorted("raisedAt"), cell: (s) => when(s.raisedAt) },
    { id: "status", header: "Status", sort: sorted("status"), cell: (s) => <Badge color={STATUS_COLOR[s.status]}>{STATUS_LABEL[s.status]}</Badge> },
    {
      id: "cleared", header: "How it ended", sort: sorted("clearedAt"),
      cell: (s) => (s.status === "OPEN" ? "—" : (
        <div className="max-w-72 whitespace-normal">
          <div>{BASIS_LABEL[s.clearBasis ?? ""] ?? s.clearBasis}{s.clearTrainingNumber ? ` (${s.clearTrainingNumber})` : ""}</div>
          <div className="text-xs text-slate-500">{when(s.clearedAt)}{s.clearedByName ? ` · ${s.clearedByName}` : ""}{s.clearReason ? ` · ${s.clearReason}` : ""}</div>
        </div>
      )),
    },
  ];
  const { layout, control } = useCustomColumnLayout("training.compliance.suspensions", columns, rowMenu.action);
  const filters: ReportSelectFilter[] = [
    departmentFilter,
    { id: "status", label: "Status", value: status, options: [{ label: "All", value: "" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ label, value }))], onChange: (v) => { setStatus(v); table.setCurrentPage(1); } },
  ];

  const resume = async (token: string) => {
    if (!resuming) return;
    try {
      await trainingFollowUpApi.resume(resuming.id, reason.trim(), token);
      showToast({ type: "success", title: "Work resumed", message: resuming.fullName });
      setSigning(false);
      setResuming(undefined);
    } catch (e) {
      showToast({ type: "error", title: "The action was not done", message: trainingError(e) });
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">A person who does not pass an assessment is retrained. Until the retraining is passed, the work that depends on the training is suspended; this is only a flag and a notice, no other function is blocked.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ReportListToolbar
        searchPlaceholder="Search employee, training or training number…"
        search={table.searchQuery}
        onSearch={(v) => { table.setSearchQuery(v); table.setCurrentPage(1); }}
        filters={filters} dates={[]} hasActiveFilters={Boolean(status !== "OPEN" || table.searchQuery)}
        onClear={() => { setStatus("OPEN"); table.setSearchQuery(""); table.setCurrentPage(1); }}
        customControl={control} framed={false} flush
      >
        <DataTable
          rows={table.items} getRowKey={(s) => s.id} isLoading={table.isLoading} loadingContent={<SectionLoading text="Loading…" />}
          columns={columns} columnLayout={layout} action={rowMenu.action}
          emptyState={<TableEmptyState title="No suspended work" description="Nobody of the department is waiting for retraining." />}
          pagination={table.totalItems > 0 ? <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} /> : undefined}
        />
      </ReportListToolbar>
      {rowMenu.node}
      <FormModal
        isOpen={!!resuming && !signing} onClose={() => setResuming(undefined)} title="Resume the Work" confirmText="Continue" size="md" confirmDisabled={!reason.trim()}
        description={resuming ? `${resuming.fullName} did not pass ${resuming.trainingNumber}. Resume the work only when the person is able to do it safely; the decision is signed and stays in the Audit Trail.` : undefined}
        onConfirm={() => setSigning(true)}
      >
        <FormField label="Reason" required><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
      </FormModal>
      <ESignatureModal
        isOpen={signing} onClose={() => setSigning(false)} onConfirm={async (d: { signatureToken: string }) => resume(d.signatureToken)}
        actionTitle="Resume the Work After a Failed Assessment" changes={statusChange("Work suspended", "Work resumed", "Work")}
        meaningDisplayName="Work Resumed After Failed Assessment" meaningCode="TRAINING_WORK_RESUMED"
        targetDetails={{ code: resuming?.trainingNumber ?? "", title: resuming?.fullName ?? "", revision: "" }}
      />
    </div>
  );
}
