import React, { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { useToast } from "@/components/ui/toast";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { settingsApi } from "@/services/api/settings";
import { api } from "@/services/api/client";
import { WorkflowRoleDrawer, type WorkflowRolePreview } from "./accessProfileDetailShared";
import type { AssignDiff } from "../AccessProfileDetailView";

/** Uses the persistent workflow-role catalog and workflow policies; no frontend role list exists. */
export const WorkflowTab: React.FC<{
  profileId: string;
  reloadKey?: number;
  canAssign?: boolean;
  deniedReason?: string;
  onChangesChange?: (diff: AssignDiff) => void;
}> = ({ profileId, reloadKey = 0, canAssign = true, deniedReason, onChangesChange }) => {
  const { showToast } = useToast();
  const [original, setOriginal] = useState<string[]>([]);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [roles, setRoles] = useState<WorkflowRolePreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewRole, setPreviewRole] = useState<WorkflowRolePreview | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      settingsApi.getAccessProfile(profileId),
      api.get<WorkflowRolePreview[]>("/security/workflow-roles"),
    ])
      .then(([profile, workflowRoles]) => {
        if (!active) return;
        setOriginal(profile.workflowRoles);
        setAssigned(profile.workflowRoles);
        setRoles(workflowRoles.data);
        onChangesChange?.({ added: [], removed: [] });
      })
      .catch(() => active && showToast({ type: "error", message: "Failed to load workflow roles" }))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
    // The callback belongs to the parent save coordinator and is intentionally invoked after a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, reloadKey, showToast]);

  if (loading) return <SectionLoading />;

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

  return <div className="space-y-4">
    <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3"><p className="text-xs text-blue-700">Workflow eligibility determines which workflow steps users assigned this Access Profile can participate in. The catalog and allowed actions are configured in Workflow Authorization. Changes are applied when you click <b>Save</b>.</p></div>
    {!canAssign && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{deniedReason || "You can preview workflow eligibility, but cannot change assignments."}</div>}
    <div className="flex flex-wrap items-center gap-2"><Badge color="emerald" size="sm">{assigned.length} assigned</Badge><span className="text-xs text-slate-500">{roles.length} workflow role(s) available. Click a role to see its persisted policy references.</span></div>
    <div className="max-w-3xl divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
      {roles.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-500">No active workflow roles are configured in the catalog.</p> : roles.map((role) => <div key={role.code} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50">
        <Checkbox id={`profile-wf-${role.code}`} checked={assignedSet.has(role.code)} onChange={() => handleToggle(role.code)} disabled={!canAssign} />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setPreviewRole(role)} title="View role details"><span className="flex flex-wrap items-center gap-2"><span className="text-xs font-medium text-slate-800 sm:text-sm">{role.label}</span><span className="text-2xs font-mono text-slate-400">{role.code}</span></span>{role.description && <span className="mt-0.5 block text-xs text-slate-500">{role.description}</span>}</button>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
      </div>)}
    </div>
    <WorkflowRoleDrawer role={previewRole} onClose={() => setPreviewRole(null)} />
  </div>;
};
