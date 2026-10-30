import React, { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { useToast } from "@/components/ui/toast";
import { useDebounce } from "@/hooks";
import { settingsApi } from "@/services/api/settings";
import { metadataApi } from "@/services/api/metadata";
import type { AssignDiff } from "../AccessProfileDetailView";

/** Row shared by the paged assignment list and the paged active-user search. */
interface UserRow {
  id: string;
  fullName: string;
  email: string | null;
  department: string | null;
  status: string | null;
}

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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [searchResults, setSearchResults] = useState<UserRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [rowsPage, setRowsPage] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pendingRemove, setPendingRemove] = useState<{ id: string; fullName: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const detail = await settingsApi.getAccessProfileUsersPage(profileId, 1, limit);
      const meta = new Map<string, UserRow>();
      detail.data.forEach(u => meta.set(u.id, { id: u.id, fullName: u.fullName, email: u.email, department: u.department, status: u.status }));
      setAssignedMeta(meta);
      const ids = detail.assignedIds;
      setOriginal(ids);
      setAssignedIds(ids);
      onChangesChange?.({ added: [], removed: [] });
    } catch {
      showToast({ type: "error", message: "Failed to load users" });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, showToast, reloadKey]);

  useEffect(() => { void load(); }, [load]);

  // Server-side search -- avoids ever pulling the full user list client-side (that list can
  // realistically grow into the hundreds/thousands), same pattern as the Direct Manager picker's
  // searchManagerOptions and DepartmentsTab's searchDepartmentHeadOptions.
  useEffect(() => {
    const q = debouncedSearch.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    // Assignment picker: the metadata lookup returns Active users only.
    metadataApi.getUsersLookupPaged({ search: q, page, limit, sortBy: "fullName", sortDir: "asc" })
      .then((result) => {
        if (cancelled) return;
        const users = result.data.map(u => ({ id: u.id, fullName: u.fullName, email: u.email ?? null, department: u.department ?? null, status: "Active" }));
        setSearchResults(users);
        setAssignedMeta(previous => new Map([...previous, ...users.map(u => [u.id, u] as const)]));
        setTotal(result.pagination.total);
        const pages = Math.max(1, result.pagination.totalPages); setTotalPages(pages);
        if (page > pages) setPage(pages);
      })
      .catch(() => { if (!cancelled) { setSearchResults([]); setTotal(0); setTotalPages(1); } })
      .finally(() => { if (!cancelled) setSearchLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedSearch, page, limit]);

  useEffect(() => {
    if (debouncedSearch.trim()) return;
    let cancelled = false;
    setSearchLoading(true);
    settingsApi.getAccessProfileUsersPage(profileId, page, limit).then((result) => {
      if (cancelled) return;
      setRowsPage(result.data);
      setAssignedMeta(previous => new Map([...previous, ...result.data.map(u => [u.id, u] as const)]));
      setTotal(result.pagination.total);
      const pages = Math.max(1, result.pagination.totalPages); setTotalPages(pages);
      if (page > pages) setPage(pages);
    }).catch(() => { if (!cancelled) { setRowsPage([]); setTotal(0); setTotalPages(1); showToast({ type: "error", message: "Failed to load users" }); } })
      .finally(() => { if (!cancelled) setSearchLoading(false); });
    return () => { cancelled = true; };
  }, [profileId, page, limit, debouncedSearch, reloadKey, showToast]);

  if (loading) return <SectionLoading />;

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
  // No search text: show the currently-assigned set (the primary "manage this profile's
  // membership" view). With search text: show server-matched results instead, merged with any
  // already-assigned rows the search also matched so their checked state stays visible.
  const rows: UserRow[] = q
    ? searchResults
    : rowsPage;
  const pendingAdded = q ? [] : assignedIds.filter(id => !original.includes(id)).map(id => assignedMeta.get(id)).filter((r): r is UserRow => Boolean(r));

  return (
    <div className="space-y-4">
      <WarningBanner
        variant="info"
        description={
          <>
          Removing a user from this profile only removes their access profile assignment — the user account is not affected.
          Changes are applied when you click <b>Save</b> (a single electronic signature covers all changes).
          </>
        }
      />
      {!canAssign && (
        <WarningBanner
          variant="warning"
          description={deniedReason || "You can preview assigned users, but cannot change assignments."}
        />
      )}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search all users to assign…"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge color="emerald" size="sm">{assignedIds.length} assigned</Badge>
        {q && <span className="text-xs text-slate-500">{searchLoading ? "Searching…" : `${total} match(es)`}</span>}
      </div>
      <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
        {rows.length === 0 && pendingAdded.length === 0 && (
          <p className="p-4 text-sm text-slate-400">
            {q ? (searchLoading ? "Searching…" : "No users match your search.") : "No users assigned yet — search above to add some."}
          </p>
        )}
        {[...pendingAdded, ...rows].map((u) => (
          <label key={u.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer">
            <Checkbox
              id={`profile-user-${u.id}`}
              checked={assignedSet.has(u.id)}
              onChange={() => handleToggle(u.id, u.fullName)}
              disabled={!canAssign}
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-xs sm:text-sm font-medium text-slate-800">{u.fullName}</span>
                {u.status && (
                  <span className="text-2xs text-slate-400">{u.status}</span>
                )}
              </span>
              <span className="block text-xs text-slate-500 mt-0.5">
                {[u.department, u.email].filter(Boolean).join(" · ")}
              </span>
            </span>
          </label>
        ))}
      </div>
      {total > 0 && <TablePagination currentPage={page} totalPages={totalPages} totalItems={total} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(value) => { setLimit(value); setPage(1); }} />}
      <AlertModal
        isOpen={Boolean(pendingRemove)}
        onClose={() => setPendingRemove(null)}
        onConfirm={confirmRemove}
        type="warning"
        title="Remove Assigned User"
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
