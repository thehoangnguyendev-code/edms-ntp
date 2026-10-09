import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { DataTable } from "@/components/ui/table";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { useToast } from "@/components/ui/toast/Toast";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { ROUTES } from "@/app/routes.constants";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { RestoreDetailDrawer } from "../components/RestoreDetailDrawer";
import { SAMPLE_RESTORES } from "../sampleData";
import { RESTORE_STATUS_COLOR, statusLabel, type RestoreRequest, type RestoreTarget } from "../types";
import { formatDateTime } from "../format";

const TARGET_BADGE: Record<RestoreTarget, { color: "red" | "blue" | "purple"; label: string }> = {
  PRODUCTION: { color: "red", label: "Production" },
  VALIDATION_ENV: { color: "blue", label: "Validation environment" },
  REBUILT_ENVIRONMENT: { color: "purple", label: "Rebuilt environment" },
};

export const RestoreRequestsView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const drag = useTableDragScroll();
  const [selected, setSelected] = useState<RestoreRequest>();

  return (
    <BackupRestorePage
      title="Restore Requests"
      group="Restore"
      actions={
        <Button size="sm" className="gap-2 whitespace-nowrap" onClick={() => navigate(ROUTES.BACKUP_RESTORE.RESTORE_NEW)}>
          <Plus className="h-4 w-4" />
          New Restore Request
        </Button>
      }
    >
      <WarningBanner
        variant="info"
        title="How a restore runs"
        description="Request → second-person approval with e-signature → maintenance window → restore → automatic verification (schema, row counts, files against records). A restore replaces data, it never merges; practise in the validation environment first."
      />
      <div className="flex min-w-0 w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-1 flex-col p-4 md:p-5">
          <DataTable
            rows={SAMPLE_RESTORES}
            getRowKey={(r) => r.id}
            emptyState={<TableEmptyState title="No Restore Requests" description="Restore requests and recoveries will appear here." />}
            scrollerRef={drag.scrollerRef}
            scrollProps={drag.dragEvents}
            isDragging={drag.isDragging}
            columns={[
              { id: "no", header: "No.", cell: (_r, i) => i + 1 },
              {
                id: "id",
                header: "Request",
                cell: (r) => (
                  <div>
                    <button type="button" className="text-left font-medium text-emerald-600 hover:underline" onClick={() => setSelected(r)}>
                      {r.id}
                    </button>
                    <span className="block text-xs text-slate-500">From {r.backupId}</span>
                  </div>
                ),
              },
              { id: "kind", header: "Type", cell: (r) => (r.kind === "DISASTER_RECOVERY" ? <Badge color="rose">Disaster recovery</Badge> : <Badge color="slate">Restore</Badge>) },
              { id: "target", header: "Target", cell: (r) => <Badge color={TARGET_BADGE[r.target].color}>{TARGET_BADGE[r.target].label}</Badge> },
              { id: "status", header: "Status", cell: (r) => <Badge color={RESTORE_STATUS_COLOR[r.status]}>{statusLabel(r.status)}</Badge> },
              { id: "by", header: "Requested by", cell: (r) => r.requestedBy },
              { id: "at", header: "Requested", cell: (r) => formatDateTime(r.requestedAt) },
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
