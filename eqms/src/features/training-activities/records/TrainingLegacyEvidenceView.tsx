import { useCallback, useEffect, useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Link, useNavigate } from "react-router-dom";
import { MoreVertical } from "lucide-react";
import { IconPaperclip, IconFileOff, IconDownload, IconEye } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { PdfPreviewModal } from "@/features/documents/shared/components/PdfPreviewModal";
import { ProposedParticipantsField, type ProposedPerson } from "../shared/ProposedParticipantsField";
import { Badge } from "@/components/ui/badge/Badge";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Textarea } from "../shared/TrainingFields";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast/Toast";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { ROUTES } from "@/app/routes.constants";
import { trainingError, trainingLegacyApi, type TrainingLegacyRow } from "@/services/api/trainingActivities";
import { TrainingFileDropzone } from "../shared/TrainingFileDropzone";
import { day, trainingBreadcrumbs, TRAINING_PAGES, statusChange } from "../shared/trainingLabels";
import { resettingDates, useDateRange, useDepartmentOptions } from "../shared/useListFilters";

// FILED: the person who imported (or attached) the evidence signed it; there is no second person. VERIFIED: evidence that a person verified before that was changed (history).
const STATE_LABEL: Record<string, string> = { MISSING: "No evidence yet", FILED: "Filed", VERIFIED: "Verified" };
const STATE_COLOR: Record<string, "red" | "amber" | "emerald"> = { MISSING: "red", FILED: "emerald", VERIFIED: "emerald" };
const stateOf = (r: TrainingLegacyRow) => r.evidenceStatus ?? "MISSING";
const LINK = "font-medium text-emerald-700 hover:underline";

/** Training evidence of the documents imported from paper: the scan of the paper record, or a declaration that there is none, signed by the person who filed it. */
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
  const [submitting, setSubmitting] = useState<{ row: TrainingLegacyRow; none: boolean; file: File | null; reason: string; trainees: ProposedPerson[] }>();
  const [signing, setSigning] = useState(false);
  const [viewing, setViewing] = useState<{ row: TrainingLegacyRow; url: string; isPdf: boolean }>();

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

  const submit = async (signatureToken: string) => {
    if (!submitting) return;
    setBusy(true);
    try {
      await trainingLegacyApi.submit(submitting.row.revisionId, signatureToken, submitting.none ? null : submitting.file, submitting.none, submitting.reason.trim() || undefined,
        submitting.none ? [] : submitting.trainees.map((p) => p.personId));
      showToast({ type: "success", title: "Evidence filed", message: submitting.row.documentNumber });
      setSigning(false);
      setSubmitting(undefined);
      table.reload();
    } catch (e) {
      setSigning(false);
      showToast({ type: "error", title: "The evidence was not filed", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };
  const closeViewer = () => {
    if (viewing) URL.revokeObjectURL(viewing.url);
    setViewing(undefined);
  };
  useEffect(() => () => { if (viewing) URL.revokeObjectURL(viewing.url); }, [viewing]);
  const viewScan = async (row: TrainingLegacyRow) => {
    if (!row.evidenceId) return;
    try {
      const blob = await trainingLegacyApi.view(row.evidenceId);
      setViewing({ row, url: URL.createObjectURL(blob), isPdf: blob.type === "application/pdf" });
    } catch (e) {
      showToast({ type: "error", title: "The scan could not be opened", message: trainingError(e) });
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
    { id: "paperNo", header: "Training Number", sort: sorted("paperNo"), cell: (r) => (r.paperTrainingNumber ? (r.activityId ? <Link className={LINK} to={ROUTES.TRAINING.ACTIVITY_DETAIL(r.activityId)}>{r.paperTrainingNumber}</Link> : r.paperTrainingNumber) : "—") },
    { id: "docNumber", header: "Document Number", sort: sorted("document"), cell: (r) => <Link className={LINK} to={ROUTES.DOCUMENTS.DETAIL(r.documentId)}>{r.documentNumber}</Link> },
    { id: "docName", header: "Document Name", sort: sorted("documentName"), cell: (r) => <div className="max-w-80 whitespace-normal">{r.documentName}</div> },
    { id: "docRevision", header: "Document Revision", sort: sorted("revision"), cell: (r) => <Link className={LINK} to={ROUTES.DOCUMENTS.REVISIONS.DETAIL(r.revisionId)}>{r.revisionNumber}</Link> },
    { id: "completion", header: "Paper Training Completed On", sort: sorted("completion"), cell: (r) => day(r.completionDate) },
    { id: "trained", header: "Persons Trained", cell: (r) => (r.traineeCount ? r.traineeCount : "—") },
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
      <ReportListToolbar searchPlaceholder="Search training number, document number or name…" search={table.searchQuery} onSearch={(v) => { table.setSearchQuery(v); table.setCurrentPage(1); }}
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
            {!row.evidenceId && canSubmit && <DropdownMenuItem icon={<IconPaperclip className="h-4 w-4" />} onClick={() => { setSubmitting({ row, none: false, file: null, reason: "", trainees: [] }); menu.close(); }}>Attach the scan</DropdownMenuItem>}
            {!row.evidenceId && canSubmit && <DropdownMenuItem icon={<IconFileOff className="h-4 w-4" />} onClick={() => { setSubmitting({ row, none: true, file: null, reason: "", trainees: [] }); menu.close(); }}>Declare: no evidence</DropdownMenuItem>}
            {row.evidenceId && !row.notEvidenced && <DropdownMenuItem icon={<IconEye className="h-4 w-4" />} onClick={() => { void viewScan(row); menu.close(); }}>View Scan</DropdownMenuItem>}
            {row.evidenceId && !row.notEvidenced && <DropdownMenuItem icon={<IconDownload className="h-4 w-4" />} onClick={() => { void download(row); menu.close(); }}>Download the scan</DropdownMenuItem>}
          </div>
        )}
      </PortalDropdownMenu>
      <FormModal isOpen={!!submitting && !signing} onClose={() => setSubmitting(undefined)} onConfirm={() => setSigning(true)} isLoading={busy} confirmText="Continue to Sign" size="md"
        title={submitting?.none ? "Declare: no evidence" : "Attach the scan of the paper record"}
        description="You sign the evidence in the next step; nobody else verifies it. After that it is read-only, and the persons you name get their training record."
        confirmDisabled={!submitting || (submitting.none ? !submitting.reason.trim() : !submitting.file)}>
        {submitting && (
          <div className="grid gap-4">
            <p className="text-sm text-slate-600">{submitting.row.documentNumber} Rev {submitting.row.revisionNumber} — {submitting.row.documentName}</p>
            {submitting.none ? (
              <FormField label="Why there is no evidence" required><Textarea rows={3} value={submitting.reason} onChange={(e) => setSubmitting({ ...submitting, reason: e.target.value })} /></FormField>
            ) : (
              <TrainingFileDropzone label="Scan" required accept=".pdf" maxMb={20} hint="PDF only (max 20 MB)" file={submitting.file} onChange={(f) => setSubmitting({ ...submitting, file: f })} />
            )}
            {!submitting.none && submitting.row.paperTrainingNumber && (
              <ProposedParticipantsField
                pending={submitting.trainees}
                onPendingChange={(people) => setSubmitting({ ...submitting, trainees: people })}
                labels={{
                  title: "Persons who were trained",
                  description: "The people who were at the paper training. They get their training record when you sign.",
                  localNotice: "A person who is no longer in the system cannot be chosen and gets no record.",
                  emptyTitle: "Nobody chosen",
                  emptyDescription: "Use Add Participants to choose the people who were trained.",
                  modalTitle: "Persons who were trained",
                }}
              />
            )}
          </div>
        )}
      </FormModal>
      {viewing && viewing.isPdf && (
        <PdfPreviewModal title="Scan of the paper training record" description={`${viewing.row.documentNumber} Rev ${viewing.row.revisionNumber} — ${viewing.row.originalName ?? ""}`} fileUrl={viewing.url} onClose={closeViewer} showCancel={false} />
      )}
      {viewing && !viewing.isPdf && (
        <FormModal isOpen onClose={closeViewer} onConfirm={closeViewer} title="Scan of the paper training record" description={`${viewing.row.documentNumber} Rev ${viewing.row.revisionNumber} — ${viewing.row.originalName ?? ""}`}
          confirmText="Close" showCancel={false} size="2xl">
          <div className="flex max-h-[68dvh] justify-center overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
            <img src={viewing.url} alt={viewing.row.originalName ?? "Scan of the paper training record"} className="h-auto max-w-full object-contain" onContextMenu={(e) => e.preventDefault()} />
          </div>
        </FormModal>
      )}
      <ESignatureModal isOpen={!!submitting && signing} onClose={() => setSigning(false)} onConfirm={async (d: { signatureToken: string }) => submit(d.signatureToken)} actionTitle="File the Training Evidence" changes={statusChange("No evidence", "Filed")}
        meaningDisplayName="Legacy Training Evidence Filed" meaningCode="TRAINING_LEGACY_FILED" targetDetails={{ code: submitting?.row.documentNumber ?? "", title: submitting?.row.documentName ?? "", revision: submitting?.row.revisionNumber ?? "" }} />
    </div>
  );
}
