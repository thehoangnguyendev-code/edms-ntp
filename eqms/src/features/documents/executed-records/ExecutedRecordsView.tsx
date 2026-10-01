import React, { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Select } from "@/components/ui/select/Select";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { executedRecords as executedRecordsBreadcrumbs } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { useDebounce, useNavigateWithLoading } from "@/hooks";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { formatDateTime } from "@/utils/format";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import { executedRecordApi, type ExecutedRecord } from "@/services/api/executedRecords";
import { ROUTES } from "@/app/routes.constants";

const STATUS_BADGE: Record<string, "emerald" | "amber" | "red" | "slate"> = {
  EXECUTED: "emerald",
  PENDING_APPROVAL: "amber",
  REJECTED: "red",
  SUBMITTED: "slate",
};

const STATUS_LABEL: Record<string, string> = {
  EXECUTED: "Executed",
  PENDING_APPROVAL: "Pending Approval",
  REJECTED: "Rejected",
  SUBMITTED: "Submitted",
};

const METHOD_LABEL: Record<string, string> = {
  EFORM: "eForm",
  PAPER_SCAN: "Paper",
};

/** Global "Records" screen -- every Executed Record across every Form, filterable. The same data
 *  a Form's own "Executed Records" tab shows scoped to one Form (see ExecutedRecordsTab.tsx). */
export const ExecutedRecordsView: React.FC = () => {
  const { navigateTo } = useNavigateWithLoading();
  const [rows, setRows] = useState<ExecutedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 400);
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: "created" | "number" | "status" | "method" | "filled"; direction: "asc" | "desc" }>({
    key: "created",
    direction: "desc",
  });

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  useEntityChanged(["EXECUTED_RECORD"], reload, { debounceMs: 1200 });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    executedRecordApi
      .getExecutedRecords({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        captureMethod: methodFilter === "all" ? undefined : methodFilter,
        sortBy: sortConfig.key,
        sortDirection: sortConfig.direction,
      })
      .then((page) => {
        if (!active) return;
        setRows(page.data);
        setTotalItems(page.pagination.total);
        setTotalPages(page.pagination.totalPages);
      })
      .catch((err) => {
        if (active) setError(extractApiMessage(err, "Unable to load Executed Records."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentPage, itemsPerPage, debouncedSearch, statusFilter, methodFilter, reloadKey, sortConfig]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, methodFilter]);

  const handleSort = (key: typeof sortConfig.key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };
  const sort = (key: typeof sortConfig.key) => ({
    direction: sortConfig.key === key ? sortConfig.direction : undefined,
    onSort: () => handleSort(key),
  });

  const columns: DataTableColumn<ExecutedRecord>[] = [
    {
      id: "no",
      header: "No.",
      headerClassName: "w-16",
      cell: (_, index) => (currentPage - 1) * itemsPerPage + index + 1,
    },
    {
      id: "number",
      header: "Record No.",
      sort: sort("number"),
      cell: (r) => <span className="font-semibold text-slate-900">{r.recordNumber}</span>,
    },
    {
      id: "form",
      header: "Form",
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-800">{r.formDocumentNumber}</p>
          <p className="truncate text-2xs text-slate-500">{r.formDocumentTitle}</p>
        </div>
      ),
    },
    {
      id: "method",
      header: "Method",
      sort: sort("method"),
      cell: (r) => <Badge color="blue" size="sm">{METHOD_LABEL[r.captureMethod] ?? r.captureMethod}</Badge>,
    },
    { id: "filledBy", header: "Filled By", cell: (r) => r.filledByName ?? "—" },
    {
      id: "status",
      header: "Status",
      sort: sort("status"),
      cell: (r) => <Badge color={STATUS_BADGE[r.status] ?? "slate"} size="sm">{STATUS_LABEL[r.status] ?? r.status}</Badge>,
    },
    {
      id: "filledAt",
      header: "Filled",
      sort: sort("filled"),
      cell: (r) => formatDateTime(r.filledAt ?? ""),
    },
  ];

  return (
    <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
      <PageHeader title="Records" breadcrumbItems={executedRecordsBreadcrumbs(navigateTo)} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 min-w-0 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by record number or Form..."
            className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/30"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={statusFilter}
            onChange={(v) => setStatusFilter(String(v))}
            enableSearch={false}
            options={[
              { value: "all", label: "All statuses" },
              { value: "PENDING_APPROVAL", label: "Pending Approval" },
              { value: "EXECUTED", label: "Executed" },
              { value: "REJECTED", label: "Rejected" },
            ]}
          />
        </div>
        <div className="w-full sm:w-40">
          <Select
            value={methodFilter}
            onChange={(v) => setMethodFilter(String(v))}
            enableSearch={false}
            options={[
              { value: "all", label: "All methods" },
              { value: "EFORM", label: "eForm" },
              { value: "PAPER_SCAN", label: "Paper" },
            ]}
          />
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <DataTable
          rows={rows}
          columns={columns}
          getRowKey={(r) => r.id}
          isLoading={loading}
          onRowClick={(r) => r.formDocumentId && navigateTo(`${ROUTES.DOCUMENTS.DETAIL(r.formDocumentId)}?tab=records`)}
          emptyState={<TableEmptyState title="No Executed Records" description="No Form has been filled or recorded yet." />}
          pagination={
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              isLoading={loading}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          }
        />
      </div>
    </div>
  );
};
