import React, { useEffect, useMemo, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  AlertTriangle,
  Shield,
  ShieldCheck,
  Fingerprint,
  Layers3,
  Plus,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { Switch } from "@/components/ui/switch/Switch";
import { FormSection } from "@/components/ui/form/FormSection";
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
      <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
        Priority
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
      <span className="text-sm font-medium text-slate-700">Active</span>
      <Switch checked={active} onChange={onActiveChange} />
    </div>

    <div>
      <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
        Description
      </label>
      <textarea
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        rows={2}
        placeholder="Optional description..."
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
      />
    </div>

    {showChangeReason && (
      <div>
        <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
          Change Reason
        </label>
        <input
          type="text"
          value={changeReason}
          onChange={(e) => onChangeReasonChange(e.target.value)}
          placeholder="Optional reason for this change..."
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

const readOnlyField = (label: string, value: string) => (
  <div>
    <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      workflowActionPolicyApi.getOptions(),
      id ? workflowActionPolicyApi.getPolicy(id) : Promise.resolve(null),
    ])
      .then(([opts, policy]) => {
        if (cancelled) return;
        setOptions(opts);
        setSourcePolicy(policy);
        setForm(initTransitionForm(mode, policy));
      })
      .catch(() => {
        if (!cancelled)
          showToast({
            type: "error",
            message: "Failed to load workflow policy data",
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

  const handleBack = () =>
    navigateBack(
      navigate,
      location.state,
      `/security/lifecycle-policies?tab=transitions`,
    );

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
    { label: "Select module", value: "" },
    ...(options?.modules ?? []).map((m) => ({ label: m, value: m })),
  ];
  const workflowOptions: SelectOption[] = [
    { label: "Select workflow", value: "" },
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
    const base = [{ label: "Select object type", value: "" }];
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
    const base = [{ label: "Select action", value: "" }];
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
    { label: "None (global)", value: "" },
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
      actors: form.actors,
      changeReason: form.changeReason || undefined,
    };
  }

  function validate(): boolean {
    if (mode === "create" && !form.fromStatus) {
      showToast({
        type: "warning",
        title: "Validation",
        message: "From Status is required for the selected action.",
      });
      return false;
    }
    if (!form.requiredPermissionCode) {
      showToast({
        type: "warning",
        title: "Validation",
        message: "Required permission is mandatory.",
      });
      return false;
    }
    if (form.actors.length === 0) {
      setActorError("At least one actor is required.");
      return false;
    }
    if (invalidActorIndices.length > 0) {
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
      showToast({ type: "error", title: "Preview Failed", message });
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
        title: "Policy Updated",
        message: "Policy saved successfully.",
      });
      setShowDiff(false);
      handleBack();
    } catch (err) {
      const { message } = extractApiError(err);
      showToast({ type: "error", title: "Save Failed", message });
    } finally {
      setConfirmingSave(false);
    }
  };

  const handleDirectSave = async () => {
    if (!validate()) return;
    const sig = await requestSignature(
      mode === "create"
        ? "Create Workflow Authorization Policy"
        : "Create Document-Type Override",
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
            title: "Validation",
            message: "All key fields are required.",
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
          title: "Policy Created",
          message: "Policy created successfully.",
        });
      } else if (mode === "override") {
        if (!sourcePolicy?.id) {
          setSaving(false);
          return;
        }
        if (!form.documentTypeId) {
          showToast({
            type: "warning",
            title: "Validation",
            message: "Document type is required for an override.",
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
          title: "Override Created",
          message: "Document-type override created.",
        });
      }
      handleBack();
    } catch (err) {
      const { message } = extractApiError(err);
      showToast({ type: "error", title: "Save Failed", message });
    } finally {
      setSaving(false);
    }
  };

  const titleMap: Record<TransitionMode, string> = {
    create: "New Policy",
    edit: "Edit Policy",
    override: "Create Document-Type Override",
  };

  const breadcrumbItems = lifecyclePoliciesSubPage(
    navigate,
    "Transitions",
    titleMap[mode],
  );

  if (loading) {
    return <FullPageLoading text="Loading workflow policy..." />;
  }

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
        <Shield className="h-12 w-12 text-slate-300" />
        <p className="text-lg font-semibold">Access Denied</p>
        <p className="text-sm">
          You do not have permission to manage Workflow Authorization policies.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
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
              Cancel
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
                  ? "Preview Changes"
                  : "Save"}
            </Button>
          </>
        }
      />

      {mode === "override" && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800">
          This override applies only to the selected document type. If no
          override matches, runtime uses the global policy.
        </div>
      )}
      {sourcePolicy?.system && mode === "edit" && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
          <p className="text-xs text-amber-800">
            This is a system policy. Key identity fields cannot be changed.
            Actors and permission can be reconfigured.
          </p>
        </div>
      )}

      <FormSection
        title="Policy Identity"
        icon={<IconSection className="h-4 w-4" />}
        contentClassName="p-4 md:p-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fieldRO("moduleKey") ? (
            readOnlyField(
              "Module",
              sourcePolicy?.moduleLabel ?? sourcePolicy?.moduleKey ?? "",
            )
          ) : (
            <Select
              label="Module *"
              value={form.moduleKey}
              onChange={(v) => setField("moduleKey", v)}
              options={moduleOptions}
            />
          )}
          {fieldRO("workflowKey") ? (
            readOnlyField(
              "Workflow",
              sourcePolicy?.workflowLabel ?? sourcePolicy?.workflowKey ?? "",
            )
          ) : (
            <Select
              label="Workflow *"
              value={form.workflowKey}
              onChange={(v) => setField("workflowKey", v)}
              options={workflowOptions}
            />
          )}
          {fieldRO("objectType") ? (
            readOnlyField("Object Type", sourcePolicy?.objectType ?? "")
          ) : (
            <div>
              <Select
                label={`Object Type${!form.workflowKey ? "" : " *"}`}
                value={form.objectType}
                onChange={(v) => setField("objectType", v)}
                options={objectTypeOptions}
                disabled={!form.workflowKey}
              />
              {!form.workflowKey && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Select a workflow first.
                </p>
              )}
            </div>
          )}
          {fieldRO("actionCode") ? (
            readOnlyField(
              "Action",
              sourcePolicy?.actionLabel ?? sourcePolicy?.actionCode ?? "",
            )
          ) : (
            <div>
              <Select
                label="Action *"
                value={form.actionCode}
                onChange={(v) => setField("actionCode", v)}
                options={actionOptions}
                disabled={!form.workflowKey}
              />
              {!form.workflowKey && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Select a workflow first.
                </p>
              )}
            </div>
          )}
          {fieldRO("fromStatus") ? (
            readOnlyField(
              "From Status",
              sourcePolicy?.fromStatusLabel ?? sourcePolicy?.fromStatus ?? "",
            )
          ) : fromStatusOptions.length > 0 ? (
            <Select
              label={`From Status${fromStatusOptions.length === 1 ? " (auto-selected)" : ""} *`}
              value={form.fromStatus}
              onChange={(v) => setField("fromStatus", v)}
              options={[
                { label: "Select status", value: "" },
                ...fromStatusOptions,
              ]}
            />
          ) : (
            <div>
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
                From Status <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.fromStatus}
                onChange={(e) => setField("fromStatus", e.target.value)}
                placeholder="Select an action first"
                disabled={!form.actionCode}
                className="h-9 w-full border border-slate-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
              />
              {!form.actionCode && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Select a workflow action first.
                </p>
              )}
            </div>
          )}
          {mode === "override" ? (
            <Select
              label="Document Type *"
              value={form.documentTypeId}
              onChange={(v) => setField("documentTypeId", v)}
              options={docTypeOptions.filter((o) => o.value !== "")}
            />
          ) : (
            <Select
              label="Document Type"
              value={form.documentTypeId}
              onChange={(v) => setField("documentTypeId", v)}
              options={docTypeOptions}
            />
          )}
        </div>
      </FormSection>

      <FormSection
        title="Configuration"
        icon={<Layers3 className="h-4 w-4" />}
        contentClassName="p-4 md:p-5"
      >
        <div className="flex flex-col gap-4">
          <RequiredPermissionPicker
            label="Required Permission"
            required
            value={form.requiredPermissionCode}
            onChange={(v) => setField("requiredPermissionCode", v)}
            options={(options?.permissions ?? []).map((p) => ({
              label: `${p.name} (${p.code})`,
              value: p.code,
            }))}
          />
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

      <FormSection
        title="Actors"
        icon={<Users className="h-4 w-4" />}
        contentClassName="p-4 md:p-5"
        headerRight={
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
            Add Actor
          </Button>
        }
      >
        {invalidActorIndices.length > 0 && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-red-700 font-medium">
                {invalidActorIndices.length} actor
                {invalidActorIndices.length > 1 ? "s" : ""} not allowed for the
                selected action.
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                Remove them before saving.
              </p>
            </div>
            <button
              type="button"
              onClick={removeInvalidActors}
              className="text-xs font-medium text-red-600 hover:text-red-800 underline whitespace-nowrap"
            >
              Remove invalid actors
            </button>
          </div>
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
      </FormSection>

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
    (policy.relations ?? []).map((r) => r.relationDefinitionId),
  );
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
      showToast({ type: "success", message: "Policy relations updated." });
    } catch (err) {
      const { message } = extractApiError(err);
      showToast({ type: "error", title: "Save Failed", message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSection
      title="Relations (New Engine)"
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
          label="Match Rule"
          value={matchRule}
          onChange={(v) => setMatchRule(v as "ANY" | "ALL")}
          options={[
            { label: "ANY — actor needs at least one relation", value: "ANY" },
            { label: "ALL — actor needs every relation", value: "ALL" },
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
            {saving ? "Saving…" : "Save Relations"}
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
        <label className="text-xs sm:text-sm font-medium text-slate-700">
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
          showToast({ type: "error", message: "Failed to load state policy" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, showToast]);

  const handleBack = () =>
    navigateBack(
      navigate,
      location.state,
      `/security/lifecycle-policies?tab=capabilities`,
    );

  const handleSave = async () => {
    if (!capabilityCode || !actorScope) {
      showToast({
        type: "error",
        title: "Validation failed",
        message: "Capability and actor scope are required",
      });
      return;
    }
    const sig = await requestSignature(
      isEdit
        ? "Update Lifecycle State Policy"
        : "Create Lifecycle State Policy",
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
        showToast({ type: "success", message: "State policy updated" });
      } else {
        await lifecycleStatePolicyApi.create(payload);
        showToast({ type: "success", message: "State policy created" });
      }
      handleBack();
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
        <p className="text-lg font-semibold">Access Denied</p>
        <p className="text-sm">
          You do not have permission to manage Workflow Authorization policies.
        </p>
      </div>
    );
  }

  const title = isEdit ? "Edit State Policy" : "New State Policy";

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {signatureModal}
      <PageHeader
        title={title}
        breadcrumbItems={lifecyclePoliciesSubPage(
          navigate,
          "Capabilities",
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
              Cancel
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
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800">
          This is a system policy seeded for strict participant visibility. You
          can adjust or deactivate it, but it cannot be deleted. Changes take
          effect immediately for all users.
        </div>
      )}

      <FormSection
        title="Policy Definition"
        icon={<ShieldCheck className="h-4 w-4" />}
        description="Grant a capability on document revisions at a given lifecycle status. Rules are additive: access is allowed when any active policy matches."
        contentClassName="p-4 md:p-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Capability *"
            value={capabilityCode}
            onChange={(v) => setCapabilityCode(String(v))}
            options={(options?.capabilities ?? []).map((c) => ({
              label: c.replace(/_/g, " "),
              value: c,
            }))}
          />
          <Select
            label="Revision Status"
            value={statusCode}
            onChange={(v) => setStatusCode(String(v))}
            options={[
              { label: "Any status", value: "" },
              ...(options?.statuses ?? []).map((s) => ({
                label: s.label,
                value: s.value,
              })),
            ]}
          />
          <Select
            label="Document Type"
            value={documentTypeId}
            onChange={(v) => setDocumentTypeId(String(v))}
            options={[
              { label: "All types (global)", value: "" },
              ...(options?.documentTypes ?? []).map((t) => ({
                label: t.label,
                value: t.value,
              })),
            ]}
          />
          <Select
            label="Actor Scope *"
            value={actorScope}
            onChange={(v) => setActorScope(String(v))}
            options={(options?.actorScopes ?? []).map((s) => ({
              label:
                s === "ANY"
                  ? "Any user (with required permission)"
                  : s === "AUTHOR"
                    ? "Revision author"
                    : s === "PARTICIPANT"
                      ? "Assigned workflow participant"
                      : s,
              value: s,
            }))}
          />
        </div>
      </FormSection>

      <FormSection
        title="Configuration"
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
// segment so the existing (unmodified) navigate() calls in StatePoliciesView /
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
