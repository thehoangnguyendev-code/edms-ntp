import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, ListChecks, ShieldCheck } from "lucide-react";
import { IconServer2 } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormSection } from "@/components/ui/form";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { Select } from "@/components/ui/select/Select";
import { Switch } from "@/components/ui/switch/Switch";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { useToast } from "@/components/ui/toast/Toast";
import { ROUTES } from "@/app/routes.constants";
import { backupRestoreApi, type BackupTargetInfo, type PolicyGate, type PolicyMedium, type PolicyTarget } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupAdminLivePage } from "./BackupAdminLivePage";
import { GateTable } from "./BackupPolicyDetailView";
import { COMPONENT_LABEL, MEDIUM_LABEL, policyErrorMessage } from "./policyLabels";

interface TargetChoice {
  info: BackupTargetInfo;
  included: boolean;
  medium: PolicyMedium;
  offsite: boolean;
  immutable: boolean;
}

const FOLDER_MEDIA: PolicyMedium[] = ["SERVER_FOLDER", "NETWORK_SHARE", "REMOVABLE_MEDIA"];

const mediaFor = (info: BackupTargetInfo): PolicyMedium[] => (info.code === "T1" ? ["SERVER_FOLDER"] : info.kind === "S3" ? ["OBJECT_STORAGE"] : FOLDER_MEDIA.filter((m) => m !== "SERVER_FOLDER"));

/**
 * What the 3-2-1-1 rule says about the choices made so far. It mirrors the rule the Backup Agent applies, so a person sees the
 * outcome while choosing; the Agent decides again when the version is proposed and when it is activated.
 */
export const previewGate = (choices: TargetChoice[]): PolicyGate => {
  const picked = choices.filter((c) => c.included);
  const media = new Set(picked.map((c) => c.medium));
  const offsite = picked.filter((c) => c.offsite).map((c) => c.info.code);
  const immutable = picked.filter((c) => c.immutable).map((c) => c.info.code);
  const unlocked = picked.filter((c) => c.immutable && !c.info.immutable).map((c) => c.info.code);
  const copies = 1 + picked.length;
  const conditions = [
    { code: "COPIES", ok: copies >= 3, relaxed: false, pending: false, detail: `${copies} copies of the data (the live system plus ${picked.length} target(s)); at least 3 are required` },
    { code: "MEDIA", ok: media.size >= 2, relaxed: false, pending: false, detail: `${media.size} kind(s) of medium; at least 2 are required` },
    { code: "OFFSITE", ok: offsite.length > 0, relaxed: false, pending: false, detail: offsite.length ? `Declared off-site: ${offsite.join(", ")}` : "No target is declared off-site; at least 1 is required" },
    { code: "IMMUTABLE", ok: immutable.length > 0, relaxed: false, pending: false, detail: immutable.length ? `Declared immutable: ${immutable.join(", ")}` : "No target is declared immutable; at least 1 is required" },
    {
      code: "IMMUTABLE_CONFIGURED",
      ok: unlocked.length === 0,
      relaxed: false,
      pending: false,
      detail: unlocked.length ? `Declared immutable but not configured as immutable on the Backup Agent: ${unlocked.join(", ")}` : "Every target declared immutable is configured as immutable",
    },
    { code: "TARGETS_WORK", ok: false, relaxed: false, pending: true, detail: "Every target is written, read back and, if immutable, asked to refuse a delete when the policy is activated" },
  ];
  return { passed: conditions.every((c) => c.ok || c.pending), enforced: true, conditions };
};

/** Propose a new policy version. Nothing changes until another person approves it with an electronic signature. */
export const NewBackupPolicyView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [choices, setChoices] = useState<TargetChoice[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [documents, setDocuments] = useState(true);
  const [dbEnabled, setDbEnabled] = useState(true);
  const [time, setTime] = useState("02:00");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

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
        setChoices(
          targets.map((info) => {
            const existing = current.find((t) => t.code === info.code);
            return {
              info,
              included: info.code === "T1" || !!existing,
              medium: existing?.medium ?? mediaFor(info)[0],
              offsite: existing?.offsite ?? false,
              immutable: existing?.immutable ?? false,
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
  const gate = useMemo(() => (choices ? previewGate(choices) : null), [choices]);
  const timeOk = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  const parent = { label: "Backup Policy", path: ROUTES.SETTINGS.BACKUP_ADMINISTRATION.POLICY };

  const submit = async () => {
    if (!choices) return;
    setSaving(true);
    try {
      const created = await backupRestoreApi.proposePolicy({
        scope: { components: documents ? ["DATABASE", "OBJECT_STORE"] : ["DATABASE"] },
        schedule: { database: { enabled: dbEnabled, frequency: "DAILY", time, type: "FULL" } },
        retention: { mode: "PERMANENT" },
        targets: {
          targets: choices
            .filter((c) => c.included)
            .map((c) => ({ code: c.info.code, medium: c.medium, offsite: c.offsite, immutable: c.immutable })),
        },
        reason: reason.trim(),
      });
      showToast({ type: "success", title: "Policy version proposed", message: `Version ${created.version} is waiting for approval by another person.` });
      navigate(ROUTES.SETTINGS.BACKUP_ADMINISTRATION.POLICY_DETAIL(created.version));
    } catch (e) {
      showToast({ type: "error", title: "The version was not proposed", message: policyErrorMessage(e, "The request was refused.") });
    } finally {
      setSaving(false);
    }
  };

  const actions = (
    <>
      <Button variant="outline-emerald" size="sm" onClick={() => navigate(parent.path)} className="whitespace-nowrap touch-manipulation">
        Cancel
      </Button>
      <Button size="sm" disabled={saving || !choices || !reason.trim() || !timeOk} onClick={() => void submit()} className="whitespace-nowrap touch-manipulation">
        {saving ? "Proposing…" : "Propose Version"}
      </Button>
    </>
  );

  if (loadError) {
    return (
      <BackupAdminLivePage title="Propose Policy Change" parent={parent}>
        <WarningBanner variant="error" title="Unable to prepare the form" description={loadError} />
      </BackupAdminLivePage>
    );
  }
  if (!choices || !gate) {
    return (
      <BackupAdminLivePage title="Propose Policy Change" parent={parent}>
        <SectionLoading minHeight="40vh" />
      </BackupAdminLivePage>
    );
  }

  return (
    <BackupAdminLivePage title="Propose Policy Change" parent={parent} actions={actions}>
      <WarningBanner variant="info" description="Proposing creates a draft only. The running policy does not change until another person approves the draft with an electronic signature." />

      <FormSection title="What Is Backed Up" icon={<ListChecks className="h-4 w-4" />}>
        <div className="divide-y divide-slate-100 -my-2">
          <div className="flex items-center justify-between gap-3 py-2.5">
            <div>
              <span className="text-xs font-medium text-slate-900 sm:text-sm">{COMPONENT_LABEL.DATABASE}</span>
              <Badge color="slate" className="ml-2">Required</Badge>
            </div>
            <Switch checked size="sm" disabled onChange={() => undefined} />
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <div>
              <span className="text-xs font-medium text-slate-900 sm:text-sm">{COMPONENT_LABEL.OBJECT_STORE}</span>
              <p className="mt-0.5 text-2xs text-slate-400 sm:text-xs">Every stored version of every document is copied once, encrypted.</p>
            </div>
            <Switch checked={documents} size="sm" onChange={setDocuments} />
          </div>
        </div>
      </FormSection>

      <FormSection title="Schedule and Retention" icon={<CalendarClock className="h-4 w-4" />}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField label="Database backup">
            <div className="flex h-9 items-center gap-3">
              <Switch checked={dbEnabled} size="sm" onChange={setDbEnabled} />
              <span className="text-xs text-slate-600 sm:text-sm">{dbEnabled ? "Daily" : "Switched off"}</span>
            </div>
          </FormField>
          <FormField label="Time of day" required>
            <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} disabled={!dbEnabled} />
          </FormField>
          <FormField label="Kept">
            <div className="flex h-9 items-center text-xs text-slate-700 sm:text-sm">Permanently (fixed by decision BR-2)</div>
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Backup Targets" icon={<IconServer2 className="h-4 w-4" />} description="T1 is where every backup is written first. Declare which of the others are in another location or cannot be changed.">
        <div className="divide-y divide-slate-100">
          {choices.map((c) => {
            const media = mediaFor(c.info);
            return (
              <div key={c.info.code} className="grid grid-cols-1 gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[1fr_14rem_7rem_7rem] md:items-center">
                <div className="flex items-start gap-3">
                  <Switch checked={c.included} size="sm" disabled={c.info.code === "T1"} onChange={(included) => change(c.info.code, { included })} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-900 sm:text-sm">{c.info.code}</p>
                    <p className="break-all font-mono text-2xs text-slate-400 sm:text-xs">{c.info.location}</p>
                    {c.info.immutable && <Badge color="slate" className="mt-1">Configured as immutable</Badge>}
                  </div>
                </div>
                <Select
                  value={c.medium}
                  onChange={(medium) => change(c.info.code, { medium: medium as PolicyMedium })}
                  options={media.map((m) => ({ label: MEDIUM_LABEL[m], value: m }))}
                  disabled={!c.included || media.length === 1}
                />
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <Switch checked={c.offsite} size="sm" disabled={!c.included || c.info.code === "T1"} onChange={(offsite) => change(c.info.code, { offsite })} />
                  Off-site
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <Switch checked={c.immutable} size="sm" disabled={!c.included || c.info.code === "T1"} onChange={(immutable) => change(c.info.code, { immutable })} />
                  Immutable
                </label>
              </div>
            );
          })}
        </div>
      </FormSection>

      <FormSection title="3-2-1-1 Rule" icon={<ShieldCheck className="h-4 w-4" />} description="What the choices above would give. The Backup Agent decides when the version is proposed and again when it is activated.">
        <GateTable gate={gate} />
      </FormSection>

      <FormSection title="Reason for Change">
        <FormField label="Reason" required>
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
        </FormField>
      </FormSection>

      <div className="flex items-center gap-3">{actions}</div>
    </BackupAdminLivePage>
  );
};
