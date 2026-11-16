import React, { useEffect, useState } from "react";
import { MoreVertical, Search } from "lucide-react";
import { IconInfoCircle } from "@tabler/icons-react";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { DataTable, TableEmptyState, TablePagination, TABLE_STYLES, type DataTableAction, type DataTableColumn, type DataTableSortDirection } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useDebounce, usePortalDropdown } from "@/hooks";
import { settingsApi } from "@/services/api/settings";
import { api } from "@/services/api/client";
import { WorkflowRoleDrawer, type WorkflowRolePreview } from "./accessProfileDetailShared";
import type { AssignDiff } from "../AccessProfileDetailView";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";

type SortKey = "label" | "code" | "module" | "users";
type WorkflowRoleRow = WorkflowRolePreview & { moduleKey?: string | null; totalUsers?: number };

/** Uses the persistent workflow-role catalog and workflow policies; no frontend role list exists. */
export const WorkflowTab: React.FC<{
  profileId: string;
  reloadKey?: number;
  canAssign?: boolean;
  deniedReason?: string;
  onChangesChange?: (diff: AssignDiff) => void;
}> = ({ profileId, reloadKey = 0, canAssign = true, deniedReason, onChangesChange }) => {
  const { showToast } = useToast();
  const { openId: openMenuId, position: menuPosition, getRef: getButtonRef, toggle: toggleMenu, close: closeMenu } = usePortalDropdown();
  const [original, setOriginal] = useState<string[]>([]);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [rows, setRows] = useState<WorkflowRoleRow[]>([]);
  const [search, setSearch] = useState("");
  const searchTerm = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const [sort, setSort] = useState<{ key: SortKey; direction: DataTableSortDirection }>({ key: "label", direction: "asc" });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [listLoading, setListLoading] = useState(true);
  const [previewRole, setPreviewRole] = useState<WorkflowRolePreview | null>(null);

  // The roles already assigned (from the profile) and the ones ticked since: the difference is what Save applies.
  useEffect(() => {
    let active = true;
    settingsApi.getAccessProfileEditorSummary(profileId).then((result) => result.profile)
      .then((profile) => {
        if (!active) return;
        setOriginal(profile.workflowRoles);
        setAssigned(profile.workflowRoles);
        onChangesChange?.({ added: [], removed: [] });
      })
      .catch(() => active && showToast({ type: "error", message: "Failed to load workflow roles" }));
    return () => { active = false; };
    // The callback belongs to the parent save coordinator and is intentionally invoked after a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, reloadKey, showToast]);

  // Searched, sorted and paged on the server. Details list only the roles of this profile; editing lists the whole catalog to tick from.
  useEffect(() => {
    let active = true;
    setListLoading(true);
    api.get<{ data: WorkflowRoleRow[]; pagination: { total: number; totalPages: number } }>("/security/workflow-roles/paged", {
      params: { page, limit, search: searchTerm || undefined, sortBy: sort.key, sortDir: sort.direction, accessProfileId: canAssign ? undefined : profileId },
    })
      .then((response) => {
        if (!active) return;
        setRows(response.data.data);
        setTotal(response.data.pagination.total);
        const pages = Math.max(1, response.data.pagination.totalPages);
        setTotalPages(pages);
        if (page > pages) setPage(pages);
      })
      .catch(() => { if (active) { setRows([]); setTotal(0); setTotalPages(1); showToast({ type: "error", message: "Failed to load workflow roles" }); } })
      .finally(() => { if (active) setListLoading(false); });
    return () => { active = false; };
  }, [page, limit, searchTerm, sort, reloadKey, showToast, canAssign, profileId]);

  const reportDiff = (next: string[]) => {
    const originalSet = new Set(original);
    const nextSet = new Set(next);
    onChangesChange?.({ added: next.filter((role) => !originalSet.has(role)), removed: original.filter((role) => !nextSet.has(role)) });
  };
  const assignedSet = new Set(assigned);
  const handleToggle = (role: string) => {
    if (!canAssign) return;
    setAssigned((current) => {
      const next = current.includes(role) ? current.filter((code) => code !== role) : [...current, role];
      reportDiff(next);
      return next;
    });
  };

  const sortOf = (key: SortKey) => ({
    direction: sort.key === key ? sort.direction : undefined,
    onSort: () => { setSort((s) => ({ key, direction: s.key === key && s.direction === "asc" ? "desc" : "asc" })); setPage(1); },
  });
  const openRole = rows.find((row) => row.code === openMenuId);

  const columns: DataTableColumn<WorkflowRoleRow>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: TABLE_STYLES.headerCell35, cellClassName: "text-center text-slate-500", cell: (_row, index) => (page - 1) * limit + index + 1 },
    { id: "label", header: "Role", label: "Role", sort: sortOf("label"), cellClassName: "font-medium text-slate-900", cell: (row) => row.label },
    { id: "code", header: "Code", label: "Code", sort: sortOf("code"), cell: (row) => <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">{row.code}</code> },
    { id: "module", header: "Module", label: "Module", sort: sortOf("module"), cellClassName: "text-slate-600", cell: (row) => row.moduleKey || "-" },
    { id: "users", header: "Users", label: "Users", sort: sortOf("users"), cellClassName: "text-slate-600", cell: (row) => row.totalUsers ?? 0 },
    { id: "description", header: "Description", label: "Description", cellClassName: "max-w-md truncate text-slate-600", cell: (row) => row.description || "-" },
  ];
  const action: DataTableAction<WorkflowRoleRow> = {
    header: "Action",
    cell: (row) => (
      <button
        ref={getButtonRef(row.code)}
        onClick={(e) => { e.stopPropagation(); toggleMenu(row.code, e); }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-slate-100 sm:h-8 sm:w-8"
        aria-label="More actions"
      >
        <MoreVertical className="h-3.5 w-3.5 text-slate-600 sm:h-4 sm:w-4" />
      </button>
    ),
  };

  return <div className="space-y-4">
    {canAssign && <WarningBanner variant="info" description={<>Workflow eligibility determines which workflow steps users assigned this Access Profile can participate in. The catalog and allowed actions are configured in Workflow Authorization. Changes are applied when you click <b>Save</b>.</>} />}
    {!canAssign && deniedReason && <WarningBanner variant="warning" description={deniedReason} />}
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder="Search workflow roles…"
      />
    </div>
    <DataTable
      rows={rows}
      getRowKey={(row) => row.code}
      columns={columns}
      action={action}
      isLoading={listLoading}
      onRowClick={(row) => setPreviewRole(row)}
      // The tick boxes exist only while the assignments can be changed (edit / create), never on the read-only details.
      selection={{
        visible: canAssign,
        header: "",
        cell: (row) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox id={`profile-wf-${row.code}`} checked={assignedSet.has(row.code)} onChange={() => handleToggle(row.code)} />
          </div>
        ),
      }}
      emptyState={
        <TableEmptyState
          title={searchTerm.trim() ? "No workflow roles match your search" : "No workflow roles"}
          description={searchTerm.trim() ? "Try a different search." : canAssign ? "No active workflow roles are configured in the catalog." : "No workflow role is assigned to this Access Profile."}
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
            if (openRole) setPreviewRole(openRole);
            closeMenu();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 transition-colors hover:bg-slate-50"
        >
          <IconInfoCircle className="h-3.5 w-3.5" />
          <span>View Details</span>
        </button>
      </div>
    </PortalDropdownMenu>
    <WorkflowRoleDrawer role={previewRole} onClose={() => setPreviewRole(null)} />
  </div>;
};
