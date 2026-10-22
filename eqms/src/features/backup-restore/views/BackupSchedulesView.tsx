import React, { useEffect, useState } from "react";
import { IconCalendarTime } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { FormSection } from "@/components/ui/form";
import type { DataTableColumn } from "@/components/ui/table";
import { TABLE_STYLES } from "@/components/ui/table";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { useDebounce } from "@/hooks";
import { backupRestoreApi, type BackupSchedulePolicy, type ScheduleRowRecord } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { Fact } from "../components/Fact";
import { ServerListPanel } from "../components/ServerListPanel";
import { BACKUP_STATUS_COLOR, COMPONENT_LABEL, statusLabel, type BackupComponentKey } from "../types";
import { formatDateTime } from "../format";

type SortKey = "component" | "type" | "frequency" | "time" | "status";

const ALL = "ALL";
const STATUS_OPTIONS = [
  { label: "All", value: ALL },
  { label: "Active", value: "ACTIVE" },
  { label: "Not scheduled", value: "NOT_SCHEDULED" },
];

const TYPE_OPTIONS = [
  { label: "All", value: ALL },
  { label: "Full", value: "FULL" },
  { label: "Incremental", value: "INCREMENTAL" },
  { label: "Pre-change", value: "PRE_CHANGE" },
];
const FREQUENCY_OPTIONS = [
  { label: "All", value: ALL },
  { label: "Hourly", value: "HOURLY" },
  { label: "Daily", value: "DAILY" },
  { label: "Weekly", value: "WEEKLY" },
];

const dash = (value: string) => (value ? statusLabel(value) : "—");

/**
 * What runs automatically and when: the schedule of the active policy, one row per component. Components the agent cannot back
 * up yet are listed as not scheduled. Search, filter, sort and paging run on the server; the schedule itself is changed in
 * Backup & Restore Administration > Backup Policy.
 */
export const BackupSchedulesView: React.FC = () => {
  const [policy, setPolicy] = useState<BackupSchedulePolicy>();
  const [policyError, setPolicyError] = useState("");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [status, setStatus] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [frequency, setFrequency] = useState(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "component", direction: "asc" });
  const [rows, setRows] = useState<ScheduleRowRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    backupRestoreApi
      .schedules()
      .then((data) => active && setPolicy(data))
      .catch((e) => active && setPolicyError(getApiErrorMessage(e, "Unable to read the backup schedule.")));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    backupRestoreApi
      .scheduleRows({ search: debouncedSearch.trim() || undefined, status: status === ALL ? undefined : status, type: type === ALL ? undefined : type, frequency: frequency === ALL ? undefined : frequency, sortBy: sort.key, sortDirection: sort.direction, page, limit: pageSize })
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
        setError(getApiErrorMessage(e, "Unable to read the backup schedule."));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setHasLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [debouncedSearch, status, type, frequency, sort, page, pageSize]);

  useEffect(() => setPage(1), [debouncedSearch, status, type, frequency, pageSize]);

  const clearFilters = () => {
    setSearch("");
    setStatus(ALL);
    setType(ALL);
    setFrequency(ALL);
    setPage(1);
  };

  const sortFor = (key: SortKey) => ({
    direction: sort.key === key ? sort.direction : undefined,
    onSort: () => {
      setSort((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
      setPage(1);
    },
  });

  const columns: DataTableColumn<ScheduleRowRecord>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: TABLE_STYLES.headerCell35, cellClassName: TABLE_STYLES.cell30, cell: (_row, index) => (page - 1) * pageSize + index + 1 },
    {
      id: "component",
      header: "Component",
      label: "Component",
      sort: sortFor("component"),
      cell: (row) => <span className="font-medium text-slate-900">{COMPONENT_LABEL[row.component as BackupComponentKey] ?? row.component}</span>,
    },
    { id: "type", header: "Backup type", label: "Backup type", sort: sortFor("type"), cell: (row) => dash(row.type) },
    { id: "frequency", header: "Frequency", label: "Frequency", sort: sortFor("frequency"), cell: (row) => dash(row.frequency) },
    { id: "time", header: "Starts at", label: "Starts at", sort: sortFor("time"), cell: (row) => row.time || "—" },
    {
      id: "status",
      header: "Status",
      label: "Status",
      sort: sortFor("status"),
      cell: (row) => <Badge color={row.status === "ACTIVE" ? "emerald" : "slate"}>{row.status === "ACTIVE" ? "Active" : "Not scheduled"}</Badge>,
    },
  ];

  const last = policy?.lastScheduledRun;

  return (
    <BackupRestorePage title="Backup Schedules" group="Backup" preview={false}>
      <WarningBanner variant="info" description="This list is read only. Change a schedule in System Administration > Backup & Restore Administration > Backup Policy." />
      {policyError && <WarningBanner variant="error" title="Unable to read the backup schedule" description={policyError} />}
      {policy && (
        <FormSection title="Schedule" icon={<IconCalendarTime className="h-4 w-4" />}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="space-y-3">
              <Fact label="Policy">
                Version {policy.version} ({statusLabel(policy.status)})
              </Fact>
            </div>
            <div className="space-y-3">
              <Fact label="Next scheduled backup">
                {policy.nextDue ? formatDateTime(policy.nextDue) : "Not scheduled"}{" "}
                <span className="text-xs font-normal text-slate-500">({policy.zone})</span>
              </Fact>
            </div>
            <div className="space-y-3">
              <Fact label="Last scheduled run">
                {last ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {last.backupNumber}
                    <Badge color={BACKUP_STATUS_COLOR[last.status as keyof typeof BACKUP_STATUS_COLOR] ?? "slate"}>{statusLabel(last.status)}</Badge>
                    <span className="text-xs font-normal text-slate-500">{formatDateTime(last.startedAt)}</span>
                  </span>
                ) : (
                  "None yet"
                )}
              </Fact>
            </div>
          </div>
        </FormSection>
      )}
      <ServerListPanel
        tableKey="backup-restore.schedules"
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.component}
        loading={loading}
        hasLoaded={hasLoaded}
        error={error}
        emptyTitle="No Schedule Found"
        emptyDescription="No component matches. Try changing your search or filters."
        search={search}
        onSearch={setSearch}
        searchLabel="Search schedules"
        searchPlaceholder="Component, type, frequency or time…"
        filters={[
          { id: "status", label: "Status", value: status, options: STATUS_OPTIONS, defaultValue: ALL, placeholder: "All", onChange: setStatus },
          { id: "type", label: "Backup type", value: type, options: TYPE_OPTIONS, defaultValue: ALL, placeholder: "All", onChange: setType },
          { id: "frequency", label: "Frequency", value: frequency, options: FREQUENCY_OPTIONS, defaultValue: ALL, placeholder: "All", onChange: setFrequency },
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
