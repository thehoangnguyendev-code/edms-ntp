import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormField, Textarea } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { TABLE_STYLES } from "@/components/ui/table/TablePrimitives";
import type { DataTableAction, DataTableColumn } from "@/components/ui/table/DataTable";
import { useToast } from "@/components/ui/toast/Toast";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import { ServerListPanel } from "@/features/backup-restore/components/ServerListPanel";
import { formatBytes, formatDateTime } from "@/features/backup-restore/format";
import { statusLabel } from "@/features/backup-restore/types";
import { backupRestoreApi, type BackupExport, type ExportStatus } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { EXPORT_STATUS_COLOR, exportErrorMessage } from "./mediaLabels";

type SortKey = "requestedAt" | "status" | "backupId" | "media" | "requestedBy" | "finishedAt";

const ALL = "ALL";
const STATUS_OPTIONS = [{ label: "All Statuses", value: ALL }, ...(Object.keys(EXPORT_STATUS_COLOR) as ExportStatus[]).map((value) => ({ label: statusLabel(value), value }))];

/** Requests to write a backup to an offline medium. A second person approves each one; the Backup Agent then builds the package. */
export const ExportRequestsPanel: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canApprove = hasPermission("backup.backup.export.approve");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "requestedAt", direction: "desc" });
  const [rows, setRows] = useState<BackupExport[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<BackupExport | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    backupRestoreApi
      .exports({ search: debouncedSearch.trim() || undefined, status: status === ALL ? undefined : status, sortBy: sort.key, sortDirection: sort.direction, page, limit: pageSize })
      .then((data) => {
        if (!live) return;
        setRows(data.data);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.totalPages || 1);
        if (data.pagination.page !== page) setPage(data.pagination.page);
      })
      .catch((e) => {
        if (!live) return;
        setRows([]);
        setTotal(0);
        setError(getApiErrorMessage(e, "Unable to load the export requests."));
      })
      .finally(() => {
        if (!live) return;
        setLoading(false);
        setHasLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [debouncedSearch, status, sort, page, pageSize, reloadKey]);

  // an approved export is built in the background; keep looking until it is finished
  useEffect(() => {
    if (!rows.some((row) => row.status === "APPROVED" || row.status === "RUNNING")) return;
    const timer = setTimeout(() => setReloadKey((key) => key + 1), 5000);
    return () => clearTimeout(timer);
  }, [rows]);

  useEffect(() => setPage(1), [debouncedSearch, status, pageSize]);

  const sortFor = (key: SortKey) => ({
    direction: sort.key === key ? sort.direction : undefined,
    onSort: () => {
      setSort((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
      setPage(1);
    },
  });

  const approve = async (row: BackupExport) => {
    setBusy(true);
    try {
      await backupRestoreApi.approveExport(row.exportId);
      showToast({ type: "success", title: "Export approved", message: `${row.exportId} is being written to ${row.mediaLabel}.` });
    } catch (e) {
      showToast({ type: "error", title: "The export was not approved", message: exportErrorMessage(e, "The request was refused.") });
    } finally {
      setBusy(false);
      setReloadKey((key) => key + 1);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    setBusy(true);
    try {
      await backupRestoreApi.rejectExport(rejecting.exportId, rejectReason.trim());
      showToast({ type: "success", title: "Export rejected", message: rejecting.exportId });
      setRejecting(null);
      setRejectReason("");
    } catch (e) {
      showToast({ type: "error", title: "The export was not rejected", message: exportErrorMessage(e, "The request was refused.") });
    } finally {
      setBusy(false);
      setReloadKey((key) => key + 1);
    }
  };

  const columns: DataTableColumn<BackupExport>[] = [
    { id: "exportId", header: "Export", label: "Export", locked: true, headerClassName: TABLE_STYLES.headerCell35, cell: (row) => <span className="font-medium">{row.exportId}</span> },
    {
      id: "backupId",
      header: "Backup",
      label: "Backup",
      sort: sortFor("backupId"),
      cell: (row) => (
        <button type="button" className="text-left text-emerald-600 hover:underline" onClick={() => navigate(ROUTES.BACKUP_RESTORE.BACKUP_DETAIL(row.backupId))}>
          {row.backupId}
        </button>
      ),
    },
    {
      id: "media",
      header: "Medium",
      label: "Medium",
      sort: sortFor("media"),
      cell: (row) => (
        <button type="button" className="text-left text-emerald-600 hover:underline" onClick={() => navigate(ROUTES.SETTINGS.BACKUP_ADMINISTRATION.MEDIUM_DETAIL(row.mediaId))}>
          {row.mediaLabel}
        </button>
      ),
    },
    {
      id: "status",
      header: "Status",
      label: "Status",
      sort: sortFor("status"),
      cell: (row) => (
        <span className="inline-flex flex-col gap-0.5">
          <Badge color={EXPORT_STATUS_COLOR[row.status]}>{statusLabel(row.status)}</Badge>
          {row.status === "INVALID" && <span className="text-2xs text-red-600">{row.errorCode}</span>}
        </span>
      ),
    },
    { id: "requestedBy", header: "Requested by", label: "Requested by", sort: sortFor("requestedBy"), cell: (row) => row.requestedBy },
    { id: "requestedAt", header: "Requested", label: "Requested", sort: sortFor("requestedAt"), cell: (row) => formatDateTime(row.requestedAt) },
    { id: "approvedBy", header: "Approved by", label: "Approved by", cell: (row) => row.approvedBy ?? "—" },
    { id: "size", header: "Size", label: "Size", cell: (row) => formatBytes(row.sizeBytes ?? row.estimatedBytes ?? undefined) },
    { id: "finishedAt", header: "Finished", label: "Finished", sort: sortFor("finishedAt"), cell: (row) => formatDateTime(row.finishedAt) },
  ];

  const action: DataTableAction<BackupExport> = {
    cell: (row) => {
      if (row.status !== "REQUESTED" || !canApprove) return null;
      const mine = !!user?.username && user.username.toLowerCase() === row.requestedBy.toLowerCase();
      return (
        <span className="inline-flex gap-2">
          <Button size="sm" variant="default" disabled={busy || mine} title={mine ? "You asked for this export, so someone else has to approve it." : undefined} onClick={() => void approve(row)}>
            Approve
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejecting(row)}>
            Reject
          </Button>
        </span>
      );
    },
  };

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-900 sm:text-base">Export Requests</h2>
        <p className="text-xs text-slate-500">Backups written to an offline medium so a copy can be kept somewhere else. Request one from the backup&apos;s own screen.</p>
      </div>
      <ServerListPanel
        tableKey="backup-admin.export-requests"
        columns={columns}
        action={action}
        rows={rows}
        getRowKey={(row) => row.exportId}
        loading={loading}
        hasLoaded={hasLoaded}
        error={error}
        emptyTitle="No Export Requests"
        emptyDescription="Exports appear here once someone asks for a backup to be written to an offline medium."
        search={search}
        onSearch={setSearch}
        searchLabel="Search export requests"
        searchPlaceholder="Export, backup, medium or person…"
        filters={[{ id: "status", label: "Status", value: status, options: STATUS_OPTIONS, defaultValue: ALL, placeholder: "All Statuses", onChange: setStatus }]}
        onClear={() => {
          setSearch("");
          setStatus(ALL);
          setPage(1);
        }}
        page={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
      <FormModal
        isOpen={!!rejecting}
        onClose={() => setRejecting(null)}
        title={`Reject ${rejecting?.exportId ?? "Export"}`}
        description="The request is kept in the history as rejected. Say why."
        confirmText="Reject"
        confirmDisabled={!rejectReason.trim() || busy}
        onConfirm={() => void reject()}
      >
        <FormField label="Reason" required>
          <Textarea rows={3} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
        </FormField>
      </FormModal>
    </section>
  );
};
