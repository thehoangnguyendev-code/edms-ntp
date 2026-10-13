import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { HardDrive, Info } from "lucide-react";
import { IconHistory, IconPackage } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormSection } from "@/components/ui/form";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { DataTable } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast/Toast";
import { ROUTES } from "@/app/routes.constants";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { backupRestoreApi, type BackupDetail, type RestoreRequestRecord } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { DetailField } from "../components/DetailField";
import { RestoreStatusBadge } from "../components/RestoreStatusBadge";
import { RestoreDecisionDialogs, type RestoreDecision } from "../components/RestoreDecisionDialogs";
import { COMPONENT_LABEL, statusLabel } from "../types";
import { formatBytes, formatDateTime } from "../format";

const STATUS_COLOR = { PENDING_APPROVAL: "amber", APPROVED: "emerald", REJECTED: "red" } as const;
const TYPE_LABEL: Record<string, string> = { "R-FULL": "Full restore", "R-DB": "Database only", "R-OBJ": "Documents only", "R-ONE": "One record" };
const TARGET_LABEL: Record<string, string> = { VALIDATION: "Validation environment", PRODUCTION: "Production (replaces live data)" };
/** Where the request stands: requested, waiting for approval, then approved or rejected. */
const STEPS = ["Requested", "Pending Approval", "Approved", "Rejected"];
const STEP_OF: Record<string, number> = { PENDING_APPROVAL: 1, APPROVED: 2, REJECTED: 3 };
/** The other outcome is striped once the request has taken one: approved strikes Rejected, rejected strikes Approved. */
const SKIPPED_OF: Record<string, string[]> = { APPROVED: ["Rejected"], REJECTED: ["Approved"] };

/**
 * One restore request on its own screen, laid out like a backup: where it stands, what it is, what the backup contains and what the
 * restore would put back. The assigned approver reads that before signing, then approves or rejects it.
 */
export const RestoreRequestDetailView: React.FC = () => {
  const { requestId = "" } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canApprove = hasPermission("backup.restore.approve");
  const canExecute = hasPermission("backup.restore.execute");
  const me = user?.username?.toLowerCase() ?? "";

  const [request, setRequest] = useState<RestoreRequestRecord>();
  const [backup, setBackup] = useState<BackupDetail>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<RestoreDecision>();
  const [params, setParams] = useSearchParams();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await backupRestoreApi.restoreRequest(requestId);
      setRequest(next);
      backupRestoreApi.get(next.backupId).then(setBackup).catch(() => setBackup(undefined));
    } catch (e) {
      setRequest(undefined);
      setError(getApiErrorMessage(e, "Unable to open this restore request."));
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  const back = () => navigate(ROUTES.BACKUP_RESTORE.RESTORES);
  const pending = request?.status === "PENDING_APPROVAL";
  const mine = !!request && request.requestedBy.toLowerCase() === me;
  const canDecide = pending && canApprove && !mine;

  // The list's Approve and Reject items open this screen with the decision asked for; the signing happens here.
  useEffect(() => {
    const wanted = params.get("decision");
    if (!request || !wanted) return;
    if (canDecide && (wanted === "approve" || wanted === "reject")) {
      setDecision({ request, mode: wanted });
    }
    setParams({}, { replace: true });
  }, [request, canDecide, params, setParams]);
  const parent = { label: "Restore Requests", path: ROUTES.BACKUP_RESTORE.RESTORES };
  /** The page is named for what it shows: a request waiting for a decision, or any other request. */
  const screenTitle = request?.status === "PENDING_APPROVAL" ? "Pending Approval Request Restore" : "Detail Restore Request";

  const actions = request ? (
    <>
      <Button variant="outline-emerald" size="sm" onClick={back} className="whitespace-nowrap touch-manipulation">
        Back
      </Button>
      {request.status === "APPROVED" && canExecute && (
        <Button variant="outline-emerald" size="sm" onClick={() => navigate(ROUTES.BACKUP_RESTORE.RESTORE_EXECUTION(request.requestId))} className="whitespace-nowrap touch-manipulation">
          Execution Console
        </Button>
      )}
      {canDecide && (
        <>
          <Button variant="outline-emerald" size="sm" disabled={busy} onClick={() => setDecision({ request, mode: "reject" })} className="whitespace-nowrap touch-manipulation">
            Reject
          </Button>
          <Button size="sm" disabled={busy} onClick={() => setDecision({ request, mode: "approve" })} className="whitespace-nowrap touch-manipulation">
            Approve
          </Button>
        </>
      )}
    </>
  ) : undefined;

  if (error) {
    return (
      <BackupRestorePage title={screenTitle} group="Restore" parent={parent} preview={false}>
        <WarningBanner variant="error" title="Unable to open the restore request" description={error} />
        <div>
          <Button size="sm" variant="outline-emerald" onClick={back}>
            Back to Restore Requests
          </Button>
        </div>
      </BackupRestorePage>
    );
  }
  if (loading || !request) {
    return (
      <BackupRestorePage title={screenTitle} group="Restore" parent={parent} preview={false}>
        <SectionLoading minHeight="40vh" />
      </BackupRestorePage>
    );
  }

  const impact = request.impact;
  const live = impact?.liveRowsAfterBackup;

  return (
    <BackupRestorePage title={screenTitle} group="Restore" parent={parent} preview={false} actions={actions}>
      {request.status === "PENDING_APPROVAL" && !canDecide && !mine && (
        <WarningBanner variant="info" description="You can read this request, but you do not hold the approval permission." />
      )}
      {pending && (
        <WarningBanner
          variant="warning"
          title="Approval needed from a second person"
          description="The requester cannot approve their own restore. Approving does not start the restore: an administrator runs it later in a maintenance window."
        />
      )}
      {request.target === "PRODUCTION" && <WarningBanner variant="error" description="A production restore replaces live data. Only a recorded test restore and an approval allow it." />}

      <WorkflowStepper steps={STEPS} currentStepIndex={STEP_OF[request.status] ?? 0} skippedSteps={SKIPPED_OF[request.status]} />

      <FormSection title="Request Information" icon={<Info className="h-4 w-4" />}>
        <div className="grid grid-cols-1 gap-x-10 gap-y-3 lg:gap-y-4 xl:grid-cols-2">
          <div className="space-y-3 lg:space-y-4">
            <DetailField label="Request ID">
              <span className="font-medium">{request.requestId}</span>
            </DetailField>
            <DetailField label="Status">
              <RestoreStatusBadge status={request.status} />
            </DetailField>
            <DetailField label="Type">{TYPE_LABEL[request.type] ?? request.type}</DetailField>
            <DetailField label="Target">{TARGET_LABEL[request.target] ?? request.target}</DetailField>
            <DetailField label="Change control">{request.changeControlRef ?? "—"}</DetailField>
          </div>
          <div className="space-y-3 lg:space-y-4">
            <DetailField label="Requested by">{request.requestedBy}</DetailField>
            <DetailField label="Requested">{formatDateTime(request.requestedAt)}</DetailField>
            <DetailField label="Approved / rejected by">{request.approvedBy ?? "—"}</DetailField>
            <DetailField label="Decided">{formatDateTime(request.decidedAt)}</DetailField>
            <DetailField label="E-signature">{request.approvalSignatureRef ?? "—"}</DetailField>
            {request.rehearsalId && <DetailField label="Test restore">{request.rehearsalId}</DetailField>}
          </div>
        </div>
        <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 lg:space-y-4">
          <DetailField label="Reason">{request.reason}</DetailField>
          {request.decisionReason && <DetailField label="Decision reason">{request.decisionReason}</DetailField>}
        </div>
      </FormSection>

      <FormSection title="Backup to Restore" icon={<HardDrive className="h-4 w-4" />}>
        {!backup ? (
          <p className="text-xs text-slate-500 lg:text-sm">The backup details could not be read.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-x-10 gap-y-3 lg:gap-y-4 xl:grid-cols-2">
              <div className="space-y-3 lg:space-y-4">
                <DetailField label="Backup ID">
                  <span className="font-medium">{backup.id}</span>
                </DetailField>
                <DetailField label="Started">{formatDateTime(backup.startedAt)}</DetailField>
                <DetailField label="Total size">{formatBytes(backup.sizeBytes)}</DetailField>
              </div>
              <div className="space-y-3 lg:space-y-4">
                <DetailField label="Database schema">{backup.schemaVersion ? `V${backup.schemaVersion}` : "—"}</DetailField>
                <DetailField label="Integrity">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <Badge color={backup.verification === "VERIFIED" ? "emerald" : "red"}>{statusLabel(backup.verification)}</Badge>
                    {backup.verifiedAt && <span className="text-xs text-slate-500">{formatDateTime(backup.verifiedAt)}</span>}
                  </span>
                </DetailField>
                <DetailField label="Stored at">
                  {backup.locations.length > 0 ? backup.locations.map((l) => `${l.target}${l.ok ? "" : " (not confirmed)"}`).join(", ") : "—"}
                </DetailField>
              </div>
            </div>
            <DataTable
              rows={backup.components}
              getRowKey={(row) => row.key}
              columns={[
                { id: "component", header: "Component", cell: (row) => COMPONENT_LABEL[row.key] ?? row.key },
                { id: "status", header: "Result", cell: (row) => <Badge color={row.status === "COMPLETED" ? "emerald" : "red"}>{statusLabel(row.status)}</Badge> },
                { id: "size", header: "Size", cell: (row) => formatBytes(row.sizeBytes) },
              ]}
            />
          </div>
        )}
      </FormSection>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <FormSection title="What This Restore Puts Back" icon={<IconPackage className="h-4 w-4" />} description={impact ? `Measured ${formatDateTime(impact.measuredAt)} by ${impact.measuredBy}; measured again when approved.` : undefined}>
          {!impact ? (
            <p className="text-xs text-slate-500 lg:text-sm">No impact report is recorded for this request.</p>
          ) : (
            <div className="space-y-4">
              <DataTable
                rows={impact.components}
                getRowKey={(row) => row.key}
                columns={[
                  { id: "component", header: "Component", cell: (row) => COMPONENT_LABEL[row.key] ?? row.key },
                  { id: "size", header: "Size", cell: (row) => formatBytes(row.sizeBytes) },
                  { id: "objects", header: "Documents", cell: (row) => row.objectCount ?? "—" },
                  { id: "rows", header: "Rows", cell: (row) => row.rows ?? "—" },
                ]}
              />
              <div className="space-y-3 lg:space-y-4">
                <DetailField label="Rows in the backup">{impact.rowsInBackup.toLocaleString()}</DetailField>
                <DetailField label="Audit rows lost">
                  {live?.measured ? (live.auditRows ?? 0).toLocaleString() : `Not measured: ${live?.reason ?? "unknown"}`}
                </DetailField>
                <DetailField label="Copies">{impact.targets.map((t) => `${t.target}${t.ok ? "" : " (not confirmed)"}`).join(", ") || "—"}</DetailField>
              </div>
            </div>
          )}
        </FormSection>

        <FormSection title="History" icon={<IconHistory className="h-4 w-4" />}>
          {request.events && request.events.length > 0 ? (
            <ol className="space-y-2 text-xs text-slate-700 lg:text-sm">
              {request.events.map((e, i) => (
                <li key={`${e.at}-${i}`} className="flex flex-col gap-0.5 border-b border-slate-200 pb-2 last:border-b-0 sm:flex-row sm:justify-between">
                  <span className="font-medium text-slate-900">{statusLabel(e.event)}</span>
                  <span className="text-slate-500">{e.by} · {formatDateTime(e.at)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-slate-500 lg:text-sm">No steps recorded.</p>
          )}
        </FormSection>
      </div>

      <RestoreDecisionDialogs
        decision={decision}
        onClose={() => setDecision(undefined)}
        onDecided={(updated) => {
          setRequest(updated);
        }}
      />
    </BackupRestorePage>
  );
};
