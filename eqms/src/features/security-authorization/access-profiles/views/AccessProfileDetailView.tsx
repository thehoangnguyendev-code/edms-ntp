import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import React, { useEffect, useMemo, useState } from "react";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ShieldCheck, Users, KeyRound } from "lucide-react";
import { IconArrowsShuffle } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { flagColor } from "@/utils/status";
import { TabNav } from "@/components/ui/tabs/TabNav";
import type { TabItem } from "@/components/ui/tabs/TabNav";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { useToast } from "@/components/ui/toast";
import {
  settingsApi,
  type AccessProfileCapabilitiesResponse,
  type AccessProfileDetailResponse,
  type PermissionSetSummary,
} from "@/services/api/settings";
import { ROUTES } from "@/app/routes.constants";
import { navigateBack } from "@/app/navigation/backNavigation";
import { GeneralTab } from "./tabs/AccessProfileGeneralTab";
import { PermissionSetsTab } from "./tabs/AccessProfilePermissionSetsTab";
import { AccessProfilePermissionsTab } from "./tabs/AccessProfilePermissionsTab";
import { WorkflowTab } from "./tabs/AccessProfileWorkflowTab";
import { AccessProfileAssignedUsersTab } from "./tabs/AccessProfileAssignedUsersTab";
import { AuditTrailTab } from "@/features/documents/shared/components/AuditTrailTab";
import { DOCUMENT_CONTROL_VISIBILITY_COLOR, DOCUMENT_CONTROL_VISIBILITY_LABEL } from "../shared/documentControlVisibility";
import { AccessProfilePermissionSetDrawer } from "./tabs/AccessProfilePermissionSetDrawer";
import { accessProfileDetail as accessProfileDetailBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";

type TabId = "general" | "permissions" | "permission-sets" | "workflow" | "users" | "audit";

const TABS: TabItem[] = [
  { id: "general", label: "General" },
  { id: "users", label: "Assigned Users" },
  { id: "permissions", label: "Permissions" },
  { id: "permission-sets", label: "Shared Permission Sets (Advanced)" },
  { id: "workflow", label: "Workflow Eligibility (Advanced)" },
  { id: "audit", label: "Audit Trail" },
];

export type AssignKind = "permissionSets" | "workflowRoles" | "users";
export interface AssignDiff { added: string[]; removed: string[] }
type AssignChanges = Record<AssignKind, AssignDiff>;

const EMPTY_CHANGES: AssignChanges = {
  permissionSets: { added: [], removed: [] },
  workflowRoles: { added: [], removed: [] },
  users: { added: [], removed: [] },
};

export const AccessProfileDetailView: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { showToast } = useToast();
  const { requestSignature, signatureModal } = useSecurityESign();

  const isEditRoute = location.pathname.endsWith("/edit");
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [profile, setProfile] = useState<AccessProfileDetailResponse | null>(null);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // The name error shows only after a Save found it empty, and clears as soon as a name is typed.
  const [submitted, setSubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(isEditRoute);
  const [deleteModal, setDeleteModal] = useState(false);
  const [drawerPs, setDrawerPs] = useState<PermissionSetSummary | null>(null);
  const [capabilities, setCapabilities] = useState<AccessProfileCapabilitiesResponse | null>(null);
  // Assignment diffs collected from the tabs; applied together on Save with a single e-signature.
  const [changes, setChanges] = useState<AssignChanges>(EMPTY_CHANGES);
  // Draft of the Access Profile's direct (managed) permissions from the Permissions tab.
  const [managedDraft, setManagedDraft] = useState<{ codes: string[]; dirty: boolean } | null>(null);
  // Another admin saved while we were editing (409 from the aggregate save).
  const [conflictModal, setConflictModal] = useState(false);
  const [impactModal, setImpactModal] = useState(false);
  // Bumped after save/cancel so the assignment tabs re-fetch and drop local edits.
  const [reloadKey, setReloadKey] = useState(0);

  const [draft, setDraft] = useState({
    name: "",
    description: "",
    active: true,
  });

  useEffect(() => {
    Promise.all([
      settingsApi.getAccessProfileEditorSummary(id!),
      settingsApi.getAccessProfileCapabilities(id!),
    ])
      .then(([summary, caps]) => {
        const p = summary.profile;
        setProfile(p);
        setAssignedUserIds(summary.assignedUserIds);
        setCapabilities(caps);
        setDraft({
          name: p.name,
          description: p.description ?? "",
          active: p.active,
        });
      })
      .catch(() => showToast({ type: "error", message: "Failed to load profile" }))
      .finally(() => setLoading(false));
  }, [id, showToast]);

  const can = (action: string) => Boolean(capabilities?.actions?.[action]?.allowed);
  const reason = (action: string) => capabilities?.actions?.[action]?.reason || "Action is not currently allowed";

  const updateDraft = (field: string, value: string | boolean) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  const handleTabChanges = (kind: AssignKind, diff: AssignDiff) =>
    setChanges((prev) => ({ ...prev, [kind]: diff }));

  const generalDirty = profile
    ? draft.name !== profile.name
      || draft.description !== (profile.description ?? "")
      || draft.active !== profile.active
    : false;
  const assignmentsDirty = Object.values(changes).some((d) => d.added.length > 0 || d.removed.length > 0);
  const managedDirty = Boolean(managedDraft?.dirty);
  const hasChanges = generalDirty || assignmentsDirty || managedDirty;
  // Leaving with changes that were not saved asks first (Back, the breadcrumb, the sidebar, a reload); the move after a delete is not a leave.
  const { go, modal: leaveModal } = useLeaveGuard(hasChanges, "Access Profile Details", "the list");

  const resetEdits = () => {
    if (profile) {
      setDraft({
        name: profile.name,
        description: profile.description ?? "",
        active: profile.active,
      });
    }
    setChanges(EMPTY_CHANGES);
    setManagedDraft(null);
    setReloadKey((k) => k + 1);
  };

  const impactItems = useMemo(() => {
    const items: string[] = [];
    if (generalDirty) items.push("Profile name, description, scope or active status will change.");
    if (managedDirty) items.push(`${managedDraft?.codes.length ?? 0} direct permission(s) will become part of this profile.`);
    if (changes.permissionSets.added.length || changes.permissionSets.removed.length) {
      items.push(`${changes.permissionSets.added.length} shared set(s) added; ${changes.permissionSets.removed.length} removed.`);
    }
    if (changes.workflowRoles.added.length || changes.workflowRoles.removed.length) {
      items.push(`${changes.workflowRoles.added.length} workflow eligibility item(s) added; ${changes.workflowRoles.removed.length} removed.`);
    }
    if (changes.users.added.length || changes.users.removed.length) {
      items.push(`${changes.users.added.length} user(s) added; ${changes.users.removed.length} removed.`);
    }
    if (items.length > 0 && assignedUserIds.length > 0
      && (generalDirty || managedDirty || changes.permissionSets.added.length || changes.permissionSets.removed.length)) {
      items.push(`Effective access may change for ${assignedUserIds.length} currently assigned user(s).`);
    }
    return items;
  }, [changes, generalDirty, managedDirty, managedDraft, assignedUserIds]);

  const nameError = submitted && !draft.name.trim() ? "Enter a name for this access profile." : "";

  const performSave = async () => {
    if (!draft.name.trim()) {
      setSubmitted(true);
      return;
    }
    const sig = await requestSignature("Update Access Profile", "Access Profile Change");
    if (!sig) return;
    setIsSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        active: draft.active,
      };
      // Compose the full desired state from current profile + tab diffs, and send it
      // as ONE aggregate request: one transaction, one signature, one audit event.
      // Sections without changes are omitted so the server leaves them untouched.
      const applyDiff = (current: string[], diff: AssignDiff) => {
        const next = new Set(current);
        diff.removed.forEach((v) => next.delete(v));
        diff.added.forEach((v) => next.add(v));
        return [...next];
      };
      const psDirty = changes.permissionSets.added.length > 0 || changes.permissionSets.removed.length > 0;
      const wfDirty = changes.workflowRoles.added.length > 0 || changes.workflowRoles.removed.length > 0;
      const usersDirty = changes.users.added.length > 0 || changes.users.removed.length > 0;
      const currentSharedIds = (profile?.permissionSets ?? [])
        .filter((ps) => ps.code !== `ROLE_${profile?.code}`)
        .map((ps) => ps.id);

      const updated = await settingsApi.updateAccessProfileConfiguration(
        id!,
        {
          expectedUpdatedAt: profile?.updatedAt,
          general: generalDirty ? payload : undefined,
          managedPermissionCodes: managedDirty ? managedDraft!.codes : undefined,
          sharedPermissionSetIds: psDirty ? applyDiff(currentSharedIds, changes.permissionSets) : undefined,
          workflowRoles: wfDirty ? applyDiff(profile?.workflowRoles ?? [], changes.workflowRoles) : undefined,
          userIds: usersDirty ? applyDiff(assignedUserIds, changes.users) : undefined,
        },
        sig,
      );

      const caps = await settingsApi.getAccessProfileCapabilities(id!);
      setProfile(updated);
      setAssignedUserIds(updated.assignedUsers.map((u) => u.id));
      setCapabilities(caps);
      setChanges(EMPTY_CHANGES);
      setManagedDraft(null);
      setReloadKey((k) => k + 1);
      setIsEditing(false);
      showToast({ type: "success", message: "Access profile updated" });
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setConflictModal(true);
      } else {
        showToast({ type: "error", message: e?.response?.data?.message ?? e?.response?.data?.error?.message ?? "Failed to save access profile" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    if (!draft.name.trim()) {
      setSubmitted(true);
      // the name lives on the General tab: go there so the hint is in view
      setActiveTab("general");
      window.setTimeout(() => document.getElementById("profile-field-name")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
      return;
    }
    if (impactItems.length > 0) {
      setImpactModal(true);
      return;
    }
    void performSave();
  };

  const handleConflictReload = async () => {
    setConflictModal(false);
    try {
      const [p, caps] = await Promise.all([
        settingsApi.getAccessProfileEditorSummary(id!),
        settingsApi.getAccessProfileCapabilities(id!),
      ]);
      setProfile(p.profile);
      setAssignedUserIds(p.assignedUserIds);
      setCapabilities(caps);
      setDraft({
        name: p.profile.name,
        description: p.profile.description ?? "",
        active: p.profile.active,
      });
      setChanges(EMPTY_CHANGES);
      setManagedDraft(null);
      setReloadKey((k) => k + 1);
      showToast({ type: "info", message: "Loaded the latest configuration — please re-apply your changes." });
    } catch {
      showToast({ type: "error", message: "Failed to reload profile" });
    }
  };

  const handleDelete = async () => {
    const sig = await requestSignature("Delete Access Profile", "Access Profile Change");
    if (!sig) return;
    try {
      await settingsApi.deleteAccessProfile(id!, sig);
      showToast({ type: "success", message: "Access profile deleted" });
      navigate(ROUTES.SECURITY.ACCESS_PROFILES);
    } catch {
      showToast({ type: "error", message: "Failed to delete access profile" });
    }
    setDeleteModal(false);
  };

  const handleToggle = async () => {
    if (!profile) return;
    const sig = await requestSignature(profile.active ? "Deactivate Access Profile" : "Activate Access Profile", "Access Profile Change");
    if (!sig) return;
    try {
      const updated = await settingsApi.toggleAccessProfileStatus(id!, sig);
      const caps = await settingsApi.getAccessProfileCapabilities(id!);
      setProfile(updated);
      setCapabilities(caps);
      showToast({ type: "success", message: `Profile ${updated.active ? "enabled" : "disabled"}` });
    } catch {
      showToast({ type: "error", message: "Failed to update status" });
    }
  };

  const mode: "edit" | "view" = isEditing ? "edit" : "view";
  const title = isEditing ? "Edit Access Profile" : "Access Profile Details";
  const canAssignInTab = (action: string) => isEditing && can(action);
  const tabDeniedReason = (action: string) =>
    !isEditing ? undefined : reason(action);

  // Each figure is also the way to where it is managed: the tab that lists it.
  const dashboardStats = useMemo<{ icon: React.ReactNode; value: number | "All"; label: string; tab: TabId }[]>(() => {
    if (!profile) return [];
    return [
      { icon: <KeyRound className="h-4 w-4" />, value: profile.permissionSets.filter((set) => set.code !== `ROLE_${profile.code}`).length, label: "Permission Sets", tab: "permission-sets" },
      { icon: <IconArrowsShuffle className="h-4 w-4" />, value: profile.workflowRoles.length, label: "Workflow Eligibility", tab: "workflow" },
      { icon: <Users className="h-4 w-4" />, value: assignedUserIds.length, label: "Assigned Users", tab: "users" },
    ];
  }, [profile, assignedUserIds.length]);

  if (loading) return <FullPageLoading text="Loading…" />;

  return (
    <div className="space-y-5 w-full flex-1 flex flex-col">
      <PageHeader
        title={title}
        breadcrumbItems={accessProfileDetailBreadcrumb(go, mode, profile?.name ?? undefined)}
        actions={
          <>
            <Button
              variant="outline-emerald"
              size="sm"
              onClick={() => navigateBack(go, location.state as never, ROUTES.SECURITY.ACCESS_PROFILES)}
            >
              Back
            </Button>
            {!isEditing && (
              <>
                <Button
                  variant="outline-emerald"
                  size="sm"
                  disabled={!can("edit")}
                  title={!can("edit") ? reason("edit") : undefined}
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </Button>
                <Button
                  variant="outline-emerald"
                  size="sm"
                  disabled={!can("toggleStatus")}
                  title={!can("toggleStatus") ? reason("toggleStatus") : undefined}
                  onClick={handleToggle}
                >
                  {profile?.active ? "Disable" : "Enable"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!can("delete")}
                  title={!can("delete") ? reason("delete") : undefined}
                  className="text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300 disabled:text-slate-400 disabled:border-slate-200 disabled:hover:bg-white"
                  onClick={() => setDeleteModal(true)}
                >
                  Delete
                </Button>
              </>
            )}
            {isEditing && (
              <>
                {isEditing && (
                  <Button
                    variant="outline-emerald"
                    size="sm"
                    onClick={() => { resetEdits(); setIsEditing(false); }}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  variant="outline-emerald"
                  size="sm"
                  disabled={isSaving || !hasChanges}
                  title={!hasChanges ? "No changes to save" : undefined}
                  onClick={handleSave}
                >
                  {isSaving ? "Saving…" : "Save"}
                </Button>
              </>
            )}
          </>
        }
      />

      {profile && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Access Profile summary">
          <div className="flex items-start gap-3 p-4 md:gap-4 md:p-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600" aria-hidden="true">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <h2 className="min-w-0 break-words text-lg font-semibold leading-tight text-slate-900 md:text-xl">{profile.name}</h2>
                <Badge color={profile.type === "SYSTEM" ? "blue" : "teal"} size="sm">
                  {profile.type === "SYSTEM" ? "System" : "Custom"}
                </Badge>
                <Badge color={flagColor(profile.active)} size="sm">
                  {profile.active ? "Active" : "Inactive"}
                </Badge>
                {profile.documentControlVisibility ? (
                  <Badge color={DOCUMENT_CONTROL_VISIBILITY_COLOR[profile.documentControlVisibility]} size="sm">
                    {`Document Control: ${DOCUMENT_CONTROL_VISIBILITY_LABEL[profile.documentControlVisibility]}`}
                  </Badge>
                ) : null}
              </div>
              {profile.code && <p className="mt-1 font-mono text-xs text-slate-500">{profile.code}</p>}
              {profile.description && <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-relaxed text-slate-600">{profile.description}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px border-t border-slate-200 bg-slate-200 lg:grid-cols-3">
            {dashboardStats.map(({ icon, value, label, tab }, index) => (
              <button
                key={label}
                type="button"
                onClick={() => setActiveTab(tab)}
                title={`Open ${TABS.find((item) => item.id === tab)?.label ?? label}`}
                className={`group flex items-center gap-3 bg-white px-4 py-3 text-left${index === dashboardStats.length - 1 && dashboardStats.length % 2 === 1 ? " col-span-2 lg:col-span-1" : ""} transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${value === 0 ? "bg-slate-100 text-slate-400" : "bg-emerald-50 text-emerald-600"}`}>
                  {icon}
                </span>
                <span className="min-w-0">
                  <span className={`block text-xl font-semibold leading-none tabular-nums ${value === 0 ? "text-slate-400" : "text-slate-900"}`}>{value}</span>
                  <span className="mt-1 block text-xs leading-tight text-slate-500">{label}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {isEditing && profile?.system && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-2.5 text-xs text-purple-800">
          Editing a system access profile. Changes still require electronic signature confirmation on Save
          and are recorded in the Audit Trail as a system profile override.
        </div>
      )}

      {isEditing && hasChanges && (
        <WarningBanner variant="warning">
          Unsaved changes: {generalDirty ? "general information; " : ""}{managedDirty ? "direct permissions; " : ""}{assignmentsDirty ? "assignments; " : ""}
          click <b>Save</b> to review and confirm all changes with one electronic signature.
        </WarningBanner>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
        <TabNav
          tabs={TABS}
          activeTab={activeTab}
          onChange={(tabId) => setActiveTab(tabId as TabId)}
        />
        <div className="p-4 md:p-5">
          {activeTab === "general" && profile && (
            <GeneralTab profile={profile} isEditing={isEditing} draft={draft} onChange={updateDraft} nameError={nameError} />
          )}
          {activeTab === "permissions" && id && profile && (
            <AccessProfilePermissionsTab
              profileId={id}
              profileCode={profile.code}
              reloadKey={reloadKey}
              canEdit={canAssignInTab("assignPermissionSets")}
              deniedReason={tabDeniedReason("assignPermissionSets")}
              onManagedChange={(codes, dirty) => setManagedDraft({ codes, dirty })}
            />
          )}
          {activeTab === "permission-sets" && id && (
            <PermissionSetsTab
              profileId={id}
              reloadKey={reloadKey}
              canAssign={canAssignInTab("assignPermissionSets")}
              deniedReason={tabDeniedReason("assignPermissionSets")}
              onOpenDrawer={setDrawerPs}
              onChangesChange={(diff) => handleTabChanges("permissionSets", diff)}
            />
          )}
          {activeTab === "workflow" && id && (
            <WorkflowTab
              profileId={id}
              reloadKey={reloadKey}
              canAssign={canAssignInTab("assignWorkflowRoles")}
              deniedReason={tabDeniedReason("assignWorkflowRoles")}
              onChangesChange={(diff) => handleTabChanges("workflowRoles", diff)}
            />
          )}
          {activeTab === "users" && id && (
            <AccessProfileAssignedUsersTab
              profileId={id}
              reloadKey={reloadKey}
              canAssign={canAssignInTab("assignUsers")}
              deniedReason={tabDeniedReason("assignUsers")}
              onChangesChange={(diff) => handleTabChanges("users", diff)}
            />
          )}
          {activeTab === "audit" && id && (
            // Must match AccessProfileService.ENTITY_TYPE exactly ("ACCESS_PROFILE") --
            // unlike "Controlled Copy", the backend's module filter has no switch-case
            // mapping a human-readable label to this entity type, so it falls through to
            // a direct case-insensitive equality check against the raw stored value.
            <AuditTrailTab entityId={id} entityType="ACCESS_PROFILE" />
          )}
        </div>
      </div>

      {drawerPs && <AccessProfilePermissionSetDrawer ps={drawerPs} onClose={() => setDrawerPs(null)} />}

      <AlertModal
        isOpen={impactModal}
        onClose={() => setImpactModal(false)}
        onConfirm={() => { setImpactModal(false); void performSave(); }}
        type="warning"
        title="Review Access Impact"
        description={
          <div className="space-y-2 text-left">
            <p>Access Profile changes are applied immediately after electronic signature.</p>
            <ul className="list-disc pl-5 space-y-1">
              {impactItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <p className="text-xs text-slate-500">Document participants remain assigned per revision; this change does not assign anyone as an Author, Reviewer or Approver.</p>
          </div>
        }
        confirmText="Continue to E-Sign"
        cancelText="Review Changes"
        showCancel
      />
      <AlertModal
        isOpen={conflictModal}
        onClose={() => setConflictModal(false)}
        onConfirm={handleConflictReload}
        type="warning"
        title="Configuration Changed"
        description="This Access Profile was modified by another administrator while you were editing. Reload to see the latest configuration — your unsaved changes will need to be re-applied."
        confirmText="Reload"
        cancelText="Keep Editing"
        showCancel
      />
      <AlertModal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        onConfirm={handleDelete}
        type="warning"
        title="Delete Access Profile"
        description={`Are you sure you want to delete "${profile?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        showCancel
      />
      {signatureModal}
      {leaveModal}
    </div>
  );
};
