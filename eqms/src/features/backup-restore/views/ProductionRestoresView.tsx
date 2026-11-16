import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ROUTES } from "@/app/routes.constants";
import { dateToInstant } from "@/features/settings/announcements/announcementFilters";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { useToast } from "@/components/ui/toast/Toast";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { TABLE_STYLES, type DataTableColumn } from "@/components/ui/table";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { useDebounce } from "@/hooks";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  productionRestoreApi,
  waitForProductionJob,
  type ProductionRestoreCapabilities,
  type ProductionRestoreRecord,
  type ProductionRestoreStatus,
  type BackupPart,
} from "@/services/api/backupRestore";
import { BackupExportButton } from "../components/BackupExportButton";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { ServerListPanel } from "../components/ServerListPanel";
import { ProductionRestoreDialog } from "../components/ProductionRestoreDialog";
import { formatDateTime } from "../format";
import { statusLabel } from "../types";
import { leaveRestoreNotice } from "../restoreSessionNotice";
import { useProductionRestoreRun } from "../components/useProductionRestoreRun";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";

const ALL = "ALL";
const STATUS_OPTIONS = [
  { label: "All", value: ALL },
  { label: "Waiting to finalize", value: "PENDING_FINALIZATION" },
  { label: "Finalized", value: "FINALIZED" },
  { label: "Rolled back", value: "ROLLED_BACK" },
];
const STATUS_COLOR: Record<ProductionRestoreStatus, "amber" | "emerald" | "slate"> = {
  PENDING_FINALIZATION: "amber",
  FINALIZED: "emerald",
  ROLLED_BACK: "slate",
};
const STATUS_TEXT: Record<ProductionRestoreStatus, string> = {
  PENDING_FINALIZATION: "Waiting to finalize",
  FINALIZED: "Finalized",
  ROLLED_BACK: "Rolled back",
};

const PART_TEXT: Record<string, string> = { DATABASE: "Database", OBJECT_STORE: "Files", CONFIGURATION: "Settings" };

type SortKey = "restoredAt" | "backupNumber" | "status" | "restoredBy" | "closedAt" | "closedBy" | "components";
const PART_OPTIONS = [
  { label: "All", value: ALL },
  { label: "Database", value: "DATABASE" },
  { label: "Files", value: "OBJECT_STORE" },
];

type Signing =
  | { kind: "finalize"; runCode: string }
  | { kind: "rollback"; runCode: string };

const MEANING: Record<Signing["kind"], { code: string; name: string; verb: string }> = {
  finalize: { code: "BACKUP_RESTORE_FINALIZATION", name: "Backup Restore Finalization", verb: "Finalize" },
  rollback: { code: "BACKUP_RESTORE_ROLLBACK", name: "Backup Restore Rollback", verb: "Roll Back" },
};

/**
 * Restores into production. A restore is signed, runs in the agent, and then waits until a person with the finalize permission closes
 * it; until then it can be rolled back. Only the actions the signed-in person may take are shown.
 */
export const ProductionRestoresView: React.FC = () => {
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const [status, setStatus] = useState(ALL);
  const [part, setPart] = useState(ALL);
  const [restoredFrom, setRestoredFrom] = useState("");
  const [restoredTo, setRestoredTo] = useState("");
  const [closedFrom, setClosedFrom] = useState("");
  const [closedTo, setClosedTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "restoredAt", direction: "desc" });
  const [rows, setRows] = useState<ProductionRestoreRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [capabilities, setCapabilities] = useState<ProductionRestoreCapabilities>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedBackup = searchParams.get("backup") ?? undefined;
  const [choosing, setChoosing] = useState(false);
  const [signing, setSigning] = useState<Signing>();
  const { follow, working, begin: beginRestore, signatureModal: restoreSignature } = useProductionRestoreRun(() => setReload((n) => n + 1));

  useEffect(() => {
    productionRestoreApi.capabilities().then(setCapabilities).catch(() => setCapabilities(undefined));
  }, []);

  // arriving from a backup's page with ?backup=…: open the restore dialog for it once, if the person may restore
  useEffect(() => {
    if (requestedBackup && capabilities?.restore) setChoosing(true);
  }, [requestedBackup, capabilities?.restore]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    productionRestoreApi
      .list({
        search: debouncedSearch.trim() || undefined,
        status: status === ALL ? undefined : (status as ProductionRestoreStatus),
        part: part === ALL ? undefined : part,
        restoredFrom: dateToInstant(restoredFrom, "start"),
        restoredTo: dateToInstant(restoredTo, "end"),
        closedFrom: dateToInstant(closedFrom, "start"),
        closedTo: dateToInstant(closedTo, "end"),
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
        setError(getApiErrorMessage(e, "The restores could not be loaded."));
      })
      .finally(() => {
        if (!live) return;
        setLoading(false);
        setHasLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [debouncedSearch, status, part, restoredFrom, restoredTo, closedFrom, closedTo, sort, page, pageSize, reload]);

  useEffect(() => setPage(1), [debouncedSearch, status, part, restoredFrom, restoredTo, closedFrom, closedTo, pageSize]);

  const sortFor = (key: SortKey) => ({
    direction: sort.key === key ? sort.direction : undefined,
    onSort: () => {
      setSort((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
      setPage(1);
    },
  });

  const signed = async (data: { signatureToken?: string }) => {
    const action = signing;
    setSigning(undefined);
    if (!action) return;
    if (!data.signatureToken) {
      showToast({ type: "error", title: "The signature could not be confirmed", message: "Try again." });
      return;
    }
    try {
      const { jobId } =
        action.kind === "finalize"
          ? await productionRestoreApi.finalize(action.runCode, data.signatureToken)
          : await productionRestoreApi.rollback(action.runCode, data.signatureToken);
      const label = `${MEANING[action.kind].verb} ${action.runCode}`;
      // a rollback replaces the data the session lives in: leave the explanation for the sign-in page
      if (action.kind === "rollback") leaveRestoreNotice("rolled-back");
      showToast({ type: "info", title: label, message: "Accepted. It is running; this can take a while." });
      void follow(jobId, label);
    } catch (e) {
      showToast({ type: "error", title: "The request was refused", message: getApiErrorMessage(e, "Nothing was changed.") });
    }
  };

  const columns: DataTableColumn<ProductionRestoreRecord>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: TABLE_STYLES.headerCell35, cellClassName: TABLE_STYLES.cell30, cell: (_row, index) => (page - 1) * pageSize + index + 1 },
    { id: "runCode", header: "Restore Number", label: "Restore Number", headerClassName: TABLE_STYLES.headerCell35, cell: (row) => <span className="font-medium text-slate-900">{row.run_code}</span> },
    {
      id: "backupNumber",
      header: "Backup Number",
      label: "Backup Number",
      sort: sortFor("backupNumber"),
      cell: (row) => (
        <button type="button" className="text-left font-medium text-emerald-600 hover:underline" onClick={() => navigate(ROUTES.BACKUP_RESTORE.BACKUP_DETAIL(row.backup_number))}>
          {row.backup_number}
        </button>
      ),
    },
    { id: "components", header: "Restored", label: "Restored", sort: sortFor("components"), cell: (row) => (row.components ?? "DATABASE").split(",").map((c) => PART_TEXT[c] ?? c).join(", ") },
    { id: "status", header: "Status", label: "Status", sort: sortFor("status"), cell: (row) => <Badge color={STATUS_COLOR[row.status]}>{STATUS_TEXT[row.status]}</Badge> },
    { id: "restoredBy", header: "Restored by", label: "Restored by", sort: sortFor("restoredBy"), cell: (row) => row.restored_by },
    { id: "restoredAt", header: "Restored", label: "Restored", sort: sortFor("restoredAt"), cell: (row) => formatDateTime(row.restored_at) },
    { id: "closedBy", header: "Closed by", label: "Closed by", sort: sortFor("closedBy"), cell: (row) => row.closed_by ?? "—" },
    { id: "closedAt", header: "Closed", label: "Closed", sort: sortFor("closedAt"), cell: (row) => (row.closed_at ? formatDateTime(row.closed_at) : "—") },
    {
      id: "actions",
      header: "Actions",
      label: "Actions",
      cell: (row) =>
        row.status === "PENDING_FINALIZATION" ? (
          <div className="flex flex-wrap gap-2">
            {capabilities?.finalize && (
              <Button variant="outline-emerald" size="sm" onClick={() => setSigning({ kind: "finalize", runCode: row.run_code })}>
                Finalize
              </Button>
            )}
            {capabilities?.rollback && (
              <Button variant="destructive" size="sm" onClick={() => setSigning({ kind: "rollback", runCode: row.run_code })}>
                Roll Back
              </Button>
            )}
          </div>
        ) : (
          "—"
        ),
    },
  ];

  const waiting = rows.some((row) => row.status === "PENDING_FINALIZATION");
  const meaning = signing ? MEANING[signing.kind] : undefined;

  return (
    <BackupRestorePage
      title="Restore Backup"
      group="Restore"
      preview={false}
      actions={
        <>
          <BackupExportButton
            dataset="production-restores"
            params={{
              search: debouncedSearch.trim() || undefined,
              status: status === ALL ? undefined : status,
              part: part === ALL ? undefined : part,
              restoredFrom: dateToInstant(restoredFrom, "start"),
              restoredTo: dateToInstant(restoredTo, "end"),
              closedFrom: dateToInstant(closedFrom, "start"),
              closedTo: dateToInstant(closedTo, "end"),
              sortBy: sort.key,
              sortDirection: sort.direction,
            }}
          />
          {capabilities?.restore && (
            <Button size="sm" variant="default" disabled={working > 0} onClick={() => setChoosing(true)}>
              Restore a Backup
            </Button>
          )}
        </>
      }
    >
      <WarningBanner
        variant="info"
        description="A restore replaces the live database with a backup and adds any missing files. It waits here until a person with the finalize permission closes it; until then it can be rolled back. Every action is signed."
      />
      {waiting && <WarningBanner variant="warning" description="A restore is waiting to be finalized. No other restore can start until it is finalized or rolled back." />}
      <ServerListPanel
        tableKey="backup-restore.production-restores.v1"
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.run_code}
        loading={loading}
        hasLoaded={hasLoaded}
        error={error}
        emptyTitle="No Restores"
        emptyDescription="Restores into the live system will appear here. Try changing your search or filters."
        search={search}
        onSearch={setSearch}
        searchLabel="Search restores"
        searchPlaceholder="Restore, backup or person…"
        filters={[
          { id: "status", label: "Status", value: status, options: STATUS_OPTIONS, defaultValue: ALL, placeholder: "All", onChange: setStatus },
          { id: "part", label: "Restored Part", value: part, options: PART_OPTIONS, defaultValue: ALL, placeholder: "All", onChange: setPart },
        ]}
        dates={[
          { id: "restored", label: "Restored", from: restoredFrom, to: restoredTo, onFromChange: setRestoredFrom, onToChange: setRestoredTo },
          { id: "closed", label: "Closed", from: closedFrom, to: closedTo, onFromChange: setClosedFrom, onToChange: setClosedTo },
        ]}
        onClear={() => {
          setSearch("");
          setStatus(ALL);
          setPart(ALL);
          setRestoredFrom("");
          setRestoredTo("");
          setClosedFrom("");
          setClosedTo("");
          setPage(1);
        }}
        page={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
      <ProductionRestoreDialog
        isOpen={choosing}
        initialBackup={requestedBackup}
        onClose={() => {
          setChoosing(false);
          if (requestedBackup) setSearchParams({}, { replace: true });
        }}
        onContinue={(backupNumber, parts) => {
          setChoosing(false);
          if (requestedBackup) setSearchParams({}, { replace: true });
          beginRestore(backupNumber, parts);
        }}
      />
      <ESignatureModal
        isOpen={!!signing}
        onClose={() => setSigning(undefined)}
        deferConfirm
        onConfirm={signed}
        actionTitle={signing ? `${meaning?.verb} ${signing.runCode}` : ""}
        meaningDisplayName={meaning?.name}
        meaningCode={meaning?.code}
      />
      {restoreSignature}
    </BackupRestorePage>
  );
};
