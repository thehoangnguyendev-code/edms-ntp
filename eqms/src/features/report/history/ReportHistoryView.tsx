import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button/Button";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormSection } from "@/components/ui/form/FormSection";
import { DataTable } from "@/components/ui/table";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useNavigate } from "react-router-dom";
import { MoreVertical, Eye, Download } from "lucide-react";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { ReportListFilters } from "../shared/ReportListFilters";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { Drawer } from "@/components/ui/drawer/Drawer";
import { DocumentPdfViewer } from "@/features/documents/shared/components/DocumentPdfViewer";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import {
  reportsApi,
  type ReportRunPage,
  type ReportRunDetail,
} from "@/services/api/reports";
import { reportError } from "@/services/api/reportTemplates";
import { Badge } from "@/components/ui/badge/Badge";
import { IconFileDownload, IconInfoCircle } from "@tabler/icons-react";

type Sort = "queuedAt" | "completedAt" | "definitionCode" | "status";
export function ReportHistoryView() {
  const navigate = useNavigate();
  const menu = usePortalDropdown();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<Sort>("queuedAt");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [value, setValue] = useState<ReportRunPage>({
    data: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [detail, setDetail] = useState<ReportRunDetail>();
  const [selected, setSelected] = useState("");
  const [url, setUrl] = useState("");
  const [detailError, setDetailError] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const drag = useTableDragScroll();
  const actionRow = value.data.find((row) => row.id === menu.openId);
  const selection = useRef(selected);
  selection.current = selected;
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(input);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);
  useEffect(() => {
    let alive = true;
    setBusy(true);
    setError("");
    reportsApi
      .listRuns({
        search,
        page,
        limit: 10,
        sortBy: sort,
        sortDirection: direction,
      })
      .then((v) => {
        if (alive) setValue(v);
      })
      .catch((e) => {
        if (alive) setError(reportError(e));
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [search, page, sort, direction, refresh]);
  useEffect(() => {
    if (
      !value.data.some((r) =>
        ["QUEUED", "PROCESSING", "RETRY_SCHEDULED"].includes(r.status),
      )
    )
      return;
    const timer = setTimeout(() => setRefresh((n) => n + 1), 5000);
    return () => clearTimeout(timer);
  }, [value, refresh]);
  useEffect(() => {
    let alive = true;
    if (!selected) return;
    setDetail(undefined);
    setDetailError("");
    reportsApi
      .getRun(selected)
      .then((v) => {
        if (alive) setDetail(v);
      })
      .catch((e) => {
        if (alive) setDetailError(reportError(e));
      });
    return () => {
      alive = false;
    };
  }, [selected, refresh]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  const changeSort = (field: Sort) => {
    setPage(1);
    setSort(field);
    setDirection(sort === field && direction === "asc" ? "desc" : "asc");
  };
  const download = async (id: string, artifact: string) => {
    try {
      const blob = await reportsApi.downloadArtifact(id, artifact);
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `report-${id}.${blob.type.includes("pdf") ? "pdf" : blob.type.includes("spreadsheet") ? "xlsx" : "csv"}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (e) {
      setError(reportError(e));
    }
  };
  const preview = async () => {
    if (!detail) return;
    const runId = detail.id;
    const pdf = detail.artifacts.find((a) => a.format === "PDF" && !a.purgedAt);
    if (!pdf) return;
    setPreviewBusy(true);
    setDetailError("");
    try {
      const blob = await reportsApi.downloadArtifact(runId, pdf.id);
      if (selection.current === runId) setUrl(URL.createObjectURL(blob));
    } catch (e) {
      if (selection.current === runId) setDetailError(reportError(e));
    } finally {
      if (selection.current === runId) setPreviewBusy(false);
    }
  };
  return (
    <div className="flex min-w-0 flex-col h-full gap-4 md:gap-6 w-full flex-1">
      <PageHeader
        title="Report History"
        breadcrumbItems={reportBreadcrumbs(navigate, "Report History")}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRefresh((n) => n + 1)}
          >
            Refresh
          </Button>
        }
      />
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm min-w-0 w-full overflow-hidden flex flex-col">
        <div className="p-4 md:p-5 flex-1 flex flex-col">
          {error && (
            <p role="alert" className="mb-4 text-sm text-red-700">
              {error}
            </p>
          )}
          <ReportListFilters
            search={input}
            onSearch={setInput}
            placeholder="Search report name, template or run…"
            values={{ sort, direction }}
            defaults={{ sort: "queuedAt", direction: "desc" }}
            groups={[
              {
                id: "sort",
                label: "Sort by",
                options: [
                  { value: "queuedAt", label: "Queued time" },
                  { value: "completedAt", label: "Completed time" },
                  { value: "definitionCode", label: "Template" },
                  { value: "status", label: "Status" },
                ],
              },
              {
                id: "direction",
                label: "Sort direction",
                options: [
                  { value: "asc", label: "Ascending" },
                  { value: "desc", label: "Descending" },
                ],
              },
            ]}
            onApply={(next) => {
              setSort(next.sort as Sort);
              setDirection(next.direction as "asc" | "desc");
              setPage(1);
            }}
          />
          <div className="flex-1 flex flex-col relative">
            <DataTable
              rows={value.data}
              getRowKey={(r) => r.id}
              isLoading={busy}
              loadingContent={<SectionLoading text="Loading reports…" />}
              emptyState={
                <TableEmptyState
                  title="No Reports Found"
                  description="Generated reports will appear here. Try changing your search."
                />
              }
              scrollerRef={drag.scrollerRef}
              scrollProps={drag.dragEvents}
              isDragging={drag.isDragging}
              columns={[
                {
                  id: "no",
                  header: "No.",
                  cell: (_r, i) => (page - 1) * 10 + i + 1,
                },
                {
                  id: "name",
                  header: "Report name",
                  cell: (r) => (
                    <div className="max-w-80 whitespace-normal">
                      <button
                        type="button"
                        className="font-medium text-emerald-600 hover:underline text-left"
                        onClick={() => {
                          setUrl("");
                          setSelected(r.id);
                        }}
                      >
                        {r.reportTitle ?? r.definitionCode}
                      </button>
                      <span className="block text-xs text-slate-500">
                        {r.definitionCode} · v{r.definitionVersion}
                      </span>
                    </div>
                  ),
                },
                {
                  id: "status",
                  header: "Status",
                  sort: {
                    direction: sort === "status" ? direction : undefined,
                    onSort: () => changeSort("status"),
                  },
                  cell: (r) => (
                    <Badge
                      color={
                        r.status === "COMPLETED"
                          ? "emerald"
                          : r.status === "FAILED"
                            ? "red"
                            : "slate"
                      }
                    >
                      {r.status}
                    </Badge>
                  ),
                },
                {
                  id: "date",
                  header: "Queued",
                  sort: {
                    direction: sort === "queuedAt" ? direction : undefined,
                    onSort: () => changeSort("queuedAt"),
                  },
                  cell: (r) => new Date(r.queuedAt).toLocaleString(),
                },
                {
                  id: "progress",
                  header: "Progress",
                  cell: (r) => `${r.progress}%`,
                },
                {
                  id: "reason",
                  header: "Reason",
                  cell: (r) => r.reasonCode ?? "—",
                },
              ]}
              action={{
                cell: (r) => (
                  <button
                    type="button"
                    ref={menu.getRef(r.id)}
                    aria-label="More actions"
                    className="inline-flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                    onClick={(event) => menu.toggle(r.id, event)}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                ),
              }}
              pagination={
                <TablePagination
                  currentPage={page}
                  totalPages={value.pagination.totalPages}
                  totalItems={value.pagination.total}
                  itemsPerPage={10}
                  showItemsPerPageSelector={false}
                  onPageChange={setPage}
                />
              }
            />
          </div>
        </div>
      </div>
      <PortalDropdownMenu
        isOpen={!!actionRow}
        onClose={menu.close}
        position={menu.position}
        minWidth={200}
      >
        {actionRow && (
          <div className="py-1">
            <DropdownMenuItem
              icon={<IconInfoCircle className="h-4 w-4" />}
              onClick={() => {
                setUrl("");
                setSelected(actionRow.id);
                menu.close();
              }}
            >
              View Detail
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<IconFileDownload className="h-4 w-4" />}
              disabled={
                actionRow.status !== "COMPLETED" || !actionRow.artifactId
              }
              onClick={() => {
                void download(actionRow.id, actionRow.artifactId!);
                menu.close();
              }}
            >
              Download Report
            </DropdownMenuItem>
          </div>
        )}
      </PortalDropdownMenu>
      <Drawer
        open={!!selected}
        title="Report Details"
        subtitle={detail?.reportTitle ?? detail?.definitionCode}
        onClose={() => {
          setSelected("");
          setUrl("");
        }}
      >
        {detailError && (
          <p role="alert" className="mb-4 text-sm text-red-700">
            {detailError}
          </p>
        )}
        {detail ? (
          <div className="space-y-5 text-sm text-slate-700">
            <FormSection title="Report Information">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  ["Status", detail.status],
                  ["Progress", `${detail.progress}%`],
                  ["Attempts", detail.attemptCount],
                  ["Template version", `v${detail.definitionVersion}`],
                  ["Queued", new Date(detail.queuedAt).toLocaleString()],
                  [
                    "Completed",
                    detail.completedAt
                      ? new Date(detail.completedAt).toLocaleString()
                      : "—",
                  ],
                  ["Reason", detail.reasonCode ?? "—"],
                ].map(([label, value]) => (
                  <div key={String(label)} className="min-w-0">
                    <dt className="mb-1 text-xs text-slate-500">{label}</dt>
                    <dd className="break-words font-medium text-slate-900">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </FormSection>
            {detail.status === "COMPLETED" &&
              detail.artifacts.some(
                (a) => a.format === "PDF" && !a.purgedAt,
              ) && (
                <Button
                  size="sm"
                  variant="outline-emerald"
                  loading={previewBusy}
                  onClick={() => void preview()}
                >
                  Preview PDF
                </Button>
              )}
            {["FAILED", "RETRY_SCHEDULED"].includes(detail.status) && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await reportsApi.retryRun(detail.id);
                    setRefresh((n) => n + 1);
                  } catch (e) {
                    setDetailError(reportError(e));
                  }
                }}
              >
                Retry generation
              </Button>
            )}
            {url && (
              <DocumentPdfViewer
                fileUrl={url}
                height="550px"
                minHeight="360px"
                forceHideDownloadAndPrint
              />
            )}
            <FormSection title="Audit Events">
              <ol className="space-y-3">
                {detail.events.map((event, i) => (
                  <li key={i} className="border-l-2 border-emerald-100 pl-3">
                    <p>{event.eventType}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(event.createdAt).toLocaleString()}
                      {event.reasonCode ? ` · ${event.reasonCode}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            </FormSection>
            <FormSection title="Report Files">
              <div className="space-y-3">
                {detail.artifacts.map((a) => (
                  <div
                    key={a.id}
                    className="space-y-1 rounded-lg border border-slate-200 p-3"
                  >
                    <p>
                      {a.format} · {a.byteSize.toLocaleString()} bytes
                    </p>
                    <p className="break-all text-xs text-slate-500">
                      SHA-256: {a.sha256}
                    </p>
                    <p className="text-xs">
                      {a.purgedAt
                        ? "Expired / removed by retention"
                        : a.legalHold
                          ? "Legal hold"
                          : "Retention policy applies"}
                    </p>
                  </div>
                ))}
              </div>
            </FormSection>
          </div>
        ) : (
          <SectionLoading text="Loading report details…" />
        )}
      </Drawer>
    </div>
  );
}
