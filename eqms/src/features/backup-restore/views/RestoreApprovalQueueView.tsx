import React, { useState } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { DataTable } from "@/components/ui/table";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { useToast } from "@/components/ui/toast/Toast";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { RestoreDetailDrawer } from "../components/RestoreDetailDrawer";
import { SAMPLE_RESTORES } from "../sampleData";
import { statusLabel, type RestoreRequest } from "../types";
import { formatDateTime } from "../format";

/** Restore requests waiting for a second person. A person never approves their own request. */
export const RestoreApprovalQueueView: React.FC = () => {
  const { showToast } = useToast();
  const drag = useTableDragScroll();
  const [selected, setSelected] = useState<RestoreRequest>();
  const rows = SAMPLE_RESTORES.filter((request) => request.status === "PENDING_APPROVAL");

  return (
    <BackupRestorePage title="Restore Approval Queue" group="Restore">
      <WarningBanner variant="info" description="Open a request to read the reason and the change control reference, then approve with your e-signature or reject with a reason." />
      <div className="flex min-w-0 w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-1 flex-col p-4 md:p-5">
          <DataTable
            rows={rows}
            getRowKey={(row) => row.id}
            emptyState={<TableEmptyState title="Nothing Waiting For Approval" description="Restore requests that need a decision will appear here." />}
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
              { id: "backup", header: "Backup to restore", cell: (row) => row.backupId },
              { id: "target", header: "Target", cell: (row) => statusLabel(row.target) },
              { id: "change", header: "Change control", cell: (row) => row.changeControlRef ?? "—" },
              { id: "by", header: "Requested by", cell: (row) => row.requestedBy },
              { id: "at", header: "Requested", cell: (row) => formatDateTime(row.requestedAt) },
              { id: "status", header: "Status", cell: () => <Badge color="amber">Waiting for approval</Badge> },
            ]}
          />
        </div>
      </div>
      <RestoreDetailDrawer
        request={selected}
        onClose={() => setSelected(undefined)}
        onDecision={(_request, decision) =>
          showToast({ type: "info", title: decision === "approve" ? "Approve and sign" : "Reject", message: "Design preview: nothing was sent to a server." })
        }
      />
    </BackupRestorePage>
  );
};
