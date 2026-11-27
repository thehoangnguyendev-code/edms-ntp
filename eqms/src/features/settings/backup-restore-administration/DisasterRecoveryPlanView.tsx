import { tr as __ariaTr } from "@/i18n";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CircleStar, Gauge, Package, Siren } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormSection } from "@/components/ui/form/FormSection";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { DataTable } from "@/components/ui/table";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate, formatDateTime, nowForPicker, pickerToInstant } from "@/features/backup-restore/format";
import { DrDeclarationsList } from "./DisasterRecoveryLists";
import { Select } from "@/components/ui/select/Select";
import {
  backupRestoreApi,
  type DrDeclarationRecord,
  type DrKitItemRecord,
  type DrReadinessRecord,
  type DrScenarioRecord,
} from "@/services/api/backupRestore";
import { metadataApi, type MetadataUserLookup } from "@/services/api/metadata";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupAdminLivePage } from "./BackupAdminLivePage";
import { tr, trFormat } from "@/i18n";

type TargetEdit = { scenario: DrScenarioRecord; rpo: string; rto: string; reason: string; step: "form" | "sign" };
type VerifyEdit = { item: DrKitItemRecord; date: string; note: string };
type AuthorityEdit = { username: string; reason: string; step: "form" | "sign" };
type DeclareEdit = { scenario: string; reason: string; step: "form" | "sign" };
type CloseEdit = { declaration: DrDeclarationRecord; summary: string; step: "form" | "sign" };

const TABS: TabItem[] = [
  { id: "plan", label: "Plan" },
  { id: "declarations", get label() { return tr("Declarations"); } },
];

const hours = (value: number | null) => (value === null ? "—" : `${value} h`);

/** A restore that took seconds is shown in seconds, not as 0 hours. */
const duration = (seconds: number | null | undefined) =>
  seconds === null || seconds === undefined ? "—" : seconds < 90 ? `${seconds} s` : seconds < 5400 ? `${Math.round(seconds / 60)} min` : `${Math.round(seconds / 360) / 10} h`;

/**
 * The Disaster Recovery Plan (SDS 15.2). The recovery targets, the person who may declare a disaster, and a declaration and its closing each
 * change only after an electronic signature. A rebuild-kit item shows the last time a person checked it. The plan also shows each target
 * next to what the records show now. Every change is recorded in the Audit Trail.
 */
export const DisasterRecoveryPlanView: React.FC = () => {
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("backup.admin.disaster_recovery.manage");
  const [searchParams, setSearchParams] = useSearchParams();
  const active = TABS.find((tab) => tab.id === searchParams.get("tab"))?.id ?? "plan";

  const [scenarios, setScenarios] = useState<DrScenarioRecord[]>();
  const [kit, setKit] = useState<DrKitItemRecord[]>();
  const [authority, setAuthority] = useState<string>();
  const [readiness, setReadiness] = useState<DrReadinessRecord[]>([]);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [target, setTarget] = useState<TargetEdit>();
  const [verify, setVerify] = useState<VerifyEdit>();
  const [declareAuthority, setDeclareAuthority] = useState<AuthorityEdit>();
  const [busy, setBusy] = useState(false);
  const [people, setPeople] = useState<MetadataUserLookup[]>();

  const [open, setOpen] = useState<DrDeclarationRecord>();
  const [declare, setDeclare] = useState<DeclareEdit>();
  const [close, setClose] = useState<CloseEdit>();

  /** Opens the change dialog; the people offered are the active accounts, read from the server when the dialog opens. */
  const openAuthority = () => {
    setDeclareAuthority({ username: authority ?? "", reason: "", step: "form" });
    if (people) return;
    metadataApi
      .getUsersLookup()
      .then((list) => setPeople(list.filter((person) => !!person.username)))
      .catch((e) => {
        setPeople([]);
        showToast({ type: "error", title: tr("The people could not be listed"), message: getApiErrorMessage(e, "Try again.") });
      });
  };

  useEffect(() => {
    let live = true;
    Promise.all([backupRestoreApi.drScenarios(), backupRestoreApi.drKit(), backupRestoreApi.drAuthority(), backupRestoreApi.drReadiness()])
      .then(([s, k, a, r]) => {
        if (!live) return;
        setScenarios(s);
        setKit(k);
        setAuthority(a.value);
        setReadiness(r);
        setError("");
      })
      .catch((e) => {
        if (live) setError(getApiErrorMessage(e, "The disaster recovery plan could not be loaded."));
      });
    return () => {
      live = false;
    };
  }, [reloadKey]);

  // The declaration that is open decides the banner and which button is offered; the list itself is read by its own tab.
  useEffect(() => {
    let live = true;
    backupRestoreApi
      .drDeclarations({ status: "OPEN", page: 1, limit: 1 })
      .then((data) => live && setOpen(data.data[0]))
      .catch(() => live && setOpen(undefined));
    return () => {
      live = false;
    };
  }, [reloadKey]);

  const notVerified = (kit ?? []).filter((item) => item.state === "NOT_VERIFIED");
  const overdue = (kit ?? []).filter((item) => item.state === "OVERDUE");
  const readinessOf = (code: string) => readiness.find((r) => r.scenario === code);

  const signatureMissing = () => showToast({ type: "error", title: tr("The signature could not be confirmed"), message: "Try again." });

  const signedTarget = async (data: { signatureToken?: string }) => {
    const current = target;
    setTarget(undefined);
    if (!current) return;
    if (!data.signatureToken) return signatureMissing();
    setBusy(true);
    try {
      await backupRestoreApi.changeDrTargets(current.scenario.code, Number(current.rpo), Number(current.rto), current.reason.trim(), data.signatureToken);
      showToast({ type: "success", title: tr("Targets approved"), message: current.scenario.label });
      setReloadKey((k) => k + 1);
    } catch (e) {
      showToast({ type: "error", title: tr("The targets were not changed"), message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setBusy(false);
    }
  };

  const saveVerify = async () => {
    if (!verify) return;
    setBusy(true);
    try {
      await backupRestoreApi.verifyDrKitItem(verify.item.code, pickerToInstant(verify.date), verify.note.trim());
      showToast({ type: "success", title: tr("Check recorded"), message: verify.item.label });
      setVerify(undefined);
      setReloadKey((k) => k + 1);
    } catch (e) {
      showToast({ type: "error", title: tr("The check was not recorded"), message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setBusy(false);
    }
  };

  const signedAuthority = async (data: { signatureToken?: string }) => {
    const current = declareAuthority;
    setDeclareAuthority(undefined);
    if (!current) return;
    if (!data.signatureToken) return signatureMissing();
    setBusy(true);
    try {
      const updated = await backupRestoreApi.changeDrAuthority(current.username.trim(), current.reason.trim(), data.signatureToken);
      setAuthority(updated.value);
      showToast({ type: "success", title: tr("Declaration authority approved"), message: updated.value });
      setReloadKey((k) => k + 1);
    } catch (e) {
      showToast({ type: "error", title: tr("The authority was not changed"), message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setBusy(false);
    }
  };

  const signedDeclare = async (data: { signatureToken?: string }) => {
    const current = declare;
    setDeclare(undefined);
    if (!current) return;
    if (!data.signatureToken) return signatureMissing();
    setBusy(true);
    try {
      const made = await backupRestoreApi.declareDisaster(current.scenario, current.reason.trim(), data.signatureToken);
      showToast({ type: "success", title: tr("Disaster declared"), message: made.code });
      setReloadKey((k) => k + 1);
    } catch (e) {
      showToast({ type: "error", title: tr("The disaster was not declared"), message: getApiErrorMessage(e, "Only the declaration authority may declare a disaster.") });
    } finally {
      setBusy(false);
    }
  };

  const signedClose = async (data: { signatureToken?: string }) => {
    const current = close;
    setClose(undefined);
    if (!current) return;
    if (!data.signatureToken) return signatureMissing();
    setBusy(true);
    try {
      await backupRestoreApi.closeDeclaration(current.declaration.code, current.summary.trim(), data.signatureToken);
      showToast({ type: "success", title: tr("Declaration closed"), message: current.declaration.code });
      setReloadKey((k) => k + 1);
    } catch (e) {
      showToast({ type: "error", title: tr("The declaration was not closed"), message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setBusy(false);
    }
  };

  const stateBadge = (state: string) =>
    state === "WITHIN" ? <Badge color="emerald">{tr("Within the target")}</Badge> : state === "EXCEEDED" ? <Badge color="red">{tr("Over the target")}</Badge> : <Badge color="amber">{state === "NOT_TESTED" ? tr("Not tested") : tr("No data")}</Badge>;

  const plan = (
    <div className="space-y-6">
      {error && <WarningBanner variant="error" title={tr("Unable to load")} description={error} />}
      {open && <WarningBanner variant="error" title={trFormat("A disaster is declared: {code}", { code: open.code })} description={trFormat("{scenario}, declared by {by} on {when}. It stays open until it is closed with a summary and a signature.", { scenario: tr(open.scenarioLabel), by: open.declaredBy, when: formatDateTime(open.declaredAt) })} />}
      {notVerified.length > 0 && (
        <WarningBanner variant="warning" title={tr("The rebuild kit is not verified")} description={trFormat("{count} item(s) have never been checked by a person. Without a check a rebuild cannot be relied on.", { count: notVerified.length })} />
      )}
      {overdue.length > 0 && (
        <WarningBanner variant="warning" title={tr("Rebuild kit checks are overdue")} description={trFormat("{count} item(s) were last checked longer ago than the review period of the alert rule.", { count: overdue.length })} />
      )}

      <FormSection
        title={tr("Recovery Targets")}
        icon={<Siren className="h-4 w-4" />}
        description={tr("RPO is the most data, in hours, that may be lost; RTO is the longest time, in hours, to be working again. A change needs an electronic signature.")}
      >
        <DataTable
          rows={scenarios ?? []}
          getRowKey={(row) => row.code}
          columns={[
            {
              id: "scenario",
              header: tr("Scenario"),
              cell: (row) => (
                <div className="max-w-96 whitespace-normal">
                  <span className="font-medium text-slate-900">{tr(row.label)}</span>
                  <span className="block text-xs text-slate-500">{tr(row.description)}</span>
                </div>
              ),
            },
            { id: "rpo", header: tr("RPO (hours)"), cell: (row) => row.rpoHours },
            { id: "rto", header: tr("RTO (hours)"), cell: (row) => row.rtoHours },
            { id: "status", header: "Status", cell: (row) => (row.status === "APPROVED" ? <Badge color="emerald">{tr("Approved by")} {row.approvedBy}</Badge> : <Badge color="amber">{tr("Proposed")}</Badge>) },
            {
              id: "change",
              header: "",
              cell: (row) =>
                canManage ? (
                  <Button variant="outline-emerald" size="sm" disabled={busy} onClick={() => setTarget({ scenario: row, rpo: String(row.rpoHours), rto: String(row.rtoHours), reason: "", step: "form" })}>
                    {tr("Change")}
                  </Button>
                ) : null,
            },
          ]}
        />
      </FormSection>

      <FormSection
        title={tr("Targets Against The Records")}
        icon={<Gauge className="h-4 w-4" />}
        description={tr("What the records show now, next to each target. The age of the data is how old the newest backup that passed its integrity check is; for a site loss or ransomware, the newest one that also reached T2. The recovery time is how long the newest passed test restore took.")}
      >
        <DataTable
          rows={scenarios ?? []}
          getRowKey={(row) => row.code}
          columns={[
            { id: "scenario", header: tr("Scenario"), cell: (row) => tr(row.label) },
            { id: "age", header: tr("Age of the data"), cell: (row) => hours(readinessOf(row.code)?.dataAgeHours ?? null) },
            { id: "rpoNow", header: tr("Against RPO"), cell: (row) => stateBadge(readinessOf(row.code)?.rpoState ?? "NO_DATA") },
            { id: "tested", header: tr("Tested restore time"), cell: (row) => duration(readinessOf(row.code)?.testedRestoreSeconds) },
            { id: "rtoNow", header: tr("Against RTO"), cell: (row) => stateBadge(readinessOf(row.code)?.rtoState ?? "NOT_TESTED") },
          ]}
        />
      </FormSection>

      <FormSection title={tr("Rebuild Kit")} icon={<Package className="h-4 w-4" />} description={tr("Everything needed to rebuild the system on empty hardware. Each item is verified by a person, with the date of the check.")}>
        <DataTable
          rows={kit ?? []}
          getRowKey={(row) => row.code}
          columns={[
            {
              id: "item",
              header: tr("Item"),
              cell: (row) => (
                <div className="max-w-96 whitespace-normal">
                  <span className="font-medium text-slate-900">{tr(row.label)}</span>
                  <span className="block text-xs text-slate-500">{tr(row.detail)}</span>
                </div>
              ),
            },
            {
              id: "state",
              header: tr("State"),
              cell: (row) => <Badge color={row.state === "VERIFIED" ? "emerald" : "amber"}>{row.state === "VERIFIED" ? tr("Verified") : row.state === "OVERDUE" ? tr("Check overdue") : tr("Not verified")}</Badge>,
            },
            { id: "verified", header: tr("Last verified"), cell: (row) => (row.lastVerifiedAt ? `${formatDate(row.lastVerifiedAt)} by ${row.lastVerifiedBy}` : "—") },
            {
              id: "check",
              header: "",
              cell: (row) =>
                canManage ? (
                  <Button variant="outline-emerald" size="sm" disabled={busy} onClick={() => setVerify({ item: row, date: nowForPicker(), note: "" })}>
                    {tr("Record check")}
                  </Button>
                ) : null,
            },
          ]}
        />
      </FormSection>

      <FormSection title={tr("Declaration Authority")} icon={<CircleStar className="h-4 w-4" />}>
        <div className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <span className="text-xs font-medium text-slate-900 sm:text-sm">{tr("Who may declare a disaster")}</span>
            <p className="mt-1.5 text-xs text-slate-500">{tr("Only this person can declare a disaster, with an electronic signature. Changing the person needs a signature too.")}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-900">{authority ?? "—"}</span>
            {canManage && (
              <Button variant="default" size="sm" disabled={busy} onClick={openAuthority}>
                {tr("Change")}
              </Button>
            )}
          </div>
        </div>
      </FormSection>
    </div>
  );

  const declarationsTab = (
    <div className="space-y-4">
      <WarningBanner
        variant="info"
        title={tr("How a declaration works")}
        description={trFormat("Only {authority} can declare a disaster, with an electronic signature. One declaration is open at a time. It is closed, again with a signature and a summary, when service is restored; the time between the two is the recovery time actually taken.", { authority: authority ?? tr("the declaration authority") })}
      />
      <DrDeclarationsList reloadKey={reloadKey} scenarios={scenarios ?? []} />
    </div>
  );

  return (
    <BackupAdminLivePage
      title={tr("Disaster Recovery Plan")}
      actions={
        canManage ? (
          <div className="flex flex-wrap gap-2">
            {open && (
              <Button size="sm" variant="outline-emerald" disabled={busy} onClick={() => setClose({ declaration: open, summary: "", step: "form" })}>
                {tr("Close the Open Declaration")}
              </Button>
            )}
            <Button size="sm" variant="default" disabled={busy || !!open || authority === undefined} onClick={() => setDeclare({ scenario: scenarios?.[0]?.code ?? "", reason: "", step: "form" })}>
              {tr("Declare a Disaster")}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <TabNav tabs={TABS} activeTab={active} onChange={(id) => setSearchParams({ tab: id }, { replace: true })} layoutId="backup-dr-tab" ariaLabel={__ariaTr("Disaster recovery plan")} />
        <div className="p-4 md:p-5">{active === "plan" ? plan : declarationsTab}</div>
      </div>

      <FormModal
        isOpen={target?.step === "form"}
        onClose={() => setTarget(undefined)}
        title={`Change Targets: ${target?.scenario.label ?? ""}`}
        description={tr("The new targets take effect only after the electronic signature.")}
        confirmText={tr("Continue to Sign")}
        confirmDisabled={!target || !target.reason.trim() || !(Number(target.rpo) > 0) || !(Number(target.rto) > 0)}
        onConfirm={() => target && setTarget({ ...target, step: "sign" })}
      >
        <div className="space-y-4">
          <FormField label={tr("RPO (hours)")} required hint={tr("The most data, in hours, that may be lost.")}>
            <Input type="number" min={0} step="0.5" value={target?.rpo ?? ""} onChange={(e) => target && setTarget({ ...target, rpo: e.target.value })} />
          </FormField>
          <FormField label={tr("RTO (hours)")} required hint={tr("The longest time, in hours, to be working again.")}>
            <Input type="number" min={0} step="0.5" value={target?.rto ?? ""} onChange={(e) => target && setTarget({ ...target, rto: e.target.value })} />
          </FormField>
          <FormField label={tr("Reason")} required hint={tr("Recorded with the change, with your name and the time.")}>
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
        description={tr("Record the check a person has made. The date is the date of the check.")}
        confirmText={tr("Record check")}
        confirmDisabled={!verify || busy}
        onConfirm={saveVerify}
      >
        <div className="space-y-4">
          <DateTimePicker
            label={
              <>
                {tr("Date of the check")} <span className="text-red-500">*</span>
              </>
            }
            value={verify?.date ?? ""}
            onChange={(value) => verify && setVerify({ ...verify, date: value })}
            showTime
            placeholder={tr("Select date and time")}
          />
          <FormField label={tr("Note")} hint={tr("Optional. What was checked and what was found.")}>
            <Textarea rows={3} maxLength={1000} value={verify?.note ?? ""} onChange={(e) => verify && setVerify({ ...verify, note: e.target.value })} />
          </FormField>
        </div>
      </FormModal>

      <FormModal
        isOpen={declareAuthority?.step === "form"}
        onClose={() => setDeclareAuthority(undefined)}
        title={tr("Change Who May Declare a Disaster")}
        description={tr("The person must be an active account. The change takes effect after the electronic signature.")}
        confirmText={tr("Continue to Sign")}
        confirmDisabled={!declareAuthority || !declareAuthority.username.trim() || !declareAuthority.reason.trim()}
        onConfirm={() => declareAuthority && setDeclareAuthority({ ...declareAuthority, step: "sign" })}
      >
        <div className="space-y-4">
          <FormField label={tr("Person")} required hint={tr("Only active accounts are listed.")}>
            <Select
              value={declareAuthority?.username ?? ""}
              onChange={(value) => declareAuthority && setDeclareAuthority({ ...declareAuthority, username: String(value) })}
              options={(people ?? []).map((person) => ({ label: `${person.fullName} (${person.username})`, value: person.username ?? "" }))}
              placeholder={people ? tr("Choose an active person") : "Loading…"}
              disabled={!people}
            />
          </FormField>
          <FormField label={tr("Reason")} required hint={tr("Recorded with the change, with your name and the time.")}>
            <Textarea rows={3} maxLength={500} value={declareAuthority?.reason ?? ""} onChange={(e) => declareAuthority && setDeclareAuthority({ ...declareAuthority, reason: e.target.value })} />
          </FormField>
        </div>
      </FormModal>
      <ESignatureModal
        isOpen={declareAuthority?.step === "sign"}
        onClose={() => setDeclareAuthority(undefined)}
        deferConfirm
        onConfirm={signedAuthority}
        actionTitle={`Change the Declaration Authority to ${declareAuthority?.username ?? ""}`}
        meaningDisplayName="Disaster Declaration Authority Change"
        meaningCode="BACKUP_DR_AUTHORITY_CHANGE"
      />

      <FormModal
        isOpen={declare?.step === "form"}
        onClose={() => setDeclare(undefined)}
        title={tr("Declare a Disaster")}
        description={tr("This opens a declaration that stays open until it is closed. It is recorded with your name, the time and your signature.")}
        confirmText={tr("Continue to Sign")}
        confirmDisabled={!declare || !declare.scenario || !declare.reason.trim()}
        onConfirm={() => declare && setDeclare({ ...declare, step: "sign" })}
      >
        <div className="space-y-4">
          <FormField label={tr("Scenario")} required>
            <Select
              value={declare?.scenario ?? ""}
              onChange={(value) => declare && setDeclare({ ...declare, scenario: String(value) })}
              options={(scenarios ?? []).map((s) => ({ label: s.label, value: s.code }))}
              placeholder={tr("Choose a scenario")}
            />
          </FormField>
          <FormField label={tr("What happened")} required hint={tr("Recorded with the declaration.")}>
            <Textarea rows={4} maxLength={1000} value={declare?.reason ?? ""} onChange={(e) => declare && setDeclare({ ...declare, reason: e.target.value })} />
          </FormField>
        </div>
      </FormModal>
      <ESignatureModal
        isOpen={declare?.step === "sign"}
        onClose={() => setDeclare(undefined)}
        deferConfirm
        onConfirm={signedDeclare}
        actionTitle="Declare a Disaster"
        meaningDisplayName="Disaster Declaration"
        meaningCode="BACKUP_DR_DECLARE"
      />

      <FormModal
        isOpen={close?.step === "form"}
        onClose={() => setClose(undefined)}
        title={`Close Declaration ${close?.declaration.code ?? ""}`}
        description={tr("Close it when service is restored. The time since it was declared becomes the recovery time actually taken.")}
        confirmText={tr("Continue to Sign")}
        confirmDisabled={!close || !close.summary.trim()}
        onConfirm={() => close && setClose({ ...close, step: "sign" })}
      >
        <FormField label={tr("How service was restored, and what was found")} required>
          <Textarea rows={5} maxLength={2000} value={close?.summary ?? ""} onChange={(e) => close && setClose({ ...close, summary: e.target.value })} />
        </FormField>
      </FormModal>
      <ESignatureModal
        isOpen={close?.step === "sign"}
        onClose={() => setClose(undefined)}
        deferConfirm
        onConfirm={signedClose}
        actionTitle={`Close Declaration ${close?.declaration.code ?? ""}`}
        meaningDisplayName="Disaster Declaration Closure"
        meaningCode="BACKUP_DR_CLOSE"
      />
    </BackupAdminLivePage>
  );
};
