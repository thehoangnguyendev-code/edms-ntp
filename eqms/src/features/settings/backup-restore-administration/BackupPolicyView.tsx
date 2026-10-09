import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormSection } from "@/components/ui/form";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { TABLE_STYLES } from "@/components/ui/table/TablePrimitives";
import type { DataTableColumn } from "@/components/ui/table/DataTable";
import { useDebounce } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import { ServerListPanel } from "@/features/backup-restore/components/ServerListPanel";
import { formatDateTime } from "@/features/backup-restore/format";
import { statusLabel } from "@/features/backup-restore/types";
import { backupRestoreApi, readPolicyBody, type PolicyStatus, type PolicyVersion } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupAdminLivePage } from "./BackupAdminLivePage";
import { COMPONENT_LABEL, MEDIUM_LABEL, POLICY_STATUS_COLOR } from "./policyLabels";

type SortKey = "version" | "status" | "proposedBy" | "approvedBy" | "createdAt" | "activatedAt";

const ALL = "ALL";
const STATUS_OPTIONS = [{ label: "All Statuses", value: ALL }, ...(["ACTIVE", "DRAFT", "SUPERSEDED", "DISCARDED"] as PolicyStatus[]).map((value) => ({ label: statusLabel(value), value }))];

/**
 * Backup Policy: what is backed up, where it is copied and when. A policy is never edited; a change is a new version proposed by
 * one person and approved, with an electronic signature, by another. The running policy is shown first, the history below.
 */
export const BackupPolicyView: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canPropose = hasPermission("backup.admin.policy.propose");

  const [active, setActive] = useState<PolicyVersion | null | undefined>(undefined);
  const [activeError, setActiveError] = useState("");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "version", direction: "desc" });
  const [rows, setRows] = useState<PolicyVersion[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    backupRestoreApi
      .policies({ status: "ACTIVE", limit: 1 })
      .then((data) => live && setActive(data.data[0] ?? null))
      .catch((e) => {
        if (!live) return;
        setActive(null);
        setActiveError(getApiErrorMessage(e, "The running policy could not be read."));
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    backupRestoreApi
      .policies({ search: debouncedSearch.trim() || undefined, status: status === ALL ? undefined : status, sortBy: sort.key, sortDirection: sort.direction, page, limit: pageSize })
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
        setError(getApiErrorMessage(e, "Unable to load the policy versions."));
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

  const open = (version: number) => navigate(ROUTES.SETTINGS.BACKUP_ADMINISTRATION.POLICY_DETAIL(version));

  const columns: DataTableColumn<PolicyVersion>[] = [
    {
      id: "version",
      header: "Version",
      label: "Version",
      locked: true,
      sort: sortFor("version"),
      headerClassName: TABLE_STYLES.headerCell35,
      cell: (row) => (
        <button type="button" className="text-left font-medium text-emerald-600 hover:underline" onClick={() => open(row.version)}>
          Version {row.version}
        </button>
      ),
    },
    { id: "status", header: "Status", label: "Status", sort: sortFor("status"), cell: (row) => <Badge color={POLICY_STATUS_COLOR[row.status]}>{statusLabel(row.status)}</Badge> },
    { id: "scope", header: "Backs up", label: "Backs up", cell: (row) => readPolicyBody(row).components.map((c) => COMPONENT_LABEL[c] ?? c).join(", ") || "—" },
    { id: "targets", header: "Copied to", label: "Copied to", cell: (row) => readPolicyBody(row).targets.map((t) => t.code).join(", ") || "—" },
    { id: "proposedBy", header: "Proposed by", label: "Proposed by", sort: sortFor("proposedBy"), cell: (row) => row.proposedBy ?? "System" },
    { id: "approvedBy", header: "Approved by", label: "Approved by", sort: sortFor("approvedBy"), cell: (row) => row.approvedBy ?? "—" },
    { id: "createdAt", header: "Proposed", label: "Proposed", sort: sortFor("createdAt"), cell: (row) => formatDateTime(row.createdAt) },
    { id: "activatedAt", header: "Activated", label: "Activated", sort: sortFor("activatedAt"), cell: (row) => formatDateTime(row.activatedAt) },
  ];

  const activeBody = active ? readPolicyBody(active) : null;

  return (
    <BackupAdminLivePage
      title="Backup Policy"
      actions={
        canPropose ? (
          <Button size="sm" variant="outline-emerald" onClick={() => navigate(ROUTES.SETTINGS.BACKUP_ADMINISTRATION.POLICY_NEW)} className="gap-2 whitespace-nowrap">
            Propose Policy Change
          </Button>
        ) : undefined
      }
    >
      {activeError && <WarningBanner variant="error" title="The running policy could not be read" description={activeError} />}
      <FormSection title="Running Policy" icon={<ShieldCheck className="h-4 w-4" />}>
        {active === undefined ? (
          <SectionLoading minHeight="80px" />
        ) : active && activeBody ? (
          <div className="flex flex-col gap-3 text-xs sm:text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => open(active.version)}>
                Version {active.version}
              </button>
              <Badge color={POLICY_STATUS_COLOR[active.status]}>{statusLabel(active.status)}</Badge>
              <span className="text-slate-500">
                {active.approvedBy ? `Approved by ${active.approvedBy} on ${formatDateTime(active.activatedAt)}` : "Installed with the Backup Agent"}
              </span>
            </div>
            <p className="text-slate-700">Backs up: {activeBody.components.map((c) => COMPONENT_LABEL[c] ?? c).join(", ")}. Database backup {activeBody.enabled ? `daily at ${activeBody.time}` : "is switched off"}.</p>
            <ul className="grid grid-cols-1 gap-1 md:grid-cols-2">
              {activeBody.targets.map((t) => (
                <li key={t.code} className="text-slate-700">
                  <span className="font-medium">{t.code}</span> · {MEDIUM_LABEL[t.medium] ?? t.medium}
                  {t.offsite && <Badge color="slate" className="ml-2">Off-site</Badge>}
                  {t.immutable && <Badge color="slate" className="ml-2">Immutable</Badge>}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-slate-500 sm:text-sm">No policy is running.</p>
        )}
      </FormSection>

      <ServerListPanel
        tableKey="backup-admin.policy-versions"
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        loading={loading}
        hasLoaded={hasLoaded}
        error={error}
        emptyTitle="No Policy Versions"
        emptyDescription="Try changing your search or filters."
        search={search}
        onSearch={setSearch}
        searchLabel="Search policy versions"
        searchPlaceholder="Version, person or reason…"
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
    </BackupAdminLivePage>
  );
};
