import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical, Plus } from "lucide-react";
import { IconChecks, IconInfoCircle, IconX } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import type { DataTableAction, DataTableColumn } from "@/components/ui/table";
import { TABLE_STYLES } from "@/components/ui/table";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { useDebounce, usePortalDropdown } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { ROUTES } from "@/app/routes.constants";
import { backupRestoreApi, type RestoreRequestRecord, type RestoreRequestStatus } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { ServerListPanel } from "../components/ServerListPanel";
import { RestoreStatusBadge } from "../components/RestoreStatusBadge";
import { statusLabel } from "../types";
import { formatDateTime } from "../format";

const ALL = "ALL";
const STATUS_COLOR = { PENDING_APPROVAL: "amber", APPROVED: "emerald", REJECTED: "red" } as const;
const STATUS_OPTIONS = [{ label: "All", value: ALL }, ...(Object.keys(STATUS_COLOR) as RestoreRequestStatus[]).map((value) => ({ label: statusLabel(value), value }))];
const TARGET_OPTIONS = [
  { label: "All", value: ALL },
  { label: "Validation environment", value: "VALIDATION" },
  { label: "Production", value: "PRODUCTION" },
];
const TYPE_LABEL: Record<string, string> = { "R-FULL": "Full restore", "R-DB": "Database only", "R-OBJ": "Documents only", "R-ONE": "One record" };

type SortKey = "requestedAt" | "status" | "backupNumber" | "requestedBy" | "decidedAt";

/**
 * Restore requests: one list for asking, deciding and following a request. Asking never runs a restore; a request waits for a second
 * person's electronic signature, and an approved request is then run by an administrator (the run is not built yet).
 */
export const RestoreRequestsView: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canRequest = hasPermission("backup.restore.request");
  const canApprove = hasPermission("backup.restore.approve");
  const me = user?.username?.toLowerCase() ?? "";
  const menu = usePortalDropdown();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [status, setStatus] = useState(ALL);
  const [target, setTarget] = useState(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "requestedAt", direction: "desc" });
  const [rows, setRows] = useState<RestoreRequestRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey] = useState(0);

  const actionRow = rows.find((row) => row.id === menu.openId);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    backupRestoreApi
      .restoreRequests({
        search: debouncedSearch.trim() || undefined,
        status: status === ALL ? undefined : status,
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
        setError(getApiErrorMessage(e, "Unable to load the restore requests."));
      })
      .finally(() => {
        if (!live) return;
        setLoading(false);
        setHasLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [debouncedSearch, status, target, sort, page, pageSize, reloadKey]);

  useEffect(() => setPage(1), [debouncedSearch, status, target, pageSize]);

  const sortFor = (key: SortKey) => ({
    direction: sort.key === key ? sort.direction : undefined,
    onSort: () => {
      setSort((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
      setPage(1);
    },
  });

  const mine = (request: RestoreRequestRecord) => request.requestedBy.toLowerCase() === me;
  const canDecide = (request: RestoreRequestRecord) => request.status === "PENDING_APPROVAL" && canApprove && !mine(request);
  const open = (request: RestoreRequestRecord) => navigate(ROUTES.BACKUP_RESTORE.RESTORE_DETAIL(request.restoreNumber));

  const columns: DataTableColumn<RestoreRequestRecord>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: TABLE_STYLES.headerCell35, cellClassName: TABLE_STYLES.cell30, cell: (_row, index) => (page - 1) * pageSize + index + 1 },
    { id: "restoreNumber", header: "Restore Number", label: "Restore Number", headerClassName: TABLE_STYLES.headerCell35, cell: (row) => (
      <button type="button" className="text-left font-medium text-emerald-600 hover:underline" onClick={() => open(row)}>{row.restoreNumber}</button>
    ) },
    { id: "backupNumber", header: "Backup Number", label: "Backup Number", sort: sortFor("backupNumber"), cell: (row) => (
      <button type="button" className="text-left text-emerald-600 hover:underline" onClick={() => navigate(ROUTES.BACKUP_RESTORE.BACKUP_DETAIL(row.backupNumber))}>{row.backupNumber}</button>
    ) },
    { id: "type", header: "Type", label: "Type", cell: (row) => TYPE_LABEL[row.type] ?? row.type },
    { id: "target", header: "Target", label: "Target", cell: (row) => <Badge color={row.target === "PRODUCTION" ? "red" : "blue"}>{row.target === "PRODUCTION" ? "Production" : "Validation"}</Badge> },
    { id: "status", header: "Status", label: "Status", sort: sortFor("status"), cell: (row) => <RestoreStatusBadge status={row.status} /> },
    { id: "requestedBy", header: "Requested by", label: "Requested by", sort: sortFor("requestedBy"), cell: (row) => row.requestedBy },
    { id: "requestedAt", header: "Requested", label: "Requested", sort: sortFor("requestedAt"), cell: (row) => formatDateTime(row.requestedAt) },
    { id: "approvedBy", header: "Approved by", label: "Approved by", cell: (row) => row.approvedBy ?? "—" },
    { id: "approvedAt", header: "Approved at", label: "Approved at", cell: (row) => (row.status === "APPROVED" && row.decidedAt ? formatDateTime(row.decidedAt) : "—") },
    { id: "rejectedAt", header: "Rejected at", label: "Rejected at", cell: (row) => (row.status === "REJECTED" && row.decidedAt ? formatDateTime(row.decidedAt) : "—") },
  ];

  const action: DataTableAction<RestoreRequestRecord> = {
    header: "Actions",
    headerClassName: TABLE_STYLES.headerCell35,
    cell: (row) => (
      <button
        type="button"
        ref={menu.getRef(row.id)}
        aria-label="More actions"
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8"
        onClick={(event) => menu.toggle(row.id, event)}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    ),
  };

  return (
    <BackupRestorePage
      title="Restore Requests"
      group="Restore"
      preview={false}
      actions={
        canRequest ? (
          <Button size="sm" className="gap-2 whitespace-nowrap" onClick={() => navigate(ROUTES.BACKUP_RESTORE.RESTORE_NEW)}>
            <Plus className="h-4 w-4" />
            New Restore Request
          </Button>
        ) : undefined
      }
    >
      <WarningBanner
        variant="info"
        title="How a restore runs"
        description="Request, then approval by a second person with an e-signature, then a maintenance window, then the restore and its automatic checks. Approval is recorded now; running the restore is not built yet."
      />
      <ServerListPanel
        tableKey="backup-restore.restore-requests.v2"
        columns={columns}
        action={action}
        rows={rows}
        getRowKey={(row) => row.id}
        loading={loading}
        hasLoaded={hasLoaded}
        error={error}
        emptyTitle="No Restore Requests"
        emptyDescription="Restore requests appear here once someone asks for one. Try changing your search or filters."
        search={search}
        onSearch={setSearch}
        searchLabel="Search restore requests"
        searchPlaceholder="Request, backup or person…"
        filters={[
          { id: "status", label: "Status", value: status, options: STATUS_OPTIONS, defaultValue: ALL, placeholder: "All", onChange: setStatus },
          { id: "target", label: "Target", value: target, options: TARGET_OPTIONS, defaultValue: ALL, placeholder: "All", onChange: setTarget },
        ]}
        onClear={() => {
          setSearch("");
          setStatus(ALL);
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

      <PortalDropdownMenu isOpen={!!actionRow} onClose={menu.close} position={menu.position} minWidth={200}>
        {actionRow && (
          <div className="py-1">
            <DropdownMenuItem icon={<IconInfoCircle className="h-4 w-4" />} onClick={() => { open(actionRow); menu.close(); }}>
              View Detail
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<IconChecks className="h-4 w-4" />}
              disabled={!canDecide(actionRow)}
              onClick={() => { navigate(`${ROUTES.BACKUP_RESTORE.RESTORE_DETAIL(actionRow.restoreNumber)}?decision=approve`); menu.close(); }}
            >
              Approve Request
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<IconX className="h-4 w-4" />}
              disabled={!canDecide(actionRow)}
              onClick={() => { navigate(`${ROUTES.BACKUP_RESTORE.RESTORE_DETAIL(actionRow.restoreNumber)}?decision=reject`); menu.close(); }}
            >
              Reject Request
            </DropdownMenuItem>
          </div>
        )}
      </PortalDropdownMenu>

    </BackupRestorePage>
  );
};
