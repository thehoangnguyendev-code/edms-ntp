import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical, Plus } from "lucide-react";
import { IconChecks, IconInfoCircle, IconRestore, IconShieldCheck } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import type { DataTableAction, DataTableColumn } from "@/components/ui/table";
import { TABLE_STYLES } from "@/components/ui/table";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast/Toast";
import { useDebounce, usePortalDropdown } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import { dateToInstant } from "@/features/settings/announcements/announcementFilters";
import { backupRestoreApi } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { CreateBackupModal, type CreateBackupInput } from "../components/CreateBackupModal";
import { ServerListPanel } from "../components/ServerListPanel";
import { useBackupJobs } from "../components/useBackupJobs";
import { BACKUP_STATUS_COLOR, VERIFICATION_COLOR, statusLabel, type BackupRecord } from "../types";
import { formatBytes, formatDateTime } from "../format";

type SortKey = "startedAt" | "backupNumber" | "status" | "type" | "sizeBytes" | "createdBy" | "verification";

const ALL = "ALL";
const option = (value: string) => ({ label: statusLabel(value), value });
const STATUS_OPTIONS = [{ label: "All", value: ALL }, ...["COMPLETED", "RUNNING", "FAILED"].map(option)];
const TYPE_OPTIONS = [{ label: "All", value: ALL }, { label: "Full", value: "FULL" }, { label: "Pre-change", value: "PRE_CHANGE" }];
const INTEGRITY_OPTIONS = [{ label: "All", value: ALL }, ...["VERIFIED", "NOT_VERIFIED", "FAILED"].map(option)];

/**
 * Backup History: every backup the agent has taken, newest first. Search, filters, sorting and paging all run on the server; the
 * columns can be shown, hidden, pinned and reordered per user. A backup opens on its own screen.
 */
export const BackupsView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const menu = usePortalDropdown();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [status, setStatus] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [integrity, setIntegrity] = useState(ALL);
  const [startedFrom, setStartedFrom] = useState("");
  const [startedTo, setStartedTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "startedAt", direction: "desc" });
  const [rows, setRows] = useState<BackupRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [creating, setCreating] = useState(false);
  const [starting, setStarting] = useState(false);

  const canRun = hasPermission("backup.backup.run");
  const canVerify = hasPermission("backup.backup.verify");
  const actionRow = rows.find((row) => row.id === menu.openId);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  const { working, follow } = useBackupJobs(reload);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    backupRestoreApi
      .list({
        search: debouncedSearch.trim() || undefined,
        status: status === ALL ? undefined : status,
        type: type === ALL ? undefined : type,
        verification: integrity === ALL ? undefined : integrity,
        startedFrom: dateToInstant(startedFrom, "start"),
        startedTo: dateToInstant(startedTo, "end"),
        sortBy: sort.key,
        sortDirection: sort.direction,
        page,
        limit: pageSize,
      })
      .then((result) => {
        if (!active) return;
        setRows(result.data);
        setTotal(result.pagination.total);
        setTotalPages(result.pagination.totalPages || 1);
        if (result.pagination.page !== page) setPage(result.pagination.page);
      })
      .catch((e) => {
        if (!active) return;
        setRows([]);
        setTotal(0);
        setError(getApiErrorMessage(e, "Unable to load the backups."));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setHasLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [debouncedSearch, status, type, integrity, startedFrom, startedTo, sort, page, pageSize, reloadKey]);

  // A different search, filter or page size starts again from the first page.
  useEffect(() => setPage(1), [debouncedSearch, status, type, integrity, startedFrom, startedTo, pageSize]);

  const clearFilters = () => {
    setSearch("");
    setStatus(ALL);
    setType(ALL);
    setIntegrity(ALL);
    setStartedFrom("");
    setStartedTo("");
    setPage(1);
  };

  const sortFor = (key: SortKey) => ({
    direction: sort.key === key ? sort.direction : undefined,
    onSort: () => {
      setSort((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
      setPage(1);
    },
  });

  const create = async (input: CreateBackupInput) => {
    setStarting(true);
    try {
      const { jobId } = await backupRestoreApi.create(input);
      setCreating(false);
      showToast({ type: "info", title: "Backup requested", message: "The agent is taking the backup." });
      reload();
      void follow(jobId, "Backup");
    } catch (e) {
      showToast({ type: "error", title: "Unable to start the backup", message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setStarting(false);
    }
  };

  const verify = async (backupNumber: string) => {
    try {
      const { jobId } = await backupRestoreApi.verify(backupNumber);
      showToast({ type: "info", title: "Integrity check requested", message: backupNumber });
      void follow(jobId, "Integrity check");
    } catch (e) {
      showToast({ type: "error", title: "Unable to start the check", message: getApiErrorMessage(e, "The request was refused.") });
    }
  };

  const open = (backupNumber: string) => navigate(ROUTES.BACKUP_RESTORE.BACKUP_DETAIL(backupNumber));
  const requestRestore = (backupNumber: string) => navigate(`${ROUTES.BACKUP_RESTORE.RESTORE_NEW}?backup=${encodeURIComponent(backupNumber)}`);

  const columns: DataTableColumn<BackupRecord>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: TABLE_STYLES.headerCell35, cellClassName: TABLE_STYLES.cell30, cell: (_b, i) => (page - 1) * pageSize + i + 1 },
    {
      id: "id",
      header: "Backup Number",
      label: "Backup Number",
      sort: sortFor("backupNumber"),
      cell: (b) => (
        <div>
          <button type="button" className="text-left font-medium text-emerald-600 hover:underline" onClick={() => open(b.id)}>
            {b.id}
          </button>
          <span className="block text-xs text-slate-500">
            {statusLabel(b.type)} · {statusLabel(b.trigger)}
          </span>
        </div>
      ),
    },
    { id: "status", header: "Status", label: "Status", sort: sortFor("status"), cell: (b) => <Badge color={BACKUP_STATUS_COLOR[b.status]}>{statusLabel(b.status)}</Badge> },
    { id: "type", header: "Type", label: "Type", sort: sortFor("type"), cell: (b) => statusLabel(b.type) },
    { id: "started", header: "Started", label: "Started", sort: sortFor("startedAt"), cell: (b) => formatDateTime(b.startedAt) },
    { id: "size", header: "Size", label: "Size", sort: sortFor("sizeBytes"), cell: (b) => formatBytes(b.sizeBytes) },
    { id: "verify", header: "Integrity", label: "Integrity", sort: sortFor("verification"), cell: (b) => <Badge color={VERIFICATION_COLOR[b.verification]}>{statusLabel(b.verification)}</Badge> },
    { id: "by", header: "Requested by", label: "Requested by", sort: sortFor("createdBy"), cell: (b) => b.createdBy },
    {
      id: "retention",
      header: "Retained",
      label: "Retained",
      cell: (b) => (
        <span className="inline-flex items-center gap-1.5">
          {b.retention === "PERMANENT" ? "Permanently" : b.retentionUntil ? new Date(b.retentionUntil).toLocaleDateString() : "—"}
          {b.legalHold && <Badge color="amber">Hold</Badge>}
        </span>
      ),
    },
  ];

  const action: DataTableAction<BackupRecord> = {
    cell: (b) => (
      <button
        type="button"
        ref={menu.getRef(b.id)}
        aria-label="More actions"
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8"
        onClick={(event) => menu.toggle(b.id, event)}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    ),
  };

  return (
    <BackupRestorePage
      title="Backup History"
      group="Backup"
      preview={false}
      actions={
        <Button size="sm" className="gap-2 whitespace-nowrap" onClick={() => setCreating(true)} disabled={!canRun}>
          <Plus className="h-4 w-4" />
          Create Backup
        </Button>
      }
    >
      {working > 0 && <WarningBanner variant="info" description="The agent is working on a request. This list refreshes when it finishes." />}
      <ServerListPanel
        tableKey="backup-restore.history"
        columns={columns}
        action={action}
        rows={rows}
        getRowKey={(b) => b.id}
        loading={loading}
        hasLoaded={hasLoaded}
        error={error}
        emptyTitle="No Backups Found"
        emptyDescription="No backup matches. Try changing your search or filters."
        search={search}
        onSearch={setSearch}
        searchLabel="Search backups"
        searchPlaceholder="Backup Number, person or reason…"
        filters={[
          { id: "status", label: "Status", value: status, options: STATUS_OPTIONS, defaultValue: ALL, placeholder: "All", onChange: setStatus },
          { id: "type", label: "Type", value: type, options: TYPE_OPTIONS, defaultValue: ALL, placeholder: "All", onChange: setType },
          { id: "integrity", label: "Integrity", value: integrity, options: INTEGRITY_OPTIONS, defaultValue: ALL, placeholder: "All", onChange: setIntegrity },
        ]}
        dates={[{ id: "started", label: "Started", from: startedFrom, to: startedTo, onFromChange: setStartedFrom, onToChange: setStartedTo }]}
        onClear={clearFilters}
        page={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <PortalDropdownMenu isOpen={!!actionRow} onClose={menu.close} position={menu.position} minWidth={200}>
        {actionRow && (
          <div className="py-1">
            <DropdownMenuItem icon={<IconInfoCircle className="h-4 w-4" />} onClick={() => { open(actionRow.id); menu.close(); }}>
              View Detail
            </DropdownMenuItem>
            <DropdownMenuItem icon={<IconChecks className="h-4 w-4" />} disabled={actionRow.status !== "COMPLETED" || !canVerify} onClick={() => { void verify(actionRow.id); menu.close(); }}>
              Verify Integrity
            </DropdownMenuItem>
            <DropdownMenuItem icon={<IconRestore className="h-4 w-4" />} disabled={actionRow.status !== "COMPLETED" || actionRow.verification !== "VERIFIED"} onClick={() => { requestRestore(actionRow.id); menu.close(); }}>
              Request Restore
            </DropdownMenuItem>
          </div>
        )}
      </PortalDropdownMenu>

      <CreateBackupModal isOpen={creating} busy={starting} onClose={() => setCreating(false)} onConfirm={(input) => void create(input)} />
    </BackupRestorePage>
  );
};
