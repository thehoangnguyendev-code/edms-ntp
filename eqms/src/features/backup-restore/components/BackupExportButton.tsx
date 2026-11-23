import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { TableExportModal } from "@/components/ui/modal/TableExportModal";
import { useToast } from "@/components/ui/toast/Toast";
import { downloadTableExport, type TableExportDataset, type TableExportOptions } from "@/services/api/tableExport";
import { getApiErrorMessage } from "@/utils/apiError";
import { tr } from "@/i18n";

const TITLES = { backups: "Backups", "backup-rehearsals": "Restore Rehearsals", "production-restores": "Production Restores" } as const;

/**
 * Export of a backup register (REPORT-BACKUP-RUNS-2026-11-15). The button opens the Export dialog, where the person chooses Excel or CSV and the columns. The server writes the whole filtered list,
 * as the screen shows it, and records the export in the Audit Trail; what is sent is only the filters, the order of the screen and the choice, never a list of rows.
 */
export function BackupExportButton({ dataset, params, className, totalRecords }: { dataset: Extract<TableExportDataset, "backups" | "backup-rehearsals" | "production-restores">; params: Record<string, unknown>; className?: string; totalRecords?: number }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const run = async (options: TableExportOptions) => {
    try {
      await downloadTableExport(dataset, params, options);
    } catch (error) {
      showToast({ type: "error", title: tr("Unable to export"), message: getApiErrorMessage(error, "The export could not be made.") });
    }
  };
  return (
    <>
      <Button variant="outline" size="sm" className={className ?? "whitespace-nowrap gap-2"} onClick={() => setOpen(true)}>
        <Download className="h-4 w-4" />
        {tr("Export")}
      </Button>
      <TableExportModal isOpen={open} onClose={() => setOpen(false)} dataset={dataset} title={TITLES[dataset]} totalRecords={totalRecords} onExport={run} />
    </>
  );
}
