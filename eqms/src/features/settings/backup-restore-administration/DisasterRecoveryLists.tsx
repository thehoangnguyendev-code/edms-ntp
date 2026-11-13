import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { TABLE_STYLES, type DataTableColumn } from "@/components/ui/table";
import { useDebounce } from "@/hooks";
import { dateToInstant } from "@/features/settings/announcements/announcementFilters";
import { ServerListPanel } from "@/features/backup-restore/components/ServerListPanel";
import { formatDateTime } from "@/features/backup-restore/format";
import { backupRestoreApi, type DrDeclarationRecord, type DrScenarioRecord } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";

const ALL = "ALL";
type Direction = "asc" | "desc";

const STATUS_OPTIONS = [
  { label: "All", value: ALL },
  { label: "Open", value: "OPEN" },
  { label: "Closed", value: "CLOSED" },
];

/** The state every server-side list of this screen keeps: search (debounced), filters, sort and page. The server does all of it. */
function useServerList<R, K extends string>(
  load: (args: { search?: string; filters: Record<string, string>; from?: string; to?: string; sortBy: K; sortDirection: Direction; page: number; limit: number }) => Promise<{ data: R[]; pagination: { total: number; totalPages: number } }>,
  initial: { sort: K; filters: Record<string, string> },
  reloadKey: number,
  failure: string,
) {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 400);
  const [filters, setFilters] = useState<Record<string, string>>(initial.filters);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<{ key: K; direction: Direction }>({ key: initial.sort, direction: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rows, setRows] = useState<R[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    let live = true;
    load({ search: debounced.trim() || undefined, filters, from: dateToInstant(from, "start"), to: dateToInstant(to, "end"), sortBy: sort.key, sortDirection: sort.direction, page, limit: pageSize })
      .then((data) => {
        if (!live) return;
        setRows(data.data);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.totalPages || 1);
        setError("");
      })
      .catch((e) => {
        if (!live) return;
        setRows([]);
        setTotal(0);
        setError(getApiErrorMessage(e, failure));
      })
      .finally(() => {
        if (!live) return;
        setLoading(false);
        setHasLoaded(true);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, filterKey, from, to, sort, page, pageSize, reloadKey]);

  useEffect(() => setPage(1), [debounced, filterKey, from, to, pageSize]);

  const sortFor = (key: K) => ({
    direction: sort.key === key ? sort.direction : undefined,
    onSort: () => {
      setSort((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
      setPage(1);
    },
  });
  const setFilter = (id: string) => (value: string) => setFilters((prev) => ({ ...prev, [id]: value }));
  const clear = () => {
    setSearch("");
    setFilters(initial.filters);
    setFrom("");
    setTo("");
    setPage(1);
  };
  return { search, setSearch, filters, setFilter, from, setFrom, to, setTo, page, setPage, pageSize, setPageSize, rows, total, totalPages, loading, hasLoaded, error, sortFor, clear };
}

const NO: DataTableColumn<unknown>["headerClassName"] = TABLE_STYLES.headerCell35;

type DeclarationSort = "declaredAt" | "code" | "scenario" | "status" | "declaredBy" | "timeTaken" | "closedAt";

/** The declarations of a disaster, searched, filtered by status, scenario and date, sorted and paged by the server. */
export const DrDeclarationsList: React.FC<{ reloadKey: number; scenarios: DrScenarioRecord[] }> = ({ reloadKey, scenarios }) => {
  const list = useServerList<DrDeclarationRecord, DeclarationSort>(
    (a) =>
      backupRestoreApi.drDeclarations({
        search: a.search,
        status: a.filters.status === ALL ? undefined : a.filters.status,
        scenario: a.filters.scenario === ALL ? undefined : a.filters.scenario,
        from: a.from,
        to: a.to,
        sortBy: a.sortBy,
        sortDirection: a.sortDirection,
        page: a.page,
        limit: a.limit,
      }),
    { sort: "declaredAt", filters: { status: ALL, scenario: ALL } },
    reloadKey,
    "The declarations could not be loaded.",
  );
  const scenarioOptions = [{ label: "All", value: ALL }, ...scenarios.map((s) => ({ label: s.label, value: s.code }))];
  const columns: DataTableColumn<DrDeclarationRecord>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: NO, cellClassName: TABLE_STYLES.cell30, cell: (_row, index) => (list.page - 1) * list.pageSize + index + 1 },
    { id: "code", header: "Declaration", label: "Declaration", sort: list.sortFor("code"), cell: (row) => row.code },
    { id: "scenario", header: "Scenario", label: "Scenario", sort: list.sortFor("scenario"), cell: (row) => row.scenarioLabel },
    { id: "status", header: "Status", label: "Status", sort: list.sortFor("status"), cell: (row) => <Badge color={row.status === "OPEN" ? "red" : "emerald"}>{row.status === "OPEN" ? "Open" : "Closed"}</Badge> },
    { id: "declared", header: "Declared", label: "Declared", sort: list.sortFor("declaredAt"), cell: (row) => `${row.declaredBy} · ${formatDateTime(row.declaredAt)}` },
    { id: "reason", header: "Reason", label: "Reason", cell: (row) => <span className="block max-w-xs whitespace-normal break-words text-xs">{row.reason}</span> },
    { id: "taken", header: "Time taken", label: "Time taken", sort: list.sortFor("timeTaken"), cell: (row) => (row.hoursTaken === null ? "—" : `${row.hoursTaken} h (target ${row.rtoTargetHours} h)`) },
    { id: "closed", header: "Closed", label: "Closed", sort: list.sortFor("closedAt"), cell: (row) => (row.closedAt ? `${row.closedBy} · ${formatDateTime(row.closedAt)}` : "—") },
    { id: "summary", header: "Summary", label: "Summary", cell: (row) => <span className="block max-w-xs whitespace-normal break-words text-xs">{row.summary ?? "—"}</span> },
  ];
  return (
    <ServerListPanel
      tableKey="backup-restore.dr-declarations.v1"
      framed={false}
      tableFramed
      columns={columns}
      rows={list.rows}
      getRowKey={(row) => row.code}
      loading={list.loading}
      hasLoaded={list.hasLoaded}
      error={list.error}
      emptyTitle="No Declarations"
      emptyDescription="No disaster has been declared for this filter."
      search={list.search}
      onSearch={list.setSearch}
      searchLabel="Search declarations"
      searchPlaceholder="Declaration, scenario, person or reason…"
      filters={[
        { id: "status", label: "Status", value: list.filters.status, options: STATUS_OPTIONS, defaultValue: ALL, placeholder: "All", onChange: list.setFilter("status") },
        { id: "scenario", label: "Scenario", value: list.filters.scenario, options: scenarioOptions, defaultValue: ALL, placeholder: "All", onChange: list.setFilter("scenario") },
      ]}
      dates={[{ id: "declared", label: "Declared", from: list.from, to: list.to, onFromChange: list.setFrom, onToChange: list.setTo }]}
      onClear={list.clear}
      page={list.page}
      totalPages={list.totalPages}
      totalItems={list.total}
      pageSize={list.pageSize}
      onPageChange={list.setPage}
      onPageSizeChange={list.setPageSize}
    />
  );
};
