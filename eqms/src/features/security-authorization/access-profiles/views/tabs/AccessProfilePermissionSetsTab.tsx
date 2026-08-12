import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Search } from "lucide-react";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast";
import { ROUTES } from "@/app/routes.constants";
import { settingsApi, type PermissionCatalogGroup, type PermissionSetSummary, type PermissionSetResponse } from "@/services/api/settings";
import type { AssignDiff } from "../AccessProfileDetailView";

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
  const [allSets, setAllSets] = useState<PermissionSetResponse[]>([]);
  const [originalIds, setOriginalIds] = useState<string[]>([]);
  const [assignedIdsState, setAssignedIdsState] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalogGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pendingRemove, setPendingRemove] = useState<PermissionSetSummary | null>(null);

  const load = useCallback(async () => {
    try {
      const [sets, catalogData, profileDetail] = await Promise.all([
        settingsApi.listPermissionSets(),
        settingsApi.getPermissionCatalog(),
        settingsApi.getAccessProfile(profileId),
      ]);
      setAllSets(sets);
      setCatalog(catalogData);
      // Only track shared sets visible in this list — the auto-managed ROLE_ set is
      // edited on the Permissions tab and must never enter this tab's diff.
      const visible = new Set(sets.map((s) => s.id));
      const ids = profileDetail.permissionSets.map((s) => s.id).filter((psId) => visible.has(psId));
      setOriginalIds(ids);
      setAssignedIdsState(ids);
      onChangesChange?.({ added: [], removed: [] });
    } catch {
      showToast({ type: "error", message: "Failed to load permission sets" });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, showToast, reloadKey]);

  useEffect(() => { void load(); }, [load]);

  const reportDiff = (nextAssigned: string[]) => {
    const originalSet = new Set(originalIds);
    const nextSet = new Set(nextAssigned);
    onChangesChange?.({
      added: nextAssigned.filter((id) => !originalSet.has(id)),
      removed: originalIds.filter((id) => !nextSet.has(id)),
    });
  };

  const permissionLookup = useMemo(() => {
    const lookup = new Map<string, { module: string; group: string }>();
    catalog.forEach((group) => {
      group.permissions.forEach((permission) => {
        lookup.set(permission.code, {
          module: permission.module,
          group: permission.group,
        });
      });
    });
    return lookup;
  }, [catalog]);

  const summarizeModules = (permissionCodes: string[]) => {
    const modules = Array.from(
      new Set(
        permissionCodes
          .map((code) => permissionLookup.get(code)?.module)
          .filter((module): module is string => Boolean(module))
      )
    );
    if (modules.length === 0) return "No module metadata";
    if (modules.length <= 2) return modules.join(" · ");
    return `${modules.slice(0, 2).join(" · ")} · +${modules.length - 2} more`;
  };

  const summarizeGroups = (permissionCodes: string[]) => {
    const groups = Array.from(
      new Set(
        permissionCodes
          .map((code) => permissionLookup.get(code)?.group)
          .filter((group): group is string => Boolean(group))
      )
    );
    if (groups.length === 0) return "No group metadata";
    if (groups.length <= 2) return groups.join(" · ");
    return `${groups.slice(0, 2).join(" · ")} · +${groups.length - 2} more`;
  };

  const assignedSet = new Set(assignedIdsState);

  const filteredSets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allSets;
    return allSets.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q),
    );
  }, [allSets, search]);

  const handleToggle = (set: PermissionSetResponse) => {
    if (!canAssign) return;
    if (assignedSet.has(set.id)) {
      // Removals are confirmed — users holding this profile lose the set's permissions.
      setPendingRemove(set as unknown as PermissionSetSummary);
      return;
    }
    setAssignedIdsState((prev) => {
      const next = [...prev, set.id];
      reportDiff(next);
      return next;
    });
  };

  const confirmRemove = () => {
    if (!pendingRemove) return;
    setAssignedIdsState((prev) => {
      const next = prev.filter((id) => id !== pendingRemove.id);
      reportDiff(next);
      return next;
    });
    setPendingRemove(null);
  };

  if (loading) return <SectionLoading />;

  const assignedVisibleCount = allSets.filter((s) => assignedSet.has(s.id)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <p className="text-xs text-blue-700">
          Tick a shared permission set to attach it to this Access Profile. Changes are applied when you click <b>Save</b>{" "}
          (a single electronic signature covers all changes). To modify a set's contents, use{" "}
          <button
            onClick={() => navigate(ROUTES.SECURITY.PERMISSION_SETS)}
            className="underline font-medium hover:text-blue-900"
          >
            Shared Permission Sets
          </button>.
        </p>
      </div>
      {!canAssign && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {deniedReason || "You can preview permission sets, but cannot change assignments."}
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search permission sets…"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge color="emerald" size="sm">{assignedVisibleCount} assigned</Badge>
        <span className="text-xs text-slate-500">{allSets.length} shared set(s) available</span>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
        {filteredSets.length === 0 && (
          <p className="p-4 text-sm text-slate-400">No permission sets match your search.</p>
        )}
        {filteredSets.map((ps) => (
          <div key={ps.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
            <Checkbox
              id={`profile-ps-${ps.id}`}
              checked={assignedSet.has(ps.id)}
              onChange={() => handleToggle(ps)}
              disabled={!canAssign}
            />
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => onOpenDrawer(ps as unknown as PermissionSetSummary)}
              title="Preview permissions in this set"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-xs sm:text-sm font-medium text-slate-800">{ps.name}</span>
                <Badge color={ps.system ? "blue" : "slate"} size="xs">{ps.system ? "System" : "Custom"}</Badge>
                <span className="text-2xs text-slate-400">{ps.permissionCount} permissions</span>
              </span>
              {ps.description && (
                <span className="block text-xs text-slate-500 mt-0.5">{ps.description}</span>
              )}
              <span className="block text-2xs text-slate-400 mt-0.5">
                {summarizeModules(ps.permissionCodes ?? [])} · {summarizeGroups(ps.permissionCodes ?? [])}
              </span>
            </button>
            <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" aria-hidden="true" />
          </div>
        ))}
      </div>
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
