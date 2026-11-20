import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical, Search } from "lucide-react";
import { IconInfoCircle } from "@tabler/icons-react";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { DataTable, TableEmptyState, TablePagination, TABLE_STYLES, type DataTableAction, type DataTableColumn, type DataTableSortDirection } from "@/components/ui/table";
import { useDebounce, usePortalDropdown } from "@/hooks";
import { useToast } from "@/components/ui/toast";
import { ROUTES } from "@/app/routes.constants";
import { settingsApi, type PermissionSetSummary, type PermissionSetResponse } from "@/services/api/settings";
import type { AssignDiff } from "../AccessProfileDetailView";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { moduleDisplayName } from "@/utils/moduleDisplay";

type SortKey = "name" | "type" | "permissionCount" | "moduleCount";

/** The modules a set touches, by the name of their menu (never the key the server stores), once each. */
const summarizeModules = (modules: string[] | undefined) => {
  const list = [...new Set((modules ?? []).map((key) => moduleDisplayName(key)))];
  if (list.length === 0) return "-";
  if (list.length <= 2) return list.join(" · ");
  return `${list.slice(0, 2).join(" · ")} · +${list.length - 2} more`;
};

export const PermissionSetsTab: React.FC<{
  profileId: string;
  reloadKey?: number;
  canAssign?: boolean;
  deniedReason?: string;
  onOpenDrawer: (ps: PermissionSetSummary) => void;
  onChangesChange?: (diff: AssignDiff) => void;
}> = ({ profileId, reloadKey = 0, canAssign = true, deniedReason, onOpenDrawer, onChangesChange }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { openId: openMenuId, position: menuPosition, getRef: getButtonRef, toggle: toggleMenu, close: closeMenu } = usePortalDropdown();
  const [rows, setRows] = useState<PermissionSetResponse[]>([]);
  const [originalIds, setOriginalIds] = useState<string[]>([]);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const searchTerm = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const [sort, setSort] = useState<{ key: SortKey; direction: DataTableSortDirection }>({ key: "name", direction: "asc" });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [listLoading, setListLoading] = useState(true);
  const [pendingRemove, setPendingRemove] = useState<PermissionSetSummary | null>(null);

  // The ids already attached (from the profile) and the ones ticked since: the difference is what Save applies.
  const load = useCallback(async () => {
    try {
      const profileDetail = await settingsApi.getAccessProfileEditorSummary(profileId).then((result) => result.profile);
      // The auto-managed ROLE_ set is edited on the Permissions tab and must never enter this tab's difference.
      const ids = profileDetail.permissionSets.filter((s) => !s.code.startsWith("ROLE_")).map((s) => s.id);
      setOriginalIds(ids);
      setAssignedIds(ids);
      onChangesChange?.({ added: [], removed: [] });
    } catch {
      showToast({ type: "error", message: "Failed to load permission sets" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, showToast, reloadKey]);

  useEffect(() => { void load(); }, [load]);

  // Searched, sorted and paged on the server. Details list only the sets of this profile; editing lists every set to tick from.
  useEffect(() => {
    let active = true;
    setListLoading(true);
    settingsApi.listPermissionSetsPaged({
      page, limit, search: searchTerm || undefined, sortBy: sort.key, sortDir: sort.direction,
      accessProfileId: canAssign ? undefined : profileId,
    })
      .then((result) => {
        if (!active) return;
        setRows(result.data);
        setTotal(result.pagination.total);
        const pages = Math.max(1, result.pagination.totalPages);
        setTotalPages(pages);
        if (page > pages) setPage(pages);
      })
      .catch(() => { if (active) { setRows([]); setTotal(0); setTotalPages(1); showToast({ type: "error", message: "Failed to load permission sets" }); } })
      .finally(() => { if (active) setListLoading(false); });
    return () => { active = false; };
  }, [page, limit, searchTerm, sort, reloadKey, showToast, canAssign, profileId]);

  const reportDiff = (nextAssigned: string[]) => {
    const originalSet = new Set(originalIds);
    const nextSet = new Set(nextAssigned);
    onChangesChange?.({
      added: nextAssigned.filter((id) => !originalSet.has(id)),
      removed: originalIds.filter((id) => !nextSet.has(id)),
    });
  };

  const assignedSet = new Set(assignedIds);

  const handleToggle = (set: PermissionSetResponse) => {
    if (!canAssign) return;
    if (assignedSet.has(set.id)) {
      // Removals are confirmed: users holding this profile lose the set's permissions.
      setPendingRemove(set as unknown as PermissionSetSummary);
      return;
    }
    setAssignedIds((prev) => {
      const next = [...prev, set.id];
      reportDiff(next);
      return next;
    });
  };

  const confirmRemove = () => {
    if (!pendingRemove) return;
    setAssignedIds((prev) => {
      const next = prev.filter((id) => id !== pendingRemove.id);
      reportDiff(next);
      return next;
    });
    setPendingRemove(null);
  };

  const sortOf = (key: SortKey) => ({
    direction: sort.key === key ? sort.direction : undefined,
    onSort: () => { setSort((s) => ({ key, direction: s.key === key && s.direction === "asc" ? "desc" : "asc" })); setPage(1); },
  });
  const openSet = rows.find((row) => row.id === openMenuId);

  const columns: DataTableColumn<PermissionSetResponse>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: TABLE_STYLES.headerCell35, cellClassName: "text-center text-slate-500", cell: (_row, index) => (page - 1) * limit + index + 1 },
    { id: "name", header: "Name", label: "Name", sort: sortOf("name"), cellClassName: "font-medium text-slate-900", cell: (row) => (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {row.name}
        {row.code.startsWith("ROLE_") && <Badge semantic="info" size="xs" title="The direct permissions of another Access Profile, attached to this one">Another profile's permissions</Badge>}
      </span>
    ) },
    { id: "code", header: "Code", label: "Code", cell: (row) => <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">{row.code}</code> },
    { id: "type", header: "Type", label: "Type", sort: sortOf("type"), cell: (row) => <Badge color={row.system ? "blue" : "slate"} size="sm">{row.system ? "System" : "Custom"}</Badge> },
    { id: "status", header: "Status", label: "Status", cell: (row) => <Badge semantic={row.active ? "success" : "neutral"} size="sm">{row.active ? "Active" : "Inactive"}</Badge> },
    { id: "permissionCount", header: "Permissions", label: "Permissions", sort: sortOf("permissionCount"), cellClassName: "text-slate-600", cell: (row) => row.permissionCount },
    { id: "modules", header: "Modules", label: "Modules", sort: sortOf("moduleCount"), cellClassName: "text-slate-600", cell: (row) => summarizeModules(row.modules) },
    { id: "description", header: "Description", label: "Description", cellClassName: "max-w-md truncate text-slate-600", cell: (row) => row.description || "-" },
  ];
  const action: DataTableAction<PermissionSetResponse> = {
    header: "Action",
    cell: (row) => (
      <button
        ref={getButtonRef(row.id)}
        onClick={(e) => { e.stopPropagation(); toggleMenu(row.id, e); }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-slate-100 sm:h-8 sm:w-8"
        aria-label="More actions"
      >
        <MoreVertical className="h-3.5 w-3.5 text-slate-600 sm:h-4 sm:w-4" />
      </button>
    ),
  };

  return (
    <div className="space-y-4">
      {canAssign && (
        <WarningBanner
          variant="info"
          description={
            <>
              Tick a shared permission set to attach it to this Access Profile. Changes are applied when you click <b>Save</b>{" "}
              (a single electronic signature covers all changes). To modify a set's contents, use{" "}
              <button
                onClick={() => navigate(ROUTES.SECURITY.PERMISSION_SETS)}
                className="font-medium underline hover:text-blue-900"
              >
                Shared Permission Sets
              </button>.
            </>
          }
        />
      )}
      {!canAssign && deniedReason && (
        <WarningBanner variant="warning" description={deniedReason} />
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search permission sets…"
        />
      </div>

      <DataTable
        rows={rows}
        getRowKey={(row) => row.id}
        columns={columns}
        action={action}
        isLoading={listLoading}
        onRowClick={(row) => onOpenDrawer(row as unknown as PermissionSetSummary)}
        // The tick boxes exist only while the assignments can be changed (edit / create), never on the read-only details.
        selection={{
          visible: canAssign,
          header: "",
          cell: (row) => (
            <div onClick={(e) => e.stopPropagation()}>
              <Checkbox id={`profile-ps-${row.id}`} checked={assignedSet.has(row.id)} onChange={() => handleToggle(row)} />
            </div>
          ),
        }}
        emptyState={
          <TableEmptyState
            title={searchTerm.trim() ? "No permission sets match your search" : "No shared permission sets"}
            description={searchTerm.trim() ? "Try a different search." : canAssign ? "No shared permission set exists yet." : "No shared permission set is attached to this Access Profile."}
          />
        }
        pagination={total > 0 ? (
          <div className="border-t border-slate-200">
            <TablePagination currentPage={page} totalPages={totalPages} totalItems={total} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(value) => { setLimit(value); setPage(1); }} />
          </div>
        ) : undefined}
      />

      <PortalDropdownMenu isOpen={!!openMenuId} onClose={closeMenu} position={menuPosition}>
        <div className="py-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (openSet) onOpenDrawer(openSet as unknown as PermissionSetSummary);
              closeMenu();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 transition-colors hover:bg-slate-50"
          >
            <IconInfoCircle className="h-3.5 w-3.5" />
            <span>View Permissions</span>
          </button>
        </div>
      </PortalDropdownMenu>

      <AlertModal
        isOpen={Boolean(pendingRemove)}
        onClose={() => setPendingRemove(null)}
        onConfirm={confirmRemove}
        type="warning"
        title="Remove Permission Set"
        description={
          pendingRemove
            ? `Users assigned through this Access Profile will lose the permissions in "${pendingRemove.name}" once you save. Continue?`
            : ""
        }
        confirmText="Remove"
        cancelText="Cancel"
        showCancel
      />
    </div>
  );
};
