import React, { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast";
import type { User } from "@/types";
import { settingsApi } from "@/services/api/settings";
import type { AssignDiff } from "../AccessProfileDetailView";

export const AccessProfileAssignedUsersTab: React.FC<{
  profileId: string;
  reloadKey?: number;
  canAssign?: boolean;
  deniedReason?: string;
  onChangesChange?: (diff: AssignDiff) => void;
}> = ({ profileId, reloadKey = 0, canAssign = true, deniedReason, onChangesChange }) => {
  const { showToast } = useToast();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [original, setOriginal] = useState<string[]>([]);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [assignedMeta, setAssignedMeta] = useState<Map<string, { fullName: string; department: string | null; status: string | null }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pendingRemove, setPendingRemove] = useState<{ id: string; fullName: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [usersRes, detail] = await Promise.all([
        settingsApi.getUsers({ limit: 500 }),
        settingsApi.getAccessProfile(profileId),
      ]);
      setAllUsers(usersRes.data ?? []);
      const meta = new Map<string, { fullName: string; department: string | null; status: string | null }>();
      detail.assignedUsers.forEach(u => meta.set(u.id, { fullName: u.fullName, department: u.department, status: u.status }));
      setAssignedMeta(meta);
      const ids = detail.assignedUsers.map(u => u.id);
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

  const handleToggle = (userId: string) => {
    if (!canAssign) return;
    if (assignedSet.has(userId)) {
      // Removals are confirmed — the user loses everything this profile grants.
      const meta = assignedMeta.get(userId);
      const user = allUsers.find(u => u.id === userId);
      setPendingRemove({ id: userId, fullName: meta?.fullName ?? user?.fullName ?? "this user" });
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

  const q = search.trim().toLowerCase();
  const filteredUsers = q
    ? allUsers.filter(u =>
        u.fullName.toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.department ?? "").toLowerCase().includes(q))
    : allUsers;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <p className="text-xs text-blue-700">
          Removing a user from this profile only removes their access profile assignment — the user account is not affected.
          Changes are applied when you click <b>Save</b> (a single electronic signature covers all changes).
        </p>
      </div>
      {!canAssign && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {deniedReason || "You can preview assigned users, but cannot change assignments."}
        </div>
      )}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users…"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge color="emerald" size="sm">{assignedIds.length} assigned</Badge>
        <span className="text-xs text-slate-500">{allUsers.length} user(s) available</span>
      </div>
      <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
        {filteredUsers.length === 0 && (
          <p className="p-4 text-sm text-slate-400">No users match your search.</p>
        )}
        {filteredUsers.map((u) => {
          const meta = assignedMeta.get(u.id);
          return (
            <label key={u.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer">
              <Checkbox
                id={`profile-user-${u.id}`}
                checked={assignedSet.has(u.id)}
                onChange={() => handleToggle(u.id)}
                disabled={!canAssign}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-xs sm:text-sm font-medium text-slate-800">{meta?.fullName ?? u.fullName}</span>
                  {(meta?.status ?? u.status) && (
                    <span className="text-2xs text-slate-400">{meta?.status ?? u.status}</span>
                  )}
                </span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  {[meta?.department ?? u.department, u.email].filter(Boolean).join(" · ")}
                </span>
              </span>
            </label>
          );
        })}
      </div>
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
