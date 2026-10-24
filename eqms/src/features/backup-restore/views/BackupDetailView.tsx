import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { HardDrive, Info } from "lucide-react";
import { IconBrandHeadlessui, IconDatabase, IconHistory, IconPackage, IconShieldCheck } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormSection } from "@/components/ui/form";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { DataTable } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import { backupRestoreApi, type BackupDetail, type RestoreRehearsal } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { ExportBackupModal } from "../components/ExportBackupModal";
import { FormField, Textarea } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { useBackupJobs } from "../components/useBackupJobs";
import { BACKUP_STATUS_COLOR, COMPONENT_LABEL, VERIFICATION_COLOR, statusLabel } from "../types";
import { formatBytes, formatDateTime, formatDuration } from "../format";
import { exportErrorMessage } from "@/features/settings/backup-restore-administration/mediaLabels";
import { displayDate } from "@/utils/format";

/** One label and its value, laid out like the rest of the detail screens: stacked on small screens, side by side on large. */
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1.5 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0 lg:flex-row lg:items-center lg:gap-2 lg:pb-4 last:lg:pb-0">
    <label className="w-full flex-shrink-0 text-xs font-medium text-slate-700 sm:text-sm lg:w-40">{label}</label>
    <div className="min-w-0 flex-1 break-words text-xs text-slate-900 lg:text-sm">{children}</div>
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
  const { working, follow } = useBackupJobs(reload);
  const canVerify = hasPermission("backup.backup.verify");
  const canExport = hasPermission("backup.backup.export");
  const canRehearse = hasPermission("backup.restore.test");
  const [rehearsals, setRehearsals] = useState<RestoreRehearsal[]>([]);
  const [rehearsing, setRehearsing] = useState(false);
  const [rehearseReason, setRehearseReason] = useState("");
  const [rehearseBusy, setRehearseBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

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

  const verify = async () => {
    try {
      const { jobId } = await backupRestoreApi.verify(backupNumber);
      showToast({ type: "info", title: "Integrity check requested", message: backupNumber });
      void follow(jobId, "Integrity check");
    } catch (e) {
      showToast({ type: "error", title: "Unable to start the check", message: getApiErrorMessage(e, "The request was refused.") });
    }
  };

  const requestExport = async (mediaId: string, reason: string) => {
    setExportBusy(true);
    try {
      const created = await backupRestoreApi.requestExport(backupNumber, mediaId, reason);
      showToast({ type: "success", title: "Export requested", message: `${created.exportId} is waiting for another person to approve it.` });
      setExporting(false);
    } catch (e) {
      showToast({ type: "error", title: "The export was not requested", message: exportErrorMessage(e, "The request was refused.") });
    } finally {
      setExportBusy(false);
    }
  };

  useEffect(() => {
    let live = true;
    backupRestoreApi
      .rehearsals({ backupNumber, sortBy: "requestedAt", sortDirection: "desc", limit: 10 })
      .then((data) => live && setRehearsals(data.data))
      .catch(() => live && setRehearsals([]));
    return () => {
      live = false;
    };
  }, [backupNumber, reloadKey]);

  const requestRehearsal = async () => {
    setRehearseBusy(true);
    try {
      const created = await backupRestoreApi.requestRehearsal(backupNumber, rehearseReason.trim());
      showToast({ type: "success", title: "Test restore requested", message: `${created.rehearsalId} is queued.` });
      setRehearsing(false);
      setRehearseReason("");
      reload();
    } catch (e) {
      showToast({ type: "error", title: "The test restore was not requested", message: exportErrorMessage(e, "The request was refused.") });
    } finally {
      setRehearseBusy(false);
    }
  };

  const parent = { label: "Backup History", path: ROUTES.BACKUP_RESTORE.BACKUPS };
  const back = () => navigate(ROUTES.BACKUP_RESTORE.BACKUPS);

  if (error) {
    return (
      <BackupRestorePage title="Backup Details" group="Backup" parent={parent} preview={false}>
        <WarningBanner variant="error" title="Unable to open the backup" description={error} />
        <div>
          <Button size="sm" variant="outline-emerald" onClick={back}>
            Back to Backup History
          </Button>
        </div>
      </BackupRestorePage>
    );
  }
  if (!backup) {
    return (
      <BackupRestorePage title="Backup Details" group="Backup" parent={parent} preview={false}>
        <SectionLoading minHeight="40vh" />
      </BackupRestorePage>
    );
  }

  const restorable = backup.status === "COMPLETED";
  const verified = backup.verification === "VERIFIED";
  const canRestore = restorable && verified;
  const busyRehearsal = rehearsals.some((r) => r.status === "QUEUED" || r.status === "RUNNING");

  const actions = (
    <>
      <Button variant="outline-emerald" size="sm" onClick={back} className="whitespace-nowrap touch-manipulation">
        Back
      </Button>
      <Button variant="outline-emerald" size="sm" disabled={!restorable || !canVerify || working > 0} onClick={() => void verify()} className="whitespace-nowrap touch-manipulation">
        {working > 0 ? "Checking…" : "Verify Integrity"}
      </Button>
      {canRehearse && (
        <Button variant="outline-emerald" size="sm" disabled={!canRestore || busyRehearsal} onClick={() => setRehearsing(true)} className="whitespace-nowrap touch-manipulation">
          Test Restore
        </Button>
      )}
      {canExport && (
        <Button variant="outline-emerald" size="sm" disabled={!canRestore} onClick={() => setExporting(true)} className="whitespace-nowrap touch-manipulation">
          Export Backup Set
        </Button>
      )}
      <Button
        size="sm"
        disabled={!canRestore}
        onClick={() => navigate(`${ROUTES.BACKUP_RESTORE.RESTORE_NEW}?backup=${encodeURIComponent(backup.id)}`)}
        className="whitespace-nowrap touch-manipulation"
      >
        Request Restore
      </Button>
    </>
  );

  return (
    <BackupRestorePage title="Backup Details" group="Backup" parent={parent} preview={false} actions={actions}>
      {backup.status === "FAILED" && <WarningBanner variant="error" title="This backup failed" description={backup.errorMessage ?? "No detail recorded."} />}
      {restorable && !verified && (
        <WarningBanner
          variant="warning"
          title={backup.verification === "FAILED" ? "This backup did not pass its integrity check" : "This backup has not been verified"}
          description="It cannot be used for a restore until it passes its integrity check."
        />
      )}

      <FormSection title="Backup Information" icon={<Info className="h-4 w-4" />}>
        <div className="grid grid-cols-1 gap-x-10 gap-y-3 lg:gap-y-4 xl:grid-cols-2">
          <div className="space-y-3 lg:space-y-4">
            <Field label="Backup Number">
              <span className="font-medium">{backup.id}</span>
            </Field>
            <Field label="Status">
              <Badge color={BACKUP_STATUS_COLOR[backup.status]}>{statusLabel(backup.status)}</Badge>
            </Field>
            <Field label="Type">{statusLabel(backup.type)}</Field>
            <Field label="Trigger">{statusLabel(backup.trigger)}</Field>
            <Field label="Requested by">{backup.createdBy}</Field>
          </div>
          <div className="space-y-3 lg:space-y-4">
            <Field label="Started">{formatDateTime(backup.startedAt)}</Field>
            <Field label="Duration">{formatDuration(backup.durationSec)}</Field>
            <Field label="Total size">{formatBytes(backup.sizeBytes)}</Field>
            <Field label="Database schema">{backup.schemaVersion ? `V${backup.schemaVersion}` : "—"}</Field>
            <Field label="Reason">{backup.reason || "—"}</Field>
            {backup.changeControlRef && <Field label="Change control">{backup.changeControlRef}</Field>}
            {backup.errorCode && (
              <Field label="Error code">
                <span className="font-mono text-xs">{backup.errorCode}</span>
              </Field>
            )}
          </div>
        </div>
      </FormSection>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <FormSection title="Integrity and Retention" icon={<IconShieldCheck className="h-4 w-4" />}>
          <div className="space-y-3 lg:space-y-4">
            <Field label="Verification">
              <span className="inline-flex flex-wrap items-center gap-2">
                <Badge color={VERIFICATION_COLOR[backup.verification]}>{statusLabel(backup.verification)}</Badge>
                {backup.verifiedAt && <span className="text-xs text-slate-500">{formatDateTime(backup.verifiedAt)}</span>}
              </span>
            </Field>
            <Field label="Retained">{backup.retention === "PERMANENT" ? "Permanently" : backup.retentionUntil ? displayDate(backup.retentionUntil) : "—"}</Field>
            <Field label="Legal hold">{backup.legalHold ? <Badge color="amber">On hold: will not be purged</Badge> : "No"}</Field>
          </div>
        </FormSection>

        <FormSection title="Stored At" icon={<HardDrive className="h-4 w-4" />}>
          {backup.locations && backup.locations.length > 0 ? (
            <div className="space-y-3 lg:space-y-4">
              {backup.locations.map((location) => (
                <Field key={location.target} label={location.target}>
                  <span className="break-all font-mono text-xs">{location.path}</span>
                  {!location.ok && (
                    <span className="ml-2">
                      <Badge color="red">Not confirmed</Badge>
                    </span>
                  )}
                </Field>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 lg:text-sm">No stored copy is recorded for this backup.</p>
          )}
        </FormSection>
      </div>

      <FormSection title="Contents" icon={<IconBrandHeadlessui className="h-4 w-4" />}>
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
      </FormSection>

      {backup.verifications && backup.verifications.length > 0 && (
        <FormSection title="Verification History" icon={<IconHistory className="h-4 w-4" />} description="Every check is kept; a later check never replaces an earlier one.">
          <DataTable
            rows={backup.verifications}
            getRowKey={(row) => `${row.tier}-${row.verified_at}`}
            columns={[
              { id: "tier", header: "Check", cell: (row) => row.tier },
              { id: "result", header: "Result", cell: (row) => <Badge color={row.result === "VERIFIED" ? "emerald" : "red"}>{statusLabel(row.result)}</Badge> },
              { id: "at", header: "When", cell: (row) => formatDateTime(row.verified_at) },
              { id: "by", header: "By", cell: (row) => row.verified_by },
            ]}
          />
        </FormSection>
      )}

      <div className={canRestore ? "rounded-xl border border-emerald-200 bg-emerald-50 p-4 md:p-5" : "rounded-xl border border-amber-200 bg-amber-50 p-4 md:p-5"}>
        <h3 className={canRestore ? "mb-3 text-sm font-semibold text-emerald-900" : "mb-3 text-sm font-semibold text-amber-900"}>What this means</h3>
        <ul className={canRestore ? "list-disc space-y-2 pl-5 text-xs text-emerald-800 marker:text-emerald-600 sm:text-sm" : "list-disc space-y-2 pl-5 text-xs text-amber-800 marker:text-amber-600 sm:text-sm"}>
          {canRestore ? (
            <li>This backup passed its integrity check and can be used for a restore request.</li>
          ) : (
            <li>This backup cannot be used for a restore until it is completed and has passed its integrity check.</li>
          )}
          <li>{backup.retention === "PERMANENT" ? "It is kept permanently and is never removed by age." : "Its retention period is set by the backup policy."}</li>
          <li>The data is encrypted. It can only be opened by the people who hold the decryption key, never by the Backup Agent.</li>
          <li>Every check on this backup is recorded in the history above and in the tamper-evident ledger.</li>
        </ul>
      </div>

      <div className="flex items-center gap-3">{actions}</div>
      <FormSection title="Restore Tests" icon={<IconHistory className="h-4 w-4" />} description="A test restore puts this backup into a scratch database, runs the checks and drops the database. Production is not changed.">
        {rehearsals.length === 0 ? (
          <p className="text-xs text-slate-500 lg:text-sm">No test restore has been run for this backup.</p>
        ) : (
          <DataTable
            rows={rehearsals}
            getRowKey={(row) => row.rehearsalId}
            columns={[
              { id: "id", header: "Test", cell: (row) => <span className="font-medium">{row.rehearsalId}</span> },
              { id: "status", header: "Result", cell: (row) => <Badge color={row.status === "PASSED" ? "emerald" : row.status === "FAILED" ? "red" : "amber"}>{statusLabel(row.status)}</Badge> },
              { id: "checks", header: "Checks", cell: (row) => (row.checkCount > 0 ? `${row.checkCount - row.failedCount} of ${row.checkCount} passed` : "—") },
              { id: "error", header: "Problem", cell: (row) => (row.errorCode ? <span className="font-mono text-xs">{row.errorCode}</span> : "—") },
              { id: "by", header: "Requested by", cell: (row) => row.requestedBy },
              { id: "at", header: "Requested", cell: (row) => formatDateTime(row.requestedAt) },
              { id: "took", header: "Restore time", cell: (row) => (row.restoreSeconds == null ? "—" : `${row.restoreSeconds} s`) },
            ]}
          />
        )}
      </FormSection>

      <ExportBackupModal backupNumber={backupNumber} isOpen={exporting} busy={exportBusy} onClose={() => setExporting(false)} onConfirm={(mediaId, reason) => void requestExport(mediaId, reason)} />
      <FormModal
        isOpen={rehearsing}
        onClose={() => setRehearsing(false)}
        title="Test Restore"
        description={`Restore ${backupNumber} into a scratch database and run the checks. Production is not changed; the scratch database is dropped afterwards.`}
        confirmText={rehearseBusy ? "Requesting…" : "Start Test"}
        confirmDisabled={!rehearseReason.trim() || rehearseBusy}
        onConfirm={() => void requestRehearsal()}
      >
        <FormField label="Reason" required hint="For example: annual restore test for the validation report.">
          <Textarea rows={3} value={rehearseReason} maxLength={500} onChange={(event) => setRehearseReason(event.target.value)} />
        </FormField>
      </FormModal>
    </BackupRestorePage>
  );
};
