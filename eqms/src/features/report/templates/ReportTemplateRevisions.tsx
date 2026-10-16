import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormSection } from "@/components/ui/form/FormSection";
import { Badge } from "@/components/ui/badge/Badge";
import { Select } from "@/components/ui/select/Select";
import { DataTable, useCustomColumnLayout, type DataTableAction, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { reportTemplatesApi, reportError, type ReportRevisionPage, type ReportRevisionRow, type ReportRevisionStatus } from "@/services/api/reportTemplates";

export const REVISION_STATUS: Record<ReportRevisionStatus, { label: string; color: "emerald" | "amber" | "slate" }> = {
  EFFECTIVE: { label: "Effective", color: "emerald" },
  PENDING_APPROVAL: { label: "Pending Approval", color: "amber" },
  DRAFT: { label: "Draft", color: "slate" },
  OBSOLETE: { label: "Obsoleted", color: "slate" },
  DISCARDED: { label: "Discarded", color: "slate" },
};
export const whenText = (value?: string | null) => (value ? new Date(value).toLocaleString() : "—");

/** The revisions of one report template: the effective one that runs, the one being written, and the obsoleted ones. Sorted, filtered and paged on the server. */
export function ReportTemplateRevisions({ code, inAdministration }: { code: string; inAdministration: boolean }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<{ field: string; direction: "asc" | "desc" }>({ field: "revision", direction: "desc" });
  const [result, setResult] = useState<ReportRevisionPage>();
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setError("");
    reportTemplatesApi
      .revisions(code, { status, sortBy: sort.field, sortDirection: sort.direction, page, limit: pageSize })
      .then((value) => alive && setResult(value))
      .catch((e) => alive && setError(reportError(e)));
    return () => {
      alive = false;
    };
  }, [code, status, sort, page, pageSize]);

  const open = (row: ReportRevisionRow) =>
    navigate(`${inAdministration ? "/settings/report-configuration" : "/report/templates"}/${encodeURIComponent(code)}/revisions/${row.revision}`);
  const sortOf = (field: string) => ({
    direction: sort.field === field ? sort.direction : undefined,
    onSort: () => {
      setPage(1);
      setSort({ field, direction: sort.field === field && sort.direction === "asc" ? "desc" : "asc" });
    },
  });
  const columns: DataTableColumn<ReportRevisionRow>[] = [
    {
      id: "revision",
      header: "Revision",
      sort: sortOf("revision"),
      cell: (row) => (
        <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => open(row)}>
          Rev {row.revision}
        </button>
      ),
    },
    {
      id: "status",
      header: "Status",
      sort: sortOf("status"),
      cell: (row) => (
        <Badge color={REVISION_STATUS[row.status]?.color ?? "slate"} size="sm">
          {REVISION_STATUS[row.status]?.label ?? row.status}
        </Badge>
      ),
    },
    { id: "reason", header: "Reason for the change", cell: (row) => <div className="max-w-80 whitespace-normal">{row.changeReason ?? "—"}</div> },
    { id: "author", header: "Created by", cell: (row) => row.createdByName ?? "—" },
    { id: "approver", header: "Approved by", cell: (row) => row.approvedByName ?? "—" },
    { id: "approved", header: "Approved on", sort: sortOf("approvedAt"), cell: (row) => whenText(row.approvedAt) },
    { id: "effective", header: "Effective from", sort: sortOf("effectiveAt"), cell: (row) => whenText(row.effectiveAt) },
    { id: "obsoleted", header: "Obsoleted", cell: (row) => (row.obsoletedAt ? `${whenText(row.obsoletedAt)} by Rev ${row.obsoletedByRevision ?? ""}` : "—") },
  ];
  const action: DataTableAction<ReportRevisionRow> = {
    cell: (row) => (
      <button type="button" className="text-sm font-medium text-emerald-600 hover:underline" onClick={() => open(row)}>
        View
      </button>
    ),
  };
  const { layout, control } = useCustomColumnLayout("reportTemplateRevisions", columns, action);

  return (
    <FormSection title="Revisions" description="Every revision of this template. Only the effective revision runs; a new revision runs after it is approved.">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="w-full sm:w-64">
          <Select
            label="Status"
            value={status}
            options={[{ value: "ALL", label: "All" }, ...Object.entries(REVISION_STATUS).map(([value, item]) => ({ value, label: item.label }))]}
            onChange={(value) => {
              setPage(1);
              setStatus(String(value));
            }}
          />
        </div>
        {control}
      </div>
      {error && (
        <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <DataTable
        rows={result?.data ?? []}
        getRowKey={(row) => String(row.revision)}
        columns={columns}
        columnLayout={layout}
        action={action}
        emptyState={<TableEmptyState title="No revisions" description="This template has no revision for the chosen status." />}
        pagination={
          result && (
            <TablePagination
              currentPage={page}
              totalPages={result.pagination.totalPages}
              totalItems={result.pagination.total}
              itemsPerPage={pageSize}
              onPageChange={setPage}
              onItemsPerPageChange={(size) => {
                setPage(1);
                setPageSize(size);
              }}
            />
          )
        }
      />
    </FormSection>
  );
}
