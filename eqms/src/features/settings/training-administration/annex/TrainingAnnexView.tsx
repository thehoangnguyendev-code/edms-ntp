import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconInfoCircle, IconPencilMinus, IconToggleLeft, IconToggleRight } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { trainingAnnex } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { Badge } from "@/components/ui/badge/Badge";
import { flagColor } from "@/utils/status";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Select } from "@/components/ui/select/Select";
import { useToast } from "@/components/ui/toast/Toast";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { ROUTES } from "@/app/routes.constants";
import { trainingAnnexApi, trainingError, trainingFormTemplatesApi, type TrainingAnnexRow, type TrainingFormTemplate } from "@/services/api/trainingActivities";
import { Textarea } from "@/features/training-activities/shared/TrainingFields";
import { useTrainingRowMenu } from "@/features/training-activities/shared/useTrainingRowMenu";
import { day } from "@/features/training-activities/shared/trainingLabels";
import { tr } from "@/i18n";

const STATUS_OPTIONS = [{ label: "All", value: "" }, { label: "Active", value: "ACTIVE" }, { label: "Inactive", value: "INACTIVE" }];

/** What a template of a form is written as: with tokens (checked), an earlier template (found by printed words), or a form that has no tokens. */
export function TokenModeBadge({ mode, checked }: { mode?: TrainingAnnexRow["tokenMode"]; checked: boolean }) {
  if (!mode) return <span className="text-slate-500">—</span>;
  if (mode === "TOKENS") return <Badge color="emerald">{tr("Tokens")}</Badge>;
  if (mode === "LEGACY") return <Badge color="amber">{tr("Legacy, tokens not checked")}</Badge>;
  return <Badge color="slate">{checked ? tr("Not applicable") : "Built by the assessment builder"}</Badge>;
}

/**
 * The Training Annex: the forms of Training (the APD annexes SOP.0003 uses). Training Administration uploads the Word file of each, written with tokens, and enables it with an electronic
 * signature; the system fixes what each form holds, when it is filled and in what order it is signed. The list is searched, filtered, sorted and paged by the server, and what a person
 * may do with each form (view, edit, enable, disable) is decided by the server and shown in the menu of the row.
 */
export function TrainingAnnexView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [status, setStatus] = useState("");
  const [enabling, setEnabling] = useState<{ row: TrainingAnnexRow; versions: TrainingFormTemplate[]; chosen: string; sign: boolean }>();
  const [disabling, setDisabling] = useState<{ row: TrainingAnnexRow; template?: TrainingFormTemplate; reason: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) => trainingAnnexApi.page(params).catch((e) => { setError(trainingError(e)); throw e; }),
    [],
  );
  const extra = useMemo(() => ({ status: status || undefined }), [status]);
  const table = useServerTable<TrainingAnnexRow>({ persistKey: "training.annex", fetcher, defaultSortBy: "code", extraParams: extra, initialItemsPerPage: 10, syncToUrl: false });
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });
  const reset = () => table.setCurrentPage(1);
  const open = (r: TrainingAnnexRow) => navigate(ROUTES.SETTINGS.TRAINING_ADMINISTRATION.ANNEX_DETAIL(r.code));

  // the versions of a form, read when a menu item that needs them is chosen
  const withVersions = async (r: TrainingAnnexRow, then: (versions: TrainingFormTemplate[]) => void) => {
    try {
      then((await trainingAnnexApi.detail(r.code)).templates);
    } catch (e) {
      showToast({ type: "error", title: tr("The versions were not read"), message: trainingError(e) });
    }
  };
  const rowMenu = useTrainingRowMenu(table.items, (r) => [
    ...(r.actions.view ? [{ label: tr("View Details"), icon: <IconInfoCircle className="h-4 w-4" />, onClick: () => open(r) }] : []),
    ...(r.actions.edit ? [{ label: tr("Edit Training Annex"), icon: <IconPencilMinus className="h-4 w-4" />, onClick: () => navigate(ROUTES.SETTINGS.TRAINING_ADMINISTRATION.ANNEX_EDIT(r.code)) }] : []),
    ...(r.actions.enable ? [{ label: r.status === "ACTIVE" ? "Enable Another Version" : "Enable Training Annex", icon: <IconToggleRight className="h-4 w-4" />, onClick: () => void withVersions(r, (all) => {
      const versions = all.filter((t) => t.status === "DISABLED" && !(t.tokenMode === "TOKENS" && t.checkProblems));
      setEnabling({ row: r, versions, chosen: versions[0]?.id ?? "", sign: false });
    }) }] : []),
    ...(r.actions.disable ? [{ label: tr("Disable Training Annex"), icon: <IconToggleLeft className="h-4 w-4" />, onClick: () => void withVersions(r, (all) => setDisabling({ row: r, template: all.find((t) => t.status === "ENABLED"), reason: "" })) }] : []),
  ]);
  const chosenVersion = enabling?.versions.find((t) => t.id === enabling.chosen);
  const doDisable = async () => {
    if (!disabling?.template) return;
    setBusy(true);
    try {
      await trainingFormTemplatesApi.disable(disabling.template.id, disabling.reason.trim());
      showToast({ type: "success", title: tr("Training Annex disabled"), message: `${disabling.row.code} ${disabling.template.versionLabel}` });
      setDisabling(undefined);
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: tr("The form was not disabled"), message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };
  const doEnable = async (token: string, reason: string) => {
    if (!enabling || !chosenVersion) return;
    try {
      await trainingFormTemplatesApi.enable(chosenVersion.id, token, reason);
      showToast({ type: "success", title: tr("Training Annex enabled"), message: `${enabling.row.code} ${chosenVersion.versionLabel}` });
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: tr("The form was not enabled"), message: trainingError(e) });
    } finally {
      setEnabling(undefined);
    }
  };
  const columns: DataTableColumn<TrainingAnnexRow>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "code", header: tr("Document Number"), sort: sorted("code"), cell: (r) => <button type="button" className="font-medium text-emerald-700 hover:underline" onClick={() => open(r)}>{r.code}</button> },
    { id: "title", header: tr("Document Name"), sort: sorted("title"), cell: (r) => <div className="max-w-80 whitespace-normal">{r.title}</div> },
    { id: "status", header: "Status", sort: sorted("status"), cell: (r) => <Badge color={flagColor(r.status === "ACTIVE")}>{r.status === "ACTIVE" ? "Active" : "Inactive"}</Badge> },
    { id: "enabledVersion", header: tr("Enabled Revision"), sort: sorted("enabledVersion"), cell: (r) => r.enabledVersion ?? "—" },
    { id: "tokenMode", header: tr("Template Written As"), sort: sorted("tokenMode"), cell: (r) => <TokenModeBadge mode={r.tokenMode} checked={r.tokenChecked} /> },
    { id: "enabledAt", header: tr("Enabled On"), sort: sorted("enabledAt"), cell: (r) => (r.enabledAt ? day(r.enabledAt) : "—") },
    { id: "templateCount", header: tr("Template Versions"), cell: (r) => r.templateCount },
  ];
  const { layout, control } = useCustomColumnLayout("training.annex", columns, rowMenu.action);
  const filters: ReportSelectFilter[] = [{ id: "status", label: "Status", value: status, options: STATUS_OPTIONS, onChange: (v) => { setStatus(v); reset(); } }];

  return (
    <div className="flex h-full w-full min-w-0 flex-1 flex-col gap-4 md:gap-6">
      <PageHeader title={tr("Training Annex")} breadcrumbItems={trainingAnnex(navigate)} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ReportListToolbar
        searchPlaceholder={tr("Search document number or name…")}
        search={table.searchQuery}
        onSearch={(v) => { table.setSearchQuery(v); reset(); }}
        filters={filters}
        hasActiveFilters={Boolean(status || table.searchQuery)}
        onClear={() => { setStatus(""); table.setSearchQuery(""); reset(); }}
        customControl={control}
      >
        <DataTable
          rows={table.items} getRowKey={(r) => r.code} isLoading={table.isLoading}
          columns={columns} columnLayout={layout} action={rowMenu.action}
          emptyState={<TableEmptyState title={tr("No form")} description={tr("No form of the Training Annex matches the filters.")} />}
          pagination={table.totalItems > 0 ? <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} /> : undefined}
        />
      </ReportListToolbar>
      {rowMenu.node}

      <FormModal
        isOpen={!!enabling && !enabling.sign} onClose={() => setEnabling(undefined)} onConfirm={() => enabling && setEnabling({ ...enabling, sign: true })} title={`Enable ${enabling?.row.code ?? ""}`} confirmText="Continue" size="md" confirmDisabled={!chosenVersion}
        description={tr("The version you choose becomes the template of this form from now on, with your electronic signature. The version in force is disabled in the same step. A form that was already made keeps the template it was made with.")}
      >
        {enabling && (enabling.versions.length === 0 ? <p className="text-sm text-slate-600">{tr("No version can be enabled.")}</p> : (
          <FormField label={tr("Version")} required>
            <Select value={enabling.chosen} onChange={(v) => setEnabling({ ...enabling, chosen: String(v) })} aria-label={tr("Version to enable")}
              options={enabling.versions.map((t) => ({ value: t.id, label: `${t.versionLabel} · ${t.tokenMode === "TOKENS" ? "tokens agree" : t.tokenMode === "LEGACY" ? "legacy, tokens not checked" : "not applicable"}` }))} />
          </FormField>
        ))}
      </FormModal>
      <ESignatureModal
        isOpen={!!enabling?.sign}
        onClose={() => setEnabling(undefined)}
        onConfirm={async (d: { signatureToken: string; reason: string }) => doEnable(d.signatureToken, d.reason)}
        actionTitle="Enable the Template"
        meaningDisplayName="Form Template Enabled"
        meaningCode="TRAINING_FORM_TEMPLATE_ENABLED"
        targetDetails={{ code: enabling?.row.code ?? "", title: enabling?.row.title ?? "", revision: chosenVersion?.versionLabel ?? "" }}
      />
      <FormModal
        isOpen={!!disabling} onClose={() => setDisabling(undefined)} onConfirm={() => void doDisable()} title={`Disable ${disabling?.row.code ?? ""}`} confirmText="Disable" confirmVariant="destructive" size="md" isLoading={busy}
        confirmDisabled={!disabling?.template || !disabling.reason.trim()}
        description={tr("No form of this kind can be made until a version is enabled again. A form that was already made keeps its template. The reason stays in the Audit Trail.")}
      >
        {disabling && (
          <div className="grid gap-4">
              <p className="text-sm text-slate-700">{tr("Version in force:")} <span className="font-medium">{disabling.template?.versionLabel ?? "—"}</span></p>
            <FormField label={tr("Reason")} required><Textarea rows={3} value={disabling.reason} onChange={(e) => setDisabling({ ...disabling, reason: e.target.value })} /></FormField>
          </div>
        )}
      </FormModal>
    </div>
  );
}
