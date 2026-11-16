import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { useToast } from "@/components/ui/toast/Toast";
import { downloadTableExcel, type TableExportDataset } from "@/services/api/tableExport";
import { getApiErrorMessage } from "@/utils/apiError";

/**
 * Export of a backup register to Excel (REPORT-BACKUP-RUNS-2026-11-15). The server writes the whole filtered list, as the screen shows it, and records the export in the Audit Trail;
 * what is sent is only the filters and the order of the screen, never a list of rows.
 */
export function BackupExportButton({ dataset, params, className }: { dataset: Extract<TableExportDataset, "backups" | "backup-rehearsals" | "production-restores">; params: Record<string, unknown>; className?: string }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await downloadTableExcel(dataset, params);
    } catch (error) {
      showToast({ type: "error", title: "Unable to export", message: getApiErrorMessage(error, "The export could not be made.") });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="outline" size="sm" className={className ?? "whitespace-nowrap gap-2"} onClick={run} disabled={busy}>
      {busy ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Export
        </>
      )}
    </Button>
  );
}
