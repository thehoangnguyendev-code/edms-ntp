import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { useToast } from "@/components/ui/toast/Toast";
import { DataTable } from "@/components/ui/table";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { ROUTES } from "@/app/routes.constants";
import { getApiErrorMessage } from "@/utils/apiError";
import { backupRestoreApi, type RestoreRequestRecord } from "@/services/api/backupRestore";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { formatDateTime } from "../format";

/**
 * Restore requests that have ended. A restore run is not built yet, so an ended request is one that was rejected; completed restores
 * will appear here when the run exists. The record is never edited.
 */
export const RestoreHistoryView: React.FC = () => {
  const drag = useTableDragScroll();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [rows, setRows] = useState<RestoreRequestRecord[]>();
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<string>();

  /** The signed pack as a file, with its SHA-256 shown so that the copy can be checked against it. */
  const downloadEvidence = async (requestId: string) => {
    setDownloading(requestId);
    try {
      const evidence = await backupRestoreApi.restoreEvidence(requestId);
      const url = URL.createObjectURL(new Blob([evidence.pack], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${requestId}-evidence.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast({ type: "success", title: "Evidence downloaded", message: `SHA-256 ${evidence.sha256}` });
    } catch (e) {
      showToast({ type: "error", title: "The evidence could not be downloaded", message: getApiErrorMessage(e, "Try again.") });
    } finally {
      setDownloading(undefined);
    }
  };

  useEffect(() => {
    let live = true;
    backupRestoreApi
      .restoreRequests({ status: "REJECTED", page: 1, limit: 50, sortBy: "requestedAt", sortDirection: "desc" })
      .then((page) => {
        if (!live) return;
        setRows(page.data);
        setTotal(page.pagination.total);
      })
      .catch((e) => {
        if (live) setError(getApiErrorMessage(e, "The restore history could not be loaded."));
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <BackupRestorePage title="Restore History & Evidence" group="Restore">
      <WarningBanner variant="info" description="The permanent record of each ended restore: request, decision and reason. Open a row for the full timeline." />
      {error && <WarningBanner variant="error" title="Unable to load" description={error} />}
      {!rows && !error && <SectionLoading minHeight="30vh" />}
      {rows && (
        <div className="flex min-w-0 w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-1 flex-col p-4 md:p-5">
            <p className="mb-3 text-xs text-slate-500">
              {total > rows.length ? `Showing the latest ${rows.length} of ${total} ended restore(s).` : `${total} ended restore(s).`}
            </p>
            <DataTable
              rows={rows}
              getRowKey={(row) => row.requestId}
              emptyState={<TableEmptyState title="No Ended Restores" description="Finished restores will appear here." />}
              scrollerRef={drag.scrollerRef}
              scrollProps={drag.dragEvents}
              isDragging={drag.isDragging}
              columns={[
                { id: "no", header: "No.", cell: (_row, index) => index + 1 },
                {
                  id: "id",
                  header: "Request",
                  cell: (row) => (
                    <button type="button" className="text-left font-medium text-emerald-600 hover:underline" onClick={() => navigate(ROUTES.BACKUP_RESTORE.RESTORE_DETAIL(row.requestId))}>
                      {row.requestId}
                    </button>
                  ),
                },
                { id: "backup", header: "Backup", cell: (row) => row.backupId },
                { id: "target", header: "Target", cell: (row) => row.target },
                { id: "outcome", header: "Outcome", cell: () => <Badge color="red">Rejected</Badge> },
                { id: "by", header: "Requested by", cell: (row) => row.requestedBy },
                { id: "reason", header: "Decision reason", cell: (row) => <span className="break-words">{row.decisionReason ?? "—"}</span> },
                { id: "at", header: "Decided", cell: (row) => formatDateTime(row.decidedAt ?? "") },
                {
                  id: "evidence",
                  header: "Evidence",
                  cell: (row) => (
                    <Button variant="outline-emerald" size="sm" disabled={downloading === row.requestId} onClick={() => downloadEvidence(row.requestId)}>
                      Download
                    </Button>
                  ),
                },
              ]}
            />
          </div>
        </div>
      )}
    </BackupRestorePage>
  );
};
