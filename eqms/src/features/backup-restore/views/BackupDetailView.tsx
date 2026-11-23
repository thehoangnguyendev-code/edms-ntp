import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { WorkflowProgressStepper } from "@/components/ui/workflow-stepper/WorkflowProgressStepper";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { DataTable } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import { backupRestoreApi, type BackupDetail } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { FormField, Textarea } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { VerifyIntegrityModal } from "../components/VerifyIntegrityModal";
import { BackupRehearsalList } from "../components/BackupRehearsalList";
import { LocalListTable } from "../components/LocalListTable";
import { ProductionRestoreDialog } from "../components/ProductionRestoreDialog";
import { useProductionRestoreRun } from "../components/useProductionRestoreRun";
import { BACKUP_STATUS_COLOR, COMPONENT_LABEL, VERIFICATION_COLOR, statusLabel } from "../types";
import { formatBytes, formatDateTime, formatDuration } from "../format";
import { displayDate } from "@/utils/format";
import { tr } from "@/i18n";

type MainTab = "general" | "integrity" | "stored" | "contents";
type SubTab = "verifications" | "restoreTests";

/** One read-only value in a labelled box, the same control the document detail tabs use. */
const ReadOnlyInput: React.FC<{ label: string; value: string; mono?: boolean; className?: string }> = ({ label, value, mono, className }) => (
  <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
    <label className="text-xs sm:text-sm font-medium text-slate-700 capitalize">{label}</label>
    <input type="text" value={value} readOnly className={`${CONTROL_STATE_CLASSES.readonlyField} ${mono ? "font-mono text-xs" : ""}`} />
  </div>
);

/** One backup on its own screen: what it is, whether it can be trusted, where it is stored and every check it has had. */
export const BackupDetailView: React.FC = () => {
  const { backupId: backupNumber = "" } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const [backup, setBackup] = useState<BackupDetail>();
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  const [verifying, setVerifying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const restoreRun = useProductionRestoreRun(reload);
  const canVerify = hasPermission("backup.backup.verify");
  const canRehearse = hasPermission("backup.restore.test");
  // Only the figures the page needs (how many, is one running); the list itself is read, paged, by BackupRehearsalList.
  const [rehearsalTotal, setRehearsalTotal] = useState(0);
  const [busyRehearsal, setBusyRehearsal] = useState(false);
  const [rehearsing, setRehearsing] = useState(false);
  const [rehearseReason, setRehearseReason] = useState("");
  const [rehearseBusy, setRehearseBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>("general");
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("verifications");

  useEffect(() => {
    let active = true;
    setError("");
    backupRestoreApi
      .get(backupNumber)
      .then((data) => active && setBackup(data))
      .catch((e) => active && setError(getApiErrorMessage(e, "The backup could not be read.")));
    return () => {
      active = false;
    };
  }, [backupNumber, reloadKey]);

  useEffect(() => {
    let live = true;
    backupRestoreApi
      .rehearsals({ backupNumber, limit: 1 })
      .then(async (all) => {
        const [queued, running] = await Promise.all([
          backupRestoreApi.rehearsals({ backupNumber, status: "QUEUED", limit: 1 }),
          backupRestoreApi.rehearsals({ backupNumber, status: "RUNNING", limit: 1 }),
        ]);
        if (!live) return;
        setRehearsalTotal(all.pagination.total);
        setBusyRehearsal(queued.pagination.total + running.pagination.total > 0);
      })
      .catch(() => {
        if (!live) return;
        setRehearsalTotal(0);
        setBusyRehearsal(false);
      });
    return () => {
      live = false;
    };
  }, [backupNumber, reloadKey]);

  const requestRehearsal = async () => {
    setRehearseBusy(true);
    try {
      const created = await backupRestoreApi.requestRehearsal(backupNumber, rehearseReason.trim());
      showToast({ type: "success", title: tr("Test restore requested"), message: `${created.rehearsalId} is queued.` });
      setRehearsing(false);
      setRehearseReason("");
      reload();
    } catch (e) {
      showToast({ type: "error", title: tr("The test restore was not requested"), message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setRehearseBusy(false);
    }
  };

  const parent = { label: tr("Backup History"), path: ROUTES.BACKUP_RESTORE.BACKUPS };
  const back = () => navigate(ROUTES.BACKUP_RESTORE.BACKUPS);

  if (error) {
    return (
      <BackupRestorePage title={tr("Backup Details")} group="Backup" parent={parent} preview={false}>
        <WarningBanner variant="error" title={tr("Unable to open the backup")} description={error} />
        <div>
          <Button size="sm" variant="outline-emerald" onClick={back}>
            {tr("Back to Backup History")}
          </Button>
        </div>
      </BackupRestorePage>
    );
  }
  if (!backup) {
    return (
      <BackupRestorePage title={tr("Backup Details")} group="Backup" parent={parent} preview={false}>
        <SectionLoading minHeight="40vh" />
      </BackupRestorePage>
    );
  }

  const restorable = backup.status === "COMPLETED";
  const verified = backup.verification === "VERIFIED";
  const canRestore = restorable && verified;
  const locations = backup.locations ?? [];
  const verifications = backup.verifications ?? [];

  // The same buttons sit above and below the tabs so they are always close to where the person is reading.
  const actionButtons = (
    <>
      <Button variant="outline-emerald" size="sm" onClick={back} className="whitespace-nowrap touch-manipulation">
        {tr("Back")}
      </Button>
      <Button variant="outline-emerald" size="sm" disabled={!restorable || !canVerify || verifying} onClick={() => setVerifying(true)} className="whitespace-nowrap touch-manipulation">
        {tr("Verify Integrity")}
      </Button>
      {canRehearse && (
        <Button variant="outline-emerald" size="sm" disabled={!canRestore || busyRehearsal} onClick={() => setRehearsing(true)} className="whitespace-nowrap touch-manipulation">
          {tr("Test Restore")}
        </Button>
      )}
      <Button
        size="sm"
        disabled={!canRestore || restoreRun.working > 0}
        onClick={() => setRestoring(true)}
        className="whitespace-nowrap touch-manipulation"
      >
        {tr("Restore")}
      </Button>
    </>
  );

  const tabs = [
    { id: "general" as MainTab, label: tr("General Information") },
    { id: "integrity" as MainTab, label: tr("Integrity and Retention") },
    { id: "stored" as MainTab, label: "Stored At", count: locations.length },
    { id: "contents" as MainTab, label: "Contents", count: backup.components.length },
  ];
  const subTabs = [
    { id: "verifications" as SubTab, label: tr("Verification History"), count: verifications.length },
    { id: "restoreTests" as SubTab, label: tr("Restore Tests"), count: rehearsalTotal },
  ];

  return (
    <BackupRestorePage
      title={tr("Backup Details")}
      group="Backup"
      parent={parent}
      preview={false}
      actions={<div className="flex flex-wrap items-center justify-end gap-2 md:gap-3">{actionButtons}</div>}
    >
      {backup.status === "FAILED" && <WarningBanner variant="error" title={tr("This backup failed")} description={backup.errorMessage ?? "No detail recorded."} />}
      {restorable && !verified && (
        <WarningBanner
          variant="warning"
          title={backup.verification === "FAILED" ? tr("This backup did not pass its integrity check") : "This backup has not been verified"}
          description={tr("It cannot be used for a restore until it passes its integrity check.")}
        />
      )}

      {/* The stages a backup goes through, shown like the document status stepper; the server works them out. */}
      <WorkflowProgressStepper workflow={backup.workflow} />

      <div className={canRestore ? "rounded-xl border border-emerald-200 bg-emerald-50 p-4 md:p-5" : "rounded-xl border border-amber-200 bg-amber-50 p-4 md:p-5"}>
        <h3 className={canRestore ? "mb-3 text-sm font-semibold text-emerald-900" : "mb-3 text-sm font-semibold text-amber-900"}>{tr("What this means")}</h3>
        <ul className={canRestore ? "list-disc space-y-2 pl-5 text-xs text-emerald-800 marker:text-emerald-600 sm:text-sm" : "list-disc space-y-2 pl-5 text-xs text-amber-800 marker:text-amber-600 sm:text-sm"}>
          {canRestore ? (
            <li>{tr("This backup passed its integrity check and can be used for a restore request.")}</li>
          ) : (
            <li>{tr("This backup cannot be used for a restore until it is completed and has passed its integrity check.")}</li>
          )}
          <li>{backup.retention === "PERMANENT" ? tr("It is kept permanently and is never removed by age.") : tr("Its retention period is set by the backup policy.")}</li>
          <li>{tr("The data is encrypted. It can only be opened by the people who hold the decryption key, never by the Backup Agent.")}</li>
          <li>{tr("Every check on this backup is recorded in the Verification History below and in the tamper-evident ledger.")}</li>
        </ul>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as MainTab)} layoutId="backup-detail-main-tab" />
        <div className="p-4 md:p-5">
          {activeTab === "general" && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
              <ReadOnlyInput label={tr("Backup Number")} value={backup.id} />
              <ReadOnlyInput label={tr("Status")} value={statusLabel(backup.status)} />
              <ReadOnlyInput label={tr("Type")} value={statusLabel(backup.type)} />
              <ReadOnlyInput label={tr("Trigger")} value={statusLabel(backup.trigger)} />
              <ReadOnlyInput label={tr("Requested by")} value={backup.createdBy} />
              <ReadOnlyInput label={tr("Started")} value={formatDateTime(backup.startedAt)} />
              <ReadOnlyInput label={tr("Duration")} value={formatDuration(backup.durationSec)} />
              <ReadOnlyInput label={tr("Total size")} value={formatBytes(backup.sizeBytes)} />
              <ReadOnlyInput label={tr("Database schema")} value={backup.schemaVersion ? `V${backup.schemaVersion}` : "—"} />
              {backup.changeControlRef && <ReadOnlyInput label={tr("Change control")} value={backup.changeControlRef} />}
              {backup.errorCode && <ReadOnlyInput label={tr("Error code")} value={backup.errorCode} mono />}
              <ReadOnlyInput label={tr("Reason")} value={backup.reason || "—"} className="md:col-span-2" />
            </div>
          )}

          {activeTab === "integrity" && (
            <div className="space-y-4 md:space-y-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                <ReadOnlyInput label={tr("Verification")} value={statusLabel(backup.verification)} />
                <ReadOnlyInput label={tr("Verified")} value={backup.verifiedAt ? formatDateTime(backup.verifiedAt) : "—"} />
                <ReadOnlyInput label={tr("Retained")} value={backup.retention === "PERMANENT" ? "Permanently" : backup.retentionUntil ? displayDate(backup.retentionUntil) : "—"} />
                <ReadOnlyInput label={tr("Legal hold")} value={backup.legalHold ? "On hold: will not be purged" : "No"} />
              </div>
            </div>
          )}

          {activeTab === "stored" &&
            (locations.length === 0 ? (
              <p className="text-xs text-slate-500 lg:text-sm">{tr("No stored copy is recorded for this backup.")}</p>
            ) : (
              <DataTable
                rows={locations}
                getRowKey={(row) => row.target}
                columns={[
                  { id: "target", header: "Target", cell: (row) => <span className="font-medium">{row.target}</span> },
                  { id: "path", header: "Location", cell: (row) => <span className="break-all font-mono text-xs">{row.path}</span> },
                  { id: "ok", header: "Result", cell: (row) => <Badge color={row.ok ? "emerald" : "red"}>{row.ok ? "Confirmed" : "Not confirmed"}</Badge> },
                ]}
              />
            ))}

          {activeTab === "contents" && (
            <DataTable
              rows={backup.components}
              getRowKey={(row) => row.key}
              columns={[
                { id: "component", header: "Component", cell: (row) => COMPONENT_LABEL[row.key] ?? row.key },
                { id: "size", header: "Size", cell: (row) => formatBytes(row.sizeBytes) },
                { id: "status", header: "Result", cell: (row) => <Badge color={row.status === "COMPLETED" ? "emerald" : "red"}>{statusLabel(row.status)}</Badge> },
                { id: "sha", header: "SHA-256", cell: (row) => <span className="break-all font-mono text-xs text-slate-500">{row.sha256 ?? "—"}</span> },
              ]}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:gap-3">{actionButtons}</div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav tabs={subTabs} activeTab={activeSubTab} onChange={(id) => setActiveSubTab(id as SubTab)} variant="simple-underline" />
        <div className="p-4 md:p-5">
          {activeSubTab === "verifications" && (
            <LocalListTable
              rows={verifications}
              getRowKey={(row) => `${row.tier}-${row.verified_at}`}
              searchText={(row) => `${row.tier} ${statusLabel(row.result)} ${row.verified_by} ${formatDateTime(row.verified_at)}`}
              searchLabel="Search checks"
              searchPlaceholder={tr("Check, result or person…")}
              emptyTitle={tr("No checks yet")}
              emptyDescription={tr("Every check is kept; a later check never replaces an earlier one.")}
              columns={[
                { id: "tier", header: "Check", cell: (row) => row.tier, sortValue: (row) => row.tier },
                { id: "result", header: "Result", cell: (row) => <Badge color={row.result === "VERIFIED" ? "emerald" : "red"}>{statusLabel(row.result)}</Badge>, sortValue: (row) => row.result },
                { id: "at", header: "When", cell: (row) => formatDateTime(row.verified_at), sortValue: (row) => row.verified_at },
                { id: "by", header: "By", cell: (row) => row.verified_by, sortValue: (row) => row.verified_by },
              ]}
            />
          )}

          {activeSubTab === "restoreTests" && <BackupRehearsalList backupNumber={backupNumber} reloadKey={reloadKey} />}
        </div>
      </div>

      <ProductionRestoreDialog
        isOpen={restoring}
        onlyBackup={backup.id}
        onClose={() => setRestoring(false)}
        onContinue={(backupNumber, parts) => {
          setRestoring(false);
          restoreRun.begin(backupNumber, parts);
        }}
      />
      {restoreRun.signatureModal}
      <VerifyIntegrityModal isOpen={verifying} backupNumber={backupNumber} onClose={() => setVerifying(false)} onFinished={reload} />

      <FormModal
        isOpen={rehearsing}
        onClose={() => setRehearsing(false)}
        title={tr("Test Restore")}
        description={`Restore ${backupNumber} into a scratch database and run the checks. Production is not changed; the scratch database is dropped afterwards.`}
        confirmText={rehearseBusy ? "Requesting…" : "Start Test"}
        confirmDisabled={!rehearseReason.trim() || rehearseBusy}
        onConfirm={() => void requestRehearsal()}
      >
        <FormField label={tr("Reason")} required hint={tr("For example: annual restore test for the validation report.")}>
          <Textarea rows={3} value={rehearseReason} maxLength={500} onChange={(event) => setRehearseReason(event.target.value)} />
        </FormField>
      </FormModal>
    </BackupRestorePage>
  );
};
