import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical } from "lucide-react";
import { IconInfoCircle } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormSection } from "@/components/ui/form";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { TABLE_STYLES } from "@/components/ui/table";
import type { DataTableAction, DataTableColumn } from "@/components/ui/table";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { dateToInstant } from "@/features/settings/announcements/announcementFilters";
import { useDebounce, usePortalDropdown } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import { Fact } from "@/features/backup-restore/components/Fact";
import { ServerListPanel } from "@/features/backup-restore/components/ServerListPanel";
import { formatDateTime } from "@/features/backup-restore/format";
import { statusLabel } from "@/features/backup-restore/types";
import { backupRestoreApi, readPolicyBody, type PolicyStatus, type PolicyVersion } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupAdminLivePage } from "./BackupAdminLivePage";
import { COMPONENT_LABEL, filesText, MEDIUM_LABEL, POLICY_STATUS_COLOR } from "./policyLabels";
import { IconSettingsAutomation } from "@tabler/icons-react";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { tr, trFormat } from "@/i18n";

type SortKey = "version" | "status" | "proposedBy" | "approvedBy" | "createdAt" | "activatedAt";

const ALL = "ALL";
const PART_OPTIONS = [
  { label: "All", value: ALL },
  { label: "Database", value: "DATABASE" },
  { label: tr("Document files"), value: "OBJECT_STORE" },
];
const FILES_OPTIONS = [
  { label: "All", value: ALL },
  { label: tr("At its own time"), value: "OWN" },
  { label: tr("With the database"), value: "WITH_DATABASE" },
];
const APPROVAL_OPTIONS = [
  { label: "All", value: ALL },
  { label: "Approved", value: "APPROVED" },
  { label: tr("Not approved"), value: "NOT_APPROVED" },
];
const STATUS_OPTIONS = [{ label: "All", value: ALL }, ...(["ACTIVE", "DRAFT", "SUPERSEDED", "DISCARDED"] as PolicyStatus[]).map((value) => ({ label: statusLabel(value), value }))];

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
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const [status, setStatus] = useState(ALL);
  const [part, setPart] = useState(ALL);
  const [target, setTarget] = useState(ALL);
  const [filesSchedule, setFilesSchedule] = useState(ALL);
  const [approval, setApproval] = useState(ALL);
  const [proposedFrom, setProposedFrom] = useState("");
  const [proposedTo, setProposedTo] = useState("");
  const [activatedFrom, setActivatedFrom] = useState("");
  const [activatedTo, setActivatedTo] = useState("");
  const [targetOptions, setTargetOptions] = useState([{ label: "All", value: ALL }]);
  const menu = usePortalDropdown();
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
    backupRestoreApi
      .targets()
      .then((list) => live && setTargetOptions([{ label: "All", value: ALL }, ...list.map((t) => ({ label: t.code, value: t.code }))]))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    backupRestoreApi
      .policies({
        search: debouncedSearch.trim() || undefined,
        status: status === ALL ? undefined : status,
        component: part === ALL ? undefined : part,
        target: target === ALL ? undefined : target,
        filesSchedule: filesSchedule === ALL ? undefined : filesSchedule,
        approval: approval === ALL ? undefined : approval,
        proposedFrom: dateToInstant(proposedFrom, "start"),
        proposedTo: dateToInstant(proposedTo, "end"),
        activatedFrom: dateToInstant(activatedFrom, "start"),
        activatedTo: dateToInstant(activatedTo, "end"),
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
  }, [debouncedSearch, status, part, target, filesSchedule, approval, proposedFrom, proposedTo, activatedFrom, activatedTo, sort, page, pageSize]);

  useEffect(() => setPage(1), [debouncedSearch, status, part, target, filesSchedule, approval, proposedFrom, proposedTo, activatedFrom, activatedTo, pageSize]);

  const sortFor = (key: SortKey) => ({
    direction: sort.key === key ? sort.direction : undefined,
    onSort: () => {
      setSort((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
      setPage(1);
    },
  });

  const open = (version: number) => navigate(ROUTES.SETTINGS.BACKUP_ADMINISTRATION.POLICY_DETAIL(version));

  const columns: DataTableColumn<PolicyVersion>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: TABLE_STYLES.headerCell35, cellClassName: TABLE_STYLES.cell30, cell: (_row, index) => (page - 1) * pageSize + index + 1 },
    {
      id: "version",
      header: "Version",
      label: "Version",
      sort: sortFor("version"),
      headerClassName: TABLE_STYLES.headerCell35,
      cell: (row) => (
        <button type="button" className="text-left font-medium text-emerald-600 hover:underline" onClick={() => open(row.version)}>
          {row.version}
        </button>
      ),
    },
    { id: "status", header: "Status", label: "Status", sort: sortFor("status"), cell: (row) => <Badge color={POLICY_STATUS_COLOR[row.status]}>{statusLabel(row.status)}</Badge> },
    { id: "scope", header: "Backs up", label: "Backs up", cell: (row) => readPolicyBody(row).components.map((c) => COMPONENT_LABEL[c] ?? c).join(", ") || "—" },
    { id: "targets", header: "Copied to", label: "Copied to", cell: (row) => readPolicyBody(row).targets.map((t) => t.code).join(", ") || "—" },
    { id: "proposedBy", header: tr("Proposed by"), label: tr("Proposed by"), sort: sortFor("proposedBy"), cell: (row) => row.proposedBy ?? "System" },
    { id: "approvedBy", header: tr("Approved by"), label: tr("Approved by"), sort: sortFor("approvedBy"), cell: (row) => row.approvedBy ?? "—" },
    { id: "createdAt", header: "Proposed", label: "Proposed", sort: sortFor("createdAt"), cell: (row) => formatDateTime(row.createdAt) },
    { id: "activatedAt", header: "Activated", label: "Activated", sort: sortFor("activatedAt"), cell: (row) => formatDateTime(row.activatedAt) },
  ];

  const actionRow = rows.find((row) => row.id === menu.openId);
  const action: DataTableAction<PolicyVersion> = {
    cell: (row) => (
      <button
        type="button"
        ref={menu.getRef(row.id)}
        aria-label={tr("More actions")}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8"
        onClick={(event) => menu.toggle(row.id, event)}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    ),
  };

  const activeBody = active ? readPolicyBody(active) : null;

  return (
    <BackupAdminLivePage
      title={tr("Backup Policy")}
      actions={
        canPropose ? (
          <Button size="sm" variant="default" onClick={() => navigate(ROUTES.SETTINGS.BACKUP_ADMINISTRATION.POLICY_NEW)} className="gap-2 whitespace-nowrap">
            {tr("Propose Policy Change")}
          </Button>
        ) : undefined
      }
    >
      {activeError && <WarningBanner variant="error" title={tr("The running policy could not be read")} description={activeError} />}
      <FormSection title={tr("Running Policy")} icon={<IconSettingsAutomation className="h-4 w-4" />}>
        {active === undefined ? (
          <SectionLoading minHeight="80px" />
        ) : active && activeBody ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
            <div className="space-y-3">
              <Fact label={tr("Version")}>
                <span className="inline-flex flex-wrap items-center gap-2">
                  <button type="button" className="font-semibold text-emerald-600 hover:underline" onClick={() => open(active.version)}>
                    {tr("Version")} {active.version}
                  </button>
                  <Badge color={POLICY_STATUS_COLOR[active.status]}>{statusLabel(active.status)}</Badge>
                </span>
              </Fact>
              <Fact label={tr("Approved")}>
                {active.approvedBy ? `${active.approvedBy}, ${formatDateTime(active.activatedAt)}` : "Installed with the Backup Agent"}
              </Fact>
            </div>
            <div className="space-y-3">
              <Fact label={tr("Backs up")}>{activeBody.components.map((c) => COMPONENT_LABEL[c] ?? c).join(", ")}</Fact>
              <Fact label={tr("Database backup")}>{activeBody.enabled ? `Daily at ${activeBody.time}` : tr("Switched off")}</Fact>
              <Fact label={tr("Files backup")}>{filesText(activeBody)}</Fact>
            </div>
            <div className="space-y-3">
              <Fact label={tr("Copied to")}>
                <ul className="space-y-1">
                  {activeBody.targets.map((t) => (
                    <li key={t.code}>
                      {t.code} · {MEDIUM_LABEL[t.medium] ?? t.medium}
                      {t.offsite && <Badge color="slate" className="ml-2">{tr("Off-site")}</Badge>}
                      {t.immutable && <Badge color="slate" className="ml-2">{tr("Immutable")}</Badge>}
                    </li>
                  ))}
                </ul>
              </Fact>
              {activeBody.manualCopy && <Fact label={tr("Manual copy")}>{activeBody.manualCopy.description}, {trFormat("every {count} days", { count: activeBody.manualCopy.everyDays })}</Fact>}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 sm:text-sm">{tr("No policy is running.")}</p>
        )}
      </FormSection>

      <ServerListPanel
        tableKey="backup-admin.policy-versions"
        columns={columns}
        action={action}
        rows={rows}
        getRowKey={(row) => row.id}
        loading={loading}
        hasLoaded={hasLoaded}
        error={error}
        emptyTitle={tr("No Policy Versions")}
        emptyDescription={tr("Try changing your search or filters.")}
        search={search}
        onSearch={setSearch}
        searchLabel="Search policy versions"
        searchPlaceholder={tr("Version, person or reason…")}
        filters={[
          { id: "status", label: "Status", value: status, options: STATUS_OPTIONS, defaultValue: ALL, placeholder: "All", onChange: setStatus },
          { id: "part", label: "Backs Up", value: part, options: PART_OPTIONS, defaultValue: ALL, placeholder: "All", onChange: setPart },
          { id: "target", label: "Copied To", value: target, options: targetOptions, defaultValue: ALL, placeholder: "All", onChange: setTarget },
          { id: "files", label: tr("Files Backup"), value: filesSchedule, options: FILES_OPTIONS, defaultValue: ALL, placeholder: "All", onChange: setFilesSchedule },
          { id: "approval", label: "Approval", value: approval, options: APPROVAL_OPTIONS, defaultValue: ALL, placeholder: "All", onChange: setApproval },
        ]}
        dates={[
          { id: "proposed", label: "Proposed", from: proposedFrom, to: proposedTo, onFromChange: setProposedFrom, onToChange: setProposedTo },
          { id: "activated", label: "Activated", from: activatedFrom, to: activatedTo, onFromChange: setActivatedFrom, onToChange: setActivatedTo },
        ]}
        onClear={() => {
          setSearch("");
          setStatus(ALL);
          setPart(ALL);
          setTarget(ALL);
          setFilesSchedule(ALL);
          setApproval(ALL);
          setProposedFrom("");
          setProposedTo("");
          setActivatedFrom("");
          setActivatedTo("");
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
            <DropdownMenuItem
              icon={<IconInfoCircle className="h-4 w-4" />}
              onClick={() => {
                open(actionRow.version);
                menu.close();
              }}
            >
              {tr("View Details")}
            </DropdownMenuItem>
          </div>
        )}
      </PortalDropdownMenu>
    </BackupAdminLivePage>
  );
};
