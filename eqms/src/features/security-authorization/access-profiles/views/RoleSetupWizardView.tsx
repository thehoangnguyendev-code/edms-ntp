import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GitBranch, Info, ListChecks, ListTodoIcon, Search, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Switch } from "@/components/ui/switch/Switch";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import { flagColor } from "@/utils/status";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FormSection } from "@/components/ui/form/FormSection";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/utils";
import { useDebounce } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { getApiErrorMessage } from "@/utils/apiError";
import { PermissionSplitExplorer } from "@/features/security-authorization/shared/explorer/PermissionSplitExplorer";
import { usePermissionCatalog } from "@/features/security-authorization/shared/usePermissionCatalog";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { applyVisibilityChoice, classifyVisibility, DOCUMENT_CONTROL_VISIBILITY_LABEL, withKnowledgePermission, type DocumentControlVisibilityChoice } from "@/features/security-authorization/access-profiles/shared/documentControlVisibility";
import { DOCUMENT_CONTROL_MODULE, RecordVisibilityForModule } from "@/features/security-authorization/access-profiles/shared/RecordVisibilityForModule";
import { MODULE_VISIBILITY, applyModuleVisibility, classifyModuleVisibility, type ModuleVisibilityDef } from "@/features/security-authorization/access-profiles/shared/moduleVisibility";
import { accessProfiles as accessProfilesBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { ROUTES } from "@/app/routes.constants";
import { settingsApi } from "@/services/api";
import { api } from "@/services/api/client";
import type { PermissionSetResponse } from "@/services/api/settings";
import type { User } from "@/types";
import { IconArrowsShuffle, IconCircles } from "@tabler/icons-react";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { moduleDisplayName } from "@/utils/moduleDisplay";
import { WizardUsersStep } from "./WizardUsersStep";
import { WizardPickerTable, type PickerPage, type PickerQuery } from "./WizardPickerTable";
import { WizardReviewStep } from "./WizardReviewStep";

/** What the fields that the system fills in say until the profile is created (the last step). */
const AFTER_CREATION = "Auto-filled after the profile is created";
const labelClass = "text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block";
const inputClass =
  "w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400";
const textareaClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400 resize-none";
const clearSelectionClass =
  "text-xs font-medium text-rose-600 transition-colors hover:text-rose-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30 rounded";

const STEPS = ["Basic Info", "Permissions", "Workflow Eligibility", "Users", "Review & Create"] as const;
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
  pagination?: { page: number; limit: number; total: number; totalPages: number };
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
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set());
  const [selectedSetDetails, setSelectedSetDetails] = useState<Map<string, PermissionSetResponse>>(new Map());
  const { permissionGroups, isLoading: catalogLoading } = usePermissionCatalog();
  const [customCodes, setCustomCodes] = useState<Set<string>>(new Set());
  // Direct permissions added next to the chosen Permission Sets (the record-visibility choice); in "custom" mode the visibility lives in customCodes.
  const [setModeCodes, setSetModeCodes] = useState<Set<string>>(new Set());
  // Every user must reach the Knowledge Base (the server refuses it without the permission), so a new profile has it unless the administrator unticks it.
  const [includeKnowledge, setIncludeKnowledge] = useState(true);

  // ── Step 3: workflow roles ────────────────────────────────────────────────
  const [selectedRoleCodes, setSelectedRoleCodes] = useState<Set<string>>(new Set());
  const [selectedRoleDetails, setSelectedRoleDetails] = useState<Map<string, WorkflowRoleCatalogEntry>>(new Map());

  // ── Step 4: initial users (optional) ──────────────────────────────────────
  // Listing users needs settings.user.view. Without it the step is informational only: the profile
  // is created unassigned and users are assigned later (the wizard route itself only needs update + assign).
  const { hasPermissionAlias } = usePermissions();
  const canListUsers = hasPermissionAlias("settings.user.view");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [selectedUserDetails, setSelectedUserDetails] = useState<Map<string, User>>(new Map());


  useEffect(() => {
    settingsApi
      .listAllAccessProfiles()
      .then((profiles) =>
        setExistingProfileNames(new Set(profiles.map((p) => p.name.trim().toLowerCase()))),
      )
      .catch(() => { /* uniqueness still enforced server-side (roles.name unique) */ });
  }, [showToast]);

  // The tables of permission sets and workflow roles ask the server for one page at a time (search, sort and pages are the server's).
  const loadPermissionSets = async ({ page, limit, search, sortBy, sortDir }: PickerQuery): Promise<PickerPage<PermissionSetResponse>> => {
    const result = await settingsApi.listPermissionSetsPaged({ page, limit, search: search || undefined, status: "ACTIVE", sortBy, sortDir });
    return { rows: result.data ?? [], total: result.pagination?.total ?? 0, totalPages: result.pagination?.totalPages ?? 1 };
  };
  const loadWorkflowRoles = async ({ page, limit, search, sortBy, sortDir }: PickerQuery): Promise<PickerPage<WorkflowRoleCatalogEntry>> => {
    const result = await api.get<WorkflowRoleCatalogPage>("/security/workflow-roles/catalog", {
      params: { page, limit, search: search || undefined, status: "ACTIVE", sortBy, sortDir },
    });
    return { rows: result.data.data ?? [], total: result.data.pagination?.total ?? 0, totalPages: result.data.pagination?.totalPages ?? 1 };
  };

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

  const toggleManySets = (sets: readonly PermissionSetResponse[], checked: boolean) => {
    setSelectedSetIds((prev) => {
      const next = new Set(prev);
      sets.forEach((set) => (checked ? next.add(set.id) : next.delete(set.id)));
      return next;
    });
    setSelectedSetDetails((prev) => {
      const next = new Map(prev);
      sets.forEach((set) => (checked ? next.set(set.id, set) : next.delete(set.id)));
      return next;
    });
  };

  const toggleManyRoles = (roles: readonly WorkflowRoleCatalogEntry[], checked: boolean) => {
    setSelectedRoleCodes((prev) => {
      const next = new Set(prev);
      roles.forEach((role) => (checked ? next.add(role.code) : next.delete(role.code)));
      return next;
    });
    setSelectedRoleDetails((prev) => {
      const next = new Map(prev);
      roles.forEach((role) => (checked ? next.set(role.code, role) : next.delete(role.code)));
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

  // Record visibility: what the chosen sets already grant cannot be lowered here; the picker edits the direct permissions of the current mode.
  const lockedVisibilityCodes = useMemo(
    () => new Set(permissionMode === "existing" ? [...selectedSetDetails.values()].flatMap((set) => set.permissionCodes ?? []) : []),
    [permissionMode, selectedSetDetails],
  );
  const directVisibilityCodes = permissionMode === "custom" ? customCodes : setModeCodes;
  const effectiveVisibilityCodes = useMemo(
    () => new Set([...lockedVisibilityCodes, ...directVisibilityCodes]),
    [lockedVisibilityCodes, directVisibilityCodes],
  );
  const chooseVisibility = (choice: DocumentControlVisibilityChoice) => {
    const next = applyVisibilityChoice(directVisibilityCodes, lockedVisibilityCodes, choice);
    if (permissionMode === "custom") setCustomCodes(next);
    else setSetModeCodes(next);
  };
  const chooseModuleVisibility = (def: ModuleVisibilityDef, choice: string) => {
    const next = applyModuleVisibility(def, directVisibilityCodes, lockedVisibilityCodes, choice);
    if (permissionMode === "custom") setCustomCodes(next);
    else setSetModeCodes(next);
  };
  // The choice of a module is shown only once the profile holds a permission of that module: under its chip in the permission picker (custom mode), or under the
  // list of sets for the modules the chosen sets and direct permissions already touch (existing-sets mode, which has no picker).
  const modulesWithRecordVisibility = useMemo(() => {
    const held = new Set(effectiveVisibilityCodes);
    const names = new Set<string>();
    for (const group of permissionGroups) {
      for (const permission of group.permissions) {
        if (held.has(permission.id)) names.add(moduleDisplayName(permission.module));
      }
    }
    return [DOCUMENT_CONTROL_MODULE, ...MODULE_VISIBILITY.map((def) => def.moduleName)].filter((name) => names.has(name));
  }, [effectiveVisibilityCodes, permissionGroups]);
  const recordVisibilityOf = (moduleName: string) => (
    <RecordVisibilityForModule
      moduleName={moduleName}
      selectedCodes={effectiveVisibilityCodes}
      lockedCodes={lockedVisibilityCodes}
      onChooseDocumentControl={chooseVisibility}
      onChooseModule={chooseModuleVisibility}
    />
  );
  const toggleManyUsers = (users: readonly User[], checked: boolean) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      users.forEach((user) => (checked ? next.add(user.id) : next.delete(user.id)));
      return next;
    });
    setSelectedUserDetails((prev) => {
      const next = new Map(prev);
      users.forEach((user) => (checked ? next.set(user.id, user) : next.delete(user.id)));
      return next;
    });
  };
  // What the review step says about who sees which records: one line for each module that has the choice and that the profile holds a permission of.
  const reviewVisibility = modulesWithRecordVisibility.map((moduleName) => {
    if (moduleName === DOCUMENT_CONTROL_MODULE) return { module: moduleName, level: DOCUMENT_CONTROL_VISIBILITY_LABEL[classifyVisibility(effectiveVisibilityCodes)] };
    const def = MODULE_VISIBILITY.find((candidate) => candidate.moduleName === moduleName);
    const value = def ? classifyModuleVisibility(def, effectiveVisibilityCodes) : null;
    return { module: moduleName, level: def?.levels.find((level) => level.value === value)?.label ?? "No access to these records" };
  });
  // The review counts distinct permissions (one that two sets both grant counts once), by the module the catalogue puts it in.
  const reviewPermissionsByModule: Record<string, number> = {};
  for (const group of permissionGroups) {
    for (const permission of group.permissions) {
      if (!effectiveVisibilityCodes.has(permission.id)) continue;
      const moduleName = moduleDisplayName(permission.module);
      reviewPermissionsByModule[moduleName] = (reviewPermissionsByModule[moduleName] ?? 0) + 1;
    }
  }
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
          permissionCodes: withKnowledgePermission(
            permissionMode === "custom" ? customCodes : setModeCodes,
            permissionMode === "existing" ? [...selectedSetDetails.values()].flatMap((set) => set.permissionCodes ?? []) : [],
            includeKnowledge,
          ),
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
        message: getApiErrorMessage(e, "Unexpected error — nothing was created."),
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
          {/* The same fields as the Access Profile Details page; what the system fills in after the profile is created is shown as a placeholder. */}
          <div className="grid grid-cols-1 gap-3 md:gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>Created By</label>
              <input className={cn(inputClass, CONTROL_STATE_CLASSES.readonly)} disabled placeholder={AFTER_CREATION} />
            </div>
            <div>
              <label className={labelClass}>Created Time</label>
              <input className={cn(inputClass, CONTROL_STATE_CLASSES.readonly)} disabled placeholder={AFTER_CREATION} />
            </div>

            <div>
              <label className={labelClass}>
                Profile Name <span className="text-red-500">*</span>
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
              <label className={labelClass}>Code (Immutable)</label>
              <input className={cn(inputClass, CONTROL_STATE_CLASSES.readonly)} disabled placeholder={AFTER_CREATION} />
            </div>

            <div>
              <label className={labelClass}>Type</label>
              <div className="flex h-9 items-center">
                <Badge color="teal" size="sm">Custom</Badge>
              </div>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <div className="flex h-9 items-center gap-2.5">
                <Switch checked onChange={() => {}} disabled size="sm" />
                <Badge size="sm" color={flagColor(true)}>Active</Badge>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>Description</label>
              <textarea
                className={textareaClass}
                rows={3}
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
          <div className="mb-4">
            <Checkbox
              checked={includeKnowledge}
              onChange={setIncludeKnowledge}
              label="Allow reading Effective documents in the Knowledge Base"
            />
          </div>
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
              <WizardPickerTable<PermissionSetResponse>
                load={loadPermissionSets}
                getId={(set) => set.id}
                defaultSort={{ key: "name", direction: "asc" }}
                selectedIds={selectedSetIds}
                onToggle={toggleSet}
                onToggleMany={toggleManySets}
                onClear={() => { setSelectedSetIds(new Set()); setSelectedSetDetails(new Map()); }}
                searchPlaceholder="Search permission sets by name, code, description…"
                noun="permission set"
                requiredHint="Select at least one permission set"
                emptyTitle="No permission sets found"
                columns={({ sortOf, offset }) => [
                  { id: "no", header: "No.", label: "No.", locked: true, headerClassName: "w-14", cellClassName: "w-14 text-xs tabular-nums text-slate-500", cell: (_set, index) => offset + index + 1 },
                  { id: "name", header: "Permission Set", label: "Permission Set", sort: sortOf("name"), cellClassName: "font-medium text-slate-900", cell: (set) => set.name },
                  { id: "type", header: "Type", label: "Type", sort: sortOf("type"), cell: (set) => <Badge color={set.system ? "blue" : "teal"} size="sm">{set.system ? "System" : "Custom"}</Badge> },
                  { id: "permissionCount", header: "Permissions", label: "Permissions", sort: sortOf("permissionCount"), cellClassName: "tabular-nums", cell: (set) => set.permissionCount },
                  { id: "description", header: "Description", label: "Description", cellClassName: "min-w-[20rem] max-w-[34rem] !whitespace-normal text-xs text-slate-600", cell: (set) => set.description || "—" },
                ]}
              />
              {modulesWithRecordVisibility.map((moduleName) => (
                <div key={moduleName}>
                  <p className="mb-1.5 text-xs font-medium text-slate-600">{moduleName}</p>
                  {recordVisibilityOf(moduleName)}
                </div>
              ))}
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
                moduleExtras={recordVisibilityOf}
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
          <WizardPickerTable<WorkflowRoleCatalogEntry>
            load={loadWorkflowRoles}
            getId={(role) => role.code}
            defaultSort={{ key: "displayOrder", direction: "asc" }}
            selectedIds={selectedRoleCodes}
            onToggle={toggleRole}
            onToggleMany={toggleManyRoles}
            onClear={() => { setSelectedRoleCodes(new Set()); setSelectedRoleDetails(new Map()); }}
            searchPlaceholder="Search workflow roles by name, code, module…"
            noun="workflow role"
            noneSelectedHint="Optional — leave empty if users with this profile are not to be considered for any workflow capacity."
            emptyTitle="No workflow roles found"
            columns={({ sortOf, offset }) => [
              { id: "no", header: "No.", label: "No.", locked: true, headerClassName: "w-14", cellClassName: "w-14 text-xs tabular-nums text-slate-500", cell: (_role, index) => offset + index + 1 },
              { id: "label", header: "Workflow Role", label: "Workflow Role", sort: sortOf("label"), cellClassName: "font-medium text-slate-900", cell: (role) => role.label },
              { id: "code", header: "Code", label: "Code", sort: sortOf("code"), cellClassName: "font-mono text-2xs text-slate-600 md:text-xs", cell: (role) => role.code },
              { id: "moduleKey", header: "Module", label: "Module", sort: sortOf("moduleKey"), cell: (role) => <Badge color="slate" size="sm">{moduleDisplayName(role.moduleKey)}</Badge> },
              { id: "description", header: "Description", label: "Description", cellClassName: "min-w-[18rem] max-w-[32rem] !whitespace-normal text-xs text-slate-600", cell: (role) => role.description || "—" },
            ]}
          />
        </FormSection>
      )}

      {/* ── Step 4: Users (optional) ── */}
      {step === 3 && (
        <FormSection
          title="Who should receive this Access Profile?"
          icon={<Users className="h-4 w-4" />}
          description="Optional — assignments are created together with the Access Profile under the same signature. You can always assign more users later. Segregation-of-Duties conflicts are checked per user and block the whole creation."
          contentClassName="p-4 md:p-5"
        >
          <WizardUsersStep
            canListUsers={canListUsers}
            selectedIds={selectedUserIds}
            onToggle={toggleUser}
            onToggleMany={toggleManyUsers}
            onClear={() => { setSelectedUserIds(new Set()); setSelectedUserDetails(new Map()); }}
          />
        </FormSection>
      )}

      {/* ── Step 5: Review ── */}
      {step === 4 && (
        <WizardReviewStep
          name={name.trim()}
          description={description.trim()}
          permissionMode={permissionMode}
          sets={selectedSetSummaries.map((set) => ({ id: set.id, name: set.name, count: set.permissionCount }))}
          permissionTotal={effectiveVisibilityCodes.size}
          permissionsByModule={reviewPermissionsByModule}
          visibility={reviewVisibility}
          roles={selectedRoleSummaries.map((role) => ({ code: role.code, label: role.label, module: role.moduleKey }))}
          users={selectedUserSummaries.map((user) => ({ id: user.id, fullName: user.fullName, employeeCode: user.employeeCode, department: user.department, avatar: user.avatar }))}
          onEdit={setStep}
        />
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
