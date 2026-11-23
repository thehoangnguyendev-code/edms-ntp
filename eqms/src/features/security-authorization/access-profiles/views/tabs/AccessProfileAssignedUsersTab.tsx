import React, { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { Badge } from "@/components/ui/badge/Badge";
import { flagColor } from "@/utils/status";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { DataTable, TableEmptyState, TablePagination, TABLE_STYLES, type DataTableColumn, type DataTableSortDirection } from "@/components/ui/table";
import { formatDateTime } from "@/utils/format";
import { useToast } from "@/components/ui/toast";
import { useDebounce } from "@/hooks";
import { settingsApi } from "@/services/api/settings";
import { metadataApi } from "@/services/api/metadata";
import type { AssignDiff } from "../AccessProfileDetailView";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { tr } from "@/i18n";

/** Row shared by the paged assignment list and the paged active-user search. */
interface UserRow {
  id: string;
  fullName: string;
  employeeCode?: string | null;
  email: string | null;
  department: string | null;
  status: string | null;
  assignedAt?: string | null;
}

type SortKey = "fullName" | "employeeCode" | "email" | "department" | "status" | "assignedAt";

/** The all-users lookup sorts by name, email and department only; the other columns fall back to name. */
const lookupSortKey = (key: SortKey): "fullName" | "employeeCode" | "email" | "department" => (key === "employeeCode" || key === "email" || key === "department" ? key : "fullName");

export const AccessProfileAssignedUsersTab: React.FC<{
  profileId: string;
  reloadKey?: number;
  canAssign?: boolean;
  deniedReason?: string;
  onChangesChange?: (diff: AssignDiff) => void;
}> = ({ profileId, reloadKey = 0, canAssign = true, deniedReason, onChangesChange }) => {
  const { showToast } = useToast();
  const [assignedMeta, setAssignedMeta] = useState<Map<string, UserRow>>(new Map());
  const [original, setOriginal] = useState<string[]>([]);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const [searchResults, setSearchResults] = useState<UserRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [rowsPage, setRowsPage] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; direction: DataTableSortDirection }>({ key: "fullName", direction: "asc" });
  const [pendingRemove, setPendingRemove] = useState<{ id: string; fullName: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const detail = await settingsApi.getAccessProfileUsersPage(profileId, 1, limit);
      const meta = new Map<string, UserRow>();
      detail.data.forEach(u => meta.set(u.id, { id: u.id, fullName: u.fullName, employeeCode: u.employeeCode ?? null, email: u.email, department: u.department, status: u.status }));
      setAssignedMeta(meta);
      const ids = detail.assignedIds;
      setOriginal(ids);
      setAssignedIds(ids);
      onChangesChange?.({ added: [], removed: [] });
    } catch {
      showToast({ type: "error", message: tr("Failed to load users") });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, showToast, reloadKey]);

  useEffect(() => { void load(); }, [load]);

  // Server-side search -- avoids ever pulling the full user list client-side (that list can
  // realistically grow into the hundreds/thousands), same pattern as the Direct Manager picker's
  // searchManagerOptions and DepartmentsTab's searchDepartmentHeadOptions.
  useEffect(() => {
    const q = debouncedSearch.trim();
    // Searching ALL active users (to add someone) only makes sense while the assignments can be changed.
    if (!q || !canAssign) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    // Assignment picker: the metadata lookup returns Active users only.
    metadataApi.getUsersLookupPaged({ search: q, page, limit, sortBy: lookupSortKey(sort.key), sortDir: sort.direction })
      .then((result) => {
        if (cancelled) return;
        const users = result.data.map(u => ({ id: u.id, fullName: u.fullName, employeeCode: u.employeeCode ?? null, email: u.email ?? null, department: u.department ?? null, status: "Active" }));
        setSearchResults(users);
        setAssignedMeta(previous => new Map([...previous, ...users.map(u => [u.id, u] as const)]));
        setTotal(result.pagination.total);
        const pages = Math.max(1, result.pagination.totalPages); setTotalPages(pages);
        if (page > pages) setPage(pages);
      })
      .catch(() => { if (!cancelled) { setSearchResults([]); setTotal(0); setTotalPages(1); } })
      .finally(() => { if (!cancelled) setSearchLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedSearch, page, limit, canAssign, sort]);

  useEffect(() => {
    if (debouncedSearch.trim() && canAssign) return;
    let cancelled = false;
    setSearchLoading(true);
    settingsApi.getAccessProfileUsersPage(profileId, page, limit, { search: debouncedSearch.trim() || undefined, sortBy: sort.key, sortDir: sort.direction }).then((result) => {
      if (cancelled) return;
      setRowsPage(result.data);
      setAssignedMeta(previous => new Map([...previous, ...result.data.map(u => [u.id, u] as const)]));
      setTotal(result.pagination.total);
      const pages = Math.max(1, result.pagination.totalPages); setTotalPages(pages);
      if (page > pages) setPage(pages);
    }).catch(() => { if (!cancelled) { setRowsPage([]); setTotal(0); setTotalPages(1); showToast({ type: "error", message: tr("Failed to load users") }); } })
      .finally(() => { if (!cancelled) setSearchLoading(false); });
    return () => { cancelled = true; };
  }, [profileId, page, limit, debouncedSearch, reloadKey, showToast, canAssign, sort]);

  const reportDiff = (next: string[]) => {
    const originalSet = new Set(original);
    const nextSet = new Set(next);
    onChangesChange?.({
      added: next.filter((id) => !originalSet.has(id)),
      removed: original.filter((id) => !nextSet.has(id)),
    });
  };

  const assignedSet = new Set(assignedIds);

  const handleToggle = (userId: string, fullName: string) => {
    if (!canAssign) return;
    if (assignedSet.has(userId)) {
      // Removals are confirmed — the user loses everything this profile grants.
      setPendingRemove({ id: userId, fullName });
      return;
    }
    setAssignedIds(prev => {
      const next = [...prev, userId];
      reportDiff(next);
      return next;
    });
  };

  const confirmRemove = () => {
    if (!pendingRemove) return;
    setAssignedIds(prev => {
      const next = prev.filter(id => id !== pendingRemove.id);
      reportDiff(next);
      return next;
    });
    setPendingRemove(null);
  };

  const q = search.trim();
  const searchingAll = Boolean(q) && canAssign;
  // Editing with no search text: the assigned users (plus the ones just ticked). Editing with search text: every active user that matches,
  // so someone can be added. Viewing: only the assigned users, searched and sorted by the server.
  const rows: UserRow[] = searchingAll ? searchResults : rowsPage;
  const pendingAdded = searchingAll || page !== 1 || !canAssign ? [] : assignedIds.filter(id => !original.includes(id)).map(id => assignedMeta.get(id)).filter((r): r is UserRow => Boolean(r));
  const tableRows = [...pendingAdded, ...rows.filter((u) => !pendingAdded.some((a) => a.id === u.id))];

  const sortOf = (key: SortKey) => {
    // The all-users lookup cannot order by these.
    if (searchingAll && (key === "status" || key === "assignedAt")) return undefined;
    return {
      direction: sort.key === key ? sort.direction : undefined,
      onSort: () => { setSort((s) => ({ key, direction: s.key === key && s.direction === "asc" ? "desc" : "asc" })); setPage(1); },
    };
  };
  const columns: DataTableColumn<UserRow>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: TABLE_STYLES.headerCell35, cellClassName: "text-center text-slate-500", cell: (_u, index) => (page - 1) * limit + index + 1 },
    { id: "employeeCode", header: tr("Employee Code"), label: tr("Employee Code"), sort: sortOf("employeeCode"), cellClassName: "text-slate-600", cell: (u) => u.employeeCode || "-" },
    { id: "fullName", header: "Full Name", label: "Full Name", sort: sortOf("fullName"), cellClassName: "font-medium text-slate-900", cell: (u) => u.fullName },
    { id: "email", header: "Email", label: "Email", sort: sortOf("email"), cellClassName: "text-slate-600", cell: (u) => u.email || "-" },
    { id: "department", header: "Department", label: "Department", sort: sortOf("department"), cellClassName: "text-slate-600", cell: (u) => u.department || "-" },
    {
      id: "status",
      header: "Status",
      label: "Status",
      sort: sortOf("status"),
      cell: (u) => (u.status ? <Badge color={flagColor(u.status === "Active")} size="sm">{u.status}</Badge> : "-"),
    },
    { id: "assignedAt", header: tr("Assigned At"), label: tr("Assigned At"), sort: sortOf("assignedAt"), cellClassName: "text-slate-600", cell: (u) => (u.assignedAt ? formatDateTime(u.assignedAt) : "-") },
  ];

  return (
    <div className="space-y-4">
      {canAssign && (
        <WarningBanner
          variant="info"
          description={
            <>
            {tr("Removing a user from this profile only removes their access profile assignment — the user account is not affected. Changes are applied when you click")} <b>{tr("Save")}</b> {tr("(a single electronic signature covers all changes).")}
            </>
          }
        />
      )}
      {!canAssign && deniedReason && (
        <WarningBanner variant="warning" description={deniedReason} />
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={canAssign ? tr("Search all users to assign…") : "Search assigned users…"}
        />
      </div>
      <DataTable
        rows={tableRows}
        getRowKey={(u) => u.id}
        columns={columns}
        isLoading={searchLoading}
        // The tick boxes exist only while the assignments can be changed (edit / create), never on the read-only details.
        selection={{
          visible: canAssign,
          header: "",
          cell: (u) => (
            <Checkbox
              id={`profile-user-${u.id}`}
              checked={assignedSet.has(u.id)}
              onChange={() => handleToggle(u.id, u.fullName)}
            />
          ),
        }}
        emptyState={
          <TableEmptyState
            title={q ? tr("No users match your search") : "No users assigned"}
            description={q ? tr("Try a different search.") : canAssign ? "Search above to add some." : "No user has this access profile."}
          />
        }
        pagination={total > 0 ? (
          <div className="border-t border-slate-200">
            <TablePagination currentPage={page} totalPages={totalPages} totalItems={total} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(value) => { setLimit(value); setPage(1); }} />
          </div>
        ) : undefined}
      />
      <AlertModal
        isOpen={Boolean(pendingRemove)}
        onClose={() => setPendingRemove(null)}
        onConfirm={confirmRemove}
        type="warning"
        title={tr("Remove Assigned User")}
        description={
          pendingRemove
            ? `"${pendingRemove.fullName}" will lose all permissions inherited from this Access Profile once you save. Continue?`
            : ""
        }
        confirmText="Remove"
        cancelText="Cancel"
        showCancel
      />
    </div>
  );
};
