import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MoreVertical } from "lucide-react";
import { IconBinoculars, IconEye, IconFileDownload, IconInfoCircle } from "@tabler/icons-react";
import { ReportArtifactPreview } from "./ReportArtifactPreview";
import { Badge } from "@/components/ui/badge/Badge";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, pickerDateToIso, type ReportSelectFilter, type ReportDateFilter } from "../shared/ReportListToolbar";
import { ReportTabsFrame } from "../shared/ReportTabsFrame";
import { codeLabel, reportRevisionLabel, runStatusColor, runStatusLabel } from "../shared/reportLabels";
import { reportsApi, type ReportRunSummary } from "@/services/api/reports";
import { reportError } from "@/services/api/reportTemplates";
import { displayDateTime, formatFileSize } from "@/utils/format";

const STATUSES = ["QUEUED", "PROCESSING", "COMPLETED", "RETRY_SCHEDULED", "FAILED", "DEAD_LETTERED"];

/** Report run history. Search, filters, sort and paging are applied by the server (REPORT-LIST-STANDARD-2026-10-14). */
export function ReportHistoryView() {
  const navigate = useNavigate();
  const menu = usePortalDropdown();
  const [searchParams] = useSearchParams();
  // Old links (?run=) still work: they open the run's own page.
  useEffect(() => {
    const run = searchParams.get("run");
    if (run) navigate(`/report/runs/${run}`, { replace: true });
  }, [navigate, searchParams]);
  const drag = useTableDragScroll();
  const [status, setStatus] = useState("");
  const [definitionCode, setDefinitionCode] = useState("");
  const [queued, setQueued] = useState({ from: "", to: "" });
  const [completed, setCompleted] = useState({ from: "", to: "" });
  const [format, setFormat] = useState("");
  const [templates, setTemplates] = useState<{ value: string; label: string }[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    reportsApi
      .catalog()
      .then((definitions) => alive && setTemplates(definitions.map((d) => ({ value: d.code, label: d.displayName }))))
      .catch(() => alive && setTemplates([]));
    return () => {
      alive = false;
    };
  }, []);

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      reportsApi
        .listRuns({
          search: params.search as string | undefined,
          status: params.status as string | undefined,
          definitionCode: params.definitionCode as string | undefined,
          queuedFrom: params.queuedFrom as string | undefined,
          queuedTo: params.queuedTo as string | undefined,
          format: params.format as string | undefined,
          completedFrom: params.completedFrom as string | undefined,
          completedTo: params.completedTo as string | undefined,
          page: params.page as number,
          limit: params.limit as number,
          sortBy: params.sortBy as "queuedAt" | "completedAt" | "definitionCode" | "status",
          sortDirection: params.sortDirection as "asc" | "desc",
        })
        .catch((e) => {
          setError(reportError(e));
          throw e;
        }),
    [],
  );
  const extraParams = useMemo(
    () => ({ status, definitionCode, queuedFrom: pickerDateToIso(queued.from), queuedTo: pickerDateToIso(queued.to), format, completedFrom: pickerDateToIso(completed.from), completedTo: pickerDateToIso(completed.to) }),
    [status, definitionCode, queued, format, completed],
  );
  const table = useServerTable<ReportRunSummary>({
    fetcher,
    defaultSortBy: "queuedAt",
    defaultSortDirection: "desc",
    extraParams,
    initialItemsPerPage: 10,
    liveTypes: ["REPORT_RUN"],
  });
  useEffect(() => {
    if (!table.items.some((r) => ["QUEUED", "PROCESSING", "RETRY_SCHEDULED"].includes(r.status))) return;
    const timer = setTimeout(() => table.reload(), 5000);
    return () => clearTimeout(timer);
  }, [table.items]);

  const reset = (apply: () => void) => {
    apply();
    table.setCurrentPage(1);
  };
  const filters: ReportSelectFilter[] = [
    {
      id: "status",
      label: "Run Status",
      value: status,
      options: [{ label: "All", value: "" }, ...STATUSES.map((s) => ({ label: runStatusLabel(s), value: s }))],
      onChange: (value) => reset(() => setStatus(value)),
    },
    {
      id: "template",
      label: "Report Template",
      value: definitionCode,
      options: [{ label: "All", value: "" }, ...templates],
      onChange: (value) => reset(() => setDefinitionCode(value)),
    },
    {
      id: "format",
      label: "Output Format",
      value: format,
      options: [{ label: "All", value: "" }, ...["PDF", "XLSX", "CSV"].map((f) => ({ label: f, value: f }))],
      onChange: (value) => reset(() => setFormat(value)),
    },
  ];
  const dates: ReportDateFilter[] = [
    {
      id: "queued",
      label: "Queued Date Range",
      from: queued.from,
      to: queued.to,
      onChange: (from, to) => reset(() => setQueued({ from, to })),
    },
    {
      id: "completed",
      label: "Completed Date Range",
      from: completed.from,
      to: completed.to,
      onChange: (from, to) => reset(() => setCompleted({ from, to })),
    },
  ];
  const hasActiveFilters = Boolean(status || definitionCode || format || queued.from || queued.to || completed.from || completed.to);

  const actionRow = table.items.find((row) => row.id === menu.openId);
  const [previewing, setPreviewing] = useState<ReportRunSummary | null>(null);
  const download = async (row: ReportRunSummary) => {
    const id = row.id;
    const artifact = row.artifactId!;
    try {
      const blob = await reportsApi.downloadArtifact(id, artifact);
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = row.artifactFilename ?? `report-${id}.${(row.artifactFormat ?? "pdf").toLowerCase()}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (e) {
      setError(reportError(e));
    }
  };

  const columns: DataTableColumn<ReportRunSummary>[] = [
    { id: "no", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    {
      id: "name",
      header: "Generated Report Name",
      cell: (r) => (
        <div className="max-w-80 whitespace-normal">
          <button type="button" className="text-left font-medium text-emerald-600 hover:underline" onClick={() => navigate(`/report/runs/${r.id}`)}>
            {r.reportTitle ?? r.definitionCode}
          </button>
        </div>
      ),
    },
    {
      id: "template",
      header: "Report Template Number",
      sort: { direction: table.sortConfig.key === "definitionCode" ? table.sortConfig.direction : undefined, onSort: () => table.handleSort("definitionCode") },
      cell: (r) => r.definitionCode,
    },
    { id: "revision", header: "Report Template Revision", cell: (r) => (r.revision != null ? reportRevisionLabel(r.revision) : "—") },
    { id: "format", header: "Output Format", cell: (r) => (r.artifactFormat ? <Badge color="slate">{r.artifactFormat}</Badge> : r.requestedFormat ? <span className="text-slate-400">{r.requestedFormat}</span> : "—") },
    { id: "size", header: "File Size", cell: (r) => (r.artifactSize != null ? formatFileSize(r.artifactSize) : "—") },
    { id: "scope", header: "Run Type", cell: (r) => (r.fullRun ? <Badge color="blue">Full</Badge> : "Filtered") },
    {
      id: "status",
      header: "Run Status",
      sort: { direction: table.sortConfig.key === "status" ? table.sortConfig.direction : undefined, onSort: () => table.handleSort("status") },
      cell: (r) => (
        <Badge color={runStatusColor(r.status)}>{runStatusLabel(r.status)}</Badge>
      ),
    },
    {
      id: "queued",
      header: "Queued At",
      sort: { direction: table.sortConfig.key === "queuedAt" ? table.sortConfig.direction : undefined, onSort: () => table.handleSort("queuedAt") },
      cell: (r) => displayDateTime(r.queuedAt),
    },
    {
      id: "completed",
      header: "Completed At",
      sort: { direction: table.sortConfig.key === "completedAt" ? table.sortConfig.direction : undefined, onSort: () => table.handleSort("completedAt") },
      cell: (r) => (r.completedAt ? displayDateTime(r.completedAt) : "—"),
    },
    { id: "progress", header: "Run Progress", cell: (r) => `${r.progress}%` },
    { id: "reason", header: "Failure Reason", cell: (r) => codeLabel(r.reasonCode) },
  ];
  const action = {
    cell: (r: ReportRunSummary) => (
      <button
        type="button"
        ref={menu.getRef(r.id)}
        aria-label="More actions"
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8"
        onClick={(event) => menu.toggle(r.id, event)}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    ),
  };
  const { layout, control } = useCustomColumnLayout("reportRuns", columns, action);

  return (
    <div className="flex h-full w-full min-w-0 flex-1 flex-col gap-4 md:gap-6">
      <ReportTabsFrame pair="runs">
      {error && (
        <p role="alert" className="px-4 pt-4 text-sm text-red-700 md:px-5">
          {error}
        </p>
      )}
      <ReportListToolbar
        framed={false}
        searchPlaceholder="Search report name, template or run…"
        search={table.searchQuery}
        onSearch={(value) => {
          table.setSearchQuery(value);
          table.setCurrentPage(1);
        }}
        filters={filters}
        dates={dates}
        hasActiveFilters={hasActiveFilters}
        onClear={() => {
          setStatus("");
          setDefinitionCode("");
          setQueued({ from: "", to: "" });
          setCompleted({ from: "", to: "" });
          setFormat("");
          table.setCurrentPage(1);
        }}
        customControl={control}
      >
        <>
          <DataTable
            rows={table.items}
            getRowKey={(r) => r.id}
            isLoading={table.isLoading}

            emptyState={<TableEmptyState title="No Reports Found" description="Generated reports will appear here. Try changing your search or filters." />}
            scrollerRef={drag.scrollerRef}
            scrollProps={drag.dragEvents}
            isDragging={drag.isDragging}
            columns={columns}
            columnLayout={layout}
            action={action}
            pagination={
              table.totalItems > 0 ? (
                <TablePagination
                  currentPage={table.currentPage}
                  totalPages={table.totalPages}
                  totalItems={table.totalItems}
                  itemsPerPage={table.itemsPerPage}
                  onPageChange={table.setCurrentPage}
                  onItemsPerPageChange={table.setItemsPerPage}
                />
              ) : undefined
            }
          />
        </>
      </ReportListToolbar>
      </ReportTabsFrame>
      {previewing?.artifactId && previewing.artifactFormat && (
        <ReportArtifactPreview runId={previewing.id} artifactId={previewing.artifactId} format={previewing.artifactFormat} title={previewing.reportTitle ?? previewing.definitionCode} onClose={() => setPreviewing(null)} />
      )}
      <PortalDropdownMenu isOpen={!!actionRow} onClose={menu.close} position={menu.position} minWidth={200}>
        {actionRow && (
          <div className="py-1">
            <DropdownMenuItem
              icon={<IconInfoCircle className="h-4 w-4" />}
              onClick={() => {
                navigate(`/report/runs/${actionRow.id}`);
                menu.close();
              }}
            >
              View Detail
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<IconFileDownload className="h-4 w-4" />}
              disabled={actionRow.status !== "COMPLETED" || !actionRow.artifactId}
              onClick={() => {
                void download(actionRow);
                menu.close();
              }}
            >
              Download Report
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<IconBinoculars className="h-4 w-4" />}
              disabled={actionRow.status !== "COMPLETED" || !actionRow.artifactId}
              onClick={() => {
                setPreviewing(actionRow);
                menu.close();
              }}
            >
              Preview Report
            </DropdownMenuItem>
          </div>
        )}
      </PortalDropdownMenu>
    </div>
  );
}
