import { useCallback, useEffect, useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useNavigate } from "react-router-dom";
import { MoreVertical } from "lucide-react";
import { IconBan, IconCheck, IconFileDownload, IconPaperclip, IconFileOff, IconDownload } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Badge } from "@/components/ui/badge/Badge";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Textarea } from "../shared/TrainingFields";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { Select } from "@/components/ui/select/Select";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast/Toast";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { trainingError, trainingLegacyApi, type TrainingLegacyRow, type TrainingPerson } from "@/services/api/trainingActivities";
import { TrainingFileDropzone } from "../shared/TrainingFileDropzone";
import { day, trainingBreadcrumbs, TRAINING_PAGES } from "../shared/trainingLabels";
import { resettingDates, useDateRange, useDepartmentOptions } from "../shared/useListFilters";

const STATE_LABEL: Record<string, string> = { MISSING: "No evidence yet", SUBMITTED: "Waiting for verification", VERIFIED: "Verified" };
const STATE_COLOR: Record<string, "red" | "amber" | "emerald"> = { MISSING: "red", SUBMITTED: "amber", VERIFIED: "emerald" };
const stateOf = (r: TrainingLegacyRow) => r.evidenceStatus ?? "MISSING";

/** Training evidence of the documents imported from paper: the scan of the paper record, or a declaration that there is none, verified by a person designated. */
export function TrainingLegacyEvidenceView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const menu = usePortalDropdown();
  const [status, setStatus] = usePersistedState("training.legacy.status", "");
  const [departmentFilter, setDepartmentFilter] = usePersistedState("training.legacy.departmentId", "");
  const departments = useDepartmentOptions();
  const completedRange = useDateRange("training.legacy.completed", "Paper Training Completed Date Range");
  const submittedRange = useDateRange("training.legacy.submitted", "Evidence Submitted Date Range");
  const verifiedRange = useDateRange("training.legacy.verified", "Evidence Verified Date Range");
  const [error, setError] = useState("");
  const [canSubmit, setCanSubmit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState<{ row: TrainingLegacyRow; none: boolean; file: File | null; reason: string; verifierId: string }>();
  const [verifiers, setVerifiers] = useState<TrainingPerson[]>([]);
  const [sign, setSign] = useState<TrainingLegacyRow>();
  const [rejecting, setRejecting] = useState<{ id: string; reason: string }>();

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      trainingLegacyApi.queue(params).then((page) => { setCanSubmit(page.canSubmit); return page; }).catch((e) => { setError(trainingError(e)); throw e; }),
    [],
  );
  const extra = useMemo(() => ({
    status: status || undefined, departmentId: departmentFilter || undefined,
    ...completedRange.params("completionFrom", "completionTo"), ...submittedRange.params("submittedFrom", "submittedTo"), ...verifiedRange.params("verifiedFrom", "verifiedTo"),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [status, departmentFilter, completedRange.from, completedRange.to, submittedRange.from, submittedRange.to, verifiedRange.from, verifiedRange.to]);
  const table = useServerTable<TrainingLegacyRow>({ persistKey: "training.legacy", liveTypes: ["TRAINING"], fetcher, defaultSortBy: "document", extraParams: extra, initialItemsPerPage: 10 });

  useEffect(() => {
    if (!submitting) { setVerifiers([]); return; }
    trainingLegacyApi.eligibleVerifiers(submitting.row.revisionId).then((p) => setVerifiers(p.data)).catch(() => setVerifiers([]));
  }, [submitting?.row.revisionId]);

  const submit = async () => {
    if (!submitting) return;
    setBusy(true);
    try {
      await trainingLegacyApi.submit(submitting.row.revisionId, submitting.verifierId, submitting.none ? null : submitting.file, submitting.none, submitting.reason.trim() || undefined);
      showToast({ type: "success", title: "Evidence submitted", message: "It waits for the person you chose." });
      setSubmitting(undefined);
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: "The evidence was not submitted", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };
  const verify = async (token: string) => {
    if (!sign?.evidenceId) return;
    setBusy(true);
    try {
      await trainingLegacyApi.verify(sign.evidenceId, token);
      showToast({ type: "success", title: "Evidence verified", message: sign.documentNumber });
      setSign(undefined);
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: "The verification failed", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };
  const reject = async () => {
    if (!rejecting) return;
    setBusy(true);
    try {
      await trainingLegacyApi.reject(rejecting.id, rejecting.reason.trim());
      setRejecting(undefined);
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: "The rejection failed", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };
  const download = async (row: TrainingLegacyRow) => {
    if (!row.evidenceId) return;
    try {
      const blob = await trainingLegacyApi.download(row.evidenceId);
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = row.originalName ?? "training-evidence";
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (e) {
      showToast({ type: "error", title: "The file could not be downloaded", message: trainingError(e) });
    }
  };

  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });

  const columns: DataTableColumn<TrainingLegacyRow>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "doc", header: "Document", sort: sorted("document"), cell: (r) => <div className="max-w-80 whitespace-normal"><div className="font-medium">{r.documentNumber} Rev {r.revisionNumber}</div><div className="text-xs text-slate-500">{r.documentName}</div></div> },
    { id: "completion", header: "Paper Training Completed On", sort: sorted("completion"), cell: (r) => day(r.completionDate) },
    { id: "paperNo", header: "Paper Training Number", sort: sorted("paperNo"), cell: (r) => r.paperTrainingNumber ?? "—" },
    { id: "state", header: "Evidence", sort: sorted("evidence"), cell: (r) => <Badge color={STATE_COLOR[stateOf(r)]}>{STATE_LABEL[stateOf(r)]}</Badge> },
    { id: "detail", header: "Detail", sort: sorted("detail"), cell: (r) => <div className="max-w-60 whitespace-normal">{r.notEvidenced ? `No evidence: ${r.notEvidencedReason}` : r.originalName ?? "—"}</div> },
    { id: "by", header: "Submitted By", sort: sorted("submittedBy"), cell: (r) => r.submittedByName ?? "—" },
    { id: "submittedOn", header: "Submitted On", sort: sorted("submittedOn"), cell: (r) => (r.submittedAt ? day(r.submittedAt) : "—") },
    { id: "verified", header: "Verified By", sort: sorted("verifiedBy"), cell: (r) => r.verifiedByName ?? "—" },
    { id: "verifiedOn", header: "Verified On", sort: sorted("verifiedOn"), cell: (r) => (r.verifiedAt ? day(r.verifiedAt) : "—") },
  ];
  const action = {
    cell: (r: TrainingLegacyRow) => (
      <button type="button" ref={menu.getRef(r.revisionId)} aria-label="More actions" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8" onClick={(e) => menu.toggle(r.revisionId, e)}>
        <MoreVertical className="h-4 w-4" />
      </button>
    ),
  };
  const { layout, control } = useCustomColumnLayout("training.legacy.evidence", columns, action);
  const row = table.items.find((r) => r.revisionId === menu.openId);
  const filters: ReportSelectFilter[] = [
    { id: "status", label: "Evidence", value: status, options: [{ label: "All", value: "" }, ...Object.entries(STATE_LABEL).map(([value, label]) => ({ label, value }))], onChange: (v) => { setStatus(v); table.setCurrentPage(1); } },
    { id: "department", label: "Department", value: departmentFilter, options: [{ label: "All", value: "" }, ...departments], onChange: (v) => { setDepartmentFilter(v); table.setCurrentPage(1); } },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader title={TRAINING_PAGES.legacy.title} breadcrumbItems={trainingBreadcrumbs(navigate, "legacy")} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ReportListToolbar searchPlaceholder="Search document number or name…" search={table.searchQuery} onSearch={(v) => { table.setSearchQuery(v); table.setCurrentPage(1); }}
        filters={filters} dates={resettingDates([completedRange.filter, submittedRange.filter, verifiedRange.filter], () => table.setCurrentPage(1))}
        hasActiveFilters={Boolean(status || departmentFilter || completedRange.isSet || submittedRange.isSet || verifiedRange.isSet || table.searchQuery)}
        onClear={() => { setStatus(""); setDepartmentFilter(""); completedRange.clear(); submittedRange.clear(); verifiedRange.clear(); table.setCurrentPage(1); }} customControl={control}>
        <DataTable rows={table.items} getRowKey={(r) => r.revisionId} isLoading={table.isLoading} loadingContent={<SectionLoading text="Loading…" />} columns={columns} columnLayout={layout} action={action}
          emptyState={<TableEmptyState title="Nothing to show" description="Documents imported from paper that required training appear here." />}
          pagination={table.totalItems > 0 ? <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} /> : undefined} />
      </ReportListToolbar>
      <PortalDropdownMenu isOpen={!!row} onClose={menu.close} position={menu.position} minWidth={220}>
        {row && (
          <div className="py-1">
            {!row.evidenceId && canSubmit && <DropdownMenuItem icon={<IconPaperclip className="h-4 w-4" />} onClick={() => { setSubmitting({ row, none: false, file: null, reason: "", verifierId: "" }); menu.close(); }}>Attach the scan</DropdownMenuItem>}
            {!row.evidenceId && canSubmit && <DropdownMenuItem icon={<IconFileOff className="h-4 w-4" />} onClick={() => { setSubmitting({ row, none: true, file: null, reason: "", verifierId: "" }); menu.close(); }}>Declare: no evidence</DropdownMenuItem>}
            {row.evidenceId && !row.notEvidenced && <DropdownMenuItem icon={<IconDownload className="h-4 w-4" />} onClick={() => { void download(row); menu.close(); }}>Download the scan</DropdownMenuItem>}
            {row.pendingForMe && <DropdownMenuItem icon={<IconCheck className="h-4 w-4" />} onClick={() => { setSign(row); menu.close(); }}>Verify</DropdownMenuItem>}
            {row.pendingForMe && <DropdownMenuItem icon={<IconBan className="h-4 w-4" />} onClick={() => { setRejecting({ id: row.evidenceId as string, reason: "" }); menu.close(); }}>Reject</DropdownMenuItem>}
          </div>
        )}
      </PortalDropdownMenu>
      <FormModal isOpen={!!submitting} onClose={() => setSubmitting(undefined)} onConfirm={() => void submit()} isLoading={busy} confirmText="Submit" size="md"
        title={submitting?.none ? "Declare: no evidence" : "Attach the scan of the paper record"}
        description="The person you choose verifies it with a signature; it cannot be you. After that it is read-only."
        confirmDisabled={!submitting || !submitting.verifierId || (submitting.none ? !submitting.reason.trim() : !submitting.file)}>
        {submitting && (
          <div className="grid gap-4">
            <p className="text-sm text-slate-600">{submitting.row.documentNumber} Rev {submitting.row.revisionNumber}</p>
            {submitting.none ? (
              <FormField label="Why there is no evidence" required><Textarea rows={3} value={submitting.reason} onChange={(e) => setSubmitting({ ...submitting, reason: e.target.value })} /></FormField>
            ) : (
              <TrainingFileDropzone label="Scan" required accept=".pdf,.png,.jpg,.jpeg" maxMb={20} hint="PDF, PNG or JPEG (max 20 MB)" file={submitting.file} onChange={(f) => setSubmitting({ ...submitting, file: f })} />
            )}
            <FormField label="Who verifies" required>
              {verifiers.length === 0 ? <p className="text-sm text-amber-700">No eligible person was found.</p> : <Select value={submitting.verifierId} onChange={(v) => setSubmitting({ ...submitting, verifierId: v })} options={verifiers.map((p) => ({ label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`, value: p.id }))} placeholder="Choose" />}
            </FormField>
          </div>
        )}
      </FormModal>
      <ESignatureModal isOpen={!!sign} onClose={() => setSign(undefined)} onConfirm={async (d: { signatureToken: string }) => verify(d.signatureToken)} actionTitle="Verify the training evidence"
        meaningDisplayName="Legacy Training Evidence Verified" meaningCode="TRAINING_LEGACY_VERIFIED" targetDetails={{ code: sign?.documentNumber ?? "", title: sign?.documentName ?? "", revision: sign?.revisionNumber ?? "" }} />
      <FormModal isOpen={!!rejecting} onClose={() => setRejecting(undefined)} onConfirm={() => void reject()} title="Reject the evidence" confirmText="Reject" confirmVariant="destructive" isLoading={busy} confirmDisabled={!rejecting?.reason.trim()} size="md">
        <FormField label="Reason" required><Textarea rows={3} value={rejecting?.reason ?? ""} onChange={(e) => rejecting && setRejecting({ ...rejecting, reason: e.target.value })} /></FormField>
      </FormModal>
    </div>
  );
}
