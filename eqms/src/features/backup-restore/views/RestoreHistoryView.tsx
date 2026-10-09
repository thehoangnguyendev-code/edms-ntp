import React, { useState } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { DataTable } from "@/components/ui/table";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { RestoreDetailDrawer } from "../components/RestoreDetailDrawer";
import { SAMPLE_RESTORES } from "../sampleData";
import { RESTORE_STATUS_COLOR, statusLabel, type RestoreRequest } from "../types";
import { formatDateTime } from "../format";

const CLOSED = new Set(["COMPLETED", "FAILED", "REJECTED", "CANCELLED"]);

/** Every restore that has ended, with who requested, approved and ran it. The record is never edited. */
export const RestoreHistoryView: React.FC = () => {
  const drag = useTableDragScroll();
  const [selected, setSelected] = useState<RestoreRequest>();
  const rows = SAMPLE_RESTORES.filter((request) => CLOSED.has(request.status));

  return (
    <BackupRestorePage title="Restore History & Evidence" group="Restore">
      <WarningBanner variant="info" description="The permanent record of each restore: request, approval, execution steps and verification. Open a row for the full timeline." />
      <div className="flex min-w-0 w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-1 flex-col p-4 md:p-5">
          <DataTable
            rows={rows}
            getRowKey={(row) => row.id}
            emptyState={<TableEmptyState title="No Completed Restores" description="Finished restores will appear here." />}
            scrollerRef={drag.scrollerRef}
            scrollProps={drag.dragEvents}
            isDragging={drag.isDragging}
            columns={[
              { id: "no", header: "No.", cell: (_row, index) => index + 1 },
              {
                id: "id",
                header: "Request",
                cell: (row) => (
                  <button type="button" className="text-left font-medium text-emerald-600 hover:underline" onClick={() => setSelected(row)}>
                    {row.id}
                  </button>
                ),
              },
              { id: "backup", header: "Backup", cell: (row) => row.backupId },
              { id: "target", header: "Target", cell: (row) => statusLabel(row.target) },
              { id: "status", header: "Outcome", cell: (row) => <Badge color={RESTORE_STATUS_COLOR[row.status]}>{statusLabel(row.status)}</Badge> },
              { id: "by", header: "Requested by", cell: (row) => row.requestedBy },
              { id: "approver", header: "Decided by", cell: (row) => row.decidedBy ?? "—" },
              { id: "at", header: "Completed", cell: (row) => formatDateTime(row.completedAt) },
            ]}
          />
        </div>
      </div>
      <RestoreDetailDrawer request={selected} onClose={() => setSelected(undefined)} onDecision={() => undefined} />
    </BackupRestorePage>
  );
};
