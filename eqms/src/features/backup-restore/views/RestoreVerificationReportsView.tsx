import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { TABLE_STYLES, type DataTableColumn } from "@/components/ui/table";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { useDebounce } from "@/hooks";
import { getApiErrorMessage } from "@/utils/apiError";
import { backupRestoreApi, type RestoreRehearsal } from "@/services/api/backupRestore";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { ServerListPanel } from "../components/ServerListPanel";
import { formatDateTime } from "../format";

const ALL = "ALL";
const STATUS_COLOR: Record<RestoreRehearsal["status"], "emerald" | "red" | "amber" | "slate"> = {
  PASSED: "emerald",
  FAILED: "red",
  RUNNING: "amber",
  QUEUED: "amber",
};
const STATUS_LABEL: Record<RestoreRehearsal["status"], string> = { PASSED: "Passed", FAILED: "Failed", RUNNING: "Running", QUEUED: "Queued" };
const STATUS_OPTIONS = [{ label: "All Outcomes", value: ALL }, ...(Object.keys(STATUS_COLOR) as RestoreRehearsal["status"][]).map((value) => ({ label: STATUS_LABEL[value], value }))];

type SortKey = "requestedAt" | "status" | "backupNumber" | "requestedBy" | "finishedAt";

/** The automatic checks after each test restore: schema, row counts, documents against records, aliases, signatures, state. */
export const RestoreVerificationReportsView: React.FC = () => {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "requestedAt", direction: "desc" });
  const [rows, setRows] = useState<RestoreRehearsal[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<RestoreRehearsal>();

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    backupRestoreApi
      .rehearsals({
        search: debouncedSearch.trim() || undefined,
        status: status === ALL ? undefined : status,
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
        setError(getApiErrorMessage(e, "The verification reports could not be loaded."));
      })
      .finally(() => {
        if (!live) return;
        setLoading(false);
        setHasLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [debouncedSearch, status, sort, page, pageSize]);

  useEffect(() => setPage(1), [debouncedSearch, status, pageSize]);

  const sortFor = (key: SortKey) => ({
    direction: sort.key === key ? sort.direction : undefined,
    onSort: () => {
      setSort((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
      setPage(1);
    },
  });

  const open = async (row: RestoreRehearsal) => {
    setSelected(row);
    try {
      setSelected(await backupRestoreApi.rehearsal(row.rehearsalId));
    } catch (e) {
      setError(getApiErrorMessage(e, "The report could not be opened."));
    }
  };

  const columns: DataTableColumn<RestoreRehearsal>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: TABLE_STYLES.headerCell35, cellClassName: TABLE_STYLES.cell30, cell: (_row, index) => (page - 1) * pageSize + index + 1 },
    { id: "rehearsalId", header: "Test restore", label: "Test restore", headerClassName: TABLE_STYLES.headerCell35, cell: (row) => (
      <button type="button" className="text-left font-medium text-emerald-600 hover:underline" onClick={() => void open(row)}>{row.rehearsalId}</button>
    ) },
    { id: "backupNumber", header: "Backup Number", label: "Backup Number", sort: sortFor("backupNumber"), cell: (row) => row.backupNumber },
    { id: "status", header: "Outcome", label: "Outcome", sort: sortFor("status"), cell: (row) => <Badge color={STATUS_COLOR[row.status]}>{STATUS_LABEL[row.status]}</Badge> },
    { id: "checkCount", header: "Checks", label: "Checks", cell: (row) => row.checkCount },
    { id: "failedCount", header: "Failed", label: "Failed", cell: (row) => <Badge color={row.failedCount ? "red" : "slate"}>{row.failedCount}</Badge> },
    { id: "requestedBy", header: "Requested by", label: "Requested by", sort: sortFor("requestedBy"), cell: (row) => row.requestedBy },
    { id: "requestedAt", header: "Requested", label: "Requested", sort: sortFor("requestedAt"), cell: (row) => formatDateTime(row.requestedAt ?? "") },
    { id: "finishedAt", header: "Finished", label: "Finished", sort: sortFor("finishedAt"), cell: (row) => formatDateTime(row.finishedAt ?? "") },
  ];

  return (
    <BackupRestorePage title="Restore Verification Reports" group="Restore" preview={false}>
      <WarningBanner variant="info" description="A test restore is only complete when every required check has passed. Open a row to see each check and its detail." />
      <ServerListPanel
        tableKey="backup-restore.verification-reports.v1"
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.rehearsalId}
        loading={loading}
        hasLoaded={hasLoaded}
        error={error}
        emptyTitle="No Verification Reports"
        emptyDescription="Reports appear after a test restore has run. Try changing your search or filters."
        search={search}
        onSearch={setSearch}
        searchLabel="Search verification reports"
        searchPlaceholder="Test restore, backup or person…"
        filters={[{ id: "status", label: "Outcome", value: status, options: STATUS_OPTIONS, defaultValue: ALL, placeholder: "All Outcomes", onChange: setStatus }]}
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
        onRowClick={(row) => void open(row)}
      />
      {selected && (
        <div className="mt-4 min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{selected.rehearsalId}</p>
          {selected.errorDetail && (
            <p className="mt-2 break-words text-xs text-red-700">
              {selected.errorCode}: {selected.errorDetail}
            </p>
          )}
          {!selected.checks ? (
            <p className="mt-2 text-xs text-slate-500">Checks are loading or not yet recorded.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-200">
              {selected.checks.map((check) => (
                <li key={check.code} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-slate-900">{check.code}</p>
                    <p className="break-words text-xs text-slate-500">{check.title}</p>
                    {check.detail && <p className="break-words text-xs text-slate-500">{check.detail}</p>}
                  </div>
                  <Badge color={check.ok ? "emerald" : check.required ? "red" : "amber"}>{check.ok ? "Pass" : check.required ? "Fail" : "Warning"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </BackupRestorePage>
  );
};
