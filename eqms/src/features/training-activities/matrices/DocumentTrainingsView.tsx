import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconCircleOpenArrowRight, IconListCheck, IconPhotoSensor } from "@tabler/icons-react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { RadioGroup } from "@/components/ui/radio";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { dictionaryApi } from "@/services/api/dictionary";
import { trainingError, trainingFollowUpApi, type TrainingImpactContext, type TrainingImpactRow } from "@/services/api/trainingActivities";
import { Textarea } from "../shared/TrainingFields";
import { useTrainingRowMenu } from "../shared/useTrainingRowMenu";
import { STATUS_COLOR, STATUS_LABEL, statusChange, trainingBreadcrumbs, TRAINING_PAGES, when } from "../shared/trainingLabels";

const IMPACT_LABEL: Record<string, string> = { PENDING: "Pending Impact Assessment", MATRIX_UPDATE_PENDING: "Pending Matrix Update", DONE: "Done" };
const IMPACT_COLOR: Record<string, "red" | "amber" | "emerald"> = { PENDING: "red", MATRIX_UPDATE_PENDING: "amber", DONE: "emerald" };
const OUTCOME_LABEL: Record<string, string> = {
  MATRIX_UPDATE_NEEDED: "The matrix must be updated",
  MATRIX_ALREADY_COVERS: "The effective matrix already covers the document",
  NO_TRAINING_IMPACT: "No training impact",
};

/**
 * The documents that were issued or revised and need training, one line each, with what the department has done about the training matrix (SOP.0003 5.3.1: when a document is
 * issued, the department assesses the training impact, names the Job Roles to be trained and updates the matrix). The assessment is signed. "Pending Matrix Update" ends by
 * itself when an effective matrix of the department contains the document.
 */
export function DocumentTrainingsView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [status, setStatus] = usePersistedState("training.documentTrainings.status", "OPEN");
  const [departments, setDepartments] = useState<{ label: string; value: string }[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [activityStatus, setActivityStatus] = usePersistedState("training.documentTrainings.activityStatus", "");
  const [error, setError] = useState("");
  const [assessing, setAssessing] = useState<{ row: TrainingImpactRow; context: TrainingImpactContext }>();
  const [outcome, setOutcome] = useState("");
  const [positionIds, setPositionIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [signing, setSigning] = useState(false);

  useEffect(() => { dictionaryApi.getDepartments().then((l) => setDepartments(l.map((d) => ({ label: d.name, value: d.id })))).catch(() => setDepartments([])); }, []);

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) => trainingFollowUpApi.documentTrainings(params).catch((e) => { setError(trainingError(e)); throw e; }),
    [],
  );
  const extra = useMemo(() => ({ departmentId: departmentId || undefined, status: status || undefined, activityStatus: activityStatus || undefined }), [departmentId, status, activityStatus]);
  const table = useServerTable<TrainingImpactRow>({ persistKey: "training.documentTrainings", liveTypes: ["TRAINING"], fetcher, defaultSortBy: "impactStatus", extraParams: extra, initialItemsPerPage: 10, syncToUrl: false });
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });

  const open = async (row: TrainingImpactRow) => {
    try {
      const context = await trainingFollowUpApi.impactContext(row.id);
      setOutcome(""); setPositionIds([]); setReason("");
      setAssessing({ row, context });
    } catch (e) {
      showToast({ type: "error", title: "The assessment could not be opened", message: trainingError(e) });
    }
  };
  const rowMenu = useTrainingRowMenu(table.items, (r) => [
    ...(r.canAssess ? [{ label: r.impactStatus === "PENDING" ? "Assess Impact" : "Assess Again", icon: <IconCircleOpenArrowRight className="h-4 w-4" />, onClick: () => void open(r) }] : []),
    { label: "View Training Activity", icon: <IconPhotoSensor className="h-4 w-4" />, onClick: () => navigate(`/training-management/activities/${r.id}`) },
  ]);

  const columns: DataTableColumn<TrainingImpactRow>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "document", header: "Document", sort: sorted("documentNumber"), cell: (r) => <div className="max-w-80 whitespace-normal"><div className="font-medium text-slate-900">{r.documentNumber}</div><div className="text-xs text-slate-500">{r.documentName}</div></div> },
    { id: "revision", header: "Revision", sort: sorted("revisionNumber"), cell: (r) => r.revisionNumber ?? "—" },
    { id: "training", header: "Training Number", sort: sorted("trainingNumber"), cell: (r) => <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => navigate(`/training-management/activities/${r.id}`)}>{r.trainingNumber}</button> },
    { id: "activity", header: "Training Status", sort: sorted("activityStatus"), cell: (r) => <Badge color={STATUS_COLOR[r.activityStatus] ?? "slate"}>{STATUS_LABEL[r.activityStatus] ?? r.activityStatus}</Badge> },
    { id: "impact", header: "Impact on the Matrix", sort: sorted("impactStatus"), cell: (r) => <Badge color={IMPACT_COLOR[r.impactStatus]}>{IMPACT_LABEL[r.impactStatus]}</Badge> },
    { id: "outcome", header: "Assessment", cell: (r) => (r.outcome ? <div className="max-w-72 whitespace-normal">{OUTCOME_LABEL[r.outcome]}<div className="text-xs text-slate-500">{r.assessedByName} · {when(r.assessedAt)}</div></div> : "—") },
  ];
  const { layout, control } = useCustomColumnLayout("training.documentTrainings", columns, rowMenu.action);
  const filters: ReportSelectFilter[] = [
    { id: "department", label: "Department", value: departmentId, options: [{ label: "My department", value: "" }, ...departments], onChange: (v) => { setDepartmentId(v); table.setCurrentPage(1); } },
    { id: "activityStatus", label: "Training Status", value: activityStatus, options: [{ label: "All statuses", value: "" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ label, value }))], onChange: (v) => { setActivityStatus(v); table.setCurrentPage(1); } },
    { id: "status", label: "Impact", value: status, options: [{ label: "All", value: "" }, { label: "Not done yet", value: "OPEN" }, ...Object.entries(IMPACT_LABEL).map(([value, label]) => ({ label, value }))], onChange: (v) => { setStatus(v); table.setCurrentPage(1); } },
  ];

  const submit = async (token: string) => {
    if (!assessing) return;
    try {
      await trainingFollowUpApi.assess(assessing.row.id, { outcome, reason: reason.trim(), positionIds, signatureToken: token });
      showToast({ type: "success", title: "Impact assessed", message: assessing.row.documentNumber ?? "" });
      setSigning(false);
      setAssessing(undefined);
    } catch (e) {
      showToast({ type: "error", title: "The action was not done", message: trainingError(e) });
    }
  };
  const needsPositions = outcome === "MATRIX_UPDATE_NEEDED";
  const ready = !!outcome && !!reason.trim() && (!needsPositions || positionIds.length > 0) && (outcome !== "MATRIX_ALREADY_COVERS" || !!assessing?.context.inEffectiveMatrix);
  const ctx = assessing?.context;

  return (
    <div className="flex h-full w-full min-w-0 flex-1 flex-col gap-4 md:gap-6">
      <PageHeader title={TRAINING_PAGES.documentTrainings.title} breadcrumbItems={trainingBreadcrumbs(navigate, "documentTrainings")} />
      <p className="text-xs text-slate-500">When a document is issued or revised, the department assesses its effect on the training matrix, names the Job Roles that must be trained and updates the matrix (SOP.0003 5.3.1). Each assessment is signed.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ReportListToolbar
        searchPlaceholder="Search document or training number…"
        search={table.searchQuery}
        onSearch={(v) => { table.setSearchQuery(v); table.setCurrentPage(1); }}
        filters={filters} dates={[]} hasActiveFilters={Boolean(departmentId || activityStatus || status !== "OPEN" || table.searchQuery)}
        onClear={() => { setDepartmentId(""); setActivityStatus(""); setStatus("OPEN"); table.setSearchQuery(""); table.setCurrentPage(1); }}
        customControl={control}
      >
        <DataTable
          rows={table.items} getRowKey={(r) => r.id} isLoading={table.isLoading} loadingContent={<SectionLoading text="Loading…" />}
          columns={columns} columnLayout={layout} action={rowMenu.action}
          emptyState={<TableEmptyState title="Nothing waits for an assessment" description="Every new or revised document of the department has been assessed." />}
          pagination={table.totalItems > 0 ? <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} /> : undefined}
        />
      </ReportListToolbar>
      {rowMenu.node}
      <FormModal
        isOpen={!!assessing && !signing} onClose={() => setAssessing(undefined)} title={`Impact of ${ctx?.documentNumber ?? "the document"} on the Training Matrix`} confirmText="Continue" size="xl" confirmDisabled={!ready}
        description={ctx ? `${ctx.documentName ?? ""} · revision ${ctx.revisionNumber ?? "—"} · ${ctx.trainingNumber}` : undefined}
        onConfirm={() => setSigning(true)}
      >
        {ctx && (
          <div className="space-y-4 text-sm">
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
              {ctx.effectiveMatrix
                ? ctx.inEffectiveMatrix
                  ? `The effective matrix (version ${ctx.effectiveMatrix.versionNo}) already has this document, for: ${ctx.positionsInMatrix.length ? ctx.positionsInMatrix.join(", ") : "no Job Role"}.`
                  : `The effective matrix (version ${ctx.effectiveMatrix.versionNo}) does not have this document.`
                : "The department has no effective matrix yet."}
            </p>
            <RadioGroup label="Result of the assessment" required name="impact-outcome" value={outcome} onChange={(v) => setOutcome(String(v))}
              options={[
                { label: OUTCOME_LABEL.MATRIX_UPDATE_NEEDED, value: "MATRIX_UPDATE_NEEDED" },
                { label: OUTCOME_LABEL.MATRIX_ALREADY_COVERS, value: "MATRIX_ALREADY_COVERS", disabled: !ctx.inEffectiveMatrix },
                { label: OUTCOME_LABEL.NO_TRAINING_IMPACT, value: "NO_TRAINING_IMPACT" },
              ]} />
            {needsPositions && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-700 sm:text-sm">Job Roles that must be trained on the document <span className="text-red-500">*</span></p>
                <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-2 md:grid-cols-2">
                  {ctx.positions.length === 0 && <p className="p-2 text-slate-500">The department has no Job Role.</p>}
                  {ctx.positions.map((p) => (
                    <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 hover:bg-emerald-50/50">
                      <Checkbox checked={positionIds.includes(p.id)} onChange={(c) => setPositionIds(c ? [...positionIds, p.id] : positionIds.filter((x) => x !== p.id))} />
                      <span>{p.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500">The matrix itself is then updated on the Training Matrix screen. This line stays "Pending Matrix Update" until an effective matrix has the document.</p>
              </div>
            )}
            <FormField label="Reason" required><Textarea rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
          </div>
        )}
      </FormModal>
      <ESignatureModal
        isOpen={signing} onClose={() => setSigning(false)} onConfirm={async (d: { signatureToken: string }) => submit(d.signatureToken)}
        actionTitle="Assess the Impact of the Document on the Training Matrix" changes={statusChange("Not assessed", OUTCOME_LABEL[outcome] ?? "—", "Impact on the matrix")}
        meaningDisplayName="Training Impact Assessed" meaningCode="TRAINING_IMPACT_ASSESSED"
        targetDetails={{ code: ctx?.documentNumber ?? "", title: ctx?.documentName ?? "", revision: ctx?.revisionNumber ?? "" }}
      />
    </div>
  );
}
