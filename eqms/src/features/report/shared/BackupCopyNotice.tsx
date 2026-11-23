import { useEffect, useState } from "react";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { reportsApi, type BackupCopyStatus } from "@/services/api/reports";
import { displayDateTime } from "@/utils/format";
import { tr } from "@/i18n";

/**
 * Says how current the Backup and Restore Runs report is: the application keeps a copy of the summary of the runs and refreshes it every few minutes
 * (REPORT-BACKUP-RUNS-2026-11-15). Shown above a report of that type; it says nothing when the copy is on and current. A failure to read the state shows nothing:
 * the report itself is the answer, this is only a hint.
 */
export function BackupCopyNotice() {
  const [status, setStatus] = useState<BackupCopyStatus>();
  useEffect(() => {
    let alive = true;
    reportsApi
      .backupCopyStatus()
      .then((value) => alive && setStatus(value))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  if (!status) return null;
  if (!status.enabled) {
    return <WarningBanner variant="warning" description={tr("The copy of the backup runs is switched off, so this report has no data until the read-only login of the copy is set (scripts/backup/report-reader-role.sh).")} />;
  }
  if (status.stale) {
    return (
      <WarningBanner
        variant="warning"
        description={`The backup runs in this report may be out of date. The copy was last refreshed ${status.lastSuccessAt ? displayDateTime(status.lastSuccessAt) : "never"}${status.lastError ? ` (last problem: ${status.lastError})` : ""}. Runs after that time are not in the report.`}
      />
    );
  }
    return <p className="text-xs text-slate-500">{tr("Runs copied from the backup system; last refreshed")} {displayDateTime(status.lastSuccessAt)}.</p>;
}
