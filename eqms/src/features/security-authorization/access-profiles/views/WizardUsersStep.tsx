import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Select } from "@/components/ui/select/Select";
import { DataTable, type DataTableColumn, type DataTableSelection } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { useToast } from "@/components/ui/toast";
import { useDebounce } from "@/hooks";
import { settingsApi } from "@/services/api/settings";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { USER_MANAGEMENT_ROUTES } from "../../user-management/constants";
import type { User } from "@/types";

type SortKey = "employeeCode" | "fullName" | "businessUnit" | "department" | "email";
type SortDirection = "asc" | "desc";
type Option = { label: string; value: string };

const labelClass = "text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block";
const inputClass =
  "w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400";

/**
 * Step "Users" of the Access Profile wizard: the people who receive the profile when it is created. The list is the shared `DataTable` with the search, the Business Unit and
 * Department filters, the sort and the pages all done by the server (the list of users is long); what the person ticked stays ticked across pages and filters, because the
 * wizard owns the selection (it also reads it for the review step and the request).
 */
export const WizardUsersStep: React.FC<{
  /** Without `settings.user.view` the list cannot be read: the step only says that the profile is created unassigned. */
  canListUsers: boolean;
  selectedIds: ReadonlySet<string>;
  onToggle: (user: User) => void;
  /** Ticks or unticks every user of the page at once. */
  onToggleMany: (users: readonly User[], checked: boolean) => void;
  onClear: () => void;
}> = ({ canListUsers, selectedIds, onToggle, onToggleMany, onClear }) => {
  const { showToast } = useToast();
  const [rows, setRows] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(canListUsers);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: "fullName", direction: "asc" });
  const [search, setSearch] = useState("");
  const [businessUnit, setBusinessUnit] = useState("All");
  const [department, setDepartment] = useState("All");
  const [businessUnitOptions, setBusinessUnitOptions] = useState<Option[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<Option[]>([]);
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    if (!canListUsers) return;
    let active = true;
    settingsApi.getUserFilters()
      .then((filters) => {
        if (!active) return;
        setBusinessUnitOptions(filters.businessUnits.map((item) => ({ label: item.label, value: item.value })));
        setDepartmentOptions(filters.departments.map((item) => ({ label: item.label, value: item.value })));
      })
      .catch(() => { if (active) showToast({ type: "error", title: "Load Failed", message: "Failed to load user filter options." }); });
    return () => { active = false; };
  }, [canListUsers, showToast]);

  useEffect(() => {
    if (!canListUsers) {
      setRows([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    settingsApi
      .getUsers({
        page,
        limit,
        search: debouncedSearch.trim() || undefined,
        status: "Active",
        businessUnit: businessUnit === "All" ? undefined : businessUnit,
        department: department === "All" ? undefined : department,
        sortBy: sort.key,
        sortDirection: sort.direction,
      })
      .then((result) => {
        if (!active) return;
        setRows(result.data ?? []);
        setTotal(result.pagination?.total ?? result.data?.length ?? 0);
        setTotalPages(Math.max(1, result.pagination?.totalPages ?? 1));
      })
      .catch(() => { if (active) showToast({ type: "error", message: "Failed to load users" }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canListUsers, page, limit, debouncedSearch, businessUnit, department, sort, showToast]);

  const sortOf = (key: SortKey) => ({
    direction: sort.key === key ? sort.direction : undefined,
    onSort: () => {
      setSort((current) => (current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }));
      setPage(1);
    },
  });

  const pageAllSelected = rows.length > 0 && rows.every((user) => selectedIds.has(user.id));
  const pageSomeSelected = !pageAllSelected && rows.some((user) => selectedIds.has(user.id));

  const selection: DataTableSelection<User> = {
    visible: true,
    header: <Checkbox aria-label="Select every user of this page" checked={pageAllSelected} indeterminate={pageSomeSelected} onChange={() => onToggleMany(rows, !pageAllSelected)} />,
    cell: (user) => <span onClick={(event) => event.stopPropagation()}><Checkbox aria-label={`Select ${user.fullName}`} checked={selectedIds.has(user.id)} onChange={() => onToggle(user)} /></span>,
    cellClassName: "w-10",
  };

  const columns = useMemo<DataTableColumn<User>[]>(
    () => [
      { id: "no", header: "No.", label: "No.", locked: true, headerClassName: "w-14", cellClassName: "w-14 text-xs tabular-nums text-slate-500", cell: (_user, index) => (page - 1) * limit + index + 1 },
      {
        id: "employeeCode",
        header: "Employee ID",
        label: "Employee ID",
        sort: sortOf("employeeCode"),
        // the same look as the Employee ID of User Management (a green link to the person's profile); here it opens in a new tab so that the wizard keeps what was entered
        cell: (user) => (
          <a
            href={USER_MANAGEMENT_ROUTES.PROFILE(user.id)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="cursor-pointer font-medium text-emerald-600 hover:underline"
          >
            {user.employeeCode}
          </a>
        ),
      },
      {
        id: "fullName",
        header: "Full Name",
        label: "Full Name",
        sort: sortOf("fullName"),
        cell: (user) => (
          <div className="flex items-center gap-2.5">
            <Avatar name={user.fullName || user.username || "User"} src={user.avatar} tone="brand" className="h-8 w-8" />
            <span className="font-medium text-slate-900">{user.fullName}</span>
          </div>
        ),
      },
      { id: "businessUnit", header: "Business Unit", label: "Business Unit", sort: sortOf("businessUnit"), cell: (user) => user.businessUnit || "—" },
      { id: "department", header: "Department", label: "Department", sort: sortOf("department"), cell: (user) => user.department || "—" },
      { id: "email", header: "Email", label: "Email", sort: sortOf("email"), cellClassName: "text-slate-600", cell: (user) => user.email || "—" },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sort, page, limit],
  );

  const hasFilters = Boolean(debouncedSearch.trim()) || businessUnit !== "All" || department !== "All";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className={labelClass}>Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className={inputClass + " pl-9"}
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search by name, employee ID, email…"
              disabled={!canListUsers}
            />
          </div>
        </div>
        <Select
          label="Business Unit"
          value={businessUnit}
          onChange={(value) => { setBusinessUnit(String(value)); setDepartment("All"); setPage(1); }}
          options={[{ label: "All", value: "All" }, ...businessUnitOptions]}
          disabled={!canListUsers}
        />
        <Select
          label="Department"
          value={department}
          onChange={(value) => { setDepartment(String(value)); setPage(1); }}
          options={[{ label: "All", value: "All" }, ...departmentOptions]}
          disabled={!canListUsers}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge color="emerald" size="sm">{selectedIds.size} selected</Badge>
        {selectedIds.size > 0 ? (
          <button type="button" className="rounded text-xs font-medium text-rose-600 transition-colors hover:text-rose-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30" onClick={onClear}>
            Clear all
          </button>
        ) : (
          <span className="text-xs text-slate-500">No users selected — the Access Profile will be created unassigned.</span>
        )}
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(user) => user.id}
        selection={selection}
        isLoading={loading && rows.length === 0}
        onRowClick={(user) => onToggle(user)}
        rowClassName={(user) => (selectedIds.has(user.id) ? "bg-emerald-50/60 cursor-pointer" : "cursor-pointer")}
        emptyState={
          <TableEmptyState
            title={canListUsers ? "No users found" : "You cannot list users"}
            description={
              canListUsers
                ? hasFilters ? "Try adjusting your search or filters." : "There are no active users."
                : "You do not have permission to list users. The Access Profile will be created unassigned; assign users later from the profile's Assigned Users tab."
            }
          />
        }
        pagination={
          total > 0 ? (
            <div className="border-t border-slate-200">
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={total}
                itemsPerPage={limit}
                isLoading={loading}
                onPageChange={setPage}
                onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }}
                itemsPerPageOptions={[10, 20, 50]}
              />
            </div>
          ) : undefined
        }
      />
    </div>
  );
};
