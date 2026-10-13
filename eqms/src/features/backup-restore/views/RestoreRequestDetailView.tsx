import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button/Button";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { ROUTES } from "@/app/routes.constants";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { backupRestoreApi, type BackupDetail, type RestoreRequestRecord } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { RestoreDecisionDialogs, type RestoreDecision } from "../components/RestoreDecisionDialogs";
import { AuditTrailTab, BackupToRestoreTab, ImpactTab, RequestInformationTab } from "./restore-request-detail/tabs";

const STEPS = ["Requested", "Pending Approval", "Approved", "Rejected"];
const STEP_OF: Record<string, number> = { PENDING_APPROVAL: 1, APPROVED: 2, REJECTED: 3 };
/** The other outcome is striped once the request has taken one: approved strikes Rejected, rejected strikes Approved. */
const SKIPPED_OF: Record<string, string[]> = { APPROVED: ["Rejected"], REJECTED: ["Approved"] };
/** The tabs of one request, as in the document detail screen: the stepper stays above them. */
type RequestTab = "request" | "backup" | "impact" | "audit";
const TABS: { id: RequestTab; label: string }[] = [
  { id: "request", label: "Request Information" },
  { id: "backup", label: "Backup to Restore" },
  { id: "impact", label: "What This Restore Puts Back" },
  { id: "audit", label: "Audit Trail" },
];

/**
 * One restore request on its own screen, laid out like a backup: where it stands, what it is, what the backup contains and what the
 * restore would put back. The assigned approver reads that before signing, then approves or rejects it.
 */
export const RestoreRequestDetailView: React.FC = () => {
  const { requestId: restoreNumber = "" } = useParams();
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
  const [tab, setTab] = useState<RequestTab>("request");
  const [params, setParams] = useSearchParams();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await backupRestoreApi.restoreRequest(restoreNumber);
      setRequest(next);
      backupRestoreApi.get(next.backupNumber).then(setBackup).catch(() => setBackup(undefined));
    } catch (e) {
      setRequest(undefined);
      setError(getApiErrorMessage(e, "Unable to open this restore request."));
    } finally {
      setLoading(false);
    }
  }, [restoreNumber]);

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
        <Button variant="outline-emerald" size="sm" onClick={() => navigate(ROUTES.BACKUP_RESTORE.RESTORE_EXECUTION(request.restoreNumber))} className="whitespace-nowrap touch-manipulation">
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav tabs={TABS} activeTab={tab} onChange={(id) => setTab(id as RequestTab)} layoutId="restore-request-tab" />
        <div className="p-4 md:p-5">
          {tab === "request" && <RequestInformationTab request={request} />}
          {tab === "backup" && <BackupToRestoreTab backup={backup} />}
          {tab === "impact" && <ImpactTab request={request} />}
          {tab === "audit" && <AuditTrailTab request={request} />}
        </div>
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
