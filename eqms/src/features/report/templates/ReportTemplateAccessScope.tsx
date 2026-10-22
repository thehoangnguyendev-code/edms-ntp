import React, { useCallback, useEffect, useState } from "react";
import { Select } from "@/components/ui/select/Select";
import { Badge } from "@/components/ui/badge/Badge";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { useDebounce } from "@/hooks";
import { ReportListToolbar } from "../shared/ReportListToolbar";
import { reportError, reportTemplatesApi, type MetadataScope, type ReportRolePage, type ReportRoleRow, type RoleGrant } from "@/services/api/reportTemplates";

const SCOPES: { value: MetadataScope; label: string }[] = [
  { value: "PERSONAL", label: "Personal" },
  { value: "DEPARTMENT", label: "Department" },
  { value: "BUSINESS_UNIT", label: "Business Unit" },
  { value: "SYSTEM", label: "Entire system" },
];
const SCOPE_LABEL: Record<string, string> = Object.fromEntries(SCOPES.map((scope) => [scope.value, scope.label]));

/**
 * Access & Scope of a report template: which Access Profiles may use it and how far their data reaches. The profiles are searched, filtered, sorted and
 * paged by the server (the scopes set so far travel with each request, so the server can filter and sort by them); this table only shows them and
 * holds the author's choices until the template is saved. A profile with no scope has no access to the template.
 */
export function ReportTemplateAccessScope({ assignments, editable, onChange, allowedScopes }: { assignments: RoleGrant[]; editable: boolean; onChange: (next: RoleGrant[]) => void; allowedScopes?: MetadataScope[] }) {
  // The report type decides which scopes it can be given: the Audit Trail, for example, only the whole system.
  const scopeChoices = allowedScopes?.length ? SCOPES.filter((item) => allowedScopes.includes(item.value)) : SCOPES;
  const [search, setSearch] = useState("");
  const [assignment, setAssignment] = useState("ALL");
  const [scope, setScope] = useState("");
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "name", direction: "asc" });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [result, setResult] = useState<ReportRolePage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const assignmentsKey = JSON.stringify(assignments.map((grant) => [grant.roleId, grant.scope]));
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    reportTemplatesApi
      .searchRoles({
        search: debouncedSearch.trim(),
        assignment,
        scope,
        sortBy: sort.key,
        sortDirection: sort.direction,
        page,
        limit,
        assignments: assignments.map((grant) => ({ roleId: grant.roleId, scope: grant.scope })),
      })
      .then((value) => alive && setResult(value))
      .catch((e) => alive && setError(reportError(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // The grants are read through assignmentsKey: the list loads again when a scope changes, because the filters may change what it holds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, assignment, scope, sort, page, limit, assignmentsKey]);

  const setScopeOf = useCallback(
    (row: ReportRoleRow, next: string) => {
      const others = assignments.filter((grant) => grant.roleId !== row.id);
      onChange(next ? [...others, { roleId: row.id, roleName: row.name, scope: next as MetadataScope }] : others);
    },
    [assignments, onChange],
  );

  const sortOf = (key: string) => ({
    direction: sort.key === key ? sort.direction : undefined,
    onSort: () => {
      setPage(1);
      setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
    },
  });
  const columns: DataTableColumn<ReportRoleRow>[] = [
    { id: "no", header: "No.", locked: true, cell: (_row, index) => (page - 1) * limit + index + 1 },
    {
      id: "name",
      header: "Access Profile",
      sort: sortOf("name"),
      cell: (row) => <span className="font-medium text-slate-900">{row.name}</span>,
    },
    { id: "code", header: "Code", sort: sortOf("code"), cell: (row) => <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">{row.code}</code> },
    {
      id: "scope",
      header: "Data scope",
      sort: sortOf("scope"),
      cell: (row) =>
        editable ? (
          <div className="min-w-48">
            <Select
              value={row.scope ?? ""}
              enableSearch={false}
              options={[{ value: "", label: "No access" }, ...scopeChoices]}
              onChange={(next) => setScopeOf(row, String(next))}
            />
          </div>
        ) : row.scope ? (
          SCOPE_LABEL[row.scope] ?? row.scope
        ) : (
          "No access"
        ),
    },
    {
      id: "access",
      header: "Access",
      label: "Access",
      cell: (row) =>
        row.scope ? (
          <Badge color="emerald" size="sm">
            Can use this template
          </Badge>
        ) : (
          <Badge color="slate" size="sm">
            No access
          </Badge>
        ),
    },
  ];
  const { layout, control } = useCustomColumnLayout("reportTemplateAccessScope", columns);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm leading-relaxed text-blue-800">
        Report metadata scope is independent of source-document access. An Access Profile without a scope has no access to this template. Scopes of the profiles a person holds
        are combined; the broadest applicable scope wins. Entire system includes metadata outside the user's department, but never file content.
      </div>
      {(result?.inactive ?? []).length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">These Access Profiles are not active any more. Remove their scope before the template is saved.</p>
          <ul className="mt-2 space-y-1">
            {(result?.inactive ?? []).map((role) => (
              <li key={role.id} className="flex items-center justify-between gap-3">
                <span>
                  {role.name} · {SCOPE_LABEL[role.scope] ?? role.scope}
                </span>
                {editable && (
                  <button type="button" className="text-xs font-medium text-red-700 underline" onClick={() => onChange(assignments.filter((grant) => grant.roleId !== role.id))}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <ReportListToolbar
        framed={false}
        flush
        searchPlaceholder="Search access profile or code…"
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        filters={[
          {
            id: "assignment",
            label: "Assignment",
            value: assignment,
            options: [
              { label: "All", value: "ALL" },
              { label: "With access", value: "ASSIGNED" },
              { label: "Without access", value: "UNASSIGNED" },
            ],
            onChange: (value) => {
              setAssignment(value);
              setPage(1);
            },
          },
          {
            id: "scope",
            label: "Data scope",
            value: scope,
            options: [{ label: "All", value: "" }, ...scopeChoices],
            onChange: (value) => {
              setScope(value);
              setPage(1);
            },
          },
        ]}
        hasActiveFilters={assignment !== "ALL" || !!scope || !!search}
        onClear={() => {
          setSearch("");
          setAssignment("ALL");
          setScope("");
          setPage(1);
        }}
        customControl={control}
      >
        <DataTable
          rows={result?.data ?? []}
          getRowKey={(row) => row.id}
          isLoading={loading && !result}
          columns={columns}
          columnLayout={layout}
          emptyState={<TableEmptyState title="No access profiles" description="No active Access Profile matches the search or filter." />}
          pagination={
            result && result.pagination.total > 0 ? (
              <TablePagination
                currentPage={page}
                totalPages={result.pagination.totalPages}
                totalItems={result.pagination.total}
                itemsPerPage={limit}
                onPageChange={setPage}
                onItemsPerPageChange={(size) => {
                  setPage(1);
                  setLimit(size);
                }}
              />
            ) : undefined
          }
        />
      </ReportListToolbar>
    </div>
  );
}
