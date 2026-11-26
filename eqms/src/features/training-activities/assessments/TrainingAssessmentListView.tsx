import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconChecks, IconEye, IconInfoCircle, IconPencilMinus, IconPlus, IconSend, IconTrash } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { resettingDates, useDateRange } from "../shared/useListFilters";
import { trainingAssessmentsApi, trainingError, type TrainingAssessmentDetail, type TrainingAssessmentSummary } from "@/services/api/trainingActivities";
import { localized, when, trainingBreadcrumbs, TRAINING_PAGES } from "../shared/trainingLabels";
import { useTrainingRowMenu } from "../shared/useTrainingRowMenu";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { useToast } from "@/components/ui/toast/Toast";
import { Textarea } from "../shared/TrainingFields";
import { AssessmentPreviewModal } from "./AssessmentPreviewModal";
import { tr } from "@/i18n";
import { statusColors } from "@/components/ui/badge/statusColors";
import type { BadgeColor } from "@/components/ui/badge/Badge";

export const ASSESSMENT_STATUS_LABEL: Record<string, string> = localized({ DRAFT: "Draft", PENDING_APPROVAL: "Pending Approval", EFFECTIVE: "Effective", OBSOLETED: "Obsoleted" });
export const ASSESSMENT_STATUS_COLOR = statusColors("DRAFT", "PENDING_APPROVAL", "EFFECTIVE", "OBSOLETED") as Record<string, BadgeColor>;
/** The two kinds, named as the form APD.0009 does: the test of questions is the default of the SOP. */
export const ASSESSMENT_KIND_LABEL: Record<string, string> = localized({ QUESTIONS: "Essay or multiple-choice test (APD.0009) (SOP default)", CHECKLIST: "Checklist test (APD.0009)" });

/** The library of Training Assessments (APD.0009): the tests and checklists a training activity can use. */
export function TrainingAssessmentListView() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canDesign = hasPermission("training.assessment.manage") || hasPermission("training.assessment.manage_all");
  const [status, setStatus] = usePersistedState("training.assessments.status", "");
  const [kind, setKind] = usePersistedState("training.assessments.kind", "");
  const [updatedBy, setUpdatedBy] = usePersistedState("training.assessments.updatedBy", "");
  const changedRange = useDateRange("training.assessments.changed", "Last Changed Date Range");
  // The people who changed an assessment, for the filter: every one, listed by the server.
  const [people, setPeople] = useState<{ label: string; value: string }[]>([]);
  useEffect(() => {
    trainingAssessmentsApi.editors().then((names) => setPeople(names.map((v) => ({ label: v, value: v })))).catch(() => setPeople([]));
  }, []);
  const [error, setError] = useState("");
  const { showToast } = useToast();
  // Delete Draft, as on the detail page: a reason is asked, the server deletes the draft and the reason stays in the Audit Trail.
  const [deleting, setDeleting] = useState<TrainingAssessmentSummary | null>(null);
  const [reason, setReason] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  // Preview, as on the detail page: the paper is drawn by the document server from the saved assessment and shown in the same window.
  const [preview, setPreview] = useState<{ detail: TrainingAssessmentDetail; url: string }>();
  const [submitting, setSubmitting] = useState<TrainingAssessmentSummary | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      trainingAssessmentsApi.list(params).catch((e) => {
        setError(trainingError(e));
        throw e;
      }),
    [],
  );
  const extra = useMemo(
    () => ({ status: status || undefined, kind: kind || undefined, updatedBy: updatedBy || undefined, ...changedRange.params("updatedFrom", "updatedTo") }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, kind, updatedBy, changedRange.from, changedRange.to],
  );
  const table = useServerTable<TrainingAssessmentSummary>({
    persistKey: "training.assessments",
    liveTypes: ["TRAINING"],
    fetcher,
    defaultSortBy: "updatedAt",
    defaultSortDirection: "desc",
    extraParams: extra,
    initialItemsPerPage: 10,
  });
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });

  const open = (id: string) => navigate(`/training-management/assessments/${id}`);
  const paperOf = async (d: TrainingAssessmentDetail, paper: "test" | "key" | "both") => {
    const blob = await trainingAssessmentsApi.preview({
      name: d.name,
      kind: d.kind,
      durationMinutes: d.durationMinutes ?? undefined,
      essayNumbering: d.essayNumbering,
      items: d.items.map((i) => ({
        kind: i.kind,
        prompt: i.prompt,
        options: i.options.map((o) => ({ text: o.text })),
        correct: i.correct,
        points: i.points,
        modelAnswer: i.modelAnswer ?? undefined,
        optionLayout: i.optionLayout,
        answerLines: i.answerLines ?? undefined,
        image: i.image ?? undefined,
      })),
      key: paper === "key",
      sideBySide: paper === "both" || undefined,
      code: d.code,
      revisionNumber: d.revisionNumber,
    });
    return URL.createObjectURL(blob);
  };
  const openPreview = async (row: TrainingAssessmentSummary) => {
    try {
      const d = await trainingAssessmentsApi.get(row.id);
      setPreview({ detail: d, url: await paperOf(d, "test") });
    } catch (e) {
      showToast({ type: "error", title: tr("The preview could not be made"), message: trainingError(e) });
    }
  };
  const confirmSubmit = async () => {
    if (!submitting) return;
    setSubmitBusy(true);
    try {
      const next = await trainingAssessmentsApi.submit(submitting.id);
      showToast({ type: "success", title: "Sent for approval", message: `${next.code} ${next.revisionNumber}` });
      setSubmitting(null);
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: tr("The action was not done"), message: trainingError(e) });
    } finally {
      setSubmitBusy(false);
    }
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await trainingAssessmentsApi.remove(deleting.id, reason.trim());
      showToast({ type: "success", title: tr("Draft deleted"), message: deleting.code });
      setDeleting(null);
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: tr("The draft was not deleted"), message: trainingError(e) });
    } finally {
      setDeleteBusy(false);
    }
  };
  const columns: DataTableColumn<TrainingAssessmentSummary>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "code", header: tr("Assessment Number"), sort: sorted("code"), cell: (r) => <button type="button" className="font-medium text-emerald-700 hover:underline" onClick={() => open(r.id)}>{r.code}</button> },
    { id: "revision", header: tr("Assessment Revision"), sort: sorted("revision"), cell: (r) => r.revisionNumber },
    { id: "name", header: tr("Assessment Name"), sort: sorted("name"), cell: (r) => <div className="max-w-80 whitespace-normal">{r.name}</div> },
    { id: "kind", header: "Type", sort: sorted("kind"), cell: (r) => <div className="max-w-64 whitespace-normal">{ASSESSMENT_KIND_LABEL[r.kind] ?? r.kind}</div> },
    { id: "items", header: "Items", sort: sorted("itemCount"), cell: (r) => r.itemCount },
    { id: "max", header: tr("Total Score"), sort: sorted("maxScore"), cell: (r) => (r.kind === "CHECKLIST" || r.maxScore == null ? "—" : r.maxScore) },
    { id: "status", header: "Status", sort: sorted("status"), cell: (r) => <Badge color={ASSESSMENT_STATUS_COLOR[r.status]}>{ASSESSMENT_STATUS_LABEL[r.status] ?? r.status}</Badge> },
    { id: "updatedBy", header: tr("Last Changed By"), sort: sorted("updatedBy"), cell: (r) => r.updatedByName },
    { id: "updatedAt", header: tr("Last Changed On"), sort: sorted("updatedAt"), cell: (r) => when(r.updatedAt) },
  ];
  const rowMenu = useTrainingRowMenu(table.items, (r) => [
    ...(r.actions?.view ? [{ label: tr("View Details"), icon: <IconInfoCircle className="h-4 w-4" />, onClick: () => open(r.id) }] : []),
    ...(r.actions?.view ? [{ label: tr("Preview"), icon: <IconEye className="h-4 w-4" />, onClick: () => void openPreview(r) }] : []),
    ...(r.actions?.continueDraft ? [{ label: tr("Edit Assessment"), icon: <IconPencilMinus className="h-4 w-4" />, onClick: () => navigate(`/training-management/assessments/${r.id}/edit`) }] : []),
    ...(r.actions?.review ? [{ label: tr("Review and Approve"), icon: <IconChecks className="h-4 w-4" />, onClick: () => open(r.id) }] : []),
    ...(r.actions?.submit ? [{ label: tr("Submit for Approval"), icon: <IconSend className="h-4 w-4" />, onClick: () => setSubmitting(r) }] : []),
    ...(r.actions?.delete ? [{ label: tr("Delete Draft"), icon: <IconTrash className="h-4 w-4" />, onClick: () => { setReason(""); setDeleting(r); } }] : []),
  ]);
  const { layout, control } = useCustomColumnLayout("training.assessments", columns, rowMenu.action);
  const filters: ReportSelectFilter[] = [
    {
      id: "status",
      label: "Status",
      value: status,
      options: [{ label: "All", value: "" }, ...Object.entries(ASSESSMENT_STATUS_LABEL).map(([value, label]) => ({ label, value }))],
      onChange: (v) => { setStatus(v); table.setCurrentPage(1); },
    },
    {
      id: "kind",
      label: "Type",
      value: kind,
      options: [{ label: "All", value: "" }, ...Object.entries(ASSESSMENT_KIND_LABEL).map(([value, label]) => ({ label, value }))],
      onChange: (v) => { setKind(v); table.setCurrentPage(1); },
    },
    { id: "updatedBy", label: tr("Last Changed By"), value: updatedBy, options: [{ label: "Anyone", value: "" }, ...people], onChange: (v) => { setUpdatedBy(v); table.setCurrentPage(1); } },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader
        title={TRAINING_PAGES.assessments.title}
        breadcrumbItems={trainingBreadcrumbs(navigate, "assessments")}
        actions={canDesign ? <Button size="sm" onClick={() => navigate("/training-management/assessments/new")}><IconPlus className="mr-2 h-4 w-4" />{tr("New Assessment")}</Button> : undefined}
      />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ReportListToolbar
        searchPlaceholder={tr("Search assessment number, revision or name…")}
        search={table.searchQuery}
        onSearch={(v) => { table.setSearchQuery(v); table.setCurrentPage(1); }}
        filters={filters}
        dates={resettingDates([changedRange.filter], () => table.setCurrentPage(1))}
        hasActiveFilters={Boolean(status || kind || updatedBy || changedRange.isSet || table.searchQuery)}
        onClear={() => { setStatus(""); setKind(""); setUpdatedBy(""); changedRange.clear(); table.setCurrentPage(1); }}
        customControl={control}
      >
        <DataTable
          rows={table.items}
          getRowKey={(r) => r.id}
          isLoading={table.isLoading}

          columns={columns}
          columnLayout={layout}
          action={rowMenu.action}
          emptyState={<TableEmptyState title={tr("No Training Assessments")} description={tr("The tests and checklists that training activities use appear here.")} />}
          pagination={
            table.totalItems > 0 ? (
              <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} />
            ) : undefined
          }
        />
      </ReportListToolbar>
      {rowMenu.node}
      {preview && (
        <AssessmentPreviewModal
          title={`Preview: ${preview.detail.name || "Training Assessment"}`}
          description={preview.detail.kind === "CHECKLIST"
            ? tr("The checklist in the enabled form APD.0009, as an activity gets it; the answer key is for the trainer only and is never handed out.")
            : tr("The test in the enabled form APD.0009, as an activity gets it; the answer key is for the trainer only and is never handed out. The training topic is a sample line here; the name of each trainee, the Training Number and the date are written when it is printed for a session.")}
          firstUrl={preview.url}
          load={(paper) => paperOf(preview.detail, paper)}
          onClose={() => setPreview(undefined)}
        />
      )}
      <AlertModal
        isOpen={!!submitting}
        onClose={() => setSubmitting(null)}
        onConfirm={() => void confirmSubmit()}
        type="confirm"
        title={tr("Submit for Approval")}
        description={submitting ? `${submitting.code} ${submitting.revisionNumber}: ${submitting.name}` : ""}
        confirmText={tr("Submit for Approval")}
        cancelText={tr("Cancel")}
        showCancel
        isLoading={submitBusy}
      />
      <FormModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        title={tr("Delete Draft")}
        description={tr("Only a draft can be deleted. The reason stays in the Audit Trail.")}
        confirmText="Delete"
        confirmVariant="destructive"
        isLoading={deleteBusy}
        confirmDisabled={!reason.trim()}
        size="md"
      >
        <FormField label={tr("Reason")} required>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </FormModal>
    </div>
  );
}
