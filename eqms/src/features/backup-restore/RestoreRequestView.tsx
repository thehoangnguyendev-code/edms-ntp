import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FormSection } from "@/components/ui/form/FormSection";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { useToast } from "@/components/ui/toast/Toast";
import { ROUTES } from "@/app/routes.constants";
import { BackupRestorePage } from "./components/BackupRestorePage";
import { SAMPLE_BACKUPS, SAMPLE_OVERVIEW } from "./sampleData";
import {
  BACKUP_STATUS_COLOR,
  COMPONENT_HINT,
  COMPONENT_LABEL,
  VERIFICATION_COLOR,
  statusLabel,
  type BackupComponentKey,
  type RestoreKind,
  type RestoreTarget,
} from "./types";
import { formatBytes, formatDateTime } from "./format";

const STEPS = ["Select Backup", "Scope & Target", "Pre-checks", "Review & Submit"];
const ALL_COMPONENTS = Object.keys(COMPONENT_LABEL) as BackupComponentKey[];
type Severity = "ok" | "warning" | "blocking";
interface Check {
  label: string;
  detail: string;
  severity: Severity;
}
const SEVERITY_BADGE = { ok: ["emerald", "Pass"], warning: ["amber", "Warning"], blocking: ["red", "Blocks restore"] } as const;

const ChoiceCard: React.FC<{ active: boolean; title: string; text: string; danger?: boolean; onClick: () => void }> = ({ active, title, text, danger, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-xl border p-4 text-left transition-colors ${
      active ? (danger ? "border-red-400 bg-red-50" : "border-emerald-500 bg-emerald-50") : "border-slate-200 bg-white hover:bg-slate-50"
    }`}
  >
    <p className="text-sm font-semibold text-slate-900">{title}</p>
    <p className="mt-1 text-xs text-slate-600">{text}</p>
  </button>
);

export const RestoreRequestView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [params] = useSearchParams();
  const restorable = useMemo(() => SAMPLE_BACKUPS.filter((b) => b.status === "COMPLETED"), []);
  const initial = restorable.find((b) => b.id === params.get("backup"))?.id ?? "";

  const [step, setStep] = useState(0);
  const [backupId, setBackupId] = useState(initial);
  const [kind, setKind] = useState<RestoreKind>("RESTORE");
  const [components, setComponents] = useState<BackupComponentKey[]>(["DATABASE", "OBJECT_STORE"]);
  const [restoreTarget, setRestoreTarget] = useState<RestoreTarget>("VALIDATION_ENV");
  const [reason, setReason] = useState("");
  const [changeRef, setChangeRef] = useState("");
  const [incidentRef, setIncidentRef] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const disaster = kind === "DISASTER_RECOVERY";
  const target: RestoreTarget = disaster ? "REBUILT_ENVIRONMENT" : restoreTarget;
  const production = target === "PRODUCTION";
  const replacesData = production || disaster;
  const selected = disaster ? ALL_COMPONENTS : components;
  const backup = restorable.find((b) => b.id === backupId);

  const checks = useMemo<Check[]>(() => {
    if (!backup) return [];
    const list: Check[] = [
      {
        label: "Backup integrity",
        detail: backup.verification === "VERIFIED" ? `Checksums verified ${formatDateTime(backup.verifiedAt)}.` : "This backup has not been verified.",
        severity: backup.verification === "VERIFIED" ? "ok" : replacesData ? "blocking" : "warning",
      },
      {
        label: "Database schema version",
        detail:
          backup.schemaVersion === SAMPLE_OVERVIEW.currentSchemaVersion
            ? `Backup and application are both at ${backup.schemaVersion}.`
            : `Backup is at ${backup.schemaVersion}, the application at ${SAMPLE_OVERVIEW.currentSchemaVersion}. Migrations run forward after the restore.`,
        severity: backup.schemaVersion === SAMPLE_OVERVIEW.currentSchemaVersion ? "ok" : "warning",
      },
      {
        label: "Records and files restored together",
        detail:
          selected.includes("DATABASE") === selected.includes("OBJECT_STORE")
            ? "Database and document files come from the same backup."
            : "Only one of database and document files is selected; records and files may disagree. Reconciliation runs afterwards.",
        severity: selected.includes("DATABASE") === selected.includes("OBJECT_STORE") ? "ok" : "warning",
      },
    ];
    if (production) {
      list.push({
        label: "Change control reference",
        detail: changeRef.trim() ? `Linked to ${changeRef.trim()}.` : "A production restore must reference an approved change.",
        severity: changeRef.trim() ? "ok" : "blocking",
      });
    }
    if (disaster) {
      list.push({
        label: "Disaster declaration",
        detail: incidentRef.trim() ? `Linked to ${incidentRef.trim()}.` : "A disaster recovery must reference the declared incident.",
        severity: incidentRef.trim() ? "ok" : "blocking",
      });
    }
    return list;
  }, [backup, selected, replacesData, production, disaster, changeRef, incidentRef]);

  const consequences = useMemo(() => {
    if (!backup) return [];
    if (!replacesData) {
      return ["Nothing in the live system changes. The data is restored into the validation environment, whose document storage has no retention lock."];
    }
    return [
      `All records in the database are replaced by the backup. Anything saved after ${formatDateTime(backup.startedAt)} is not in the restored system; it stays only in the safety backup taken just before.`,
      "Document files cannot be overwritten or deleted (retention lock). Missing files are added; files newer than the backup stay in storage, unreferenced, and are listed in the verification report.",
      "Every user is signed out. Scheduled and queued jobs stay paused until reconciliation is finished; jobs that were unfinished at backup time are flagged for review, so nothing is sent or issued twice.",
      "The event is recorded in the audit trail and in a log held outside the database, because the database audit trail itself is replaced.",
    ];
  }, [backup, replacesData]);

  const blocked = checks.some((c) => c.severity === "blocking");
  const canNext =
    (step === 0 && !!backup) ||
    (step === 1 && selected.length > 0 && reason.trim().length > 0) ||
    (step === 2 && !blocked) ||
    step === 3;

  const back = () => navigate(ROUTES.BACKUP_RESTORE.RESTORES);
  const toggle = (key: BackupComponentKey, checked: boolean) =>
    setComponents((prev) => (checked ? [...prev, key] : prev.filter((item) => item !== key)));

  return (
    <BackupRestorePage
      title="New Restore Request"
      group="Restore"
      parent={{ label: "Restore Requests", path: ROUTES.BACKUP_RESTORE.RESTORES }}
      actions={
        <Button variant="outline" size="sm" onClick={back}>
          Cancel
        </Button>
      }
    >
      <WorkflowStepper steps={STEPS} currentStepIndex={step} />

      {step === 0 && (
        <FormSection title="Select a backup" description="Only completed backups can be restored.">
          <div className="space-y-2">
            {restorable.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBackupId(b.id)}
                className={`flex w-full flex-col gap-1 rounded-xl border p-4 text-left transition-colors sm:flex-row sm:items-center sm:justify-between ${
                  b.id === backupId ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <span>
                  <span className="text-sm font-semibold text-slate-900">{b.id}</span>
                  <span className="block text-xs text-slate-500">
                    {formatDateTime(b.startedAt)} · {statusLabel(b.type)} · {formatBytes(b.sizeBytes)} · schema {b.schemaVersion}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Badge color={BACKUP_STATUS_COLOR[b.status]}>{statusLabel(b.status)}</Badge>
                  <Badge color={VERIFICATION_COLOR[b.verification]}>{statusLabel(b.verification)}</Badge>
                </span>
              </button>
            ))}
          </div>
        </FormSection>
      )}

      {step === 1 && (
        <>
          <FormSection title="Type of request">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <ChoiceCard
                active={!disaster}
                title="Restore"
                text="Recover data on the existing system, or practise in the validation environment."
                onClick={() => setKind("RESTORE")}
              />
              <ChoiceCard
                active={disaster}
                danger
                title="Disaster recovery"
                text="The system is lost. Everything is restored onto a rebuilt environment from the off-site copy."
                onClick={() => setKind("DISASTER_RECOVERY")}
              />
            </div>
          </FormSection>
          {!disaster && (
            <FormSection title="Restore into">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <ChoiceCard
                  active={restoreTarget === "VALIDATION_ENV"}
                  title="Validation environment"
                  text="A separate copy. Live data is not touched. Use it for drills and to inspect old data."
                  onClick={() => setRestoreTarget("VALIDATION_ENV")}
                />
                <ChoiceCard
                  active={production}
                  danger
                  title="Production"
                  text="Replaces live data. Needs an approved change, a second approver and a maintenance window."
                  onClick={() => setRestoreTarget("PRODUCTION")}
                />
              </div>
            </FormSection>
          )}
          <FormSection title="What to restore" description={disaster ? "A disaster recovery always restores every component." : undefined}>
            <div className="space-y-3">
              {ALL_COMPONENTS.map((key) => (
                <div key={key}>
                  <Checkbox label={COMPONENT_LABEL[key]} checked={selected.includes(key)} disabled={disaster} onChange={(checked) => toggle(key, checked)} />
                  <p className="ml-7 text-xs text-slate-500">{COMPONENT_HINT[key]}</p>
                </div>
              ))}
            </div>
          </FormSection>
          <FormSection title="Justification">
            <div className="space-y-4">
              <FormField label="Reason" required>
                <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this restore needed?" />
              </FormField>
              {production && (
                <FormField label="Change control reference" required hint="For example CC-2026-0142">
                  <Input value={changeRef} onChange={(event) => setChangeRef(event.target.value)} />
                </FormField>
              )}
              {disaster && (
                <FormField label="Disaster declaration reference" required hint="The incident record in which the disaster was declared, for example INC-2026-0007">
                  <Input value={incidentRef} onChange={(event) => setIncidentRef(event.target.value)} />
                </FormField>
              )}
            </div>
          </FormSection>
        </>
      )}

      {step === 2 && (
        <>
          <FormSection title="What will happen">
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
              {consequences.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </FormSection>
          <FormSection title="Pre-checks" description="A blocking check must be resolved before the request can be submitted.">
            <ul className="divide-y divide-slate-100">
              {checks.map((check) => {
                const [color, text] = SEVERITY_BADGE[check.severity];
                return (
                  <li key={check.label} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{check.label}</p>
                      <p className="text-xs text-slate-500">{check.detail}</p>
                    </div>
                    <Badge color={color}>{text}</Badge>
                  </li>
                );
              })}
            </ul>
            {blocked && <WarningBanner className="mt-4" variant="error" description="Go back and resolve the blocking check, or choose the validation environment." />}
          </FormSection>
        </>
      )}

      {step === 3 && backup && (
        <FormSection title="Review">
          <dl className="divide-y divide-slate-100 text-sm">
            {[
              ["Type", disaster ? "Disaster recovery" : "Restore"],
              ["Backup", `${backup.id} · ${formatDateTime(backup.startedAt)}`],
              ["Target", disaster ? "Rebuilt environment" : production ? "Production — replaces live data" : "Validation environment"],
              ["Restore", selected.map((key) => COMPONENT_LABEL[key]).join(", ")],
              ["Reason", reason.trim()],
              ...(production ? [["Change control", changeRef.trim()]] : []),
              ...(disaster ? [["Disaster declaration", incidentRef.trim()]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0 sm:flex-row sm:gap-4">
                <dt className="w-40 shrink-0 text-xs font-medium uppercase tracking-wider text-slate-500">{label}</dt>
                <dd className="text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 space-y-3">
            <WarningBanner
              variant={replacesData ? "error" : "info"}
              description={
                replacesData
                  ? "Submitting asks a second person to approve. Nothing is restored until they approve with an e-signature and the restore is run in a maintenance window."
                  : "Submitting asks a second person to approve. The restore runs into the validation environment only."
              }
            />
            <Checkbox label="I understand what this restore will replace." checked={confirmed} onChange={setConfirmed} />
          </div>
        </FormSection>
      )}

      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={() => (step === 0 ? back() : setStep(step - 1))}>
          {step === 0 ? "Cancel" : "Back"}
        </Button>
        {step < 3 ? (
          <Button disabled={!canNext} onClick={() => setStep(step + 1)}>
            Next
          </Button>
        ) : (
          <Button
            disabled={!confirmed || blocked}
            onClick={() => {
              showToast({ type: "info", title: "Submit for approval", message: "Design preview: nothing was sent to a server." });
              back();
            }}
          >
            Submit for Approval
          </Button>
        )}
      </div>
    </BackupRestorePage>
  );
};
