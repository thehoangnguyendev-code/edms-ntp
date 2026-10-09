import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Info, ListChecks, ShieldCheck } from "lucide-react";
import { IconServer2 } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormSection } from "@/components/ui/form";
import { FormField, Textarea } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { DataTable } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast/Toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import { formatDateTime } from "@/features/backup-restore/format";
import { statusLabel } from "@/features/backup-restore/types";
import {
  backupRestoreApi,
  readPolicyBody,
  readPolicyGate,
  type PolicyGate,
  type PolicyGateCondition,
  type PolicyVersion,
} from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupAdminLivePage } from "./BackupAdminLivePage";
import { COMPONENT_LABEL, GATE_LABEL, MEDIUM_LABEL, POLICY_STATUS_COLOR, policyErrorMessage } from "./policyLabels";

/** One label and its value, laid out like the other detail screens. */
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1.5 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0 lg:flex-row lg:items-center lg:gap-2 lg:pb-4 last:lg:pb-0">
    <label className="w-full flex-shrink-0 text-xs font-medium text-slate-700 sm:text-sm lg:w-40">{label}</label>
    <div className="min-w-0 flex-1 break-words text-xs text-slate-900 lg:text-sm">{children}</div>
  </div>
);

const conditionState = (c: PolicyGateCondition) => {
  if (c.ok) return { label: "Met", color: "emerald" as const };
  if (c.pending) return { label: "Checked on activation", color: "slate" as const };
  if (c.relaxed) return { label: "Not enforced here", color: "amber" as const };
  return { label: "Not met", color: "red" as const };
};

/** The 3-2-1-1 rule, condition by condition, with what each one means in plain words. */
export const GateTable: React.FC<{ gate: PolicyGate }> = ({ gate }) => (
  <DataTable
    rows={gate.conditions}
    getRowKey={(row) => row.code}
    columns={[
      { id: "rule", header: "Condition", cell: (row) => <span className="font-medium">{GATE_LABEL[row.code]?.title ?? row.code}</span> },
      { id: "state", header: "Result", cell: (row) => <Badge color={conditionState(row).color}>{conditionState(row).label}</Badge> },
      { id: "detail", header: "Detail", cell: (row) => <span className="text-slate-600">{row.detail}</span> },
    ]}
  />
);

/** One policy version on its own screen: what it says, who proposed and approved it, and whether it meets the 3-2-1-1 rule. */
export const BackupPolicyDetailView: React.FC = () => {
  const { version: versionParam = "" } = useParams();
  const version = Number(versionParam);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canApprove = hasPermission("backup.admin.policy.approve");
  const canPropose = hasPermission("backup.admin.policy.propose");

  const [policy, setPolicy] = useState<PolicyVersion>();
  const [gate, setGate] = useState<PolicyGate | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [signing, setSigning] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardReason, setDiscardReason] = useState("");
  const [busy, setBusy] = useState(false);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let live = true;
    setError("");
    backupRestoreApi
      .policy(version)
      .then(async (data) => {
        if (!live) return;
        setPolicy(data);
        // a draft shows the rule as it stands now; a policy that was activated shows the result recorded at activation
        const stored = readPolicyGate(data);
        if (stored) setGate(stored);
        else if (data.status === "DRAFT") setGate(await backupRestoreApi.policyGate(version).catch(() => null));
        else setGate(null);
      })
      .catch((e) => live && setError(getApiErrorMessage(e, "The policy version could not be read.")));
    return () => {
      live = false;
    };
  }, [version, reloadKey]);

  const parent = { label: "Backup Policy", path: ROUTES.SETTINGS.BACKUP_ADMINISTRATION.POLICY };
  const back = () => navigate(ROUTES.SETTINGS.BACKUP_ADMINISTRATION.POLICY);

  if (error) {
    return (
      <BackupAdminLivePage title="Policy Version" parent={parent}>
        <WarningBanner variant="error" title="Unable to open the policy version" description={error} />
        <div>
          <Button size="sm" variant="outline-emerald" onClick={back}>
            Back to Backup Policy
          </Button>
        </div>
      </BackupAdminLivePage>
    );
  }
  if (!policy) {
    return (
      <BackupAdminLivePage title="Policy Version" parent={parent}>
        <SectionLoading minHeight="40vh" />
      </BackupAdminLivePage>
    );
  }

  const body = readPolicyBody(policy);
  const draft = policy.status === "DRAFT";
  const mine = !!user?.username && user.username.toLowerCase() === (policy.proposedBy ?? "").toLowerCase();
  const gateBlocks = !!gate && !gate.passed;

  const activate = async (data: { signatureToken?: string }) => {
    setSigning(false);
    setBusy(true);
    try {
      if (!data.signatureToken) throw new Error("The electronic signature could not be confirmed.");
      await backupRestoreApi.activatePolicy(version, data.signatureToken);
      showToast({ type: "success", title: "Policy activated", message: `Version ${version} is now the running policy.` });
      reload();
    } catch (e) {
      showToast({ type: "error", title: "The policy was not activated", message: policyErrorMessage(e, "The request was refused.") });
      reload();
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    setBusy(true);
    try {
      await backupRestoreApi.discardPolicy(version, discardReason.trim());
      setDiscarding(false);
      setDiscardReason("");
      showToast({ type: "success", title: "Draft discarded", message: `Version ${version} was discarded.` });
      reload();
    } catch (e) {
      showToast({ type: "error", title: "The draft was not discarded", message: policyErrorMessage(e, "The request was refused.") });
    } finally {
      setBusy(false);
    }
  };

  const actions = (
    <>
      <Button variant="outline-emerald" size="sm" onClick={back} className="whitespace-nowrap touch-manipulation">
        Back
      </Button>
      {draft && canPropose && (
        <Button variant="outline-emerald" size="sm" disabled={busy} onClick={() => setDiscarding(true)} className="whitespace-nowrap touch-manipulation">
          Discard Draft
        </Button>
      )}
      {draft && canApprove && (
        <Button size="sm" disabled={busy || mine} onClick={() => setSigning(true)} className="whitespace-nowrap touch-manipulation">
          Approve and Activate
        </Button>
      )}
    </>
  );

  return (
    <BackupAdminLivePage title={`Policy Version ${policy.version}`} parent={parent} actions={actions}>
      {draft && mine && (
        <WarningBanner variant="info" title="Waiting for another person" description="You proposed this version, so someone else with the approval permission has to activate it." />
      )}
      {draft && gateBlocks && (
        <WarningBanner variant="warning" title="This version does not meet the 3-2-1-1 rule yet" description="It cannot be activated until every condition below is met. Propose a corrected version instead." />
      )}
      {policy.status === "DISCARDED" && (
        <WarningBanner variant="info" title="This draft was discarded" description={`${policy.discardedBy ?? "Someone"} discarded it: ${policy.discardReason ?? "no reason recorded"}.`} />
      )}

      <FormSection title="Policy Information" icon={<Info className="h-4 w-4" />}>
        <div className="grid grid-cols-1 gap-x-10 gap-y-3 lg:gap-y-4 xl:grid-cols-2">
          <div className="space-y-3 lg:space-y-4">
            <Field label="Version">
              <span className="font-medium">{policy.version}</span>
            </Field>
            <Field label="Status">
              <Badge color={POLICY_STATUS_COLOR[policy.status]}>{statusLabel(policy.status)}</Badge>
            </Field>
            <Field label="Reason">{policy.reason || "—"}</Field>
          </div>
          <div className="space-y-3 lg:space-y-4">
            <Field label="Proposed by">{policy.proposedBy ?? "System (installed with the Backup Agent)"}</Field>
            <Field label="Proposed">{formatDateTime(policy.createdAt)}</Field>
            <Field label="Approved by">{policy.approvedBy ?? "—"}</Field>
            <Field label="Activated">{formatDateTime(policy.activatedAt)}</Field>
            {policy.signatureRef && (
              <Field label="E-signature">
                <span className="font-mono text-xs">{policy.signatureRef}</span>
              </Field>
            )}
          </div>
        </div>
      </FormSection>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <FormSection title="What Is Backed Up" icon={<ListChecks className="h-4 w-4" />}>
          <div className="space-y-3 lg:space-y-4">
            <Field label="Components">{body.components.map((c) => COMPONENT_LABEL[c] ?? c).join(", ") || "—"}</Field>
            <Field label="Database backup">{body.enabled ? `Daily at ${body.time}` : "Switched off"}</Field>
            <Field label="Kept">Permanently. Backups are never deleted by age.</Field>
          </div>
        </FormSection>

        <FormSection title="Backup Targets" icon={<IconServer2 className="h-4 w-4" />}>
          <DataTable
            rows={body.targets}
            getRowKey={(row) => row.code}
            columns={[
              { id: "code", header: "Target", cell: (row) => <span className="font-medium">{row.code}</span> },
              { id: "medium", header: "Medium", cell: (row) => MEDIUM_LABEL[row.medium] ?? row.medium },
              { id: "offsite", header: "Off-site", cell: (row) => (row.offsite ? <Badge color="emerald">Yes</Badge> : "No") },
              { id: "immutable", header: "Immutable", cell: (row) => (row.immutable ? <Badge color="emerald">Yes</Badge> : "No") },
            ]}
          />
        </FormSection>
      </div>

      {gate && (
        <FormSection
          title="3-2-1-1 Rule"
          icon={<ShieldCheck className="h-4 w-4" />}
          description={draft ? "As it stands now. The targets are also tested when the policy is activated." : "The result recorded when this version was activated."}
        >
          {!gate.enforced && (
            <p className="mb-3 text-xs text-slate-500">This is a development environment, where everything runs on one machine, so the off-site condition is shown but does not block.</p>
          )}
          <GateTable gate={gate} />
        </FormSection>
      )}

      <div className="flex items-center gap-3">{actions}</div>

      <ESignatureModal
        isOpen={signing}
        onClose={() => setSigning(false)}
        onConfirm={activate}
        actionTitle={`Activate Backup Policy Version ${policy.version}`}
        meaningDisplayName="Backup Policy Change"
        meaningCode="BACKUP_POLICY_CHANGE"
      />
      <FormModal
        isOpen={discarding}
        onClose={() => setDiscarding(false)}
        title={`Discard Version ${policy.version}`}
        description="The draft is kept in the history as discarded. Say why it is being discarded."
        confirmText="Discard"
        confirmDisabled={!discardReason.trim() || busy}
        onConfirm={() => void discard()}
      >
        <FormField label="Reason" required>
          <Textarea rows={3} value={discardReason} onChange={(event) => setDiscardReason(event.target.value)} />
        </FormField>
      </FormModal>
    </BackupAdminLivePage>
  );
};
