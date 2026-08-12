import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Check, GitBranch, Info, ListChecks, ListTodoIcon, ScanEye, Search, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FormSection } from "@/components/ui/form/FormSection";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/utils";
import { useDebounce } from "@/hooks";
import { PermissionSplitExplorer } from "@/features/security-authorization/shared/explorer/PermissionSplitExplorer";
import { usePermissionCatalog } from "@/features/security-authorization/shared/usePermissionCatalog";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { useScopeOptions } from "@/features/security-authorization/access-profiles/shared/useScopeOptions";
import { scopeListToString } from "@/features/security-authorization/access-profiles/views/tabs/accessProfileDetailShared";
import { MultiSelect } from "@/components/ui/select/MultiSelect";
import { Select } from "@/components/ui/select/Select";
import { accessProfiles as accessProfilesBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { ROUTES } from "@/app/routes.constants";
import { settingsApi } from "@/services/api";
import { api } from "@/services/api/client";
import type { PermissionSetResponse } from "@/services/api/settings";
import type { User } from "@/types";
import { IconArrowsShuffle, IconCircles } from "@tabler/icons-react";

const labelClass = "text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block";
const inputClass =
  "w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400";
const textareaClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400 resize-none";
const clearSelectionClass =
  "text-xs font-medium text-rose-600 transition-colors hover:text-rose-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30 rounded";

const STEPS = ["Basic Info", "Permissions", "Workflow Eligibility", "Scope", "Users", "Review & Create"] as const;
const PERMISSION_MODE_TABS: TabItem[] = [
  { id: "existing", label: "Use existing Permission Sets" },
  { id: "custom", label: "Pick individual permissions" },
];

interface WorkflowRoleCatalogEntry {
  id: string;
  code: string;
  label: string;
  moduleKey: string;
  description: string | null;
  active: boolean;
  system: boolean;
}

interface WorkflowRoleCatalogPage {
  data: WorkflowRoleCatalogEntry[];
}

type PermissionMode = "existing" | "custom";

/**
 * Guided one-screen wizard that assembles a complete Access Profile +
 * Permission Set(s) + optional workflow eligibility + scope — in sequential steps,
 * so admins don't have to hop across the Permission Sets / Access Profiles /
 * Workflow Authorization screens and manually wire the three records together.
 * Nothing is persisted until the final step (single e-signature covers the
 * whole batch), so abandoning the wizard mid-way leaves no partial data.
 */
export const RoleSetupWizardView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { requestSignature, signatureModal } = useSecurityESign();

  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);

  // ── Step 1: basic info ────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [existingProfileNames, setExistingProfileNames] = useState<Set<string>>(new Set());

  // ── Step 2: permissions ───────────────────────────────────────────────────
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("existing");
  const [existingSets, setExistingSets] = useState<PermissionSetResponse[]>([]);
  const [setsLoading, setSetsLoading] = useState(true);
  const [setSearch, setSetSearch] = useState("");
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set());
  const [selectedSetDetails, setSelectedSetDetails] = useState<Map<string, PermissionSetResponse>>(new Map());
  const { permissionGroups, isLoading: catalogLoading } = usePermissionCatalog();
  const [customCodes, setCustomCodes] = useState<Set<string>>(new Set());

  // ── Step 3: workflow roles ────────────────────────────────────────────────
  const [workflowRoles, setWorkflowRoles] = useState<WorkflowRoleCatalogEntry[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [roleSearch, setRoleSearch] = useState("");
  const [selectedRoleCodes, setSelectedRoleCodes] = useState<Set<string>>(new Set());
  const [selectedRoleDetails, setSelectedRoleDetails] = useState<Map<string, WorkflowRoleCatalogEntry>>(new Map());

  // ── Step 4: scope (optional) ──────────────────────────────────────────────
  const [businessUnits, setBusinessUnits] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const { businessUnitOptions, departmentOptions, isLoading: scopeOptionsLoading } = useScopeOptions();

  // ── Step 5: initial users (optional) ──────────────────────────────────────
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearch, setUserSearch] = useState("");
  const [userBusinessUnitFilter, setUserBusinessUnitFilter] = useState("All");
  const [userDepartmentFilter, setUserDepartmentFilter] = useState("All");
  const [userBusinessUnitOptions, setUserBusinessUnitOptions] = useState<{ label: string; value: string }[]>([]);
  const [userDepartmentOptions, setUserDepartmentOptions] = useState<{ label: string; value: string }[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [selectedUserDetails, setSelectedUserDetails] = useState<Map<string, User>>(new Map());

  const debouncedSetSearch = useDebounce(setSearch, 300);
  const debouncedRoleSearch = useDebounce(roleSearch, 300);
  const debouncedUserSearch = useDebounce(userSearch, 300);

  useEffect(() => {
    settingsApi
      .listAllAccessProfiles()
      .then((profiles) =>
        setExistingProfileNames(new Set(profiles.map((p) => p.name.trim().toLowerCase()))),
      )
      .catch(() => { /* uniqueness still enforced server-side (roles.name unique) */ });
  }, [showToast]);

  useEffect(() => {
    let active = true;
    settingsApi.getUserFilters()
      .then((filters) => {
        if (!active) return;
        setUserBusinessUnitOptions(filters.businessUnits.map((item) => ({ label: item.label, value: item.value })));
        setUserDepartmentOptions(filters.departments.map((item) => ({ label: item.label, value: item.value })));
      })
      .catch(() => {
        if (active) showToast({ type: "error", title: "Load Failed", message: "Failed to load user filter options." });
      });
    return () => { active = false; };
  }, [showToast]);

  useEffect(() => {
    let active = true;
    setSetsLoading(true);
    settingsApi
      .listPermissionSetsPaged({ page: 1, limit: 100, search: debouncedSetSearch.trim() || undefined, status: "ACTIVE", sortBy: "name", sortDir: "asc" })
      .then((result) => { if (active) setExistingSets(result.data ?? []); })
      .catch(() => { if (active) showToast({ type: "error", message: "Failed to load permission sets" }); })
      .finally(() => { if (active) setSetsLoading(false); });
    return () => { active = false; };
  }, [debouncedSetSearch, showToast]);

  useEffect(() => {
    let active = true;
    setRolesLoading(true);
    api
      .get<WorkflowRoleCatalogPage>("/security/workflow-roles/catalog", {
        params: { page: 1, limit: 100, search: debouncedRoleSearch.trim() || undefined, status: "ACTIVE", sortBy: "displayOrder", sortDir: "asc" },
      })
      .then((result) => { if (active) setWorkflowRoles(result.data.data ?? []); })
      .catch(() => { if (active) showToast({ type: "error", message: "Failed to load workflow roles" }); })
      .finally(() => { if (active) setRolesLoading(false); });
    return () => { active = false; };
  }, [debouncedRoleSearch, showToast]);

  useEffect(() => {
    let active = true;
    setUsersLoading(true);
    settingsApi
      .getUsers({
        page: 1,
        limit: 100,
        search: debouncedUserSearch.trim() || undefined,
        status: "Active",
        businessUnit: userBusinessUnitFilter === "All" ? undefined : userBusinessUnitFilter,
        department: userDepartmentFilter === "All" ? undefined : userDepartmentFilter,
        sortBy: "fullName",
        sortDirection: "asc",
      })
      .then((result) => { if (active) setAllUsers(result.data ?? []); })
      .catch(() => { if (active) showToast({ type: "error", message: "Failed to load users" }); })
      .finally(() => { if (active) setUsersLoading(false); });
    return () => { active = false; };
  }, [debouncedUserSearch, showToast, userBusinessUnitFilter, userDepartmentFilter]);

  const toggleUser = (user: User) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(user.id)) next.delete(user.id);
      else next.add(user.id);
      return next;
    });
    setSelectedUserDetails((prev) => {
      const next = new Map(prev);
      if (next.has(user.id)) next.delete(user.id);
      else next.set(user.id, user);
      return next;
    });
  };

  const permissionsValid =
    permissionMode === "existing" ? selectedSetIds.size > 0 : customCodes.size > 0;

  const nameTaken = existingProfileNames.has(name.trim().toLowerCase());

  const stepValid = (index: number): boolean => {
    switch (index) {
      case 0: return name.trim().length > 0 && !nameTaken;
      case 1: return permissionsValid;
      default: return true; // workflow role & scope are optional
    }
  };

  const canProceed = stepValid(step);

  const toggleSet = (permissionSet: PermissionSetResponse) => {
    setSelectedSetIds((prev) => {
      const next = new Set(prev);
      if (next.has(permissionSet.id)) next.delete(permissionSet.id);
      else next.add(permissionSet.id);
      return next;
    });
    setSelectedSetDetails((prev) => {
      const next = new Map(prev);
      if (next.has(permissionSet.id)) next.delete(permissionSet.id);
      else next.set(permissionSet.id, permissionSet);
      return next;
    });
  };

  const toggleRole = (role: WorkflowRoleCatalogEntry) => {
    setSelectedRoleCodes((prev) => {
      const next = new Set(prev);
      if (next.has(role.code)) next.delete(role.code);
      else next.add(role.code);
      return next;
    });
    setSelectedRoleDetails((prev) => {
      const next = new Map(prev);
      if (next.has(role.code)) next.delete(role.code);
      else next.set(role.code, role);
      return next;
    });
  };

  const handleCustomToggle = (code: string, checked: boolean) => {
    setCustomCodes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
  };

  const selectedSetSummaries = [...selectedSetDetails.values()];
  const selectedRoleSummaries = [...selectedRoleDetails.values()];
  const selectedUserSummaries = [...selectedUserDetails.values()];

  const handleCreate = async () => {
    const sig = await requestSignature(`Create Access Profile "${name.trim()}"`, "Access Profile Change");
    if (!sig) return;
    setCreating(true);
    try {
      // One atomic backend call: profile + picked permissions (auto-managed set) +
      // shared sets + workflow roles + initial users. Any failure rolls back everything.
      const profile = await settingsApi.createAccessProfileFull(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          active: true,
          businessUnitScope: scopeListToString(businessUnits),
          departmentScope: scopeListToString(departments),
          permissionCodes: permissionMode === "custom" ? [...customCodes] : [],
          permissionSetIds: permissionMode === "existing" ? [...selectedSetIds] : [],
          workflowRoles: [...selectedRoleCodes],
          userIds: [...selectedUserIds],
        },
        sig,
      );
      showToast({
        type: "success",
        title: "Access Profile created",
        message: selectedUserIds.size > 0
          ? `"${profile.name}" is ready and assigned to ${selectedUserIds.size} user(s).`
          : `"${profile.name}" is ready — assign users from the profile's Assigned Users tab whenever needed.`,
      });
      navigate(`${ROUTES.SECURITY.ACCESS_PROFILES}/${profile.id}`);
    } catch (e: any) {
      showToast({
        type: "error",
        title: "Access Profile creation failed",
        message: e?.response?.data?.message ?? "Unexpected error — nothing was created.",
      });
    } finally {
      setCreating(false);
    }
  };

  const breadcrumbItems = useMemo(() => {
    return [
      ...accessProfilesBreadcrumb(navigate).map((item) => ({ ...item, isActive: false })),
      { label: "New Access Profile", isActive: true },
    ];
  }, [navigate]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {signatureModal}
      <PageHeader
        title="New Access Profile"
        breadcrumbItems={breadcrumbItems}
        actions={
          <Button variant="outline-emerald" size="sm" className="whitespace-nowrap" onClick={() => navigate(ROUTES.SECURITY.ACCESS_PROFILES)}>
            Cancel
          </Button>
        }
      />

      <WorkflowStepper
        steps={STEPS}
        currentStepIndex={step}
        onStepClick={(index) => {
          // Allow jumping back to any completed step; forward only one valid step at a time via Next.
          if (index < step) setStep(index);
        }}
      />

      {/* ── Step 1: Basic Info ── */}
      {step === 0 && (
        <FormSection title="Basic Information" icon={<Info className="h-4 w-4" />} contentClassName="p-4 md:p-5">
          <div className="space-y-4 max-w-2xl">
            <div>
              <label className={labelClass}>
                Access Profile Name <span className="text-red-500">*</span>
              </label>
              <input
                className={cn(inputClass, nameTaken && "border-red-300 focus:ring-red-500 focus:border-red-500")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Document Reviewer - North Region"
                autoFocus
              />
              {nameTaken ? (
                <p className="text-xs text-red-500 mt-1.5">
                  An access profile named “{name.trim()}” already exists — choose a different name.
                </p>
              ) : (
                <p className="text-xs text-slate-500 mt-1.5">
                  This is the named bundle of permissions that will be assigned to users.
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea
                className={textareaClass}
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What responsibilities and access does this profile provide?"
              />
            </div>
          </div>
        </FormSection>
      )}

      {/* ── Step 2: Permissions ── */}
      {step === 1 && (
        <FormSection
          title="What can this Access Profile do?"
          icon={<ListTodoIcon className="h-4 w-4" />}
          description="Pick one or more existing permission sets, or build a custom set by ticking individual permissions."
          contentClassName="p-4 md:p-5"
        >
          <TabNav
            tabs={PERMISSION_MODE_TABS}
            activeTab={permissionMode}
            onChange={(mode) => setPermissionMode(mode as PermissionMode)}
            variant="pill"
            fullWidth
            className="mb-4 max-w-xl"
            ariaLabel="Permission selection mode"
          />

          {permissionMode === "existing" ? (
            <div className="space-y-3">
              <div className="max-w-md">
                <label className={labelClass}>Search</label>
                <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  className={inputClass + " pl-9"}
                  value={setSearch}
                  onChange={(e) => setSetSearch(e.target.value)}
                  placeholder="Search permission sets…"
                />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Badge color="emerald" size="sm">{selectedSetIds.size} selected</Badge>
                {selectedSetIds.size > 0 && (
                  <button type="button" className={clearSelectionClass} onClick={() => { setSelectedSetIds(new Set()); setSelectedSetDetails(new Map()); }}>
                    Clear all
                  </button>
                )}
                {selectedSetIds.size === 0 && (
                  <span className="text-xs text-red-500">Select at least one permission set</span>
                )}
              </div>
              {setsLoading ? (
                <SectionLoading minHeight="120px" />
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                  {existingSets.length === 0 && (
                    <p className="p-4 text-sm text-slate-400">No permission sets match your search.</p>
                  )}
                  {existingSets.map((ps) => (
                    <label
                      key={ps.id}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <Checkbox
                        id={`wizard-ps-${ps.id}`}
                        checked={selectedSetIds.has(ps.id)}
                        onChange={() => toggleSet(ps)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-xs sm:text-sm font-medium text-slate-800">{ps.name}</span>
                          <Badge color={ps.system ? "blue" : "slate"} size="xs">{ps.system ? "System" : "Custom"}</Badge>
                          <span className="text-2xs text-slate-400">{ps.permissionCount} permissions</span>
                        </span>
                        {ps.description && (
                          <span className="block text-xs text-slate-500 mt-0.5">{ps.description}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                <div className="flex items-center gap-2">
                  <Badge color="emerald" size="sm">{customCodes.size} selected</Badge>
                  {customCodes.size > 0 && (
                    <button type="button" className={clearSelectionClass} onClick={() => setCustomCodes(new Set())}>
                      Clear all
                    </button>
                  )}
                  {customCodes.size === 0 && (
                    <span className="text-xs text-red-500 whitespace-nowrap">Tick at least one permission</span>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  A new Permission Set named “{name.trim() || "…"} Permissions” will be created with these.
                </span>
              </div>
              <PermissionSplitExplorer
                groups={permissionGroups}
                selectedCodes={customCodes}
                onToggle={handleCustomToggle}
                isLoading={catalogLoading}
              />
            </div>
          )}
        </FormSection>
      )}

      {/* ── Step 3: Workflow eligibility ── */}
      {step === 2 && (
        <FormSection
          title="Workflow participant eligibility"
          icon={<IconArrowsShuffle className="h-4 w-4" />}
          description="Select the workflow capacities that users with this Access Profile may be considered for. A capacity never grants action rights by itself: the user still needs the configured permission and must be assigned to that document/revision."
          contentClassName="p-4 md:p-5"
        >
          <div className="space-y-3">
            <div className="max-w-md">
              <label className={labelClass}>Search</label>
              <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                className={inputClass + " pl-9"}
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                placeholder="Search workflow roles..."
              />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge color="emerald" size="sm">{selectedRoleCodes.size} selected</Badge>
              {selectedRoleCodes.size > 0 && (
                <button type="button" className={clearSelectionClass} onClick={() => { setSelectedRoleCodes(new Set()); setSelectedRoleDetails(new Map()); }}>
                  Clear all
                </button>
              )}
            </div>
          {rolesLoading ? (
            <SectionLoading minHeight="120px" />
          ) : workflowRoles.length === 0 ? (
            <p className="text-sm text-slate-400">No workflow roles are defined yet. Review the Workflow Role Catalog under Security &amp; Authorization → Advanced.</p>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-w-3xl max-h-[420px] overflow-y-auto">
              {workflowRoles.map((role) => (
                <label
                  key={role.code}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Checkbox
                    id={`wizard-role-${role.code}`}
                    checked={selectedRoleCodes.has(role.code)}
                    onChange={() => toggleRole(role)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-xs sm:text-sm font-medium text-slate-800">{role.label}</span>
                      <span className="text-2xs font-mono text-slate-400">{role.code}</span>
                      <Badge color="slate" size="xs">{role.moduleKey}</Badge>
                    </span>
                    {role.description && (
                      <span className="block text-xs text-slate-500 mt-0.5">{role.description}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          )}
          </div>
        </FormSection>
      )}

      {/* ── Step 4: Scope ── */}
      {step === 3 && (
        <FormSection
          title="Scope (optional)"
          icon={<Building2 className="h-4 w-4" />}
          headerRight={businessUnits.length > 0 || departments.length > 0 ? (
            <button type="button" className={clearSelectionClass} onClick={() => { setBusinessUnits([]); setDepartments([]); }}>
              Clear all
            </button>
          ) : undefined}
          description="Leave empty to apply system-wide. Fill in to note which Business Units / Departments this Access Profile is meant for — fine-grained object filtering is configured separately under Object Access Rules."
          contentClassName="p-4 md:p-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
            <MultiSelect
              label="Business Unit Scope"
              value={businessUnits}
              onChange={(values) => setBusinessUnits(values.map(String))}
              options={businessUnitOptions}
              placeholder="All Business Units"
              isLoading={scopeOptionsLoading}
            />
            <MultiSelect
              label="Department Scope"
              value={departments}
              onChange={(values) => setDepartments(values.map(String))}
              options={departmentOptions}
              placeholder="All Departments"
              isLoading={scopeOptionsLoading}
            />
          </div>
        </FormSection>
      )}

      {/* ── Step 5: Users (optional) ── */}
      {step === 4 && (
        <FormSection
          title="Who should receive this Access Profile?"
          icon={<Users className="h-4 w-4" />}
          description="Optional — assignments are created together with the Access Profile under the same signature. You can always assign more users later. Segregation-of-Duties conflicts are checked per user and block the whole creation."
          contentClassName="p-4 md:p-5"
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className={labelClass}>Search</label>
                <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                className={inputClass + " pl-9"}
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users…"
              />
                </div>
              </div>
              <Select
                label="Business Unit"
                value={userBusinessUnitFilter}
                onChange={(value) => {
                  setUserBusinessUnitFilter(String(value));
                  setUserDepartmentFilter("All");
                }}
                options={[{ label: "All Business Units", value: "All" }, ...userBusinessUnitOptions]}
              />
              <Select
                label="Department"
                value={userDepartmentFilter}
                onChange={(value) => setUserDepartmentFilter(String(value))}
                options={[{ label: "All Departments", value: "All" }, ...userDepartmentOptions]}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge color="emerald" size="sm">{selectedUserIds.size} selected</Badge>
              {selectedUserIds.size > 0 && (
                <button type="button" className={clearSelectionClass} onClick={() => { setSelectedUserIds(new Set()); setSelectedUserDetails(new Map()); }}>
                  Clear all
                </button>
              )}
              {selectedUserIds.size === 0 && (
                  <span className="text-xs text-slate-500">No users selected — the Access Profile will be created unassigned.</span>
              )}
            </div>
            {usersLoading ? (
              <SectionLoading minHeight="120px" />
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                {allUsers.length === 0 && (
                  <p className="p-4 text-sm text-slate-400">No users match your search.</p>
                )}
                {allUsers.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <Checkbox
                      id={`wizard-user-${u.id}`}
                      checked={selectedUserIds.has(u.id)}
                      onChange={() => toggleUser(u)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm font-medium text-slate-800">
                        {u.fullName}
                        <span className="font-mono text-2xs font-medium text-slate-500">{u.employeeCode}</span>
                      </span>
                      <span className="mt-1 grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs text-slate-500 sm:grid-cols-3">
                        <span><span className="text-slate-400">Department:</span> {u.department || "—"}</span>
                        <span><span className="text-slate-400">Business Unit:</span> {u.businessUnit || "—"}</span>
                        <span className="truncate"><span className="text-slate-400">Email:</span> {u.email}</span>
                      </span>
                      <span className="hidden">
                        {[u.department, u.email].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </FormSection>
      )}

      {/* ── Step 6: Review ── */}
      {step === 5 && (
        <FormSection
          title="Review & Create"
          icon={<ScanEye className="h-4 w-4" />}
          description="Nothing has been saved yet — everything below is created in one batch after you sign."
          contentClassName="p-4 md:p-5"
        >
          <dl className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 lg:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Access Profile name</dt>
              <dd className="text-sm font-medium text-slate-800 mt-0.5">{name.trim()}</dd>
              {description.trim() && <dd className="text-xs text-slate-500 mt-0.5">{description.trim()}</dd>}
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Permissions</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {permissionMode === "existing" ? (
                  selectedSetSummaries.map((ps) => (
                    <Badge key={ps.id} color="emerald" size="sm">{ps.name} ({ps.permissionCount})</Badge>
                  ))
                ) : (
                  <Badge color="emerald" size="sm">New set “{name.trim()} Permissions” — {customCodes.size} permissions</Badge>
                )}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Workflow roles</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {selectedRoleSummaries.length === 0 ? (
                  <span className="text-sm text-slate-500">None — users with this profile will not be considered by the participant picker through a workflow capacity.</span>
                ) : (
                  selectedRoleSummaries.map((r) => <Badge key={r.code} color="blue" size="sm">{r.label}</Badge>)
                )}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Scope</dt>
              <dd className="text-sm text-slate-700 mt-0.5">
                {businessUnits.length > 0 || departments.length > 0
                  ? [
                      businessUnits.length > 0 && `Business Units: ${businessUnits.join(", ")}`,
                      departments.length > 0 && `Departments: ${departments.join(", ")}`,
                    ].filter(Boolean).join(" · ")
                  : "System-wide"}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Initial users</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {selectedUserIds.size === 0 ? (
                  <span className="text-sm text-slate-500">None — assign users later from the profile's Assigned Users tab.</span>
                ) : (
                  selectedUserSummaries.map((u) => (
                    <Badge key={u.id} color="slate" size="sm">{u.fullName}</Badge>
                  ))
                )}
              </dd>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs sm:text-sm text-emerald-800 flex items-start gap-2 lg:col-span-2">
              <Check className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Everything above is created in <strong>one atomic operation</strong> under a single electronic
                signature — if any step fails (e.g. a Segregation-of-Duties conflict), nothing is created.
              </span>
            </div>
          </dl>
        </FormSection>
      )}

      {/* ── Footer navigation ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button
          variant="outline-emerald"
          size="sm"
          className="whitespace-nowrap"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || creating}
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            size="sm"
            className="whitespace-nowrap"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={!canProceed}
          >
            Next
          </Button>
        ) : (
          <Button
            size="sm"
            className="whitespace-nowrap"
            onClick={() => void handleCreate()}
            disabled={creating || !stepValid(0) || !stepValid(1)}
          >
            {creating ? "Creating…" : "Create Access Profile"}
          </Button>
        )}
      </div>
    </div>
  );
};
