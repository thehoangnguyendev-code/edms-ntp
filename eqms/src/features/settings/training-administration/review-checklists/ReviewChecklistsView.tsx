import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconPencilMinus, IconPlus } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Select } from "@/components/ui/select/Select";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { useToast } from "@/components/ui/toast/Toast";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { statusColor } from "@/components/ui/badge/statusColors";
import { trainingReviewTemplatesApi, trainingError, type TrainingReviewTemplate } from "@/services/api/trainingActivities";
import { Input, Textarea } from "@/features/training-activities/shared/TrainingFields";
import { useTrainingRowMenu } from "@/features/training-activities/shared/useTrainingRowMenu";
import { when } from "@/features/training-activities/shared/trainingLabels";
import { trainingAdministrationBase } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { REVIEW_KIND_LABEL } from "@/features/training-activities/personnel-reviews/personnelReviewLabels";
import { tr } from "@/i18n";

const CHECK_LABEL: Record<string, string> = {
  MANUAL: "A person marks it",
  SPECIMEN: "A specimen signature record exists",
  JOB_ASSIGNMENT: "A job assignment is in force after the event",
  HANDOVER: "A signed export of the record is approved",
};

type Draft = { id?: string; version?: number; kind: string; title: string; titleVi: string; hint: string; checkType: string; active: boolean; sortOrder: string; locked: boolean; reason: string };
const blank: Draft = { kind: "", title: "", titleVi: "", hint: "", checkType: "MANUAL", active: true, sortOrder: "100", locked: false, reason: "" };

/**
 * The checklist template of the training reviews: the items that are not training lines of the matrix. The items the SOP names are locked. A change applies to the reviews opened after
 * it, and to an open review when it is opened; a review that is closed keeps what it was closed with.
 */
export function ReviewChecklistsView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [kind, setKind] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Draft>();
  const [saving, setSaving] = useState(false);

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) => trainingReviewTemplatesApi.list(params).catch((e) => { setError(trainingError(e)); throw e; }),
    [],
  );
  const extra = useMemo(() => ({ kind: kind || undefined }), [kind]);
  const table = useServerTable<TrainingReviewTemplate>({ persistKey: "training.reviewTemplates", fetcher, defaultSortBy: "kind", extraParams: extra, initialItemsPerPage: 10, syncToUrl: false });
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });

  const edit = (t: TrainingReviewTemplate) => { setError(""); setDraft({ id: t.id, version: t.version, kind: t.kind, title: t.title, titleVi: t.titleVi ?? "", hint: t.hint ?? "", checkType: t.checkType, active: t.active, sortOrder: String(t.sortOrder), locked: t.locked, reason: "" }); };
  const rowMenu = useTrainingRowMenu(table.items, (t) => [{ label: "Edit Item", icon: <IconPencilMinus className="h-4 w-4" />, onClick: () => edit(t) }]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const body = { kind: draft.kind, title: draft.title, titleVi: draft.titleVi, hint: draft.hint, checkType: draft.checkType, active: draft.active, sortOrder: Number(draft.sortOrder) || 100, version: draft.version, reason: draft.reason.trim() || undefined };
      if (draft.id) await trainingReviewTemplatesApi.update(draft.id, body);
      else await trainingReviewTemplatesApi.create(body);
      showToast({ type: "success", title: tr("The checklist item was saved"), message: draft.title });
      setDraft(undefined);
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: tr("The checklist item was not saved"), message: trainingError(e) });
    } finally {
      setSaving(false);
    }
  };

  const columns: DataTableColumn<TrainingReviewTemplate>[] = [
    { id: "no", header: "No.", locked: true, cell: (_t, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "kind", header: tr("Review Type"), sort: sorted("kind"), cell: (t) => REVIEW_KIND_LABEL[t.kind] ?? t.kind },
    { id: "title", header: tr("Item"), sort: sorted("title"), cell: (t) => <div className="max-w-80 whitespace-normal"><div className="font-medium text-slate-900">{t.title}</div>{t.titleVi && <div className="text-xs text-slate-500">{t.titleVi}</div>}</div> },
    { id: "check", header: tr("Done when"), sort: sorted("checkType"), cell: (t) => tr(CHECK_LABEL[t.checkType] ?? t.checkType) },
    { id: "locked", header: tr("From the SOP"), cell: (t) => (t.locked ? <Badge color="blue" size="sm">{tr("Locked")}</Badge> : "—") },
    { id: "active", header: "Status", cell: (t) => <Badge color={statusColor(t.active ? "ACTIVE" : "INACTIVE")}>{t.active ? tr("Active") : tr("Inactive")}</Badge> },
    { id: "order", header: tr("Order"), sort: sorted("sortOrder"), cell: (t) => t.sortOrder },
    { id: "updated", header: tr("Last Changed"), sort: sorted("updatedAt"), cell: (t) => `${when(t.updatedAt)}${t.updatedByName ? ` · ${t.updatedByName}` : ""}` },
  ];
  const { layout, control } = useCustomColumnLayout("training.review.templates", columns, rowMenu.action);
  const filters: ReportSelectFilter[] = [
    { id: "kind", label: tr("Review Type"), value: kind, options: [{ label: "All", value: "" }, ...Object.entries(REVIEW_KIND_LABEL).map(([value, label]) => ({ label, value }))], onChange: (v) => { setKind(v); table.setCurrentPage(1); } },
  ];

  return (
    <div className="flex h-full flex-col gap-4 md:gap-6">
      <PageHeader title={tr("Review Checklists")} breadcrumbItems={[...trainingAdministrationBase(navigate), { label: tr("Review Checklists"), isActive: true }]}
        actions={<Button size="sm" onClick={() => { setError(""); setDraft({ ...blank }); }}><IconPlus className="mr-2 h-4 w-4" />{tr("New Item")}</Button>} />
      <WarningBanner variant="info" description={tr("The training lines of a review come from the training matrix. The items below are the others: signatures, job assignment, hand over of records and the like. The items the SOP names are locked. A change applies to the reviews opened after it, and to an open review when it is opened.")} />
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <ReportListToolbar searchPlaceholder={tr("Search item…")} search={table.searchQuery} onSearch={(v) => { table.setSearchQuery(v); table.setCurrentPage(1); }} filters={filters}
        hasActiveFilters={Boolean(kind || table.searchQuery)} onClear={() => { setKind(""); table.setSearchQuery(""); table.setCurrentPage(1); }} customControl={control}>
        <DataTable rows={table.items} getRowKey={(t) => t.id} isLoading={table.isLoading} columns={columns} columnLayout={layout} action={rowMenu.action}
          emptyState={<TableEmptyState title={tr("No checklist items")} description={tr("Try changing your search or filter.")} />}
          pagination={table.totalItems > 0 ? <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} /> : undefined} />
      </ReportListToolbar>
      {rowMenu.node}
      <FormModal isOpen={!!draft} onClose={() => setDraft(undefined)} onConfirm={() => void save()} title={draft?.id ? tr("Edit Checklist Item") : tr("New Checklist Item")} confirmText="Save" isLoading={saving} size="lg"
        confirmDisabled={!draft || !draft.kind || !draft.title.trim() || (Boolean(draft.id) && !draft.reason.trim())}>
        {draft && (
          <div className="grid gap-4">
            <FormField label={tr("Review Type")} required><Select value={draft.kind} disabled={Boolean(draft.id)} enableSearch={false} onChange={(v) => setDraft({ ...draft, kind: v })} options={Object.entries(REVIEW_KIND_LABEL).map(([value, label]) => ({ label, value }))} /></FormField>
            <FormField label={tr("Item")} required><Input value={draft.title} maxLength={500} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></FormField>
            <FormField label={tr("Item (Vietnamese)")}><Input value={draft.titleVi} maxLength={500} onChange={(e) => setDraft({ ...draft, titleVi: e.target.value })} /></FormField>
            <FormField label={tr("Hint")}><Textarea rows={2} maxLength={1000} value={draft.hint} onChange={(e) => setDraft({ ...draft, hint: e.target.value })} /></FormField>
            <FormField label={tr("Done when")} hint={draft.locked ? tr("An item from the SOP keeps its check.") : tr("A line a record answers cannot be marked done by hand.")}>
              <Select value={draft.checkType} disabled={draft.locked} enableSearch={false} onChange={(v) => setDraft({ ...draft, checkType: v })} options={Object.entries(CHECK_LABEL).map(([value, label]) => ({ label: tr(label), value }))} />
            </FormField>
            <FormField label={tr("Order")}><Input type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} /></FormField>
            {draft.id && <Checkbox id="review-template-active" label={tr("Active")} checked={draft.active} disabled={draft.locked} onChange={(on) => setDraft({ ...draft, active: on })} />}
            {draft.id && <FormField label={tr("Reason")} required hint={tr("Written to the Audit Trail with the change.")}><Textarea rows={2} maxLength={1000} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} /></FormField>}
          </div>
        )}
      </FormModal>
    </div>
  );
}
