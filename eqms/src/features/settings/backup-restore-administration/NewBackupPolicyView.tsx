import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { useFormDirty } from "@/hooks/useFormDirty";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, FileText, ListChecks, ShieldCheck, Warehouse } from "lucide-react";
import { IconCopy, IconServer2 } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormSection } from "@/components/ui/form";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { TimePicker } from "@/components/ui/datetime-picker/TimePicker";
import { Select } from "@/components/ui/select/Select";
import { Switch } from "@/components/ui/switch/Switch";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { useToast } from "@/components/ui/toast/Toast";
import { ROUTES } from "@/app/routes.constants";
import { backupRestoreApi, readPolicyBody, type BackupTargetInfo, type ManualCopy, type PolicyGate, type PolicyMedium, type PolicyTarget } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupAdminLivePage } from "./BackupAdminLivePage";
import { GateTable } from "./BackupPolicyDetailView";
import { COMPONENT_LABEL, MEDIUM_LABEL, policyErrorMessage } from "./policyLabels";
import { tr, trFormat } from "@/i18n";

interface TargetChoice {
  info: BackupTargetInfo;
  included: boolean;
  medium: PolicyMedium;
  offsite: boolean;
}

const FOLDER_MEDIA: PolicyMedium[] = ["SERVER_FOLDER", "NETWORK_SHARE", "REMOVABLE_MEDIA"];

const mediaFor = (info: BackupTargetInfo): PolicyMedium[] => (info.code === "T1" ? ["SERVER_FOLDER"] : info.kind === "S3" ? ["OBJECT_STORAGE"] : FOLDER_MEDIA.filter((m) => m !== "SERVER_FOLDER"));

/**
 * What the 3-2-1-1 rule says about the choices made so far. It mirrors the rule the Backup Agent applies, so a person sees the
 * outcome while choosing; the Agent decides again when the version is proposed and when it is activated.
 */
export const previewGate = (choices: TargetChoice[], manual: boolean = false): PolicyGate => {
  const picked = choices.filter((c) => c.included);
  const media = new Set<string>(picked.map((c) => c.medium));
  if (manual) media.add("MANUAL_COPY");
  const offsite = picked.filter((c) => c.offsite).map((c) => c.info.code);
  const copies = 1 + picked.length + (manual ? 1 : 0);
  const conditions = [
    { code: "COPIES", ok: copies >= 3, relaxed: false, pending: false, detail: `${copies} copies of the data (the live system plus ${picked.length} target(s)${manual ? " plus the manual copy" : ""}); at least 3 are required` },
    { code: "MEDIA", ok: media.size >= 2, relaxed: false, pending: false, detail: `${media.size} kind(s) of medium; at least 2 are required` },
    { code: "OFFSITE", ok: offsite.length > 0 || manual, relaxed: false, pending: false, detail: offsite.length > 0 || manual ? `Declared off-site: ${[...offsite, ...(manual ? ["the manual copy"] : [])].join(", ")}` : "No target is declared off-site; at least 1 is required" },
    { code: "IMMUTABLE", ok: manual, relaxed: false, pending: false, detail: manual ? "Held out of the server's reach: the manual copy" : tr("No manual offline copy is declared; at least 1 copy out of the server's reach is required") },
    { code: "TARGETS_WORK", ok: false, relaxed: false, pending: true, detail: "Every target is written and read back when the policy is activated" },
  ];
  return { passed: conditions.every((c) => c.ok || c.pending), enforced: true, conditions };
};

/** A bordered box with a small uppercase title, the same grouping as the Document Properties screen. */
const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="min-w-0 space-y-3 rounded-lg border border-slate-200 p-3.5">
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
    {children}
  </div>
);

/** A switch with its title and a short note, in its own bordered row. */
const ScopeRow: React.FC<{ title: string; note: string; checked: boolean; disabled?: boolean; onChange?: (checked: boolean) => void }> = ({ title, note, checked, disabled, onChange }) => (
  <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-3.5">
    <div className="min-w-0">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
    <Switch checked={checked} disabled={disabled} aria-label={title} onChange={onChange ?? (() => undefined)} />
  </div>
);

/** Propose a new policy version. Nothing changes until an administrator activates it with an electronic signature. */
export const NewBackupPolicyView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [choices, setChoices] = useState<TargetChoice[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [documents, setDocuments] = useState(true);
  const [dbEnabled, setDbEnabled] = useState(true);
  const [time, setTime] = useState("02:00");
  /** The files at a time of their own, or (off) in the same run as the database. */
  const [filesOwn, setFilesOwn] = useState(false);
  const [filesTime, setFilesTime] = useState("03:00");
  const [reason, setReason] = useState("");
  const [manual, setManual] = useState<ManualCopy>({ declared: false, description: "", everyDays: 7 });
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Leaving with a change that was not saved asks first (Cancel, the sidebar, a reload); the move after the version is proposed is not a leave.
  const { isDirty } = useFormDirty({ choices, documents, dbEnabled, time, filesOwn, filesTime, reason, manual }, choices !== null);
  const { go, modal: leaveModal } = useLeaveGuard(isDirty, "Propose Policy Change", "the policy page");

  useEffect(() => {
    let live = true;
    Promise.all([backupRestoreApi.targets(), backupRestoreApi.policies({ status: "ACTIVE", limit: 1 })])
      .then(([targets, active]) => {
        if (!live) return;
        const current: PolicyTarget[] = (() => {
          try {
            return JSON.parse(active.data[0]?.targets ?? "{}").targets ?? [];
          } catch {
            return [];
          }
        })();
        const currentManual = active.data[0] ? readPolicyBody(active.data[0]).manualCopy : null;
        if (currentManual) setManual(currentManual);
        if (active.data[0]) {
          const current = readPolicyBody(active.data[0]);
          if (current.time) setTime(current.time);
          setDbEnabled(current.enabled);
          if (current.filesTime) {
            setFilesOwn(true);
            setFilesTime(current.filesTime);
          }
        }
        setChoices(
          targets.map((info) => {
            const existing = current.find((t) => t.code === info.code);
            return {
              info,
              included: info.code === "T1" || !!existing,
              medium: existing?.medium ?? mediaFor(info)[0],
              offsite: existing?.offsite ?? false,
            };
          }),
        );
      })
      .catch((e) => live && setLoadError(getApiErrorMessage(e, "The backup targets could not be read.")));
    return () => {
      live = false;
    };
  }, []);

  const change = (code: string, patch: Partial<TargetChoice>) => setChoices((prev) => prev?.map((c) => (c.info.code === code ? { ...c, ...patch } : c)) ?? prev);
  const gate = useMemo(() => (choices ? previewGate(choices, manual.declared) : null), [choices, manual.declared]);
  const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
  const ownSchedule = documents && filesOwn;
  const timeOk = clock.test(time) && (!ownSchedule || clock.test(filesTime));
  const manualOk = !manual.declared || (manual.description.trim().length > 0 && Number.isInteger(manual.everyDays) && manual.everyDays >= 1 && manual.everyDays <= 365);
  const parent = { label: tr("Backup Policy"), path: ROUTES.SETTINGS.BACKUP_ADMINISTRATION.POLICY };

  const submit = async () => {
    if (!choices) return;
    setConfirming(false);
    setSaving(true);
    try {
      const created = await backupRestoreApi.proposePolicy({
        scope: { components: documents ? ["DATABASE", "OBJECT_STORE"] : ["DATABASE"] },
        schedule: {
          database: { enabled: dbEnabled, frequency: "DAILY", time, type: "FULL" },
          ...(ownSchedule ? { files: { enabled: true, frequency: "DAILY" as const, time: filesTime, type: "FULL" as const } } : {}),
        },
        retention: { mode: "PERMANENT" },
        targets: {
          targets: choices
            .filter((c) => c.included)
            .map((c) => ({ code: c.info.code, medium: c.medium, offsite: c.offsite, immutable: false })),
          ...(manual.declared ? { manualCopy: { declared: true, description: manual.description.trim(), everyDays: manual.everyDays } } : {}),
        },
        reason: reason.trim(),
      });
      showToast({ type: "success", title: tr("Policy version proposed"), message: `Version ${created.version} is a draft. Activate it with your electronic signature.` });
      navigate(ROUTES.SETTINGS.BACKUP_ADMINISTRATION.POLICY_DETAIL(created.version));
    } catch (e) {
      showToast({ type: "error", title: tr("The version was not proposed"), message: policyErrorMessage(e, "The request was refused.") });
    } finally {
      setSaving(false);
    }
  };

  const actions = (
    <>
      <Button variant="outline-emerald" size="sm" onClick={() => go(parent.path)} className="whitespace-nowrap touch-manipulation">
        {tr("Cancel")}
      </Button>
      <Button variant="outline-emerald" size="sm" disabled={saving || !choices || !reason.trim() || !timeOk || !manualOk} onClick={() => setConfirming(true)} className="whitespace-nowrap touch-manipulation">
        {saving ? "Proposing…" : tr("Propose Version")}
      </Button>
    </>
  );

  if (loadError) {
    return (
      <BackupAdminLivePage title={tr("Propose Policy Change")} parent={parent}>
        <WarningBanner variant="error" title={tr("Unable to prepare the form.")} description={loadError} />
      </BackupAdminLivePage>
    );
  }
  if (!choices || !gate) {
    return (
      <BackupAdminLivePage title={tr("Propose Policy Change")} parent={parent}>
        <SectionLoading minHeight="40vh" />
      </BackupAdminLivePage>
    );
  }

  const included = choices.filter((c) => c.included).length;
  const failing = gate.conditions.filter((c) => !c.ok && !c.pending).length;

  return (
    <BackupAdminLivePage title={tr("Propose Policy Change")} parent={parent} actions={actions}>
      <WarningBanner variant="info" description={tr("Proposing creates a draft only. The running policy does not change until the draft is activated with an electronic signature.")} />

      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
        <FormSection title={tr("What Is Backed Up")} icon={<ListChecks className="h-4 w-4" />} description={tr("The data each backup copies.")}>
          <div className="space-y-3">
            <ScopeRow title={COMPONENT_LABEL.DATABASE} note={tr("Required: every backup contains the database, with everything stored in it: settings, users, audit trail, and the images, videos and large objects kept in database columns.")} checked disabled />
            <ScopeRow
              title={COMPONENT_LABEL.OBJECT_STORE}
              note={tr("Every stored version of every file in the three document buckets (documents, revisions, templates, controlled copies, executed records, reports, training files, and the pictures inside documents) is copied once, encrypted.")}
              checked={documents}
              onChange={setDocuments}
            />
          </div>
        </FormSection>

        <FormSection title={tr("Schedule")} icon={<CalendarClock className="h-4 w-4" />} description={tr("When the database and the files are backed up. Backups are kept permanently.")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Group title={tr("Database backup")}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-700">{dbEnabled ? "Daily" : tr("Switched off")}</span>
                <Switch checked={dbEnabled} size="sm" aria-label={tr("Database backup")} onChange={setDbEnabled} />
              </div>
            </Group>
            <Group title={tr("Time of day")}>
              <TimePicker value={time} onChange={setTime} disabled={!dbEnabled} />
              <p className="text-xs text-slate-500">{tr("Used when the database backup is switched on.")}</p>
            </Group>
            <Group title={tr("Files backup")}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-700">{!documents ? "Not part of the policy" : filesOwn ? tr("At its own time") : tr("With the database")}</span>
                <Switch checked={ownSchedule} size="sm" disabled={!documents} aria-label={tr("Files at their own time")} onChange={setFilesOwn} />
              </div>
              <p className="text-xs text-slate-500">{tr("Off: the files are copied in the same run as the database. On: the database and the files are backed up in two separate runs.")}</p>
            </Group>
            <Group title={tr("Files time of day")}>
              <TimePicker value={filesTime} onChange={setFilesTime} disabled={!ownSchedule} />
              <p className="text-xs text-slate-500">{tr("Used when the files have their own time.")}</p>
            </Group>
          </div>
        </FormSection>
      </div>

      <FormSection
        title={tr("Backup Targets")}
        icon={<IconServer2 className="h-4 w-4" />}
        description={tr("T1 is where every backup is written first. Declare which of the others are in another location.")}
        headerRight={<Badge color="slate" size="sm">{trFormat("{included} of {total} used", { included, total: choices.length })}</Badge>}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {choices.map((c) => {
            const media = mediaFor(c.info);
            const locked = !c.included || c.info.code === "T1";
            return (
              <div key={c.info.code} className="min-w-0 space-y-3 rounded-lg border border-slate-200 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{c.info.code}</p>
                    <p className="break-all font-mono text-xs text-slate-500">{c.info.location}</p>
                  </div>
                  <Switch
                    checked={c.included}
                    size="sm"
                    disabled={c.info.code === "T1"}
                    aria-label={`Use ${c.info.code}`}
                    onChange={(included) => change(c.info.code, { included })}
                  />
                </div>
                <Select
                  label={tr("Medium")}
                  value={c.medium}
                  onChange={(medium) => change(c.info.code, { medium: medium as PolicyMedium })}
                  options={media.map((m) => ({ label: MEDIUM_LABEL[m], value: m }))}
                  disabled={!c.included || media.length === 1}
                />
                <div className="flex items-center justify-between gap-3 text-sm text-slate-700">
                  <span>{tr("Off-site")}</span>
                  <Switch checked={c.offsite} size="sm" disabled={locked} aria-label={`${c.info.code} off-site`} onChange={(offsite) => change(c.info.code, { offsite })} />
                </div>
              </div>
            );
          })}
        </div>
      </FormSection>

      <FormSection
        title={tr("Manual Copy")}
        icon={<IconCopy className="h-4 w-4" />}
        description={tr("A copy you make yourself and keep away from the server, for example on a disk in a safe. The Backup Agent cannot see it, so it is declared here and never tested.")}
        headerRight={<Switch checked={manual.declared} size="sm" aria-label={tr("Use a manual copy")} onChange={(declared) => setManual((m) => ({ ...m, declared }))} />}
      >
        {manual.declared ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label={tr("Where it is kept and who makes it")} required>
              <Input value={manual.description} maxLength={500} onChange={(event) => setManual((m) => ({ ...m, description: event.target.value }))} placeholder={tr("For example: USB disk in the quality safe, copied by the quality manager")} />
            </FormField>
            <FormField label={tr("Made every (days)")} required hint={tr("From 1 to 365.")}>
              <Input type="number" min={1} max={365} value={String(manual.everyDays)} onChange={(event) => setManual((m) => ({ ...m, everyDays: Number(event.target.value) }))} />
            </FormField>
          </div>
        ) : (
          <p className="text-sm text-slate-600">{tr("No manual copy is declared.")}</p>
        )}
      </FormSection>

      <FormSection
        title={tr("3-2-1-1 Rule")}
        icon={<Warehouse className="h-4 w-4" />}
        description={tr("What the choices above would give. The Backup Agent decides when the version is proposed and again when it is activated.")}
        headerRight={<Badge color={failing > 0 ? "red" : "emerald"} size="sm">{failing > 0 ? `${failing} not met` : "No condition failing"}</Badge>}
      >
        <GateTable gate={gate} />
      </FormSection>

      <FormSection title={tr("Reason for Change")} icon={<FileText className="h-4 w-4" />} description={tr("Recorded with the proposal, with your name and the time.")}>
        <FormField label={tr("Reason")} required>
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={tr("Why is this change needed?")} />
        </FormField>
      </FormSection>

      <AlertModal
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={submit}
        type="confirm"
        title={tr("Propose This Policy Version?")}
        description={
          <p className="text-sm text-slate-600">
            {tr("The version is saved as a draft and waits to be activated with an electronic signature. The running policy does not change. This action will be recorded in the Audit Trail.")}
          </p>
        }
        confirmText={tr("Propose Version")}
        cancelText="Cancel"
        isLoading={saving}
      />
      {leaveModal}
    </BackupAdminLivePage>
  );
};
