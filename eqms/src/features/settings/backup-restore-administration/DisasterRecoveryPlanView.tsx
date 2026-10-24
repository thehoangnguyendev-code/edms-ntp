import React, { useEffect, useState } from "react";
import { CircleStar, Package, Siren } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormSection } from "@/components/ui/form/FormSection";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { DataTable } from "@/components/ui/table";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate, nowForPicker, pickerToInstant } from "@/features/backup-restore/format";
import { Select } from "@/components/ui/select/Select";
import { backupRestoreApi, type DrKitItemRecord, type DrScenarioRecord } from "@/services/api/backupRestore";
import { metadataApi, type MetadataUserLookup } from "@/services/api/metadata";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupAdminPage } from "./BackupAdminPage";

type TargetEdit = { scenario: DrScenarioRecord; rpo: string; rto: string; reason: string; step: "form" | "sign" };
type VerifyEdit = { item: DrKitItemRecord; date: string; note: string };
type AuthorityEdit = { username: string; reason: string; step: "form" | "sign" };

/**
 * The Disaster Recovery Plan (SDS 15.2). Each recovery target and the person who may declare a disaster change only after the
 * electronic signature. A rebuild-kit item shows the last time a person checked it; a check is recorded by hand, with its date.
 */
export const DisasterRecoveryPlanView: React.FC = () => {
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("backup.admin.disaster_recovery.manage");
  const [scenarios, setScenarios] = useState<DrScenarioRecord[]>();
  const [kit, setKit] = useState<DrKitItemRecord[]>();
  const [authority, setAuthority] = useState<string>();
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [target, setTarget] = useState<TargetEdit>();
  const [verify, setVerify] = useState<VerifyEdit>();
  const [declare, setDeclare] = useState<AuthorityEdit>();
  const [busy, setBusy] = useState(false);
  const [people, setPeople] = useState<MetadataUserLookup[]>();

  /** Opens the change dialog; the people offered are the active accounts, read from the server when the dialog opens. */
  const openDeclare = () => {
    setDeclare({ username: authority ?? "", reason: "", step: "form" });
    if (people) return;
    metadataApi
      .getUsersLookup()
      .then((list) => setPeople(list.filter((person) => !!person.username)))
      .catch((e) => {
        setPeople([]);
        showToast({ type: "error", title: "The people could not be listed", message: getApiErrorMessage(e, "Try again.") });
      });
  };

  useEffect(() => {
    let live = true;
    Promise.all([backupRestoreApi.drScenarios(), backupRestoreApi.drKit(), backupRestoreApi.drAuthority()])
      .then(([s, k, a]) => {
        if (!live) return;
        setScenarios(s);
        setKit(k);
        setAuthority(a.value);
        setError("");
      })
      .catch((e) => {
        if (live) setError(getApiErrorMessage(e, "The disaster recovery plan could not be loaded."));
      });
    return () => {
      live = false;
    };
  }, [reloadKey]);

  const missing = (kit ?? []).filter((item) => item.state !== "VERIFIED");

  const signedTarget = async (data: { signatureToken?: string }) => {
    const current = target;
    setTarget(undefined);
    if (!current) return;
    if (!data.signatureToken) return showToast({ type: "error", title: "The signature could not be confirmed", message: "Try again." });
    setBusy(true);
    try {
      await backupRestoreApi.changeDrTargets(current.scenario.code, Number(current.rpo), Number(current.rto), current.reason.trim(), data.signatureToken);
      showToast({ type: "success", title: "Targets approved", message: current.scenario.label });
      setReloadKey((k) => k + 1);
    } catch (e) {
      showToast({ type: "error", title: "The targets were not changed", message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setBusy(false);
    }
  };

  const saveVerify = async () => {
    if (!verify) return;
    setBusy(true);
    try {
      await backupRestoreApi.verifyDrKitItem(verify.item.code, pickerToInstant(verify.date), verify.note.trim());
      showToast({ type: "success", title: "Check recorded", message: verify.item.label });
      setVerify(undefined);
      setReloadKey((k) => k + 1);
    } catch (e) {
      showToast({ type: "error", title: "The check was not recorded", message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setBusy(false);
    }
  };

  const signedAuthority = async (data: { signatureToken?: string }) => {
    const current = declare;
    setDeclare(undefined);
    if (!current) return;
    if (!data.signatureToken) return showToast({ type: "error", title: "The signature could not be confirmed", message: "Try again." });
    setBusy(true);
    try {
      const updated = await backupRestoreApi.changeDrAuthority(current.username.trim(), current.reason.trim(), data.signatureToken);
      setAuthority(updated.value);
      showToast({ type: "success", title: "Declaration authority approved", message: updated.value });
    } catch (e) {
      showToast({ type: "error", title: "The authority was not changed", message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <BackupAdminPage title="Disaster Recovery Plan" readOnly>
      {error && <WarningBanner variant="error" title="Unable to load" description={error} />}
      {missing.length > 0 && (
        <WarningBanner
          variant="warning"
          title="The rebuild kit is not verified"
          description={`${missing.length} item(s) have never been checked by a person. Without a check a rebuild cannot be relied on.`}
        />
      )}

      <FormSection
        title="Recovery Targets"
        icon={<Siren className="h-4 w-4" />}
        description="RPO is the most data, in hours, that may be lost; RTO is the longest time, in hours, to be working again. A change needs an electronic signature."
      >
        <DataTable
          rows={scenarios ?? []}
          getRowKey={(row) => row.code}
          columns={[
            {
              id: "scenario",
              header: "Scenario",
              cell: (row) => (
                <div className="max-w-96 whitespace-normal">
                  <span className="font-medium text-slate-900">{row.label}</span>
                  <span className="block text-xs text-slate-500">{row.description}</span>
                </div>
              ),
            },
            { id: "rpo", header: "RPO (hours)", cell: (row) => row.rpoHours },
            { id: "rto", header: "RTO (hours)", cell: (row) => row.rtoHours },
            {
              id: "status",
              header: "Status",
              cell: (row) => (row.status === "APPROVED" ? <Badge color="emerald">Approved by {row.approvedBy}</Badge> : <Badge color="amber">Proposed</Badge>),
            },
            {
              id: "change",
              header: "",
              cell: (row) =>
                canManage ? (
                  <Button variant="outline-emerald" size="sm" disabled={busy} onClick={() => setTarget({ scenario: row, rpo: String(row.rpoHours), rto: String(row.rtoHours), reason: "", step: "form" })}>
                    Change
                  </Button>
                ) : null,
            },
          ]}
        />
      </FormSection>

      <FormSection title="Rebuild Kit" icon={<Package className="h-4 w-4" />} description="Everything needed to rebuild the system on empty hardware. Each item is verified by a person, with the date of the check.">
        <DataTable
          rows={kit ?? []}
          getRowKey={(row) => row.code}
          columns={[
            {
              id: "item",
              header: "Item",
              cell: (row) => (
                <div className="max-w-96 whitespace-normal">
                  <span className="font-medium text-slate-900">{row.label}</span>
                  <span className="block text-xs text-slate-500">{row.detail}</span>
                </div>
              ),
            },
            { id: "state", header: "State", cell: (row) => <Badge color={row.state === "VERIFIED" ? "emerald" : "amber"}>{row.state === "VERIFIED" ? "Verified" : "Not verified"}</Badge> },
            { id: "verified", header: "Last verified", cell: (row) => (row.lastVerifiedAt ? `${formatDate(row.lastVerifiedAt)} by ${row.lastVerifiedBy}` : "—") },
            {
              id: "check",
              header: "",
              cell: (row) =>
                canManage ? (
                  <Button variant="outline-emerald" size="sm" disabled={busy} onClick={() => setVerify({ item: row, date: nowForPicker(), note: "" })}>
                    Record check
                  </Button>
                ) : null,
            },
          ]}
        />
      </FormSection>

      <FormSection title="Declaration" icon={<CircleStar className="h-4 w-4" />}>
        <div className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <span className="text-xs sm:text-sm font-medium text-slate-900">Who may declare a disaster</span>
            <p className="text-2xs sm:text-xs text-slate-400 mt-0.5">A declaration opens the incident record every recovery request must reference. Changing this needs an electronic signature.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-900">{authority ?? "—"}</span>
            {canManage && (
              <Button variant="default" size="sm" disabled={busy} onClick={openDeclare}>
                Change
              </Button>
            )}
          </div>
        </div>
      </FormSection>

      <FormModal
        isOpen={target?.step === "form"}
        onClose={() => setTarget(undefined)}
        title={`Change Targets: ${target?.scenario.label ?? ""}`}
        description="The new targets take effect only after the electronic signature."
        confirmText="Continue to sign"
        confirmDisabled={!target || !target.reason.trim() || !(Number(target.rpo) > 0) || !(Number(target.rto) > 0)}
        onConfirm={() => target && setTarget({ ...target, step: "sign" })}
      >
        <div className="space-y-4">
          <FormField label="RPO (hours)" required hint="The most data, in hours, that may be lost.">
            <Input type="number" min={0} step="0.5" value={target?.rpo ?? ""} onChange={(e) => target && setTarget({ ...target, rpo: e.target.value })} />
          </FormField>
          <FormField label="RTO (hours)" required hint="The longest time, in hours, to be working again.">
            <Input type="number" min={0} step="0.5" value={target?.rto ?? ""} onChange={(e) => target && setTarget({ ...target, rto: e.target.value })} />
          </FormField>
          <FormField label="Reason" required hint="Recorded with the change, with your name and the time.">
            <Textarea rows={3} maxLength={500} value={target?.reason ?? ""} onChange={(e) => target && setTarget({ ...target, reason: e.target.value })} />
          </FormField>
        </div>
      </FormModal>
      <ESignatureModal
        isOpen={target?.step === "sign"}
        onClose={() => setTarget(undefined)}
        deferConfirm
        onConfirm={signedTarget}
        actionTitle={`Approve Targets for ${target?.scenario.label ?? ""}`}
        meaningDisplayName="Disaster Recovery Target Change"
        meaningCode="BACKUP_DR_TARGET_CHANGE"
      />

      <FormModal
        isOpen={!!verify}
        onClose={() => setVerify(undefined)}
        title={`Record Check: ${verify?.item.label ?? ""}`}
        description="Record the check a person has made. The date is the date of the check."
        confirmText="Record check"
        confirmDisabled={!verify || busy}
        onConfirm={saveVerify}
      >
        <div className="space-y-4">
          <DateTimePicker
            label={
              <>
                Date of the check <span className="text-red-500">*</span>
              </>
            }
            value={verify?.date ?? ""}
            onChange={(value) => verify && setVerify({ ...verify, date: value })}
            showTime
            placeholder="Select date and time"
          />
          <FormField label="Note" hint="Optional. What was checked and what was found.">
            <Textarea rows={3} maxLength={1000} value={verify?.note ?? ""} onChange={(e) => verify && setVerify({ ...verify, note: e.target.value })} />
          </FormField>
        </div>
      </FormModal>

      <FormModal
        isOpen={declare?.step === "form"}
        onClose={() => setDeclare(undefined)}
        title="Change Who May Declare a Disaster"
        description="The person must be an active account. The change takes effect after the electronic signature."
        confirmText="Continue to sign"
        confirmDisabled={!declare || !declare.username.trim() || !declare.reason.trim()}
        onConfirm={() => declare && setDeclare({ ...declare, step: "sign" })}
      >
        <div className="space-y-4">
          <FormField label="Person" required hint="Only active accounts are listed.">
            <Select
              value={declare?.username ?? ""}
              onChange={(value) => declare && setDeclare({ ...declare, username: String(value) })}
              options={(people ?? []).map((person) => ({ label: `${person.fullName} (${person.username})`, value: person.username ?? "" }))}
              placeholder={people ? "Choose an active person" : "Loading…"}
              disabled={!people}
            />
          </FormField>
          <FormField label="Reason" required hint="Recorded with the change, with your name and the time.">
            <Textarea rows={3} maxLength={500} value={declare?.reason ?? ""} onChange={(e) => declare && setDeclare({ ...declare, reason: e.target.value })} />
          </FormField>
        </div>
      </FormModal>
      <ESignatureModal
        isOpen={declare?.step === "sign"}
        onClose={() => setDeclare(undefined)}
        deferConfirm
        onConfirm={signedAuthority}
        actionTitle={`Change the Declaration Authority to ${declare?.username ?? ""}`}
        meaningDisplayName="Disaster Declaration Authority Change"
        meaningCode="BACKUP_DR_AUTHORITY_CHANGE"
      />
    </BackupAdminPage>
  );
};
