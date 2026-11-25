import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { useFormDirty } from "@/hooks/useFormDirty";
import React, { useEffect, useMemo, useState } from "react";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Shield,
  ShieldCheck,
  Fingerprint,
  Grid3x3,
  Layers3,
  LayoutTemplate,
  ListOrdered,
  Plus,
  TextCursorInput,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { Switch } from "@/components/ui/switch/Switch";
import { FormSection } from "@/components/ui/form/FormSection";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { cn } from "@/components/ui/utils";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { navigateBack } from "@/app/navigation/backNavigation";
import { workflowActionPolicyApi } from "@/services/api/workflowActionPolicy";
import {
  lifecycleStatePolicyApi,
  type LifecycleStatePolicy,
  type LifecycleStatePolicyOptions,
} from "@/services/api/lifecycleStatePolicy";
import { lifecyclePoliciesSubPage } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { WorkflowPolicyActorSelector } from "../components/WorkflowPolicyActorSelector";
import { WorkflowPolicyDiffModal } from "../components/WorkflowPolicyDiffModal";
import { PolicyRuleLayout, type PolicyLayoutMode } from "../components/PolicyRuleLayouts";
import { extractApiError } from "../workflowPolicyUtils";
import { PermissionSplitExplorer } from "@/features/security-authorization/shared/explorer/PermissionSplitExplorer";
import { usePermissionCatalog } from "@/features/security-authorization/shared/usePermissionCatalog";
import { MultiSelect } from "@/components/ui/select/MultiSelect";
import {
  securityApi,
  type AuthorizationRelationDefinition,
} from "@/services/api/security";
import type {
  WorkflowActionPolicy,
  WorkflowActionPolicyActorRequest,
  WorkflowActionPolicyOptions,
  WorkflowActionPolicyPreviewResponse,
} from "../types";
import { IconHierarchy, IconSection } from "@tabler/icons-react";
import { moduleDisplayName } from "@/utils/moduleDisplay";
import { tr, trFormat } from "@/i18n";

const VIEW_PERM = "security.workflow_authorization.view";
const MANAGE_PERM = "security.workflow_authorization.manage";

// ── Shared "common fields" block ────────────────────────────────────────────
// Priority / Active / Description / Change Reason — identical shape for both
// transition (workflow action) policies and capability (lifecycle state)
// policies. Kept as a single block per the merge plan instead of duplicating
// the JSX in each branch.
interface CommonFieldsProps {
  priority: number | string;
  onPriorityChange: (value: string) => void;
  active: boolean;
  onActiveChange: (value: boolean) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  showChangeReason: boolean;
  changeReason: string;
  onChangeReasonChange: (value: string) => void;
}

const LifecyclePolicyCommonFields: React.FC<CommonFieldsProps> = ({
  priority,
  onPriorityChange,
  active,
  onActiveChange,
  description,
  onDescriptionChange,
  showChangeReason,
  changeReason,
  onChangeReasonChange,
}) => (
  <>
    <div>
      <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block capitalize">
        {tr("Priority")}
      </label>
      <input
        type="number"
        value={priority}
        onChange={(e) => onPriorityChange(e.target.value)}
        min={1}
        max={999}
        className="h-9 w-full border border-slate-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
      />
    </div>

    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-slate-700">{tr("Active")}</span>
      <Switch checked={active} onChange={onActiveChange} />
    </div>

    <div>
      <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block capitalize">
        {tr("Description")}
      </label>
      <textarea
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        rows={2}
        placeholder={tr("Optional description...")}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
      />
    </div>

    {showChangeReason && (
      <div>
        <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block capitalize">
          {tr("Change Reason")}
        </label>
        <input
          type="text"
          value={changeReason}
          onChange={(e) => onChangeReasonChange(e.target.value)}
          placeholder={tr("Optional reason for this change...")}
          className="h-9 w-full border border-slate-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>
    )}
  </>
);

// ── Transition (workflow action policy) form ────────────────────────────────
// Body copied unchanged from the former WorkflowPolicyFormView, only the
// Priority/Active/Description/Change Reason block was swapped for the shared
// component above. No filter/validation/save logic was altered.
type TransitionMode = "create" | "edit" | "override";

interface TransitionFormState {
  moduleKey: string;
  workflowKey: string;
  objectType: string;
  actionCode: string;
  fromStatus: string;
  documentTypeId: string;
  requiredPermissionCode: string;
  priority: string;
  active: boolean;
  description: string;
  actors: WorkflowActionPolicyActorRequest[];
  changeReason: string;
}

function initTransitionForm(
  mode: TransitionMode,
  policy?: WorkflowActionPolicy | null,
): TransitionFormState {
  if (mode === "create") {
    return {
      moduleKey: "DOCUMENT_CONTROL",
      workflowKey: "",
      objectType: "",
      actionCode: "",
      fromStatus: "",
      documentTypeId: "",
      requiredPermissionCode: "",
      priority: "100",
      active: true,
      description: "",
      actors: [],
      changeReason: "",
    };
  }
  return {
    moduleKey: policy?.moduleKey ?? "DOCUMENT_CONTROL",
    workflowKey: policy?.workflowKey ?? "",
    objectType: policy?.objectType ?? "",
    actionCode: policy?.actionCode ?? "",
    fromStatus: policy?.fromStatus ?? "",
    documentTypeId: policy?.documentTypeId ?? "",
    requiredPermissionCode: policy?.requiredPermissionCode ?? "",
    priority: String(policy?.priority ?? 100),
    active: policy?.active ?? true,
    description: policy?.description ?? "",
    actors: (policy?.actors ?? []).map((a) => ({
      actorType: a.actorType,
      actorCode: a.actorCode ?? null,
    })),
    changeReason: "",
  };
}

/** The four ways to fill the same policy in. The choice is the person's habit, so it is remembered in this browser. */
const POLICY_LAYOUT_TABS: readonly TabItem[] = [
  { id: "sentence", label: "Sentence", icon: TextCursorInput },
  { id: "steps", label: "Steps", icon: ListOrdered },
  { id: "matrix", label: "Matrix", icon: Grid3x3 },
  { id: "templates", label: "Templates", icon: LayoutTemplate },
];
const POLICY_LAYOUT_KEY = "eqms.policy-form.layout";

const readOnlyField = (label: string, value: string) => (
  <div>
    <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block capitalize">
      {label}
    </label>
    <div className="h-9 flex items-center px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
      {value || "(none)"}
    </div>
  </div>
);

const TransitionPolicyForm: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isOverrideRoute = searchParams.get("mode") === "override";
  const mode: TransitionMode = id
    ? isOverrideRoute
      ? "override"
      : "edit"
    : "create";

  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias(MANAGE_PERM);
  const { requestSignature, signatureModal } = useSecurityESign();

  const [options, setOptions] = useState<WorkflowActionPolicyOptions | null>(
    null,
  );
  const [sourcePolicy, setSourcePolicy] = useState<WorkflowActionPolicy | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<TransitionFormState>(() =>
    initTransitionForm(mode),
  );
  const [saving, setSaving] = useState(false);
  const [actorError, setActorError] = useState<string | undefined>();
  const [preview, setPreview] =
    useState<WorkflowActionPolicyPreviewResponse | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [confirmingSave, setConfirmingSave] = useState(false);
  const [storedLayout, setStoredLayout] = useLocalStorage<PolicyLayoutMode>(POLICY_LAYOUT_KEY, "sentence");
  const layout: PolicyLayoutMode = POLICY_LAYOUT_TABS.some((tab) => tab.id === storedLayout) ? storedLayout : "sentence";
  // Every policy now configured: the layouts say when the one being written meets another.
  const [existingPolicies, setExistingPolicies] = useState<WorkflowActionPolicy[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      workflowActionPolicyApi.getOptions(),
      id ? workflowActionPolicyApi.getPolicy(id) : Promise.resolve(null),
      workflowActionPolicyApi.listPolicies().catch(() => [] as WorkflowActionPolicy[]),
    ])
      .then(([opts, policy, policies]) => {
        if (cancelled) return;
        setOptions(opts);
        setSourcePolicy(policy);
        setExistingPolicies(policies);
        setForm(initTransitionForm(mode, policy));
      })
      .catch(() => {
        if (!cancelled)
          showToast({
            type: "error",
            message: tr("Failed to load workflow policy data"),
          });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mode]);

  // Leaving with a change that was not saved asks first (Cancel, the breadcrumb, the sidebar, a reload); the move after a successful Save is not a leave.
  const { isDirty } = useFormDirty(form, !loading);
  const { go, modal: leaveModal } = useLeaveGuard(isDirty, mode === "create" ? tr("New Transition Policy") : tr("Edit Transition Policy"), "the previous page");
  // Opened from nowhere (a link, a reload): an edit goes back to the details of the policy, a new policy to the list.
  const fallbackRoute = id && mode === "edit" ? `/security/lifecycle-policies/${id}` : `/security/lifecycle-policies?tab=transitions`;
  const handleBack = () => navigateBack(go, location.state, fallbackRoute);
  const leaveAfterSave = () => navigateBack(navigate, location.state, fallbackRoute);

  const setField = <K extends keyof TransitionFormState>(
    key: K,
    value: TransitionFormState[K],
  ) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "workflowKey") {
        next.objectType = "";
        next.actionCode = "";
        next.fromStatus = "";
        next.requiredPermissionCode = "";
        next.actors = [];
      }
      if (key === "objectType") {
        next.actionCode = "";
        next.fromStatus = "";
        next.actors = [];
      }
      if (key === "actionCode") {
        const selectedAction = options?.actions?.find(
          (a) =>
            a.value === (value as string) &&
            (!prev.workflowKey || a.workflowKey === prev.workflowKey),
        );
        const statuses = selectedAction?.defaultFromStatuses ?? [];
        if (statuses.length === 1) {
          next.fromStatus = statuses[0];
        } else if (statuses.length > 0 && !statuses.includes(prev.fromStatus)) {
          next.fromStatus = "";
        }
        if (
          !prev.requiredPermissionCode &&
          selectedAction?.requiredPermissionCandidates?.length
        ) {
          next.requiredPermissionCode =
            selectedAction.requiredPermissionCandidates[0];
        }
      }
      return next;
    });
  };

  const moduleOptions: SelectOption[] = [
    { label: tr("Select module"), value: "" },
    ...(options?.modules ?? []).map((m) => ({ label: moduleDisplayName(m), value: m })),
  ];
  const workflowOptions: SelectOption[] = [
    { label: tr("Select workflow"), value: "" },
    ...(options?.workflowOptions?.length
      ? options.workflowOptions
      : (options?.workflows ?? []).map((value) => ({
          value,
          label: value,
          moduleKey: "",
        }))
    ).map((workflow) => ({ label: workflow.label, value: workflow.value })),
  ];
  const objectTypeOptions: SelectOption[] = useMemo(() => {
    const base = [{ label: tr("Select object type"), value: "" }];
    if (!form.workflowKey || !options?.actions?.length) {
      return [
        ...base,
        ...(options?.objectTypes ?? []).map((o) => ({ label: o, value: o })),
      ];
    }
    const typesForWorkflow = [
      ...new Set(
        options.actions
          .filter((a) => a.workflowKey === form.workflowKey)
          .map((a) => a.objectType ?? ""),
      ),
    ]
      .filter(Boolean)
      .sort();
    return [...base, ...typesForWorkflow.map((o) => ({ label: o, value: o }))];
  }, [form.workflowKey, options]);
  const actionOptions: SelectOption[] = useMemo(() => {
    const base = [{ label: tr("Select action"), value: "" }];
    const allActions = options?.actions ?? [];
    const relevant = form.workflowKey
      ? allActions.filter(
          (a) =>
            a.workflowKey === form.workflowKey &&
            (!form.objectType ||
              a.objectType === form.objectType ||
              !a.objectType),
        )
      : allActions;
    const seen = new Set<string>();
    const deduped = relevant.filter((a) => {
      if (seen.has(a.value)) return false;
      seen.add(a.value);
      return true;
    });
    return [
      ...base,
      ...deduped.map((a) => ({ label: a.label || a.value, value: a.value })),
    ];
  }, [form.workflowKey, form.objectType, options]);
  const docTypeOptions: SelectOption[] = [
    { label: tr("None (global)"), value: "" },
    ...(options?.documentTypes ?? []).map((d) => ({
      label: d.name,
      value: d.id,
    })),
  ];

  const selectedAction = useMemo(
    () =>
      options?.actions?.find(
        (a) =>
          a.value === form.actionCode &&
          (!form.workflowKey || a.workflowKey === form.workflowKey),
      ),
    [form.actionCode, form.workflowKey, options],
  );

  const fromStatusOptions: SelectOption[] = useMemo(() => {
    const statuses = selectedAction?.defaultFromStatuses ?? [];
    return statuses.length === 0
      ? []
      : statuses.map((s) => ({ label: s, value: s }));
  }, [selectedAction]);

  const allowedActorTypes = useMemo(() => {
    const allTypes = options?.actorTypes ?? [];
    if (!form.actionCode || !options?.actions?.length) return allTypes;
    const action = options.actions.find((a) => a.value === form.actionCode);
    if (!action?.allowedActorTypes?.length) return allTypes;
    return allTypes.filter((t) => action.allowedActorTypes!.includes(t.value));
  }, [form.actionCode, options]);

  // The actors are read at runtime by one step only, REQUEST_COPY of a Controlled Copy; every other policy is decided by the permission, the relations and the state.
  const actorsRelevant = form.objectType === "CONTROLLED_COPY" && form.actionCode === "REQUEST_COPY";

  const invalidActorIndices = useMemo(() => {
    const allowedSet = new Set(allowedActorTypes.map((t) => t.value));
    return form.actors.reduce<number[]>((acc, a, i) => {
      if (!allowedSet.has(a.actorType)) acc.push(i);
      return acc;
    }, []);
  }, [form.actors, allowedActorTypes]);

  const removeInvalidActors = () => {
    const invalidSet = new Set(invalidActorIndices);
    setField(
      "actors",
      form.actors.filter((_, i) => !invalidSet.has(i)),
    );
  };

  const fieldRO = (field: keyof TransitionFormState): boolean => {
    if (mode === "create") return false;
    if (mode === "override") {
      return ![
        "documentTypeId",
        "requiredPermissionCode",
        "priority",
        "active",
        "description",
        "actors",
        "changeReason",
      ].includes(field as string);
    }
    // edit mode: key identity fields are locked
    return [
      "moduleKey",
      "workflowKey",
      "objectType",
      "actionCode",
      "fromStatus",
    ].includes(field as string);
  };

  function buildRequest() {
    return {
      requiredPermissionCode: form.requiredPermissionCode,
      priority: parseInt(form.priority, 10) || 100,
      active: form.active,
      description: form.description || null,
      documentTypeId: form.documentTypeId || null,
      actors: actorsRelevant ? form.actors : [],
      changeReason: form.changeReason || undefined,
    };
  }

  function validate(): boolean {
    if (mode === "create" && !form.fromStatus) {
      showToast({
        type: "warning",
        title: tr("Validation"),
        message: tr("From Status is required for the selected action."),
      });
      return false;
    }
    if (!form.requiredPermissionCode) {
      showToast({
        type: "warning",
        title: tr("Validation"),
        message: tr("Required permission is mandatory."),
      });
      return false;
    }
    if (actorsRelevant && form.actors.length === 0) {
      setActorError("At least one actor is required.");
      return false;
    }
    if (actorsRelevant && invalidActorIndices.length > 0) {
      setActorError(
        "Remove actors that are not allowed for the selected action before saving.",
      );
      return false;
    }
    setActorError(undefined);
    return true;
  }

  const handlePreview = async () => {
    if (!validate()) return;
    if (!sourcePolicy?.id) return;
    setSaving(true);
    try {
      const result = await workflowActionPolicyApi.previewUpdate(
        sourcePolicy.id,
        buildRequest(),
      );
      setPreview(result);
      setShowDiff(true);
    } catch (err) {
      const { message } = extractApiError(err);
      showToast({ type: "error", title: tr("Preview Failed"), message });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!sourcePolicy?.id || !preview) return;
    const sig = await requestSignature(
      "Update Workflow Authorization Policy",
      "Workflow Authorization Change",
    );
    if (!sig) return;
    setConfirmingSave(true);
    try {
      await workflowActionPolicyApi.updatePolicy(sourcePolicy.id, {
        ...buildRequest(),
        signatureToken: sig.signatureToken,
        changeReason: sig.reason ?? form.changeReason ?? undefined,
      });
      showToast({
        type: "success",
        title: tr("Policy Updated"),
        message: tr("Policy saved successfully."),
      });
      setShowDiff(false);
      leaveAfterSave();
    } catch (err) {
      const { message } = extractApiError(err);
      showToast({ type: "error", title: tr("Save Failed"), message });
    } finally {
      setConfirmingSave(false);
    }
  };

  const handleDirectSave = async () => {
    if (!validate()) return;
    const sig = await requestSignature(
      mode === "create"
        ? tr("Create Workflow Authorization Policy")
        : tr("Create Document-Type Override"),
      "Workflow Authorization Change",
    );
    if (!sig) return;
    setSaving(true);
    try {
      if (mode === "create") {
        if (
          !form.moduleKey ||
          !form.workflowKey ||
          !form.actionCode ||
          !form.fromStatus
        ) {
          showToast({
            type: "warning",
            title: tr("Validation"),
            message: tr("All key fields are required."),
          });
          setSaving(false);
          return;
        }
        await workflowActionPolicyApi.createPolicy({
          ...buildRequest(),
          signatureToken: sig.signatureToken,
          moduleKey: form.moduleKey,
          workflowKey: form.workflowKey,
          objectType: form.objectType,
          actionCode: form.actionCode,
          fromStatus: form.fromStatus,
        });
        showToast({
          type: "success",
          title: tr("Policy Created"),
          message: tr("Policy created successfully."),
        });
      } else if (mode === "override") {
        if (!sourcePolicy?.id) {
          setSaving(false);
          return;
        }
        if (!form.documentTypeId) {
          showToast({
            type: "warning",
            title: tr("Validation"),
            message: tr("Document type is required for an override."),
          });
          setSaving(false);
          return;
        }
        await workflowActionPolicyApi.createDocumentTypeOverride(
          sourcePolicy.id,
          { ...buildRequest(), signatureToken: sig.signatureToken },
        );
        showToast({
          type: "success",
          title: tr("Override Created"),
          message: tr("Document-type override created."),
        });
      }
      leaveAfterSave();
    } catch (err) {
      const { message } = extractApiError(err);
      showToast({ type: "error", title: tr("Save Failed"), message });
    } finally {
      setSaving(false);
    }
  };

  const titleMap: Record<TransitionMode, string> = {
    create: "New Transition Policy",
    edit: "Edit Transition Policy",
    override: "Create Document-Type Override",
  };

  const breadcrumbItems = lifecyclePoliciesSubPage(
    go,
    "Transition Policies",
    titleMap[mode],
  );

  if (loading) {
    return <FullPageLoading text="Loading workflow policy..." />;
  }

  const permissionField = (
    <RequiredPermissionPicker
      label={tr("Required Permission")}
      required
      value={form.requiredPermissionCode}
      onChange={(v) => setField("requiredPermissionCode", v)}
      options={(options?.permissions ?? []).map((p) => ({
        label: `${p.name} (${p.code})`,
        value: p.code,
      }))}
    />
  );

  const actorsField = (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-slate-700 sm:text-sm">
          {tr("Actors")}<span className="ml-0.5 font-semibold text-red-500" aria-hidden="true">*</span>
        </label>
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={allowedActorTypes.length === 0}
          onClick={() => {
            const defaultType = allowedActorTypes[0]?.value;
            if (!defaultType) return;
            setField("actors", [...form.actors, { actorType: defaultType, actorCode: null }]);
            setActorError(undefined);
          }}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          {tr("Add Actor")}
        </Button>
      </div>
      {invalidActorIndices.length > 0 && (
        <WarningBanner
          variant="error"
          className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
        >
          <span>
            <span className="font-semibold">
              {trFormat("{count} actors not allowed for the selected action.", { count: invalidActorIndices.length })}
            </span>{" "}
            {tr("Remove them before saving.")}
          </span>
          <button
            type="button"
            onClick={removeInvalidActors}
            className="whitespace-nowrap text-xs font-medium underline hover:text-red-900"
          >
            {tr("Remove invalid actors")}
          </button>
        </WarningBanner>
      )}
      <WorkflowPolicyActorSelector
        actors={form.actors}
        onChange={(actors) => {
          setField("actors", actors);
          setActorError(undefined);
        }}
        allowedActorTypes={allowedActorTypes}
        actorCodeOptions={options?.actorCodeOptions}
        invalidIndices={invalidActorIndices}
        error={actorError}
      />
    </div>
  );

  const optionsSection = (
    <FormSection title={tr("Options")} icon={<Layers3 className="h-4 w-4" />} contentClassName="p-4 md:p-5">
      <div className="flex flex-col gap-4">
        {mode === "override" ? (
          <Select
            label={tr("Document Type *")}
            value={form.documentTypeId}
            onChange={(v) => setField("documentTypeId", v)}
            options={docTypeOptions.filter((o) => o.value !== "")}
          />
        ) : (
          <Select
            label={tr("Document Type")}
            value={form.documentTypeId}
            onChange={(v) => setField("documentTypeId", v)}
            options={docTypeOptions}
          />
        )}
        <LifecyclePolicyCommonFields
          priority={form.priority}
          onPriorityChange={(v) => setField("priority", v)}
          active={form.active}
          onActiveChange={(v) => setField("active", v)}
          description={form.description}
          onDescriptionChange={(v) => setField("description", v)}
          showChangeReason={mode === "edit"}
          changeReason={form.changeReason}
          onChangeReasonChange={(v) => setField("changeReason", v)}
        />
      </div>
    </FormSection>
  );

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
        <Shield className="h-12 w-12 text-slate-300" />
        <p className="text-lg font-semibold">{tr("Access Denied")}</p>
        <p className="text-sm">
          {tr("You do not have permission to manage Workflow Authorization policies.")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {leaveModal}
      {signatureModal}
      <PageHeader
        title={titleMap[mode]}
        breadcrumbItems={breadcrumbItems}
        actions={
          <>
            <Button
              variant="outline-emerald"
              size="sm"
              onClick={handleBack}
              className="whitespace-nowrap"
            >
              {tr("Cancel")}
            </Button>
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() =>
                void (mode === "edit" ? handlePreview() : handleDirectSave())
              }
              disabled={saving}
              className="whitespace-nowrap"
            >
              {saving
                ? "Saving…"
                : mode === "edit"
                  ? tr("Preview Changes")
                  : "Save"}
            </Button>
          </>
        }
      />

      {mode === "override" && (
        <WarningBanner variant="info">{tr("This override applies only to the selected document type. If no override matches, runtime uses the global policy.")}</WarningBanner>
      )}
      {sourcePolicy?.system && mode === "edit" && (
        <WarningBanner variant="warning">
          {tr("This is a system policy. Key identity fields cannot be changed. The permission and the options can be reconfigured.")}
        </WarningBanner>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs font-medium text-slate-500">{tr("Fill it in as")}</span>
        <TabNav
          tabs={POLICY_LAYOUT_TABS}
          activeTab={layout}
          onChange={(value) => setStoredLayout(value as PolicyLayoutMode)}
          variant="pill"
          ariaLabel="How the policy is filled in"
          className="!w-auto"
        />
      </div>

      <PolicyRuleLayout
        layout={layout}
        props={{
          mode,
          form,
          setField,
          locked: fieldRO,
          options,
          moduleOptions,
          workflowOptions,
          objectTypeOptions,
          actionOptions,
          fromStatusOptions,
          allowedActorTypes,
          existing: existingPolicies,
          sourcePolicyId: sourcePolicy?.id,
          permissionField,
          actorsField,
          optionsSection,
          actorsRelevant,
        }}
      />

      {sourcePolicy?.id && (
        <PolicyRelationsSection
          policy={sourcePolicy}
          objectType={form.objectType}
          onSaved={setSourcePolicy}
        />
      )}

      {showDiff && (
        <WorkflowPolicyDiffModal
          isOpen={showDiff}
          onClose={() => setShowDiff(false)}
          onConfirm={handleConfirmSave}
          preview={preview}
          isLoading={confirmingSave}
        />
      )}
    </div>
  );
};

// ── Relations (new hybrid engine) section ───────────────────────────────────
// What ResourceAuthorizationAdapters actually read once a resource type's cutover flag is on,
// independent of the Actors list above (see AuthorizationEngineService). Only editable for
// existing policies -- relations attach to a policy id, so there's nothing to configure on create.
const PolicyRelationsSection: React.FC<{
  policy: WorkflowActionPolicy;
  objectType: string;
  onSaved: (policy: WorkflowActionPolicy) => void;
}> = ({ policy, objectType, onSaved }) => {
  const { showToast } = useToast();
  const { requestSignature, signatureModal } = useSecurityESign();
  const [relationDefs, setRelationDefs] = useState<
    AuthorizationRelationDefinition[]
  >([]);
  const [selectedRelationIds, setSelectedRelationIds] = useState<string[]>(
    (policy.relations ?? []).filter((r) => !r.forbidden).map((r) => r.relationDefinitionId),
  );
  const [forbiddenRelationIds, setForbiddenRelationIds] = useState<string[]>(
    (policy.relations ?? []).filter((r) => r.forbidden).map((r) => r.relationDefinitionId),
  );
  const [savingForbidden, setSavingForbidden] = useState(false);
  const [matchRule, setMatchRule] = useState<"ANY" | "ALL">(
    policy.relationMatchRule === "ALL" ? "ALL" : "ANY",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    securityApi
      .getAuthorizationRelationDefinitions(objectType)
      .then(setRelationDefs)
      .catch(() => setRelationDefs([]));
  }, [objectType]);

  const relationOptions = relationDefs.map((d) => ({
    label: `${d.displayName} (${d.code})`,
    value: d.id,
  }));

  const save = async () => {
    const sig = await requestSignature(
      "Update Workflow Policy Relations",
      "Workflow Authorization Change",
    );
    if (!sig) return;
    setSaving(true);
    try {
      const updated = await workflowActionPolicyApi.setPolicyRelations(
        policy.id,
        {
          relationDefinitionIds: selectedRelationIds,
          relationMatchRule: matchRule,
        },
        sig,
      );
      onSaved(updated);
      showToast({ type: "success", message: tr("Policy relations updated.") });
    } catch (err) {
      const { message } = extractApiError(err);
      showToast({ type: "error", title: tr("Save Failed"), message });
    } finally {
      setSaving(false);
    }
  };

  const saveForbidden = async () => {
    const sig = await requestSignature(
      "Update Workflow Policy Forbidden Relations",
      "Workflow Authorization Change",
    );
    if (!sig) return;
    setSavingForbidden(true);
    try {
      const updated = await workflowActionPolicyApi.setForbiddenRelations(policy.id, { relationDefinitionIds: forbiddenRelationIds }, sig);
      onSaved(updated);
      showToast({ type: "success", message: tr("Forbidden relations updated.") });
    } catch (err) {
      const { message } = extractApiError(err);
      showToast({ type: "error", title: tr("Save Failed"), message });
    } finally {
      setSavingForbidden(false);
    }
  };

  return (
    <FormSection
      title={tr("Relations (New Engine)")}
      icon={<IconHierarchy className="h-4 w-4" />}
      contentClassName="p-4 md:p-5"
    >
      <div className="flex flex-col gap-4">
        <MultiSelect
          label={`Relations (resource type: ${objectType})`}
          value={selectedRelationIds}
          onChange={(values) => setSelectedRelationIds(values.map(String))}
          options={relationOptions}
          enableSearch
        />
        <Select
          label={tr("Match Rule")}
          value={matchRule}
          onChange={(v) => setMatchRule(v as "ANY" | "ALL")}
          options={[
            { label: tr("ANY — actor needs at least one relation"), value: "ANY" },
            { label: tr("ALL — actor needs every relation"), value: "ALL" },
          ]}
        />
        <div>
          <Button
            size="sm"
            variant="outline-emerald"
            onClick={() => void save()}
            disabled={saving}
            className="whitespace-nowrap"
          >
            {saving ? "Saving…" : tr("Save Relations")}
          </Button>
        </div>
        <MultiSelect
          label={tr("Forbidden relations (a different person)")}
          value={forbiddenRelationIds}
          onChange={(values) => setForbiddenRelationIds(values.map(String))}
          options={relationOptions}
          enableSearch
        />
        <p className="text-xs text-slate-500">{tr("An actor who holds any of these relations on the record is refused, even with the permission (for example the author of a version cannot approve it).")}</p>
        <div>
          <Button
            size="sm"
            variant="outline-emerald"
            onClick={() => void saveForbidden()}
            disabled={savingForbidden}
            className="whitespace-nowrap"
          >
            {savingForbidden ? "Saving…" : tr("Save Forbidden Relations")}
          </Button>
        </div>
      </div>
      {signatureModal}
    </FormSection>
  );
};

// ── Required Permission picker ──────────────────────────────────────────────
interface PermissionPickerOption {
  label: string;
  value: string;
}

const RequiredPermissionPicker: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: PermissionPickerOption[];
  label?: string;
  required?: boolean;
}> = ({
  value,
  onChange,
  options,
  label = "Required Permission",
  required = false,
}) => {
  const { permissionGroups, isLoading } = usePermissionCatalog();
  const allowedCodes = useMemo(
    () => new Set(options.map((option) => option.value)),
    [options],
  );
  const groups = useMemo(
    () =>
      permissionGroups
        .map((group) => ({
          ...group,
          permissions: group.permissions.filter((permission) =>
            allowedCodes.has(permission.id),
          ),
        }))
        .filter((group) => group.permissions.length > 0),
    [permissionGroups, allowedCodes],
  );
  const selectedCodes = useMemo(
    () => (value ? new Set([value]) : new Set<string>()),
    [value],
  );
  return (
    <div>
      <div className="mb-1.5">
        <label className="text-xs sm:text-sm font-medium text-slate-700 capitalize">
          {label}
          {required && <span className="ml-0.5 font-semibold text-red-500" aria-hidden="true">*</span>}
        </label>
      </div>
      <div>
        <PermissionSplitExplorer
          groups={groups}
          selectedCodes={selectedCodes}
          selectionMode="single"
          isLoading={isLoading}
          onToggle={(code, checked) => onChange(checked ? code : "")}
        />
      </div>
    </div>
  );
};

// ── Capability (lifecycle state policy) form ────────────────────────────────
// Body copied unchanged from the former StatePolicyFormView, only the
// Priority/Active/Description/Change Reason block was swapped for the shared
// component above. No validation/save logic was altered.
const CapabilityPolicyForm: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias(
    "security.workflow_authorization.manage",
  );
  const { requestSignature, signatureModal } = useSecurityESign();

  const [options, setOptions] = useState<LifecycleStatePolicyOptions | null>(
    null,
  );
  const [initial, setInitial] = useState<LifecycleStatePolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [capabilityCode, setCapabilityCode] = useState("");
  const [statusCode, setStatusCode] = useState("");
  const [documentTypeId, setDocumentTypeId] = useState("");
  const [actorScope, setActorScope] = useState("");
  const [requiredPermissionCode, setRequiredPermissionCode] = useState("");
  const [priority, setPriority] = useState(100);
  const [active, setActive] = useState(true);
  const [description, setDescription] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      lifecycleStatePolicyApi.getOptions(),
      id ? lifecycleStatePolicyApi.get(id) : Promise.resolve(null),
    ])
      .then(([opts, policy]) => {
        if (cancelled) return;
        setOptions(opts);
        if (policy) {
          setInitial(policy);
          setCapabilityCode(policy.capabilityCode);
          setStatusCode(policy.statusCode ?? "");
          setDocumentTypeId(policy.documentTypeId ?? "");
          setActorScope(policy.actorScope);
          setRequiredPermissionCode(policy.requiredPermissionCode ?? "");
          setPriority(policy.priority);
          setActive(policy.active);
          setDescription(policy.description ?? "");
        } else {
          setCapabilityCode(opts.capabilities[0] ?? "");
          setActorScope(opts.actorScopes[0] ?? "");
        }
      })
      .catch(() => {
        if (!cancelled)
          showToast({ type: "error", message: tr("Failed to load state policy") });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, showToast]);

  // Leaving with a change that was not saved asks first (Cancel, the breadcrumb, the sidebar, a reload); the move after a successful Save is not a leave.
  const { isDirty } = useFormDirty({ capabilityCode, statusCode, documentTypeId, actorScope, requiredPermissionCode, priority, active, description, changeReason }, !loading);
  const { go, modal: leaveModal } = useLeaveGuard(isDirty, isEdit ? tr("Edit State Policy") : tr("New State Policy"), "the previous page");
  const handleBack = () =>
    navigateBack(
      go,
      location.state,
      `/security/lifecycle-policies?tab=capabilities`,
    );
  const leaveAfterSave = () =>
    navigateBack(
      navigate,
      location.state,
      `/security/lifecycle-policies?tab=capabilities`,
    );

  // Errors show only after the first Save; each one clears as soon as its field is valid.
  const [submitted, setSubmitted] = useState(false);
  const errors = {
    capability: capabilityCode ? "" : tr("Select a capability."),
    actorScope: actorScope ? "" : tr("Select an actor scope."),
  };
  const shown = { capability: submitted ? errors.capability : "", actorScope: submitted ? errors.actorScope : "" };

  const handleSave = async () => {
    setSubmitted(true);
    const firstInvalid = (["capability", "actorScope"] as const).find((field) => errors[field]);
    if (firstInvalid) {
      document.getElementById(`policy-field-${firstInvalid}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const sig = await requestSignature(
      isEdit
        ? tr("Update Lifecycle State Policy")
        : tr("Create Lifecycle State Policy"),
      "Workflow Authorization Change",
    );
    if (!sig) return;
    setSaving(true);
    const payload = {
      capabilityCode,
      statusCode: statusCode || null,
      documentTypeId: documentTypeId || null,
      actorScope,
      requiredPermissionCode: requiredPermissionCode || null,
      priority,
      active,
      description: description.trim() || null,
      reason: changeReason.trim() || undefined,
      signatureToken: sig.signatureToken,
    };
    try {
      if (initial) {
        await lifecycleStatePolicyApi.update(initial.id, payload);
        showToast({ type: "success", message: tr("State policy updated") });
      } else {
        await lifecycleStatePolicyApi.create(payload);
        showToast({ type: "success", message: tr("State policy created") });
      }
      leaveAfterSave();
    } catch (e: any) {
      showToast({
        type: "error",
        message: e?.response?.data?.message ?? "Save failed",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <FullPageLoading text="Loading state policy..." />;
  }

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
        <Shield className="h-12 w-12 text-slate-300" />
        <p className="text-lg font-semibold">{tr("Access Denied")}</p>
        <p className="text-sm">
          {tr("You do not have permission to manage Workflow Authorization policies.")}
        </p>
      </div>
    );
  }

  const title = isEdit ? tr("Edit State Policy") : tr("New State Policy");

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {signatureModal}
      {leaveModal}
      <PageHeader
        title={title}
        breadcrumbItems={lifecyclePoliciesSubPage(
          go,
          "State Capabilities",
          title,
        )}
        actions={
          <>
            <Button
              variant="outline-emerald"
              size="sm"
              onClick={handleBack}
              className="whitespace-nowrap"
            >
              {tr("Cancel")}
            </Button>
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() => void handleSave()}
              disabled={saving}
              className="whitespace-nowrap"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      />

      {initial?.system && (
        <WarningBanner variant="info">{tr("This is a system policy seeded for strict participant visibility. You can adjust or deactivate it, but it cannot be deleted. Changes take effect immediately for all users.")}</WarningBanner>
      )}

      <FormSection
        title={tr("Policy Definition")}
        icon={<ShieldCheck className="h-4 w-4" />}
        description={tr("Grant a capability on document revisions at a given lifecycle status. Rules are additive: access is allowed when any active policy matches.")}
        contentClassName="p-4 md:p-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div id="policy-field-capability" className="min-w-0">
            <Select
              label={tr("Capability *")}
              value={capabilityCode}
              onChange={(v) => setCapabilityCode(String(v))}
              options={(options?.capabilities ?? []).map((c) => ({
                label: c.replace(/_/g, " "),
                value: c,
              }))}
            />
            {shown.capability && <p role="alert" className="mt-1.5 text-xs text-red-600">{shown.capability}</p>}
          </div>
          <Select
            label={tr("Revision Status")}
            value={statusCode}
            onChange={(v) => setStatusCode(String(v))}
            options={[
              { label: tr("Any status"), value: "" },
              ...(options?.statuses ?? []).map((s) => ({
                label: s.label,
                value: s.value,
              })),
            ]}
          />
          <Select
            label={tr("Document Type")}
            value={documentTypeId}
            onChange={(v) => setDocumentTypeId(String(v))}
            options={[
              { label: tr("All types (global)"), value: "" },
              ...(options?.documentTypes ?? []).map((t) => ({
                label: t.label,
                value: t.value,
              })),
            ]}
          />
          <div id="policy-field-actorScope" className="min-w-0">
            <Select
              label={tr("Actor Scope *")}
              value={actorScope}
              onChange={(v) => setActorScope(String(v))}
              options={(options?.actorScopes ?? []).map((s) => ({
                label:
                  s === "ANY"
                    ? tr("Any user (with required permission)")
                    : s === "AUTHOR"
                      ? tr("Revision author")
                      : s === "PARTICIPANT"
                        ? tr("Assigned workflow participant")
                        : s,
                value: s,
              }))}
            />
            {shown.actorScope && <p role="alert" className="mt-1.5 text-xs text-red-600">{shown.actorScope}</p>}
          </div>
        </div>
      </FormSection>

      <FormSection
        title={tr("Configuration")}
        icon={<Layers3 className="h-4 w-4" />}
        contentClassName="p-4 md:p-5"
      >
        <div className="flex flex-col gap-4">
          <RequiredPermissionPicker
            value={requiredPermissionCode}
            onChange={setRequiredPermissionCode}
            options={(options?.permissions ?? []).map((p) => ({
              label: p.label,
              value: p.value,
            }))}
          />
          <LifecyclePolicyCommonFields
            priority={priority}
            onPriorityChange={(v) => setPriority(Number(v))}
            active={active}
            onActiveChange={setActive}
            description={description}
            onDescriptionChange={setDescription}
            showChangeReason={isEdit}
            changeReason={changeReason}
            onChangeReasonChange={setChangeReason}
          />
        </div>
      </FormSection>
    </div>
  );
};

// ── Dispatcher ───────────────────────────────────────────────────────────────
// Decides which form body to render. `kind` comes from `?kind=transition|capability`
// when present; otherwise falls back to detecting the `/state-policies/` path
// segment so the existing (unmodified) navigate() calls in StateCapabilitiesView /
// StatePolicyFormView keep working without having to add the query param there.
export const LifecyclePolicyFormView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const kindParam = searchParams.get("kind");
  const kind: "transition" | "capability" =
    kindParam === "capability" || kindParam === "transition"
      ? kindParam
      : location.pathname.includes("/state-policies")
        ? "capability"
        : "transition";

  return kind === "capability" ? (
    <CapabilityPolicyForm />
  ) : (
    <TransitionPolicyForm />
  );
};
