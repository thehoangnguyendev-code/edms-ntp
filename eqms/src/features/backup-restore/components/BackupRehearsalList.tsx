import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import type { DataTableColumn } from "@/components/ui/table";
import { TABLE_STYLES } from "@/components/ui/table";
import { useDebounce } from "@/hooks";
import { backupRestoreApi, type RestoreRehearsal } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDateTime } from "../format";
import { statusLabel } from "../types";
import { BackupExportButton } from "./BackupExportButton";
import { ServerListPanel } from "./ServerListPanel";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { tr } from "@/i18n";

type SortKey = "status" | "requestedBy" | "requestedAt";

const STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "Passed", value: "PASSED" },
  { label: "Failed", value: "FAILED" },
  { label: "Running", value: "RUNNING" },
  { label: "Queued", value: "QUEUED" },
];

/** The test restores of one backup: searched, filtered, sorted and paged by the server, like every other list of this module. */
export function BackupRehearsalList({ backupNumber, reloadKey }: { backupNumber: string; reloadKey: number }) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "requestedAt", direction: "desc" });
  const [rows, setRows] = useState<RestoreRehearsal[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    backupRestoreApi
      .rehearsals({ backupNumber, search: debouncedSearch.trim() || undefined, status: status || undefined, sortBy: sort.key, sortDirection: sort.direction, page, limit: pageSize })
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
        setError(getApiErrorMessage(e, "The test restores could not be read."));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setHasLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [backupNumber, debouncedSearch, status, sort, page, pageSize, reloadKey]);

  useEffect(() => setPage(1), [debouncedSearch, status, pageSize]);

  const sortFor = (key: SortKey) => ({
    direction: sort.key === key ? sort.direction : undefined,
    onSort: () => {
      setSort((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
      setPage(1);
    },
  });

  const columns: DataTableColumn<RestoreRehearsal>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: TABLE_STYLES.headerCell35, cellClassName: TABLE_STYLES.cell30, cell: (_row, index) => (page - 1) * pageSize + index + 1 },
    { id: "id", header: "Test", label: "Test", cell: (row) => <span className="font-medium">{row.rehearsalId}</span> },
    { id: "status", header: "Result", label: "Result", sort: sortFor("status"), cell: (row) => <Badge color={row.status === "PASSED" ? "emerald" : row.status === "FAILED" ? "red" : "amber"}>{statusLabel(row.status)}</Badge> },
    { id: "checks", header: "Checks", label: "Checks", cell: (row) => (row.checkCount > 0 ? `${row.checkCount - row.failedCount} of ${row.checkCount} passed` : "—") },
    { id: "error", header: "Problem", label: "Problem", cell: (row) => (row.errorCode ? <span className="font-mono text-xs">{row.errorCode}</span> : "—") },
    { id: "by", header: tr("Requested by"), label: tr("Requested by"), sort: sortFor("requestedBy"), cell: (row) => row.requestedBy },
    { id: "at", header: "Requested", label: "Requested", sort: sortFor("requestedAt"), cell: (row) => formatDateTime(row.requestedAt) },
    { id: "took", header: tr("Restore time"), label: tr("Restore time"), cell: (row) => (row.restoreSeconds == null ? "—" : `${row.restoreSeconds} s`) },
  ];

  return (
    <ServerListPanel
      tableKey="backup-restore.rehearsals"
      framed={false}
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.rehearsalId}
      loading={loading}
      hasLoaded={hasLoaded}
      error={error}
      emptyTitle={tr("No test restores")}
      emptyDescription={tr("A test restore puts the backup into a scratch database, runs the checks and drops the database; production is not changed.")}
      search={search}
      onSearch={setSearch}
      searchLabel="Search test restores"
      searchPlaceholder={tr("Test, result, problem or person…")}
      filters={[{ id: "status", label: "Result", value: status, options: STATUS_OPTIONS, defaultValue: "", placeholder: "All", onChange: setStatus }]}
      onClear={() => {
        setSearch("");
        setStatus("");
        setPage(1);
      }}
      page={page}
      totalPages={totalPages}
      totalItems={total}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      toolbarActions={
        <BackupExportButton
          dataset="backup-rehearsals"
          params={{ backupNumber, search: debouncedSearch.trim() || undefined, status: status || undefined, sortBy: sort.key, sortDirection: sort.direction }}
        />
      }
    />
  );
}
