import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { useToast } from "@/components/ui/toast/Toast";
import { TABLE_STYLES, type DataTableColumn } from "@/components/ui/table";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { useDebounce } from "@/hooks";
import { ROUTES } from "@/app/routes.constants";
import { getApiErrorMessage } from "@/utils/apiError";
import { backupRestoreApi, type RestoreRequestRecord } from "@/services/api/backupRestore";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { ServerListPanel } from "../components/ServerListPanel";
import { formatDateTime } from "../format";

const ALL = "ALL";
const TARGET_OPTIONS = [
  { label: "All Targets", value: ALL },
  { label: "Validation environment", value: "VALIDATION" },
  { label: "Production", value: "PRODUCTION" },
];

type SortKey = "requestedAt" | "backupNumber" | "requestedBy" | "decidedAt";

/**
 * Restore requests that have ended. A restore run is not built yet, so an ended request is one that was rejected; completed restores
 * will appear here when the run exists. The record is never edited.
 */
export const RestoreHistoryView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [target, setTarget] = useState(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "decidedAt", direction: "desc" });
  const [rows, setRows] = useState<RestoreRequestRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<string>();

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    backupRestoreApi
      .restoreRequests({
        status: "REJECTED",
        search: debouncedSearch.trim() || undefined,
        target: target === ALL ? undefined : target,
        sortBy: sort.key,
        sortDirection: sort.direction,
        page,
        limit: pageSize,
      })
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
        setError(getApiErrorMessage(e, "The restore history could not be loaded."));
      })
      .finally(() => {
        if (!live) return;
        setLoading(false);
        setHasLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [debouncedSearch, target, sort, page, pageSize]);

  useEffect(() => setPage(1), [debouncedSearch, target, pageSize]);

  const sortFor = (key: SortKey) => ({
    direction: sort.key === key ? sort.direction : undefined,
    onSort: () => {
      setSort((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
      setPage(1);
    },
  });

  /** The signed pack as a file, with its SHA-256 shown so that the copy can be checked against it. */
  const downloadEvidence = async (restoreNumber: string) => {
    setDownloading(restoreNumber);
    try {
      const evidence = await backupRestoreApi.restoreEvidence(restoreNumber);
      const url = URL.createObjectURL(new Blob([evidence.pack], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${restoreNumber}-evidence.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast({ type: "success", title: "Evidence downloaded", message: `SHA-256 ${evidence.sha256}` });
    } catch (e) {
      showToast({ type: "error", title: "The evidence could not be downloaded", message: getApiErrorMessage(e, "Try again.") });
    } finally {
      setDownloading(undefined);
    }
  };

  const columns: DataTableColumn<RestoreRequestRecord>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: TABLE_STYLES.headerCell35, cellClassName: TABLE_STYLES.cell30, cell: (_row, index) => (page - 1) * pageSize + index + 1 },
    { id: "restoreNumber", header: "Restore Number", label: "Restore Number", headerClassName: TABLE_STYLES.headerCell35, cell: (row) => (
      <button type="button" className="text-left font-medium text-emerald-600 hover:underline" onClick={() => navigate(ROUTES.BACKUP_RESTORE.RESTORE_DETAIL(row.restoreNumber))}>
        {row.restoreNumber}
      </button>
    ) },
    { id: "backupNumber", header: "Backup Number", label: "Backup Number", sort: sortFor("backupNumber"), cell: (row) => row.backupNumber },
    { id: "target", header: "Target", label: "Target", cell: (row) => (row.target === "PRODUCTION" ? "Production" : "Validation") },
    { id: "outcome", header: "Outcome", label: "Outcome", cell: () => <Badge color="red">Rejected</Badge> },
    { id: "requestedBy", header: "Requested by", label: "Requested by", sort: sortFor("requestedBy"), cell: (row) => row.requestedBy },
    { id: "decisionReason", header: "Decision reason", label: "Decision reason", cell: (row) => <span className="break-words">{row.decisionReason ?? "—"}</span> },
    { id: "decidedAt", header: "Decided", label: "Decided", sort: sortFor("decidedAt"), cell: (row) => formatDateTime(row.decidedAt ?? "") },
    {
      id: "evidence",
      header: "Evidence",
      label: "Evidence",
      cell: (row) => (
        <Button variant="outline-emerald" size="sm" disabled={downloading === row.restoreNumber} onClick={() => downloadEvidence(row.restoreNumber)}>
          Download
        </Button>
      ),
    },
  ];

  return (
    <BackupRestorePage title="Restore History & Evidence" group="Restore" preview={false}>
      <WarningBanner variant="info" description="The permanent record of each ended restore: request, decision and reason. Open a row for the full timeline." />
      <ServerListPanel
        tableKey="backup-restore.history.v1"
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.restoreNumber}
        loading={loading}
        hasLoaded={hasLoaded}
        error={error}
        emptyTitle="No Ended Restores"
        emptyDescription="Finished restores will appear here. Try changing your search or filters."
        search={search}
        onSearch={setSearch}
        searchLabel="Search restore history"
        searchPlaceholder="Restore, backup or person…"
        filters={[{ id: "target", label: "Target", value: target, options: TARGET_OPTIONS, defaultValue: ALL, placeholder: "All Targets", onChange: setTarget }]}
        onClear={() => {
          setSearch("");
          setTarget(ALL);
          setPage(1);
        }}
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
