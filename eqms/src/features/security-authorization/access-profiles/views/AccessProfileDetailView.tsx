import React, { useEffect, useMemo, useState } from "react";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ShieldCheck, Users, KeyRound, Building2, Factory } from "lucide-react";
import { IconArrowsShuffle } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
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
import { GeneralTab, NewProfileForm } from "./tabs/AccessProfileGeneralTab";
import { PermissionSetsTab } from "./tabs/AccessProfilePermissionSetsTab";
import { AccessProfilePermissionsTab } from "./tabs/AccessProfilePermissionsTab";
import { WorkflowTab } from "./tabs/AccessProfileWorkflowTab";
import { AccessProfileEffectiveAccessTab } from "./tabs/AccessProfileEffectiveAccessTab";
import { AccessProfileAssignedUsersTab } from "./tabs/AccessProfileAssignedUsersTab";
import { AuditTrailTab } from "@/features/documents/shared/components/AuditTrailTab";
import { parseScopeCount } from "./tabs/accessProfileDetailShared";
import { AccessProfilePermissionSetDrawer } from "./tabs/AccessProfilePermissionSetDrawer";
import { accessProfileDetail as accessProfileDetailBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";

type TabId = "general" | "permissions" | "permission-sets" | "workflow" | "effective-access" | "users" | "audit";

const TABS: TabItem[] = [
  { id: "general", label: "General" },
  { id: "effective-access", label: "Effective Access" },
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

  const isNew = !id || location.pathname.endsWith("/new");
  const isEditRoute = location.pathname.endsWith("/edit");
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [profile, setProfile] = useState<AccessProfileDetailResponse | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(isNew || isEditRoute);
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
    businessUnitScope: "",
    departmentScope: "",
    active: true,
  });

  useEffect(() => {
    if (isNew) return;
    Promise.all([
      settingsApi.getAccessProfile(id!),
      settingsApi.getAccessProfileCapabilities(id!),
    ])
      .then(([p, caps]) => {
        setProfile(p);
        setCapabilities(caps);
        setDraft({
          name: p.name,
          description: p.description ?? "",
          businessUnitScope: p.businessUnitScope ?? "",
          departmentScope: p.departmentScope ?? "",
          active: p.active,
        });
      })
      .catch(() => showToast({ type: "error", message: "Failed to load profile" }))
      .finally(() => setLoading(false));
  }, [id, isNew, showToast]);

  const can = (action: string) => Boolean(capabilities?.actions?.[action]?.allowed);
  const reason = (action: string) => capabilities?.actions?.[action]?.reason || "Action is not currently allowed";

  const updateDraft = (field: string, value: string | boolean) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  const handleTabChanges = (kind: AssignKind, diff: AssignDiff) =>
    setChanges((prev) => ({ ...prev, [kind]: diff }));

  const generalDirty = profile
    ? draft.name !== profile.name
      || draft.description !== (profile.description ?? "")
      || draft.businessUnitScope !== (profile.businessUnitScope ?? "")
      || draft.departmentScope !== (profile.departmentScope ?? "")
      || draft.active !== profile.active
    : false;
  const assignmentsDirty = Object.values(changes).some((d) => d.added.length > 0 || d.removed.length > 0);
  const managedDirty = Boolean(managedDraft?.dirty);
  const hasChanges = isNew || generalDirty || assignmentsDirty || managedDirty;

  const resetEdits = () => {
    if (profile) {
      setDraft({
        name: profile.name,
        description: profile.description ?? "",
        businessUnitScope: profile.businessUnitScope ?? "",
        departmentScope: profile.departmentScope ?? "",
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
    if (items.length > 0 && (profile?.assignedUsers.length ?? 0) > 0
      && (generalDirty || managedDirty || changes.permissionSets.added.length || changes.permissionSets.removed.length)) {
      items.push(`Effective access may change for ${profile!.assignedUsers.length} currently assigned user(s).`);
    }
    return items;
  }, [changes, generalDirty, managedDirty, managedDraft, profile]);

  const performSave = async () => {
    if (!draft.name.trim()) {
      showToast({ type: "error", title: "Validation failed", message: "Name is required" });
      return;
    }
    const sig = await requestSignature(isNew ? "Create Access Profile" : "Update Access Profile", "Access Profile Change");
    if (!sig) return;
    setIsSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        active: draft.active,
        businessUnitScope: draft.businessUnitScope.trim() || null,
        departmentScope: draft.departmentScope.trim() || null,
      };
      if (isNew) {
        const created = await settingsApi.createAccessProfile(payload, sig);
        showToast({ type: "success", message: "Access profile created" });
        navigate(`${ROUTES.SECURITY.ACCESS_PROFILES}/${created.id}`, { replace: true });
        return;
      }

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
          userIds: usersDirty ? applyDiff((profile?.assignedUsers ?? []).map((u) => u.id), changes.users) : undefined,
        },
        sig,
      );

      const caps = await settingsApi.getAccessProfileCapabilities(id!);
      setProfile(updated);
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
      showToast({ type: "error", title: "Validation failed", message: "Name is required" });
      return;
    }
    if (!isNew && impactItems.length > 0) {
      setImpactModal(true);
      return;
    }
    void performSave();
  };

  const handleConflictReload = async () => {
    setConflictModal(false);
    try {
      const [p, caps] = await Promise.all([
        settingsApi.getAccessProfile(id!),
        settingsApi.getAccessProfileCapabilities(id!),
      ]);
      setProfile(p);
      setCapabilities(caps);
      setDraft({
        name: p.name,
        description: p.description ?? "",
        businessUnitScope: p.businessUnitScope ?? "",
        departmentScope: p.departmentScope ?? "",
        active: p.active,
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

  const mode: "new" | "edit" | "view" = isNew ? "new" : isEditing ? "edit" : "view";
  const title = isNew ? "New Access Profile" : isEditing ? "Edit Access Profile" : "Access Profile Details";
  const canAssignInTab = (action: string) => isEditing && can(action);
  const tabDeniedReason = (action: string) =>
    !isEditing ? "Click Edit to enable changes." : reason(action);

  const dashboardStats = useMemo(() => {
    if (!profile) return [];
    return [
      { icon: <KeyRound className="h-4 w-4 text-emerald-600" />, value: profile.permissionSets.length, label: "Permission Sets" },
      { icon: <IconArrowsShuffle className="h-4 w-4 text-blue-500" />, value: profile.workflowRoles.length, label: "Workflow Eligibility" },
      { icon: <Users className="h-4 w-4 text-purple-500" />, value: profile.assignedUsers.length, label: "Assigned Users" },
      { icon: <Building2 className="h-4 w-4 text-sky-600" />, value: parseScopeCount(profile.businessUnitScope), label: "Business Units" },
      { icon: <Factory className="h-4 w-4 text-indigo-600" />, value: parseScopeCount(profile.departmentScope), label: "Departments" },
    ];
  }, [profile]);

  if (loading) return <FullPageLoading text="Loading…" />;

  return (
    <div className="space-y-5 w-full flex-1 flex flex-col">
      <PageHeader
        title={title}
        breadcrumbItems={accessProfileDetailBreadcrumb(navigate, mode, profile?.name ?? undefined)}
        actions={
          <>
            <Button
              variant="outline-emerald"
              size="sm"
              onClick={() => navigateBack(navigate, location.state as never, ROUTES.SECURITY.ACCESS_PROFILES)}
            >
              Back
            </Button>
            {!isNew && !isEditing && (
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
            {(isNew || isEditing) && (
              <>
                {isEditing && !isNew && (
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

      {!isNew && profile && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-5 bg-gradient-to-r from-emerald-50 via-white to-slate-50">
            <div className="flex flex-col lg:flex-row lg:items-start gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900 truncate">{profile.name}</h2>
                    <Badge color={profile.type === "SYSTEM" ? "purple" : "slate"} size="xs">
                      {profile.type === "SYSTEM" ? "System" : "Custom"}
                    </Badge>
                    <Badge color={profile.active ? "emerald" : "slate"} size="xs" showDot pill>
                      {profile.active ? "Active" : "Inactive"}
                    </Badge>
                    <Badge color="slate" size="xs">
                      {profile.code || "-"}
                    </Badge>
                  </div>
                  {profile.description ? (
                    <p className="text-sm text-slate-600 max-w-2xl">{profile.description}</p>
                  ) : (
                    <p className="text-sm text-slate-500">Administrative access profile.</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 w-full lg:w-auto">
                {dashboardStats.map(({ icon, value, label }) => (
                  <div
                    key={label}
                    className="min-w-[112px] rounded-xl border border-slate-200 bg-white/90 px-3 py-2.5 flex flex-col items-center shadow-sm"
                  >
                    <div className="flex items-center gap-1.5">
                      {icon}
                      <span className="text-base font-bold text-slate-800">{value}</span>
                    </div>
                    <span className="text-2xs text-slate-500 mt-0.5 whitespace-nowrap">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditing && !isNew && hasChanges && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          Unsaved changes: {generalDirty ? "general information; " : ""}{managedDirty ? "direct permissions; " : ""}{assignmentsDirty ? "assignments; " : ""}
          click <b>Save</b> to review and confirm all changes with one electronic signature.
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
        <TabNav
          tabs={isNew ? [TABS[0]] : TABS}
          activeTab={activeTab}
          onChange={(tabId) => setActiveTab(tabId as TabId)}
        />
        <div className="p-4 md:p-5">
          {activeTab === "general" && profile && (
            <GeneralTab profile={profile} isEditing={isEditing} draft={draft} onChange={updateDraft} />
          )}
          {activeTab === "general" && isNew && (
            <NewProfileForm draft={draft} onChange={updateDraft} />
          )}
          {activeTab === "permissions" && !isNew && id && profile && (
            <AccessProfilePermissionsTab
              profileId={id}
              profileCode={profile.code}
              reloadKey={reloadKey}
              canEdit={canAssignInTab("assignPermissionSets") && !profile.system}
              deniedReason={profile.system ? "System profiles cannot be modified." : tabDeniedReason("assignPermissionSets")}
              onManagedChange={(codes, dirty) => setManagedDraft({ codes, dirty })}
            />
          )}
          {activeTab === "permission-sets" && !isNew && id && (
            <PermissionSetsTab
              profileId={id}
              reloadKey={reloadKey}
              canAssign={canAssignInTab("assignPermissionSets") && !profile?.system}
              deniedReason={profile?.system ? "System profiles cannot be modified." : tabDeniedReason("assignPermissionSets")}
              onOpenDrawer={setDrawerPs}
              onChangesChange={(diff) => handleTabChanges("permissionSets", diff)}
            />
          )}
          {activeTab === "workflow" && !isNew && id && (
            <WorkflowTab
              profileId={id}
              reloadKey={reloadKey}
              canAssign={canAssignInTab("assignWorkflowRoles") && !profile?.system}
              deniedReason={profile?.system ? "System profiles cannot be modified." : tabDeniedReason("assignWorkflowRoles")}
              onChangesChange={(diff) => handleTabChanges("workflowRoles", diff)}
            />
          )}
          {activeTab === "effective-access" && !isNew && profile && (
            <AccessProfileEffectiveAccessTab profile={profile} isEditing={isEditing} />
          )}
          {activeTab === "users" && !isNew && id && (
            <AccessProfileAssignedUsersTab
              profileId={id}
              reloadKey={reloadKey}
              canAssign={canAssignInTab("assignUsers") && !profile?.system}
              deniedReason={profile?.system ? "System profiles cannot be modified." : tabDeniedReason("assignUsers")}
              onChangesChange={(diff) => handleTabChanges("users", diff)}
            />
          )}
          {activeTab === "audit" && !isNew && id && (
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
    </div>
  );
};
