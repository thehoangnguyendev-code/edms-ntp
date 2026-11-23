import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconCheck, IconChecks, IconInfoCircle, IconListDetails, IconPencil, IconPencilMinus, IconPlayerPlay, IconPlayerStop, IconPlus, IconToggleLeft, IconToggleRight } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { trainingAdministrationBase } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { useToast } from "@/components/ui/toast/Toast";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { usePermissions } from "@/hooks/usePermissions";
import { trainingError, trainingVendorsApi, type TrainingVendor } from "@/services/api/trainingActivities";
import { Input, Textarea } from "@/features/training-activities/shared/TrainingFields";
import { TrainingDateField } from "@/features/training-activities/shared/TrainingDateField";
import { useTrainingRowMenu } from "@/features/training-activities/shared/useTrainingRowMenu";
import { resettingDates, useDateRange } from "@/features/training-activities/shared/useListFilters";
import { day, statusChange } from "@/features/training-activities/shared/trainingLabels";
import { tr } from "@/i18n";

const STATUS_COLOR: Record<string, "emerald" | "amber" | "slate" | "blue"> = { DRAFT: "blue", ACTIVE: "emerald", EXPIRED: "amber", INACTIVE: "slate" };
const STATUS_OPTIONS = [{ label: "All", value: "" }, { label: "Draft", value: "DRAFT" }, { label: "Active", value: "ACTIVE" }, { label: tr("Approval ended"), value: "EXPIRED" }, { label: "Inactive", value: "INACTIVE" }];
const END_OPTIONS = [{ label: "All", value: "" }, { label: tr("No end date"), value: "true" }];

/**
 * The register of approved training vendors (SOP.0025): the units that train from outside the company. A vendor is written as a Draft, approved with an electronic signature of another person,
 * deactivated and activated again with a reason and a signature. An external training whose unit is not Active here, or whose approval has ended, gets a warning on its screen. The Audit
 * Trail is the one of the system. Everything is decided by the server:
 * the list is searched, filtered, sorted and paged there, and the state and the actions of each row come from it; this screen only asks and shows.
 */
export function TrainingVendorsView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("training.admin.manage");
  const [status, setStatus] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [withoutEnd, setWithoutEnd] = useState("");
  const [approvers, setApprovers] = useState<{ label: string; value: string }[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{ id?: string; name: string; reference: string; validUntil: string }>();
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState<{ vendor: TrainingVendor; kind: "deactivate" | "activate"; reason: string; validUntil: string }>();
  const [approving, setApproving] = useState<TrainingVendor>();
  const [details, setDetails] = useState<TrainingVendor>();
  const [signing, setSigning] = useState<"approve" | "deactivate" | "activate">();

  const approvedRange = useDateRange("training.vendors.approved", "Approved Date Range");
  const validRange = useDateRange("training.vendors.valid", "Valid Until Range");
  useEffect(() => { trainingVendorsApi.approvers().then(setApprovers).catch(() => setApprovers([])); }, []);

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) => trainingVendorsApi.list(params).catch((e) => { setError(trainingError(e)); throw e; }),
    [],
  );
  const extra = useMemo(() => ({
    status: status || undefined, approvedBy: approvedBy || undefined, withoutEnd: withoutEnd || undefined,
    ...approvedRange.params("approvedFrom", "approvedTo"), ...validRange.params("validFrom", "validTo"),
  }), [status, approvedBy, withoutEnd, approvedRange.from, approvedRange.to, validRange.from, validRange.to]);
  const table = useServerTable<TrainingVendor>({ persistKey: "training.vendors", fetcher, defaultSortBy: "name", extraParams: extra, initialItemsPerPage: 10, syncToUrl: false });
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });
  const reset = () => table.setCurrentPage(1);

  // The menu of the last column: the places a row leads to. Which of them a person has is the answer of the server (`actions`).
  const rowMenu = useTrainingRowMenu(table.items, (r) => [
    ...(r.actions.view ? [{ label: tr("View Details"), icon: <IconInfoCircle className="h-4 w-4" />, onClick: () => setDetails(r) }] : []),
    ...(r.actions.edit ? [{ label: tr("Edit Vendor"), icon: <IconPencilMinus className="h-4 w-4" />, onClick: () => setEditing({ id: r.id, name: r.name, reference: r.reference ?? "", validUntil: r.validUntil ?? "" }) }] : []),
    ...(r.actions.approve ? [{ label: tr("Complete Approval"), icon: <IconChecks className="h-4 w-4" />, onClick: () => { setApproving(r); setSigning("approve"); } }] : []),
    ...(r.actions.deactivate ? [{ label: tr("Deactivate Vendor"), icon: <IconToggleLeft className="h-4 w-4" />, onClick: () => setChanging({ vendor: r, kind: "deactivate", reason: "", validUntil: "" }) }] : []),
    ...(r.actions.activate ? [{ label: tr("Activate Vendor"), icon: <IconToggleRight className="h-4 w-4" />, onClick: () => setChanging({ vendor: r, kind: "activate", reason: "", validUntil: r.validUntil ?? "" }) }] : []),
  ]);

  const columns: DataTableColumn<TrainingVendor>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "name", header: tr("Training Vendor"), sort: sorted("name"), cell: (r) => <div className="max-w-80 whitespace-normal font-medium text-slate-900">{r.name}</div> },
    { id: "reference", header: tr("Approval Reference"), sort: sorted("reference"), cell: (r) => r.reference ?? "—" },
    { id: "validUntil", header: tr("Valid Until"), sort: sorted("validUntil"), cell: (r) => (r.validUntil ? day(r.validUntil) : "No end date") },
    { id: "status", header: "Status", sort: sorted("status"), cell: (r) => <Badge color={STATUS_COLOR[r.status]}>{r.statusLabel}</Badge> },
    { id: "approvedBy", header: tr("Approved By"), sort: sorted("approvedBy"), cell: (r) => r.approvedByName ?? "—" },
    { id: "approvedAt", header: tr("Approved Date"), sort: sorted("approvedAt"), cell: (r) => (r.approvedAt ? day(r.approvedAt) : "—") },
  ];
  const { layout, control } = useCustomColumnLayout("training.vendors", columns, rowMenu.action);
  const filters: ReportSelectFilter[] = [
    { id: "status", label: "Status", value: status, options: STATUS_OPTIONS, onChange: (v) => { setStatus(v); reset(); } },
    { id: "approvedBy", label: tr("Approved By"), value: approvedBy, options: [{ label: "All", value: "" }, ...approvers], onChange: (v) => { setApprovedBy(v); reset(); } },
    { id: "withoutEnd", label: tr("Valid Until"), value: withoutEnd, options: END_OPTIONS, onChange: (v) => { setWithoutEnd(v); reset(); } },
  ];

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const body = { name: editing.name.trim(), reference: editing.reference.trim() || undefined, validUntil: editing.validUntil || undefined };
      await (editing.id ? trainingVendorsApi.update(editing.id, body) : trainingVendorsApi.create(body));
      showToast({ type: "success", title: editing.id ? "Training vendor saved" : "Training vendor written as a draft", message: body.name });
      setEditing(undefined);
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: tr("The action was not done"), message: trainingError(e) });
    } finally {
      setSaving(false);
    }
  };
  /** The step that was signed: the server does it and answers; the list is read again. */
  const sign = async (token: string) => {
    try {
      if (signing === "approve" && approving) await trainingVendorsApi.approve(approving.id, token);
      else if (signing === "deactivate" && changing) await trainingVendorsApi.deactivate(changing.vendor.id, changing.reason.trim(), token);
      else if (signing === "activate" && changing) await trainingVendorsApi.activate(changing.vendor.id, changing.reason.trim(), token, changing.validUntil || undefined);
      showToast({ type: "success", title: signing === "approve" ? "Training vendor approved" : signing === "activate" ? "Training vendor activated" : "Training vendor deactivated", message: (approving ?? changing?.vendor)?.name ?? "" });
      setApproving(undefined);
      setChanging(undefined);
      setSigning(undefined);
      table.reload();
    } catch (e) {
      setSigning(undefined);
      showToast({ type: "error", title: tr("The action was not done"), message: trainingError(e) });
    }
  };
  const target = approving ?? changing?.vendor;
  const signingCopy = {
    approve: { title: tr("Approve the Training Vendor"), code: "TRAINING_PROVIDER_APPROVED", name: "Training Vendor Approved", change: statusChange("Draft", "Active") },
    deactivate: { title: tr("Deactivate the Training Vendor"), code: "TRAINING_PROVIDER_DEACTIVATED", name: "Training Vendor Deactivated", change: statusChange("Active", "Inactive") },
    activate: { title: tr("Activate the Training Vendor"), code: "TRAINING_VENDOR_ACTIVATED", name: "Training Vendor Activated", change: statusChange("Inactive", "Active") },
  };
  const copy = signing ? signingCopy[signing] : undefined;

  return (
    <div className="flex h-full w-full min-w-0 flex-1 flex-col gap-4 md:gap-6">
      <PageHeader
        title={tr("Training Vendors")}
        breadcrumbItems={[...trainingAdministrationBase(navigate), { label: tr("Training Vendors"), isActive: true }]}
        actions={canManage ? <Button size="sm" onClick={() => setEditing({ name: "", reference: "", validUntil: "" })} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"><IconPlus className="h-4 w-4" />{tr("Add Vendor")}</Button> : undefined}
      />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ReportListToolbar
        searchPlaceholder={tr("Search vendor or approval reference…")}
        search={table.searchQuery}
        onSearch={(v) => { table.setSearchQuery(v); reset(); }}
        filters={filters}
        dates={resettingDates([approvedRange.filter, validRange.filter], reset)}
        hasActiveFilters={Boolean(status || approvedBy || withoutEnd || approvedRange.isSet || validRange.isSet || table.searchQuery)}
        onClear={() => { setStatus(""); setApprovedBy(""); setWithoutEnd(""); approvedRange.clear(); validRange.clear(); table.setSearchQuery(""); reset(); }}
        customControl={control}
      >
        <DataTable
          rows={table.items} getRowKey={(r) => r.id} isLoading={table.isLoading}
          columns={columns} columnLayout={layout} action={rowMenu.action}
          emptyState={<TableEmptyState title={tr("No training vendor")} description={tr("Approve the units that train from outside the company.")} />}
          pagination={table.totalItems > 0 ? <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} /> : undefined}
        />
      </ReportListToolbar>
      {rowMenu.node}

      <FormModal
        isOpen={!!editing} onClose={() => setEditing(undefined)} title={editing?.id ? tr("Edit the Training Vendor") : tr("Add a Training Vendor")} confirmText="Save" size="md" confirmDisabled={!editing?.name.trim()} isLoading={saving}
        description={tr("A vendor is written as a draft. Another person approves it with an electronic signature; after that the name and the reference do not change.")}
        onConfirm={() => void save()}
      >
        {editing && (
          <div className="grid gap-4">
            <FormField label={tr("Training vendor (unit or person)")} required><Input value={editing.name} maxLength={255} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></FormField>
            <FormField label={tr("Approval reference")}><Input value={editing.reference} maxLength={120} placeholder={tr("For example the number of the supplier approval")} onChange={(e) => setEditing({ ...editing, reference: e.target.value })} /></FormField>
            <FormField label={tr("Approval valid until")}><TrainingDateField value={editing.validUntil} onChange={(v) => setEditing({ ...editing, validUntil: v })} /></FormField>
          </div>
        )}
      </FormModal>
      <FormModal
        isOpen={!!changing && !signing} onClose={() => setChanging(undefined)} title={`${changing?.kind === "activate" ? "Activate" : tr("Deactivate")} ${changing?.vendor.name ?? "the vendor"}`} confirmText="Continue" size="md" confirmDisabled={!changing?.reason.trim()}
        description={changing?.kind === "activate" ? tr("The vendor is Active again with the electronic signature of the person who activates it. The reason stays in the Audit Trail.") : tr("An external training with this unit gets a warning from now on. The reason stays in the Audit Trail.")}
        onConfirm={() => setSigning(changing?.kind)}
      >
        {changing && (
          <div className="grid gap-4">
            <FormField label={tr("Reason")} required><Textarea rows={3} value={changing.reason} onChange={(e) => setChanging({ ...changing, reason: e.target.value })} /></FormField>
            {changing.kind === "activate" && <FormField label={tr("Approval valid until")}><TrainingDateField value={changing.validUntil} onChange={(v) => setChanging({ ...changing, validUntil: v })} /></FormField>}
          </div>
        )}
      </FormModal>
      <FormModal isOpen={!!details} onClose={() => setDetails(undefined)} onConfirm={() => setDetails(undefined)} title={details?.name ?? "Training Vendor"} confirmText="Close" showCancel={false} size="md">
        {details && (
          <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">{tr("Status")}</dt><dd><Badge color={STATUS_COLOR[details.status]}>{details.statusLabel}</Badge></dd>
            <dt className="text-slate-500">{tr("Approval reference")}</dt><dd>{details.reference ?? "—"}</dd>
            <dt className="text-slate-500">{tr("Valid until")}</dt><dd>{details.validUntil ? day(details.validUntil) : tr("No end date")}</dd>
            <dt className="text-slate-500">{tr("Written by")}</dt><dd>{details.createdByName} · {day(details.createdAt)}</dd>
            <dt className="text-slate-500">{tr("Approved by")}</dt><dd>{details.approvedByName ?? "—"}</dd>
            <dt className="text-slate-500">{tr("Approved date")}</dt><dd>{details.approvedAt ? day(details.approvedAt) : "—"}</dd>
            {details.status === "INACTIVE" && (
              <>
                <dt className="text-slate-500">{tr("Made inactive by")}</dt><dd>{details.deactivatedByName}</dd>
                <dt className="text-slate-500">{tr("Made inactive on")}</dt><dd>{details.deactivatedAt ? day(details.deactivatedAt) : "—"}</dd>
                <dt className="text-slate-500">{tr("Reason")}</dt><dd className="whitespace-normal">{details.deactivateReason}</dd>
              </>
            )}
          </dl>
        )}
      </FormModal>
      <ESignatureModal
        isOpen={!!signing}
        onClose={() => { setSigning(undefined); setApproving(undefined); }}
        onConfirm={async (d: { signatureToken: string }) => sign(d.signatureToken)}
        actionTitle={copy?.title ?? ""}
        changes={copy?.change ?? []}
        meaningDisplayName={copy?.name ?? ""}
        meaningCode={copy?.code ?? ""}
        targetDetails={{ code: "", title: target?.name ?? "", revision: "" }}
      />
    </div>
  );
}
