import { TrainingPersonName } from "../../shared/TrainingPersonName";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { MoreVertical } from "lucide-react";
import { IconBan, IconCheck, IconFileDownload } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Textarea } from "../../shared/TrainingFields";
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
import { trainingActivitiesApi, trainingError, trainingExportsApi, type TrainingPerson, type TrainingRecordExport } from "@/services/api/trainingActivities";
import { day, when, statusChange } from "../../shared/trainingLabels";
import { resettingDates, useDateRange, useDepartmentNameOptions } from "../../shared/useListFilters";

const STATUS_LABEL: Record<string, string> = { PENDING_APPROVAL: "Waiting for approval", APPROVED: "Approved", REJECTED: "Rejected" };
const STATUS_COLOR: Record<string, "amber" | "emerald" | "red"> = { PENDING_APPROVAL: "amber", APPROVED: "emerald", REJECTED: "red" };

/** Exports of the personal training record as a PDF (APD.0014): prepared with a signature, approved by a person designated with a signature, then kept unchanged. */
export function ExportsPersonalTab({ creating, setCreating }: { creating: boolean; setCreating: (open: boolean) => void }) {
  const { showToast } = useToast();
  const menu = usePortalDropdown();
  const [status, setStatus] = usePersistedState("training.exports.personal.status", "");
  const [departmentFilter, setDepartmentFilter] = usePersistedState("training.exports.personal.department", "");
  const departments = useDepartmentNameOptions();
  const requestedRange = useDateRange("training.exports.personal.requested", "Requested Date Range");
  const generatedRange = useDateRange("training.exports.personal.generated", "Generated Date Range");
  const [error, setError] = useState("");
  const [personId, setPersonId] = usePersistedState("training.exports.personal.personId", "");
  const [people, setPeople] = useState<{ label: string; value: string }[]>([]);
  const [approvers, setApprovers] = useState<TrainingPerson[]>([]);
  const [approverId, setApproverId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [signNew, setSignNew] = useState(false);
  const [signApprove, setSignApprove] = useState<TrainingRecordExport>();
  const [rejecting, setRejecting] = useState<{ id: string; reason: string }>();

  const fetcher = useCallback((params: Record<string, string | number | boolean | undefined>) => trainingExportsApi.list(params).catch((e) => { setError(trainingError(e)); throw e; }), []);
  const extra = useMemo(() => ({
    status: status || undefined, department: departmentFilter || undefined,
    ...requestedRange.params("requestedFrom", "requestedTo"), ...generatedRange.params("generatedFrom", "generatedTo"),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [status, departmentFilter, requestedRange.from, requestedRange.to, generatedRange.from, generatedRange.to]);
  const table = useServerTable<TrainingRecordExport>({ persistKey: "training.exports.personal", liveTypes: ["TRAINING"], fetcher, defaultSortBy: "createdAt", defaultSortDirection: "desc", extraParams: extra, initialItemsPerPage: 10 });

  const searchPeople = useCallback(async (query: string) => {
    const list = await trainingActivitiesApi.people(query).catch(() => []);
    const mapped = list.map((p) => ({ label: `${p.fullName}${p.employeeCode ? ` (${p.employeeCode})` : ""}`, value: p.id }));
    setPeople(mapped);
    return mapped;
  }, []);
  useEffect(() => { if (creating) void searchPeople(""); }, [creating, searchPeople]);
  useEffect(() => {
    if (!creating || !personId) { setApprovers([]); return; }
    trainingExportsApi.eligibleApprovers(personId).then((p) => setApprovers(p.data)).catch(() => setApprovers([]));
  }, [creating, personId]);

  const create = async (signatureToken: string) => {
    setBusy(true);
    try {
      await trainingExportsApi.create({ personUserId: personId, reason: reason.trim(), approverUserId: approverId, signatureToken });
      showToast({ type: "success", title: "Export prepared", message: "It waits for the approver." });
      setSignNew(false); setCreating(false); setPersonId(""); setApproverId(""); setReason("");
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: "The export was not prepared", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };
  const approve = async (token: string) => {
    if (!signApprove) return;
    setBusy(true);
    try {
      await trainingExportsApi.approve(signApprove.id, token);
      showToast({ type: "success", title: "Export approved", message: "The PDF was generated." });
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
      await trainingExportsApi.reject(rejecting.id, rejecting.reason.trim());
      setRejecting(undefined);
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: "The rejection failed", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };
  const download = async (row: TrainingRecordExport) => {
    try {
      const blob = await trainingExportsApi.download(row.id);
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `training-record-${row.employeeCode ?? row.fullName}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (e) {
      showToast({ type: "error", title: "The file could not be downloaded", message: trainingError(e) });
    }
  };

  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });

  const columns: DataTableColumn<TrainingRecordExport>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "employeeCode", header: "Employee ID", sort: sorted("employeeCode"), cell: (r) => r.employeeCode ?? "—" },
    { id: "name", header: "Full Name", sort: sorted("employee"), cell: (r) => <TrainingPersonName fullName={r.fullName} avatar={r.avatar} /> },
    { id: "status", header: "Status", sort: sorted("status"), cell: (r) => <Badge color={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge> },
    { id: "reason", header: "Reason", sort: sorted("reason"), cell: (r) => <div className="max-w-60 whitespace-normal">{r.rejectReason ?? r.reason}</div> },
    { id: "prepared", header: "Prepared By", sort: sorted("preparedBy"), cell: (r) => r.preparedByName },
    { id: "requested", header: "Requested On", sort: sorted("createdAt"), cell: (r) => day(r.createdAt) },
    { id: "approved", header: "Approved By", sort: sorted("approvedBy"), cell: (r) => r.approvedByName ?? "—" },
    { id: "records", header: "Records", sort: sorted("records"), cell: (r) => r.recordCount ?? "—" },
    { id: "generated", header: "Generated On", sort: sorted("generated"), cell: (r) => when(r.generatedAt) },
    { id: "sha", header: "SHA-256", cell: (r) => (r.sha256 ? <span className="block max-w-[21rem] whitespace-normal break-all font-mono text-xs">{r.sha256}</span> : "—") },
  ];
  const action = {
    cell: (r: TrainingRecordExport) =>
      r.canApprove || r.canDownload ? (
        <button type="button" ref={menu.getRef(r.id)} aria-label="More actions" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8" onClick={(e) => menu.toggle(r.id, e)}>
          <MoreVertical className="h-4 w-4" />
        </button>
      ) : null,
  };
  const { layout, control } = useCustomColumnLayout("training.record.exports", columns, action);
  const row = table.items.find((r) => r.id === menu.openId);
  const filters: ReportSelectFilter[] = [
    { id: "status", label: "Status", value: status, options: [{ label: "All", value: "" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ label, value }))], onChange: (v) => { setStatus(v); table.setCurrentPage(1); } },
    { id: "department", label: "Department", value: departmentFilter, options: [{ label: "All", value: "" }, ...departments], onChange: (v) => { setDepartmentFilter(v); table.setCurrentPage(1); } },
  ];

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ReportListToolbar searchPlaceholder="Search employee, code or reason…" search={table.searchQuery} onSearch={(v) => { table.setSearchQuery(v); table.setCurrentPage(1); }}
        filters={filters} dates={resettingDates([requestedRange.filter, generatedRange.filter], () => table.setCurrentPage(1))}
        hasActiveFilters={Boolean(status || departmentFilter || requestedRange.isSet || generatedRange.isSet || table.searchQuery)}
        onClear={() => { setStatus(""); setDepartmentFilter(""); requestedRange.clear(); generatedRange.clear(); table.setCurrentPage(1); }} customControl={control} framed={false} flush>
        <DataTable rows={table.items} getRowKey={(r) => r.id} isLoading={table.isLoading} loadingContent={<SectionLoading text="Loading…" />} columns={columns} columnLayout={layout} action={action}
          emptyState={<TableEmptyState title="No Exports" description="Prepare an export of a personal training record to have it approved." />}
          pagination={table.totalItems > 0 ? <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} /> : undefined} />
      </ReportListToolbar>
      <PortalDropdownMenu isOpen={!!row} onClose={menu.close} position={menu.position} minWidth={200}>
        {row && (
          <div className="py-1">
            {row.canDownload && <DropdownMenuItem icon={<IconFileDownload className="h-4 w-4" />} onClick={() => { void download(row); menu.close(); }}>Download PDF</DropdownMenuItem>}
            {row.canApprove && <DropdownMenuItem icon={<IconCheck className="h-4 w-4" />} onClick={() => { setSignApprove(row); menu.close(); }}>Complete Approval</DropdownMenuItem>}
            {row.canApprove && <DropdownMenuItem icon={<IconBan className="h-4 w-4" />} onClick={() => { setRejecting({ id: row.id, reason: "" }); menu.close(); }}>Reject</DropdownMenuItem>}
          </div>
        )}
      </PortalDropdownMenu>
      <FormModal isOpen={creating && !signNew} onClose={() => setCreating(false)} onConfirm={() => setSignNew(true)} title="Prepare an export" description="You sign as the person who prepared it. The person you choose approves with a signature, and the PDF is generated at that moment."
        confirmText="Continue to signature" confirmDisabled={!personId || !reason.trim() || !approverId} size="md">
        <div className="grid gap-4">
          <FormField label="Employee" required><Select value={personId} onChange={(v) => { setPersonId(v); setApproverId(""); }} options={people} onSearch={searchPeople} placeholder="Search by name" /></FormField>
          <FormField label="Reason for the export" required><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
          <FormField label="Who approves" required>
            {personId && approvers.length === 0 ? <p className="text-sm text-amber-700">No eligible approver was found.</p> : <Select value={approverId} onChange={setApproverId} options={approvers.map((p) => ({ label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`, value: p.id }))} placeholder="Choose" />}
          </FormField>
        </div>
      </FormModal>
      <ESignatureModal isOpen={signNew} onClose={() => setSignNew(false)} onConfirm={async (d: { signatureToken: string }) => create(d.signatureToken)} actionTitle="Prepare training record export" changes={statusChange("New", "Waiting for approval")}
        meaningDisplayName="Training Record Prepared" meaningCode="TRAINING_RECORD_PREPARED" targetDetails={{ code: "APD.0014", title: "Personal training record", revision: "" }} />
      <ESignatureModal isOpen={!!signApprove} onClose={() => setSignApprove(undefined)} onConfirm={async (d: { signatureToken: string }) => approve(d.signatureToken)} actionTitle="Complete approval of the training record export" changes={statusChange("Waiting for approval", "Approved")}
        meaningDisplayName="Training Record Approved" meaningCode="TRAINING_RECORD_APPROVED" targetDetails={{ code: signApprove?.fullName ?? "", title: "Personal training record", revision: "" }} />
      <FormModal isOpen={!!rejecting} onClose={() => setRejecting(undefined)} onConfirm={() => void reject()} title="Reject export" confirmText="Reject" confirmVariant="destructive" isLoading={busy} confirmDisabled={!rejecting?.reason.trim()} size="md">
        <FormField label="Reason" required><Textarea rows={3} value={rejecting?.reason ?? ""} onChange={(e) => rejecting && setRejecting({ ...rejecting, reason: e.target.value })} /></FormField>
      </FormModal>
    </div>
  );
}
