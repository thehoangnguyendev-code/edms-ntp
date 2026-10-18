import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical } from "lucide-react";
import { IconEye, IconPlus, IconCheck, IconBan } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
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
import { usePermissions } from "@/hooks/usePermissions";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { trainingActivitiesApi, trainingError, trainingSpecimenApi, type TrainingPerson, type TrainingSpecimen } from "@/services/api/trainingActivities";
import { day, trainingBreadcrumbs, TRAINING_PAGES } from "../shared/trainingLabels";
import { SpecimenImagePicker } from "../shared/SpecimenImagePicker";

const STATUS_LABEL: Record<string, string> = { PENDING: "Waiting for confirmation", APPROVED: "Approved", SUPERSEDED: "Replaced", REJECTED: "Rejected" };
const STATUS_COLOR: Record<string, "amber" | "emerald" | "slate" | "red"> = { PENDING: "amber", APPROVED: "emerald", SUPERSEDED: "slate", REJECTED: "red" };

/** Specimen signatures. The image is never in the list: it is opened on request, with a check each time, and the opening is recorded in the Audit Trail. */
export function TrainingSpecimenView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("training.signature.manage");
  const menu = usePortalDropdown();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [forPerson, setForPerson] = useState("");
  const [people, setPeople] = useState<{ label: string; value: string }[]>([]);
  const [confirmers, setConfirmers] = useState<TrainingPerson[]>([]);
  const [confirmerId, setConfirmerId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<{ title: string; urls: string[] }>();
  const [rejecting, setRejecting] = useState<{ id: string; reason: string }>();
  const [sign, setSign] = useState<TrainingSpecimen>();

  const fetcher = useCallback((params: Record<string, string | number | boolean | undefined>) => trainingSpecimenApi.list(params).catch((e) => { setError(trainingError(e)); throw e; }), []);
  const extra = useMemo(() => ({ status: status || undefined }), [status]);
  const table = useServerTable<TrainingSpecimen>({ fetcher, defaultSortBy: "createdAt", defaultSortDirection: "desc", extraParams: extra, initialItemsPerPage: 10 });

  const searchPeople = useCallback(async (query: string) => {
    const list = await trainingActivitiesApi.people(query).catch(() => []);
    const mapped = list.map((p) => ({ label: `${p.fullName}${p.employeeCode ? ` (${p.employeeCode})` : ""}`, value: p.id }));
    setPeople(mapped);
    return mapped;
  }, []);
  useEffect(() => {
    if (!uploading) return;
    void (canManage ? searchPeople("") : Promise.resolve([]));
    trainingSpecimenApi.eligibleConfirmers(forPerson || undefined).then((p) => setConfirmers(p.data)).catch(() => setConfirmers([]));
  }, [uploading, forPerson, canManage, searchPeople]);
  useEffect(() => () => { if (viewing) viewing.urls.forEach((u) => URL.revokeObjectURL(u)); }, [viewing]);

  const upload = async () => {
    if (!file || !file2) return;
    setBusy(true);
    try {
      await trainingSpecimenApi.upload(file, file2, confirmerId, forPerson || undefined, reason.trim() || undefined);
      showToast({ type: "success", title: "Specimen signature uploaded", message: "It waits for confirmation." });
      setUploading(false);
      setFile(null); setFile2(null); setConfirmerId(""); setReason(""); setForPerson("");
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: "The image was not uploaded", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };
  const view = async (s: TrainingSpecimen) => {
    try {
      const blobs = [await trainingSpecimenApi.image(s.id, 1), ...(s.hasSecond ? [await trainingSpecimenApi.image(s.id, 2)] : [])];
      setViewing({ title: `${s.fullName}, version ${s.versionNo}`, urls: blobs.map((b) => URL.createObjectURL(b)) });
    } catch (e) {
      showToast({ type: "error", title: "The image could not be opened", message: trainingError(e) });
    }
  };
  const doConfirm = async (token: string) => {
    if (!sign) return;
    setBusy(true);
    try {
      await trainingSpecimenApi.confirm(sign.id, token);
      showToast({ type: "success", title: "Specimen signature approved", message: sign.fullName });
      setSign(undefined);
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: "The confirmation failed", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };
  const doReject = async () => {
    if (!rejecting) return;
    setBusy(true);
    try {
      await trainingSpecimenApi.reject(rejecting.id, rejecting.reason.trim());
      setRejecting(undefined);
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: "The rejection failed", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };

  const columns: DataTableColumn<TrainingSpecimen>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "name", header: "Employee", cell: (r) => <div><div className="font-medium">{r.fullName}</div><div className="text-xs text-slate-500">{r.employeeCode ?? ""}</div></div> },
    { id: "department", header: "Department", cell: (r) => r.department ?? "—" },
    { id: "version", header: "Version", cell: (r) => r.versionNo },
    { id: "status", header: "Status", cell: (r) => <Badge color={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge> },
    { id: "uploaded", header: "Uploaded by", cell: (r) => `${r.uploadedByName} (${day(r.createdAt)})` },
    { id: "confirmed", header: "Confirmed by", cell: (r) => r.confirmedByName ?? "—" },
    { id: "effective", header: "Effective", cell: (r) => day(r.effectiveDate) },
    { id: "reason", header: "Reason", cell: (r) => <div className="max-w-60 whitespace-normal">{r.rejectReason ?? r.changeReason ?? "—"}</div> },
  ];
  const action = {
    cell: (r: TrainingSpecimen) => (
      <button type="button" ref={menu.getRef(r.id)} aria-label="More actions" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8" onClick={(e) => menu.toggle(r.id, e)}>
        <MoreVertical className="h-4 w-4" />
      </button>
    ),
  };
  const { layout, control } = useCustomColumnLayout("training.specimen.signatures", columns, action);
  const row = table.items.find((r) => r.id === menu.openId);
  const filters: ReportSelectFilter[] = [{ id: "status", label: "Status", value: status, options: [{ label: "All statuses", value: "" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ label, value }))], onChange: (v) => { setStatus(v); table.setCurrentPage(1); } }];

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader title={TRAINING_PAGES.specimen.title} breadcrumbItems={trainingBreadcrumbs(navigate, "specimen")}
        actions={<Button size="sm" onClick={() => setUploading(true)}><IconPlus className="mr-2 h-4 w-4" />Upload Specimen Signature</Button>} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ReportListToolbar searchPlaceholder="Search employee…" search={table.searchQuery} onSearch={(v) => { table.setSearchQuery(v); table.setCurrentPage(1); }}
        filters={filters} dates={[]} hasActiveFilters={Boolean(status)} onClear={() => { setStatus(""); table.setCurrentPage(1); }} customControl={control}>
        <DataTable rows={table.items} getRowKey={(r) => r.id} isLoading={table.isLoading} loadingContent={<SectionLoading text="Loading…" />} columns={columns} columnLayout={layout} action={action}
          emptyState={<TableEmptyState title="No Specimen Signatures" description="Upload the image of a signature to have it confirmed." />}
          pagination={table.totalItems > 0 ? <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} /> : undefined} />
      </ReportListToolbar>
      <PortalDropdownMenu isOpen={!!row} onClose={menu.close} position={menu.position} minWidth={200}>
        {row && (
          <div className="py-1">
            {row.capabilities.viewImage && <DropdownMenuItem icon={<IconEye className="h-4 w-4" />} onClick={() => { void view(row); menu.close(); }}>View image</DropdownMenuItem>}
            {row.capabilities.confirm && <DropdownMenuItem icon={<IconCheck className="h-4 w-4" />} onClick={() => { setSign(row); menu.close(); }}>Confirm</DropdownMenuItem>}
            {row.capabilities.reject && <DropdownMenuItem icon={<IconBan className="h-4 w-4" />} onClick={() => { setRejecting({ id: row.id, reason: "" }); menu.close(); }}>Reject</DropdownMenuItem>}
          </div>
        )}
      </PortalDropdownMenu>

      <FormModal isOpen={uploading} onClose={() => { setUploading(false); setFile(null); setFile2(null); }} onConfirm={() => void upload()} title="Upload a specimen signature" description="A PNG or JPEG of up to 512 KB. The person you choose confirms it with a signature; it cannot be the employee or you."
        confirmText="Upload" isLoading={busy} confirmDisabled={!file || !file2 || !confirmerId} size="md">
        <div className="grid gap-4">
          {canManage && <FormField label="For another employee (leave empty for yourself)"><Select value={forPerson} onChange={setForPerson} options={[{ label: "Myself", value: "" }, ...people]} onSearch={searchPeople} placeholder="Search by name" /></FormField>}
          <FormField label="1st specimen signature" required><SpecimenImagePicker file={file} onChange={setFile} /></FormField>
          <FormField label="2nd specimen signature" required><SpecimenImagePicker file={file2} onChange={setFile2} /></FormField>
          <FormField label="Who confirms" required>
            {confirmers.length === 0 ? <p className="text-sm text-amber-700">No eligible person was found.</p> : <Select value={confirmerId} onChange={setConfirmerId} options={confirmers.map((p) => ({ label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`, value: p.id }))} placeholder="Choose" />}
          </FormField>
          <FormField label="Reason (needed when it replaces an approved image)"><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
        </div>
      </FormModal>
      <FormModal isOpen={!!viewing} onClose={() => setViewing(undefined)} onConfirm={() => setViewing(undefined)} title={viewing?.title} showCancel={false} confirmText="Close" size="md">
        {viewing && (
          <div className="grid gap-4">
            {viewing.urls.map((url, i) => (
              <figure key={url} className="space-y-1">
                <figcaption className="text-xs font-medium text-slate-600">{i === 0 ? "1st signature" : "2nd signature"}</figcaption>
                <img src={url} alt={i === 0 ? "1st specimen signature" : "2nd specimen signature"} className="mx-auto max-h-48 max-w-full rounded border border-slate-200 bg-white" />
              </figure>
            ))}
            {viewing.urls.length === 1 && <p className="text-xs text-slate-500">This version was made before the form asked for two signatures, so it has the 1st only.</p>}
          </div>
        )}
      </FormModal>
      <FormModal isOpen={!!rejecting} onClose={() => setRejecting(undefined)} onConfirm={() => void doReject()} title="Reject specimen signature" confirmText="Reject" confirmVariant="destructive" isLoading={busy} confirmDisabled={!rejecting?.reason.trim()} size="md">
        <FormField label="Reason" required><Textarea rows={3} value={rejecting?.reason ?? ""} onChange={(e) => rejecting && setRejecting({ ...rejecting, reason: e.target.value })} /></FormField>
      </FormModal>
      <ESignatureModal isOpen={!!sign} onClose={() => setSign(undefined)} onConfirm={async (d: { signatureToken: string }) => doConfirm(d.signatureToken)} actionTitle="Confirm specimen signature"
        meaningDisplayName="Specimen Signature Approved" meaningCode="TRAINING_SPECIMEN_APPROVED" targetDetails={{ code: sign?.fullName ?? "", title: "Specimen signature", revision: String(sign?.versionNo ?? "") }} />
    </div>
  );
}
