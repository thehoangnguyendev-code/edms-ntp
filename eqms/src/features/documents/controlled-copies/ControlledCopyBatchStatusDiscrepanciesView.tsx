import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useBackNavigation } from "@/app/navigation/backNavigation";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  FileText,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { EmptyState } from "@/components/ui/page/EmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge/Badge";
import { useToast } from "@/components/ui/toast/Toast";
import {
  documentApi,
  type ControlledCopyBatchStatusDiscrepancy,
} from "@/services/api/documents";
import { controlledCopyBatchStatusDiscrepancies } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { normalizeControlledCopyStatusLabel } from "./status";
import { ROUTES } from "@/app/routes.constants";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";

const PAGE_SIZE = 20;

export const ControlledCopyBatchStatusDiscrepanciesView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const handleBack = useBackNavigation(
    navigate,
    location.state,
    ROUTES.DOCUMENTS.CONTROLLED_COPIES.ALL,
  );
  const { showToast } = useToast();
  const [rows, setRows] = useState<ControlledCopyBatchStatusDiscrepancy[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(false);
    documentApi
      .getControlledCopyBatchStatusDiscrepancies({
        page: currentPage,
        limit: PAGE_SIZE,
      })
      .then((response) => {
        if (cancelled) return;
        setRows(response.data);
        setTotal(response.pagination.total);
        setTotalPages(response.pagination.totalPages);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        showToast({
          type: "error",
          message: "Failed to load the batch review list.",
        });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentPage, reloadToken, showToast]);

  const formatDateTime = (value: string) => {
    try {
      return new Date(value).toLocaleString("en-US");
    } catch {
      return value;
    }
  };

  const columns: DataTableColumn<ControlledCopyBatchStatusDiscrepancy>[] = [
    {
      id: "batchNumber",
      header: "Batch number",
      cellClassName: "font-medium text-slate-800",
      cell: (row) => (
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          {row.batchNumber}
        </span>
      ),
    },
    {
      id: "document",
      header: "Document",
      headerClassName: "min-w-[16rem]",
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
          <span
            className="min-w-0 truncate"
            title={row.documentTitle || row.documentNumber || undefined}
          >
            {row.documentNumber || "—"}
            {row.documentTitle ? ` — ${row.documentTitle}` : ""}
          </span>
        </div>
      ),
    },
    {
      id: "storedStatus",
      header: "Stored status",
      cell: (row) => (
        <Badge color="amber" size="sm">
          {normalizeControlledCopyStatusLabel(row.actualStatusCode)}
        </Badge>
      ),
    },
    {
      id: "expectedStatus",
      header: "Expected status",
      cell: (row) => (
        <Badge color="emerald" size="sm">
          {normalizeControlledCopyStatusLabel(row.expectedStatusCode)}
        </Badge>
      ),
    },
    {
      id: "detectedAt",
      header: "Detected at",
      cell: (row) => formatDateTime(row.detectedAt),
    },
    {
      id: "lastCheckedAt",
      header: "Last checked",
      cell: (row) => formatDateTime(row.lastCheckedAt),
    },
  ];

  return (
    <div className="flex h-full w-full flex-1 flex-col gap-4 md:gap-6">
      <PageHeader
        title="Batch Status Discrepancies"
        breadcrumbItems={controlledCopyBatchStatusDiscrepancies(navigate)}
        actions={
          <Button
            onClick={handleBack}
            size="sm"
            variant="outline-emerald"
            className="whitespace-nowrap"
          >
            Back
          </Button>
        }
      />

      <section
        className="flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        aria-labelledby="batch-discrepancy-heading"
      >
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-r from-amber-50/80 via-white to-white px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-100 bg-amber-50 text-amber-600">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="batch-discrepancy-heading"
                className="text-sm font-semibold text-slate-900 md:text-base"
              >
                Review required
              </h2>
              <p className="mt-0.5 max-w-3xl text-xs leading-5 text-slate-600 md:text-sm">
                The stored batch status differs from the status derived from
                member copies. The hourly scan flags discrepancies but never
                corrects records automatically.
              </p>
            </div>
          </div>
          {!isLoading && !loadError && (
            <Badge
              color={total > 0 ? "amber" : "emerald"}
              size="sm"
              className="shrink-0 self-start md:self-auto"
            >
              {total > 0 ? `${total} requiring review` : "No discrepancies"}
            </Badge>
          )}
        </div>

        <div className="flex flex-1 flex-col p-4 md:p-5">
          {isLoading ? (
            <SectionLoading minHeight="40vh" />
          ) : loadError ? (
            <EmptyState
              icon={AlertTriangle}
              variant="dashed"
              title="Unable to load discrepancies"
              description="The review list could not be retrieved. No status records were changed."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReloadToken((value) => value + 1)}
                  className="gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Try again
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              variant="dashed"
              title="No status mismatches to review"
              description="All active batches currently match the status of their member copies."
            />
          ) : (
            <>
              <DataTable
                className="hidden md:flex"
                rows={rows}
                columns={columns}
                getRowKey={(row) => row.id}
                scrollerRef={scrollerRef}
                scrollProps={dragEvents}
                isDragging={isDragging}
                tableClassName="min-w-[900px] border-collapse text-sm"
                rowClassName="cursor-pointer hover:bg-amber-50/40 focus-within:bg-amber-50/40"
                onRowClick={(row) =>
                  navigate(
                    ROUTES.DOCUMENTS.CONTROLLED_COPIES.DETAIL(row.batchId),
                  )
                }
                onRowKeyDown={(event, row) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(
                      ROUTES.DOCUMENTS.CONTROLLED_COPIES.DETAIL(row.batchId),
                    );
                  }
                }}
                rowTabIndex={0}
                action={{
                  header: <span className="sr-only">Open batch</span>,
                  cell: (row) => (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-slate-500 hover:text-emerald-700"
                      aria-label={`Open batch ${row.batchNumber}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(
                          ROUTES.DOCUMENTS.CONTROLLED_COPIES.DETAIL(
                            row.batchId,
                          ),
                        );
                      }}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ),
                }}
              />

              <div className="space-y-3 md:hidden">
                {rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() =>
                      navigate(
                        ROUTES.DOCUMENTS.CONTROLLED_COPIES.DETAIL(row.batchId),
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-amber-200 hover:bg-amber-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    aria-label={`Open batch ${row.batchNumber}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-900">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                        {row.batchNumber}
                      </span>
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                      {row.documentNumber || "—"}
                      {row.documentTitle ? ` — ${row.documentTitle}` : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge color="amber" size="xs">
                        {normalizeControlledCopyStatusLabel(
                          row.actualStatusCode,
                        )}
                      </Badge>
                      <ArrowRight
                        className="h-3.5 w-3.5 text-slate-400"
                        aria-hidden="true"
                      />
                      <Badge color="emerald" size="xs">
                        {normalizeControlledCopyStatusLabel(
                          row.expectedStatusCode,
                        )}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                      <span>
                        <span className="block text-slate-400">Detected</span>
                        {formatDateTime(row.detectedAt)}
                      </span>
                      <span>
                        <span className="block text-slate-400">
                          Last checked
                        </span>
                        {formatDateTime(row.lastCheckedAt)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={total}
                  itemsPerPage={PAGE_SIZE}
                  onPageChange={setCurrentPage}
                />
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default ControlledCopyBatchStatusDiscrepanciesView;
