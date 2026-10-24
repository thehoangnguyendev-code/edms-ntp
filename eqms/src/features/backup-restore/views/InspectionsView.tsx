import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import type { DataTableAction, DataTableColumn } from "@/components/ui/table";
import { TABLE_STYLES } from "@/components/ui/table";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { ROUTES } from "@/app/routes.constants";
import { backupRestoreApi, type InspectionRecord, type InspectionStatus } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { ServerListPanel } from "../components/ServerListPanel";
import { formatDateTime } from "../format";

const ALL = "ALL";
const POLL_MS = 10_000;
const STATUS_LABEL: Record<InspectionStatus, string> = {
  PENDING_APPROVAL: "Waiting for approval",
  APPROVED: "Approved, opening",
  OPENING: "Opening",
  OPEN: "Open (read-only)",
  CLOSED: "Closed",
  REJECTED: "Rejected",
  FAILED: "Failed",
};
const STATUS_COLOR: Record<InspectionStatus, "amber" | "emerald" | "red" | "blue"> = {
  PENDING_APPROVAL: "amber",
  APPROVED: "blue",
  OPENING: "blue",
  OPEN: "emerald",
  CLOSED: "blue",
  REJECTED: "red",
  FAILED: "red",
};
const STATUS_OPTIONS = [{ label: "All", value: ALL }, ...(Object.keys(STATUS_LABEL) as InspectionStatus[]).map((value) => ({ label: STATUS_LABEL[value], value }))];
const BACKUP_ID = /^BK-\d{8}-\d{4}-\d{4}$/;

type Decision = { row: InspectionRecord; mode: "approve" | "reject" };
type Pending = { mode: "reject" | "close"; row: InspectionRecord };

/** How much of the five minutes is left, for display only: the agent closes the copy when the time is over, not this screen. */
const timeLeft = (expiresAt: string | null): string => {
  if (!expiresAt) return "—";
  const seconds = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} left`;
};

/**
 * Backup Inspection (SDS 7.2). A verified backup is restored into a read-only copy for five minutes. Asking, approving and closing
 * run on the server; the approver must be a different person and signs in the e-signature dialog that every approval uses.
 */
export const InspectionsView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canAsk = hasPermission("backup.restore.request");
  const canApprove = hasPermission("backup.restore.approve");
  const me = user?.username?.toLowerCase() ?? "";

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rows, setRows] = useState<InspectionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [asking, setAsking] = useState(false);
  const [askBackup, setAskBackup] = useState("");
  const [askReason, setAskReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<Decision>();
  const [pending, setPending] = useState<Pending>();
  const [rejectReason, setRejectReason] = useState<string>();
  const [closeReason, setCloseReason] = useState("");
  const [, setTick] = useState(0);

  const live = rows.some((row) => row.status === "OPEN" || row.status === "OPENING" || row.status === "APPROVED");

  const load = useCallback(() => {
    let active = true;
    backupRestoreApi
      .inspections({ search: search.trim() || undefined, status: status === ALL ? undefined : (status as InspectionStatus), page, limit: pageSize })
      .then((data) => {
        if (!active) return;
        setRows(data.data);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.totalPages || 1);
        setError("");
      })
      .catch((e) => {
        if (!active) return;
        setRows([]);
        setTotal(0);
        setError(getApiErrorMessage(e, "Unable to load the inspections."));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setHasLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [search, status, page, pageSize]);

  useEffect(() => load(), [load, reloadKey]);

  useEffect(() => setPage(1), [search, status, pageSize]);

  // while a copy is opening or open, the list follows the server; the countdown is redrawn once a second
  useEffect(() => {
    if (!live) return undefined;
    const poll = window.setInterval(() => setReloadKey((k) => k + 1), POLL_MS);
    const tick = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [live]);

  const mine = (row: InspectionRecord) => row.requestedBy.toLowerCase() === me;
  const canDecide = (row: InspectionRecord) => row.status === "PENDING_APPROVAL" && canApprove && !mine(row);
  const canClose = (row: InspectionRecord) => row.status === "OPEN" && canAsk;

  const ask = async () => {
    const backupNumber = askBackup.trim();
    const reason = askReason.trim();
    if (!BACKUP_ID.test(backupNumber) || !reason) return;
    setBusy(true);
    try {
      const created = await backupRestoreApi.askInspection(backupNumber, reason);
      showToast({ type: "success", title: "Inspection requested", message: `${created.inspectionNumber} waits for a second person's approval.` });
      setAsking(false);
      setAskBackup("");
      setAskReason("");
      setReloadKey((k) => k + 1);
    } catch (e) {
      showToast({ type: "error", title: "The inspection was not requested", message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setBusy(false);
    }
  };

  const signed = (mode: "approve" | "reject") => async (data: { signatureToken?: string }) => {
    const current = decision;
    const why = rejectReason;
    setDecision(undefined);
    setRejectReason(undefined);
    if (!current) return;
    if (!data.signatureToken) {
      showToast({ type: "error", title: "The signature could not be confirmed", message: "Try again." });
      return;
    }
    setBusy(true);
    try {
      const updated = mode === "approve"
        ? await backupRestoreApi.approveInspection(current.row.inspectionNumber, data.signatureToken)
        : await backupRestoreApi.rejectInspection(current.row.inspectionNumber, why ?? "", data.signatureToken);
      showToast({
        type: "success",
        title: mode === "approve" ? "Inspection approved" : "Inspection rejected",
        message: mode === "approve" ? `${updated.inspectionNumber} is being opened on the validation environment.` : updated.inspectionNumber,
      });
      setReloadKey((k) => k + 1);
    } catch (e) {
      showToast({
        type: "error",
        title: mode === "approve" ? "The inspection was not approved" : "The inspection was not rejected",
        message: getApiErrorMessage(e, "The request was refused."),
      });
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    if (!pending) return;
    const row = pending.row;
    setBusy(true);
    try {
      await backupRestoreApi.closeInspection(row.inspectionNumber, closeReason.trim());
      showToast({ type: "success", title: "Inspection closed", message: `${row.inspectionNumber}: the copy is dropped.` });
      setPending(undefined);
      setCloseReason("");
      setReloadKey((k) => k + 1);
    } catch (e) {
      showToast({ type: "error", title: "The inspection was not closed", message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setBusy(false);
    }
  };

  const columns: DataTableColumn<InspectionRecord>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: TABLE_STYLES.headerCell35, cellClassName: TABLE_STYLES.cell30, cell: (_row, index) => (page - 1) * pageSize + index + 1 },
    { id: "inspectionNumber", header: "Inspection Number", label: "Inspection Number", headerClassName: TABLE_STYLES.headerCell35, cell: (row) => row.inspectionNumber },
    { id: "backupNumber", header: "Backup Number", label: "Backup Number", cell: (row) => (
      <button type="button" className="text-left text-emerald-600 hover:underline" onClick={() => navigate(ROUTES.BACKUP_RESTORE.BACKUP_DETAIL(row.backupNumber))}>{row.backupNumber}</button>
    ) },
    { id: "status", header: "Status", label: "Status", cell: (row) => <Badge color={STATUS_COLOR[row.status]}>{STATUS_LABEL[row.status]}</Badge> },
    { id: "requestedBy", header: "Requested by", label: "Requested by", cell: (row) => row.requestedBy },
    { id: "requestedAt", header: "Requested", label: "Requested", cell: (row) => formatDateTime(row.requestedAt) },
    { id: "approvedBy", header: "Approved by", label: "Approved by", cell: (row) => row.approvedBy ?? "—" },
    { id: "window", header: "Copy", label: "Copy", cell: (row) => (row.status === "OPEN" ? timeLeft(row.expiresAt) : row.closeReason ?? row.errorCode ?? "—") },
  ];

  const action: DataTableAction<InspectionRecord> = {
    header: "Actions",
    headerClassName: TABLE_STYLES.headerCell35,
    cell: (row: InspectionRecord) => (
      <div className="flex flex-wrap gap-2">
        {canDecide(row) && (
          <>
            <Button variant="outline-emerald" size="sm" disabled={busy} onClick={() => setDecision({ row, mode: "approve" })}>Approve</Button>
            <Button variant="outline-emerald" size="sm" disabled={busy} onClick={() => setPending({ row, mode: "reject" })}>Reject</Button>
          </>
        )}
        {canClose(row) && (
          <Button variant="outline-emerald" size="sm" disabled={busy} onClick={() => setPending({ row, mode: "close" })}>Close now</Button>
        )}
      </div>
    ),
  };

  const rejecting = pending?.mode === "reject";

  return (
    <BackupRestorePage
      title="Backup Inspections"
      group="Restore"
      preview={false}
      actions={
        canAsk ? (
          <Button size="sm" className="gap-2 whitespace-nowrap" onClick={() => setAsking(true)}>
            <Plus className="h-4 w-4" />
            Ask for Inspection
          </Button>
        ) : undefined
      }
    >
      <WarningBanner
        variant="info"
        title="How an inspection works"
        description="A verified backup is restored into a copy that refuses writes, for five minutes, then it is dropped. A second person approves with an e-signature. Checks run on the database only."
      />
      <ServerListPanel
        tableKey="backup-restore.inspections.v1"
        columns={columns}
        action={action}
        rows={rows}
        getRowKey={(row) => row.id}
        loading={loading}
        hasLoaded={hasLoaded}
        error={error}
        emptyTitle="No Inspections"
        emptyDescription="Inspections appear here once someone asks to look at a backup. Try changing your search or filter."
        search={search}
        onSearch={setSearch}
        searchLabel="Search inspections"
        searchPlaceholder="Inspection, backup or person…"
        filters={[{ id: "status", label: "Status", value: status, options: STATUS_OPTIONS, defaultValue: ALL, placeholder: "All", onChange: setStatus }]}
        onClear={() => {
          setSearch("");
          setStatus(ALL);
          setPage(1);
        }}
        page={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <FormModal
        isOpen={asking}
        onClose={() => setAsking(false)}
        title="Ask for an Inspection"
        description="The copy is read-only and lasts five minutes. Someone else must approve it."
        confirmText="Send request"
        confirmDisabled={!BACKUP_ID.test(askBackup.trim()) || !askReason.trim() || busy}
        onConfirm={ask}
      >
        <FormField label="Backup Number" required>
          <Input value={askBackup} placeholder="BK-20261009-1900-0001" onChange={(event) => setAskBackup(event.target.value)} />
        </FormField>
        <FormField label="Reason" required>
          <Textarea rows={3} value={askReason} maxLength={500} onChange={(event) => setAskReason(event.target.value)} />
        </FormField>
      </FormModal>

      <FormModal
        isOpen={pending?.mode === "close"}
        onClose={() => setPending(undefined)}
        title={`Close ${pending?.row.inspectionNumber ?? ""}`}
        description="The copy is dropped now. Nothing else changes; the record stays in the history."
        confirmText="Close copy"
        confirmDisabled={busy}
        onConfirm={close}
      >
        <FormField label="Reason (optional)">
          <Textarea rows={2} value={closeReason} maxLength={500} onChange={(event) => setCloseReason(event.target.value)} />
        </FormField>
      </FormModal>

      <FormModal
        isOpen={rejecting}
        onClose={() => setPending(undefined)}
        title={`Reject ${pending?.row.inspectionNumber ?? ""}`}
        description="The inspection is kept in the history as rejected. Say why, then sign to confirm."
        confirmText="Continue to sign"
        confirmDisabled={!closeReason.trim() || busy}
        onConfirm={() => {
          const row = pending?.row;
          const why = closeReason.trim();
          setPending(undefined);
          setCloseReason("");
          if (row) {
            setRejectReason(why);
            setDecision({ row, mode: "reject" });
          }
        }}
      >
        <FormField label="Reason" required>
          <Textarea rows={3} value={closeReason} maxLength={500} onChange={(event) => setCloseReason(event.target.value)} />
        </FormField>
      </FormModal>

      <ESignatureModal
        isOpen={decision?.mode === "approve"}
        onClose={() => setDecision(undefined)}
        deferConfirm
        onConfirm={signed("approve")}
        actionTitle={`Approve Inspection ${decision?.row.inspectionNumber ?? ""}`}
        meaningDisplayName="Backup Inspection Approval"
        meaningCode="BACKUP_INSPECTION_APPROVAL"
      />
      <ESignatureModal
        isOpen={decision?.mode === "reject" && rejectReason !== undefined}
        onClose={() => {
          setDecision(undefined);
          setRejectReason(undefined);
        }}
        deferConfirm
        onConfirm={signed("reject")}
        actionTitle={`Reject Inspection ${decision?.row.inspectionNumber ?? ""}`}
        meaningDisplayName="Backup Inspection Rejection"
        meaningCode="BACKUP_INSPECTION_REJECTION"
      />
    </BackupRestorePage>
  );
};
