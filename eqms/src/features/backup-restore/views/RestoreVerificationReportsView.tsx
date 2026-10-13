import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { DataTable } from "@/components/ui/table";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { getApiErrorMessage } from "@/utils/apiError";
import { backupRestoreApi, type RestoreRehearsal } from "@/services/api/backupRestore";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { formatDateTime } from "../format";

const STATUS_COLOR: Record<RestoreRehearsal["status"], "emerald" | "red" | "amber" | "slate"> = {
  PASSED: "emerald",
  FAILED: "red",
  RUNNING: "amber",
  QUEUED: "amber",
};

/** The automatic checks after each test restore: schema, row counts, documents against records, aliases, signatures, state. */
export const RestoreVerificationReportsView: React.FC = () => {
  const drag = useTableDragScroll();
  const [rows, setRows] = useState<RestoreRehearsal[]>();
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<RestoreRehearsal>();

  useEffect(() => {
    let live = true;
    backupRestoreApi
      .rehearsals({ page: 1, limit: 50, sortBy: "requestedAt", sortDirection: "desc" })
      .then((page) => {
        if (!live) return;
        setRows(page.data);
        setTotal(page.pagination.total);
      })
      .catch((e) => {
        if (live) setError(getApiErrorMessage(e, "The verification reports could not be loaded."));
      });
    return () => {
      live = false;
    };
  }, []);

  const open = async (row: RestoreRehearsal) => {
    setSelected(row);
    try {
      setSelected(await backupRestoreApi.rehearsal(row.rehearsalId));
    } catch (e) {
      setError(getApiErrorMessage(e, "The report could not be opened."));
    }
  };

  return (
    <BackupRestorePage title="Restore Verification Reports" group="Restore">
      <WarningBanner variant="info" description="A test restore is only complete when every required check has passed. Open a row to see each check and its detail." />
      {error && <WarningBanner variant="error" title="Unable to load" description={error} />}
      {!rows && !error && <SectionLoading minHeight="30vh" />}
      {rows && (
        <div className="flex min-w-0 w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-1 flex-col p-4 md:p-5">
            <p className="mb-3 text-xs text-slate-500">
              {total > rows.length ? `Showing the latest ${rows.length} of ${total} reports.` : `${total} report(s).`}
            </p>
            <DataTable
              rows={rows}
              getRowKey={(row) => row.rehearsalId}
              emptyState={<TableEmptyState title="No Verification Reports" description="Reports appear after a test restore has run." />}
              scrollerRef={drag.scrollerRef}
              scrollProps={drag.dragEvents}
              isDragging={drag.isDragging}
              columns={[
                { id: "no", header: "No.", cell: (_row, index) => index + 1 },
                {
                  id: "id",
                  header: "Test restore",
                  cell: (row) => (
                    <button type="button" className="text-left font-medium text-emerald-600 hover:underline" onClick={() => void open(row)}>
                      {row.rehearsalId}
                    </button>
                  ),
                },
                { id: "backup", header: "Backup", cell: (row) => row.backupId },
                { id: "status", header: "Outcome", cell: (row) => <Badge color={STATUS_COLOR[row.status]}>{row.status}</Badge> },
                { id: "checks", header: "Checks", cell: (row) => row.checkCount },
                { id: "failed", header: "Failed", cell: (row) => <Badge color={row.failedCount ? "red" : "slate"}>{row.failedCount}</Badge> },
                { id: "by", header: "Requested by", cell: (row) => row.requestedBy },
                { id: "at", header: "Requested", cell: (row) => formatDateTime(row.requestedAt ?? "") },
              ]}
            />
          </div>
        </div>
      )}
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
