import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreVertical } from "lucide-react";
import { IconBan, IconCheck, IconFileDownload, IconPlus } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
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
import { dictionaryApi } from "@/services/api/dictionary";
import { trainingBatchExportsApi, trainingError, type TrainingExportBatch, type TrainingPerson } from "@/services/api/trainingActivities";
import { Input, Textarea } from "../../shared/TrainingFields";
import { day, saveBlob, when } from "../../shared/trainingLabels";

const STATUS_LABEL: Record<string, string> = { PENDING_APPROVAL: "Waiting for approval", APPROVED: "Approved", REJECTED: "Rejected" };
const STATUS_COLOR: Record<string, "amber" | "emerald" | "red"> = { PENDING_APPROVAL: "amber", APPROVED: "emerald", REJECTED: "red" };

/**
 * The personal training records of a whole department up to the end of a year (SOP.0003 5.3.10). One person prepares it with a signature, a different person approves it with a
 * signature, and only then is the ZIP of PDFs made and kept unchanged.
 */
export function ExportsBatchesTab() {
  const { showToast } = useToast();
  const menu = usePortalDropdown();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [departments, setDepartments] = useState<{ label: string; value: string }[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear() - 1));
  const [people, setPeople] = useState<{ people: number; tooMany: boolean; limit: number }>();
  const [approvers, setApprovers] = useState<TrainingPerson[]>([]);
  const [approverId, setApproverId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [signNew, setSignNew] = useState(false);
  const [signApprove, setSignApprove] = useState<TrainingExportBatch>();
  const [rejecting, setRejecting] = useState<{ id: string; reason: string }>();

  const fetcher = useCallback((params: Record<string, string | number | boolean | undefined>) => trainingBatchExportsApi.list(params).catch((e) => { setError(trainingError(e)); throw e; }), []);
  const extra = useMemo(() => ({ status: status || undefined }), [status]);
  const table = useServerTable<TrainingExportBatch>({ fetcher, defaultSortBy: "createdAt", defaultSortDirection: "desc", extraParams: extra, initialItemsPerPage: 10, syncToUrl: false });

  useEffect(() => {
    if (creating) dictionaryApi.getDepartments().then((l) => setDepartments(l.map((d) => ({ label: d.name, value: d.id })))).catch(() => setDepartments([]));
  }, [creating]);
  const yearNumber = Number(year);
  const yearOk = Number.isInteger(yearNumber) && yearNumber >= 2000 && yearNumber <= 2100;
  useEffect(() => {
    setPeople(undefined);
    setApprovers([]);
    setApproverId("");
    if (!creating || !departmentId || !yearOk) return;
    trainingBatchExportsApi.preview(departmentId, yearNumber).then(setPeople).catch(() => setPeople(undefined));
    trainingBatchExportsApi.eligibleApprovers(departmentId).then((p) => setApprovers(p.data)).catch(() => setApprovers([]));
  }, [creating, departmentId, yearNumber, yearOk]);

  const create = async (signatureToken: string) => {
    setBusy(true);
    try {
      await trainingBatchExportsApi.create({ departmentId, year: yearNumber, reason: reason.trim(), approverUserId: approverId, signatureToken });
      showToast({ type: "success", title: "Batch prepared", message: "It waits for the approver." });
      setSignNew(false); setCreating(false); setDepartmentId(""); setApproverId(""); setReason("");
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: "The batch was not prepared", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };
  const approve = async (token: string) => {
    if (!signApprove) return;
    setBusy(true);
    try {
      await trainingBatchExportsApi.approve(signApprove.id, token);
      showToast({ type: "success", title: "Batch approved", message: "The ZIP was generated." });
      setSignApprove(undefined);
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: "The approval failed", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };
  const reject = async () => {
    if (!rejecting) return;
    setBusy(true);
    try {
      await trainingBatchExportsApi.reject(rejecting.id, rejecting.reason.trim());
      setRejecting(undefined);
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: "The rejection failed", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };
  const download = async (row: TrainingExportBatch) => {
    try {
      saveBlob(await trainingBatchExportsApi.download(row.id), `training-records-${row.year}.zip`);
    } catch (e) {
      showToast({ type: "error", title: "The file could not be downloaded", message: trainingError(e) });
    }
  };

  const columns: DataTableColumn<TrainingExportBatch>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "department", header: "Department", cell: (r) => r.departmentName },
    { id: "year", header: "Up to the end of", cell: (r) => r.year },
    { id: "status", header: "Status", cell: (r) => <Badge color={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge> },
    { id: "people", header: "People", cell: (r) => r.personCount },
    { id: "reason", header: "Reason", cell: (r) => <div className="max-w-60 whitespace-normal">{r.rejectReason ?? r.reason}</div> },
    { id: "prepared", header: "Prepared by", cell: (r) => `${r.preparedByName} (${day(r.createdAt)})` },
    { id: "approved", header: "Approved by", cell: (r) => r.approvedByName ?? "—" },
    { id: "generated", header: "Generated", cell: (r) => when(r.generatedAt) },
    { id: "sha", header: "SHA-256", cell: (r) => (r.sha256 ? <span className="break-all font-mono text-xs">{r.sha256.slice(0, 16)}…</span> : "—") },
  ];
  const action = {
    cell: (r: TrainingExportBatch) =>
      r.canApprove || r.canDownload ? (
        <button type="button" ref={menu.getRef(r.id)} aria-label="More actions" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8" onClick={(e) => menu.toggle(r.id, e)}>
          <MoreVertical className="h-4 w-4" />
        </button>
      ) : null,
  };
  const { layout, control } = useCustomColumnLayout("training.record.export.batches", columns, action);
  const row = table.items.find((r) => r.id === menu.openId);
  const filters: ReportSelectFilter[] = [{ id: "status", label: "Status", value: status, options: [{ label: "All statuses", value: "" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ label, value }))], onChange: (v) => { setStatus(v); table.setCurrentPage(1); } }];

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button size="sm" onClick={() => setCreating(true)}><IconPlus className="mr-2 h-4 w-4" />New Batch</Button></div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ReportListToolbar searchPlaceholder="Search…" search={table.searchQuery} onSearch={(v) => { table.setSearchQuery(v); table.setCurrentPage(1); }}
        filters={filters} dates={[]} hasActiveFilters={Boolean(status)} onClear={() => { setStatus(""); table.setCurrentPage(1); }} customControl={control} framed={false} flush>
        <DataTable rows={table.items} getRowKey={(r) => r.id} isLoading={table.isLoading} loadingContent={<SectionLoading text="Loading…" />} columns={columns} columnLayout={layout} action={action}
          emptyState={<TableEmptyState title="No Batches" description="Prepare the personal training records of a department for a year to have them approved." />}
          pagination={table.totalItems > 0 ? <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} /> : undefined} />
      </ReportListToolbar>
      <PortalDropdownMenu isOpen={!!row} onClose={menu.close} position={menu.position} minWidth={200}>
        {row && (
          <div className="py-1">
            {row.canDownload && <DropdownMenuItem icon={<IconFileDownload className="h-4 w-4" />} onClick={() => { void download(row); menu.close(); }}>Download ZIP</DropdownMenuItem>}
            {row.canApprove && <DropdownMenuItem icon={<IconCheck className="h-4 w-4" />} onClick={() => { setSignApprove(row); menu.close(); }}>Approve</DropdownMenuItem>}
            {row.canApprove && <DropdownMenuItem icon={<IconBan className="h-4 w-4" />} onClick={() => { setRejecting({ id: row.id, reason: "" }); menu.close(); }}>Reject</DropdownMenuItem>}
          </div>
        )}
      </PortalDropdownMenu>
      <FormModal isOpen={creating && !signNew} onClose={() => setCreating(false)} onConfirm={() => setSignNew(true)} title="Prepare a batch export"
        description="You sign as the person who prepared it. The person you choose approves with a signature, and only then are the PDFs made. Nobody can change them afterwards."
        confirmText="Continue to signature" confirmDisabled={!departmentId || !yearOk || !reason.trim() || !approverId || !people || people.people === 0 || people.tooMany} size="md">
        <div className="grid gap-4">
          <FormField label="Department" required><Select value={departmentId} onChange={setDepartmentId} options={departments} placeholder="Choose a department" /></FormField>
          <FormField label="Records up to the end of the year" required><Input type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(e.target.value)} /></FormField>
          {people && (
            <p className={`rounded-lg border px-3 py-2 text-sm ${people.tooMany || people.people === 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700"}`} role="status">
              {people.people === 0 ? "Nobody in this department has records up to that year." : people.tooMany ? `More than ${people.limit} people. Split the batch by narrowing the year.` : `${people.people} people will be in the batch.`}
            </p>
          )}
          <FormField label="Reason for the batch" required><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
          <FormField label="Who approves" required>
            {departmentId && approvers.length === 0 ? <p className="text-sm text-amber-700">No eligible approver was found.</p> : <Select value={approverId} onChange={setApproverId} options={approvers.map((p) => ({ label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`, value: p.id }))} placeholder="Choose the approver" />}
          </FormField>
        </div>
      </FormModal>
      <ESignatureModal isOpen={signNew} onClose={() => setSignNew(false)} onConfirm={async (d: { signatureToken: string }) => create(d.signatureToken)} actionTitle="Prepare batch export of training records"
        meaningDisplayName="Training Record Prepared" meaningCode="TRAINING_RECORD_PREPARED" targetDetails={{ code: "APD.0014", title: "Personal training records of a department", revision: "" }} />
      <ESignatureModal isOpen={!!signApprove} onClose={() => setSignApprove(undefined)} onConfirm={async (d: { signatureToken: string }) => approve(d.signatureToken)} actionTitle="Approve batch export of training records"
        meaningDisplayName="Training Record Approved" meaningCode="TRAINING_RECORD_APPROVED" targetDetails={{ code: signApprove ? `${signApprove.departmentName} ${signApprove.year}` : "", title: "Personal training records of a department", revision: "" }} />
      <FormModal isOpen={!!rejecting} onClose={() => setRejecting(undefined)} onConfirm={() => void reject()} title="Reject batch" confirmText="Reject" confirmVariant="destructive" isLoading={busy} confirmDisabled={!rejecting?.reason.trim()} size="md">
        <FormField label="Reason" required><Textarea rows={3} value={rejecting?.reason ?? ""} onChange={(e) => rejecting && setRejecting({ ...rejecting, reason: e.target.value })} /></FormField>
      </FormModal>
    </div>
  );
}
