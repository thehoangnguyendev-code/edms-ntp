import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import type { DataTableAction, DataTableColumn } from "@/components/ui/table";
import { TABLE_STYLES } from "@/components/ui/table";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { useToast } from "@/components/ui/toast/Toast";
import { useDebounce } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import { dateTimeToInstant } from "../dateFilters";
import { backupRestoreApi } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { ServerListPanel } from "../components/ServerListPanel";
import { useBackupJobs } from "../components/useBackupJobs";
import { VERIFICATION_COLOR, statusLabel, type BackupRecord } from "../types";
import { formatDateTime } from "../format";

type SortKey = "backupNumber" | "startedAt" | "verification" | "verifiedAt";

const ALL = "ALL";
const RESULT_OPTIONS = [{ label: "All Results", value: ALL }, ...["FAILED", "NOT_VERIFIED", "VERIFIED"].map((value) => ({ label: statusLabel(value), value }))];

/**
 * Integrity result of every completed backup, problems first: a backup that has never passed its check is not proven, and a
 * failed one must not be used for a restore. Each re-check adds a result; earlier results are never replaced. Search, filters,
 * sorting and paging run on the server; the columns can be shown, hidden, pinned and reordered per user.
 */
export const BackupVerificationResultsView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canVerify = hasPermission("backup.backup.verify");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [result, setResult] = useState(ALL);
  const [takenFrom, setTakenFrom] = useState("");
  const [takenTo, setTakenTo] = useState("");
  const [checkedFrom, setCheckedFrom] = useState("");
  const [checkedTo, setCheckedTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // "FAILED" < "NOT_VERIFIED" < "VERIFIED", so ascending puts the problems first
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "verification", direction: "asc" });
  const [rows, setRows] = useState<BackupRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  const { working, follow } = useBackupJobs(reload);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    backupRestoreApi
      .list({
        status: "COMPLETED",
        search: debouncedSearch.trim() || undefined,
        verification: result === ALL ? undefined : result,
        startedFrom: dateTimeToInstant(takenFrom, "start"),
        startedTo: dateTimeToInstant(takenTo, "end"),
        checkedFrom: dateTimeToInstant(checkedFrom, "start"),
        checkedTo: dateTimeToInstant(checkedTo, "end"),
        sortBy: sort.key,
        sortDirection: sort.direction,
        page,
        limit: pageSize,
      })
      .then((data) => {
        if (!active) return;
        setRows(data.data);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.totalPages || 1);
        if (data.pagination.page !== page) setPage(data.pagination.page);
      })
      .catch((e) => {
        if (!active) return;
        setRows([]);
        setTotal(0);
        setError(getApiErrorMessage(e, "Unable to load the verification results."));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setHasLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [debouncedSearch, result, takenFrom, takenTo, checkedFrom, checkedTo, sort, page, pageSize, reloadKey]);

  useEffect(() => setPage(1), [debouncedSearch, result, takenFrom, takenTo, checkedFrom, checkedTo, pageSize]);

  const clearFilters = () => {
    setSearch("");
    setResult(ALL);
    setTakenFrom("");
    setTakenTo("");
    setCheckedFrom("");
    setCheckedTo("");
    setPage(1);
  };

  const sortFor = (key: SortKey) => ({
    direction: sort.key === key ? sort.direction : undefined,
    onSort: () => {
      setSort((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
      setPage(1);
    },
  });

  const verify = async (backupNumber: string) => {
    try {
      const { jobId } = await backupRestoreApi.verify(backupNumber);
      showToast({ type: "info", title: "Integrity check requested", message: backupNumber });
      void follow(jobId, "Integrity check");
    } catch (e) {
      showToast({ type: "error", title: "Unable to start the check", message: getApiErrorMessage(e, "The request was refused.") });
    }
  };

  const columns: DataTableColumn<BackupRecord>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: TABLE_STYLES.headerCell35, cellClassName: TABLE_STYLES.cell30, cell: (_row, index) => (page - 1) * pageSize + index + 1 },
    {
      id: "id",
      header: "Backup Number",
      label: "Backup Number",
      sort: sortFor("backupNumber"),
      cell: (row) => (
        <button type="button" className="text-left font-medium text-emerald-600 hover:underline" onClick={() => navigate(ROUTES.BACKUP_RESTORE.BACKUP_DETAIL(row.id))}>
          {row.id}
        </button>
      ),
    },
    { id: "started", header: "Backup taken", label: "Backup taken", sort: sortFor("startedAt"), cell: (row) => formatDateTime(row.startedAt) },
    { id: "schema", header: "Schema version", label: "Schema version", cell: (row) => row.schemaVersion ?? "—" },
    {
      id: "verification",
      header: "Integrity result",
      label: "Integrity result",
      sort: sortFor("verification"),
      cell: (row) => <Badge color={VERIFICATION_COLOR[row.verification]}>{statusLabel(row.verification)}</Badge>,
    },
    { id: "verifiedAt", header: "Checked", label: "Checked", sort: sortFor("verifiedAt"), cell: (row) => formatDateTime(row.verifiedAt) },
  ];

  const action: DataTableAction<BackupRecord> = {
    cell: (row) => (
      <Button size="sm" variant="default" disabled={!canVerify || working > 0} onClick={() => void verify(row.id)}>
        Verify Again
      </Button>
    ),
  };

  return (
    <BackupRestorePage title="Backup Verification Results" group="Backup" preview={false}>
      <WarningBanner variant="info" description="A backup that has not passed its check cannot be relied on for a restore. Backups with a failed or missing result are listed first." />
      <ServerListPanel
        tableKey="backup-restore.verifications"
        columns={columns}
        action={action}
        rows={rows}
        getRowKey={(row) => row.id}
        loading={loading}
        hasLoaded={hasLoaded}
        error={error}
        emptyTitle="No Backups To Verify"
        emptyDescription="Completed backups appear here. Try changing your search or filters."
        search={search}
        onSearch={setSearch}
        searchLabel="Search backups"
        searchPlaceholder="Backup Number or person…"
        filters={[{ id: "result", label: "Integrity", value: result, options: RESULT_OPTIONS, defaultValue: ALL, placeholder: "All Results", onChange: setResult }]}
        dates={[
          { id: "taken", label: "Backup Taken Date Range", from: takenFrom, to: takenTo, onFromChange: setTakenFrom, onToChange: setTakenTo, includeTime: true },
          { id: "checked", label: "Checked Date Range", from: checkedFrom, to: checkedTo, onFromChange: setCheckedFrom, onToChange: setCheckedTo, includeTime: true },
        ]}
        onClear={clearFilters}
        page={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </BackupRestorePage>
  );
};
