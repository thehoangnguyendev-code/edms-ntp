import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search, Shield } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { Badge } from "@/components/ui/badge/Badge";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { FormSection } from "@/components/ui/form/FormSection";
import { workflowAuthorization as workflowAuthorizationBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { ROUTES } from "@/app/routes.constants";
import { useToast } from "@/components/ui/toast/Toast";
import { workflowActionPolicyApi } from "@/services/api/workflowActionPolicy";
import { extractApiError } from "../workflowPolicyUtils";
import type {
  WorkflowActionPolicyEffectiveResponse,
  WorkflowActionPolicyOptions,
} from "../types";

type ResolverFields = {
  moduleKey: string;
  workflowKey: string;
  objectType: string;
  actionCode: string;
  fromStatus: string;
  documentTypeId: string;
};

const QUERY_FIELDS: Array<keyof ResolverFields> = [
  "moduleKey",
  "workflowKey",
  "objectType",
  "actionCode",
  "fromStatus",
  "documentTypeId",
];
const emptyFields: ResolverFields = {
  moduleKey: "",
  workflowKey: "",
  objectType: "",
  actionCode: "",
  fromStatus: "",
  documentTypeId: "",
};

/** Read-only server-side policy resolution workspace. It never executes a lifecycle transition. */
export const PolicyResolverView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const [options, setOptions] = useState<WorkflowActionPolicyOptions | null>(
    null,
  );
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState(false);
  const [fields, setFields] = useState<ResolverFields>(() => {
    const initial = { ...emptyFields };
    QUERY_FIELDS.forEach((field) => {
      initial[field] = searchParams.get(field) ?? "";
    });
    return initial;
  });
  const [result, setResult] =
    useState<WorkflowActionPolicyEffectiveResponse | null>(null);
  const [resolving, setResolving] = useState(false);

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);
    setOptionsError(false);
    try {
      setOptions(await workflowActionPolicyApi.getOptions());
    } catch (error) {
      setOptionsError(true);
      showToast({
        type: "error",
        title: "Unable to load resolver options",
        message: extractApiError(error).message,
      });
    } finally {
      setOptionsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const moduleOptions: SelectOption[] = useMemo(
    () => [
      { label: "Select module", value: "" },
      ...(options?.modules ?? []).map((moduleKey) => ({
        label: moduleKey,
        value: moduleKey,
      })),
    ],
    [options],
  );

  const workflowOptions: SelectOption[] = useMemo(() => {
    const workflows = options?.workflowOptions?.length
      ? options.workflowOptions
      : (options?.workflows ?? []).map((value) => ({
          value,
          label: value,
          moduleKey: "",
        }));
    return [
      { label: "Select workflow", value: "" },
      ...workflows
        .filter(
          (workflow) =>
            !fields.moduleKey ||
            !workflow.moduleKey ||
            workflow.moduleKey === fields.moduleKey,
        )
        .map((workflow) => ({ label: workflow.label, value: workflow.value })),
    ];
  }, [fields.moduleKey, options]);

  const objectTypeOptions: SelectOption[] = useMemo(() => {
    const base = [{ label: "Select resource type", value: "" }];
    if (!fields.workflowKey || !options?.actions?.length)
      return [
        ...base,
        ...(options?.objectTypes ?? []).map((objectType) => ({
          label: objectType,
          value: objectType,
        })),
      ];
    const types = [
      ...new Set(
        options.actions
          .filter((action) => action.workflowKey === fields.workflowKey)
          .map((action) => action.objectType ?? ""),
      ),
    ]
      .filter(Boolean)
      .sort();
    return [
      ...base,
      ...types.map((objectType) => ({ label: objectType, value: objectType })),
    ];
  }, [fields.workflowKey, options]);

  const actionOptions: SelectOption[] = useMemo(() => {
    const relevant = fields.workflowKey
      ? (options?.actions ?? []).filter(
          (action) =>
            action.workflowKey === fields.workflowKey &&
            (!fields.objectType ||
              action.objectType === fields.objectType ||
              !action.objectType),
        )
      : (options?.actions ?? []);
    const seen = new Set<string>();
    return [
      { label: "Select action", value: "" },
      ...relevant
        .filter(
          (action) =>
            !seen.has(action.value) && Boolean(seen.add(action.value)),
        )
        .map((action) => ({
          label: action.label || action.value,
          value: action.value,
        })),
    ];
  }, [fields.objectType, fields.workflowKey, options]);

  const selectedAction = useMemo(
    () =>
      options?.actions?.find(
        (action) =>
          action.value === fields.actionCode &&
          (!fields.workflowKey || action.workflowKey === fields.workflowKey),
      ),
    [fields.actionCode, fields.workflowKey, options],
  );
  const fromStatusOptions: SelectOption[] = useMemo(() => {
    const statuses = selectedAction?.defaultFromStatuses ?? [];
    return statuses.length
      ? [
          { label: "Select status", value: "" },
          ...statuses.map((status) => ({ label: status, value: status })),
        ]
      : [];
  }, [selectedAction]);
  const documentTypeOptions: SelectOption[] = useMemo(
    () => [
      { label: "Any (Global policy)", value: "" },
      ...(options?.documentTypes ?? []).map((documentType) => ({
        label: documentType.name,
        value: documentType.id,
      })),
    ],
    [options],
  );

  const updateFields = (next: Partial<ResolverFields>) => {
    setFields((current) => ({ ...current, ...next }));
    setResult(null);
  };
  const handleActionChange = (actionCode: string) => {
    const action = options?.actions?.find(
      (item) =>
        item.value === actionCode &&
        (!fields.workflowKey || item.workflowKey === fields.workflowKey),
    );
    const statuses = action?.defaultFromStatuses ?? [];
    updateFields({
      actionCode,
      fromStatus: statuses.length === 1 ? statuses[0] : "",
    });
  };
  const resolve = async () => {
    if (
      !fields.moduleKey ||
      !fields.workflowKey ||
      !fields.objectType ||
      !fields.actionCode ||
      !fields.fromStatus
    ) {
      showToast({
        type: "warning",
        title: "Incomplete context",
        message: "Fill in all required fields before resolving a policy.",
      });
      return;
    }
    setResolving(true);
    try {
      const response = await workflowActionPolicyApi.getEffectivePolicy({
        ...fields,
        documentTypeId: fields.documentTypeId || null,
      });
      setResult(response);
      const nextParams = new URLSearchParams();
      QUERY_FIELDS.forEach((field) => {
        if (fields[field]) nextParams.set(field, fields[field]);
      });
      setSearchParams(nextParams, { replace: true });
    } catch (error) {
      showToast({
        type: "error",
        title: "Policy resolution failed",
        message: extractApiError(error).message,
      });
    } finally {
      setResolving(false);
    }
  };
  const sourceColor = (source: string): "blue" | "emerald" | "slate" =>
    source === "DOCUMENT_TYPE_OVERRIDE"
      ? "blue"
      : source === "GLOBAL"
        ? "emerald"
        : "slate";

  return (
    <div className="flex w-full flex-1 flex-col space-y-6">
      <PageHeader
        title="Policy Resolver"
        breadcrumbItems={workflowAuthorizationBreadcrumb(
          navigate,
          "Policy Resolver",
        )}
        actions={
          <Button
            variant="outline-emerald"
            size="sm"
            className="whitespace-nowrap"
            onClick={() =>
              navigate(
                `${ROUTES.SECURITY.WORKFLOW_AUTHORIZATION}?tab=transitions`,
              )
            }
          >
            Back
          </Button>
        }
      />
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="border-b border-slate-200 pb-4">
          <p className="text-sm font-semibold text-slate-900">
            Resolve the active workflow policy
          </p>
          <p className="mt-1 text-sm text-slate-500">
            This is a read-only server lookup. It does not evaluate a user,
            grant access, or execute a transition.
          </p>
        </div>
        {optionsLoading ? (
          <SectionLoading />
        ) : optionsError || !options ? (
          <div className="mt-4 space-y-3">
            <WarningBanner
              variant="warning"
              description="Resolver options could not be loaded. Retry when the service is available."
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadOptions()}
            >
              Retry
            </Button>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-5">
            <div className="space-y-4 xl:col-span-3">
              <FormSection
                title="1. Workflow context"
                contentClassName="p-4 md:p-5"
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Select
                    label="Module *"
                    value={fields.moduleKey}
                    onChange={(moduleKey) =>
                      updateFields({
                        moduleKey,
                        workflowKey: "",
                        objectType: "",
                        actionCode: "",
                        fromStatus: "",
                      })
                    }
                    options={moduleOptions}
                  />
                  <Select
                    label="Workflow *"
                    value={fields.workflowKey}
                    onChange={(workflowKey) =>
                      updateFields({
                        workflowKey,
                        objectType: "",
                        actionCode: "",
                        fromStatus: "",
                      })
                    }
                    options={workflowOptions}
                  />
                  <Select
                    label="Resource type *"
                    value={fields.objectType}
                    onChange={(objectType) =>
                      updateFields({
                        objectType,
                        actionCode: "",
                        fromStatus: "",
                      })
                    }
                    options={objectTypeOptions}
                  />
                </div>
              </FormSection>
              <FormSection
                title="2. Transition to resolve"
                contentClassName="p-4 md:p-5"
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Select
                    label="Action *"
                    value={fields.actionCode}
                    onChange={handleActionChange}
                    options={actionOptions}
                  />
                  {fromStatusOptions.length ? (
                    <Select
                      label={`From status${fromStatusOptions.filter((option) => option.value).length === 1 ? " (auto-selected)" : ""} *`}
                      value={fields.fromStatus}
                      onChange={(fromStatus) => updateFields({ fromStatus })}
                      options={fromStatusOptions}
                    />
                  ) : (
                    <label className="block text-xs font-medium text-slate-700 sm:text-sm">
                      From status <span className="text-red-500">*</span>
                      <input
                        type="text"
                        value={fields.fromStatus}
                        onChange={(event) =>
                          updateFields({ fromStatus: event.target.value })
                        }
                        placeholder={
                          fields.actionCode
                            ? "Enter status"
                            : "Select an action first"
                        }
                        disabled={!fields.actionCode}
                        className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
                      />
                    </label>
                  )}
                  <Select
                    label="Document type (optional)"
                    value={fields.documentTypeId}
                    onChange={(documentTypeId) =>
                      updateFields({ documentTypeId })
                    }
                    options={documentTypeOptions}
                  />
                </div>
              </FormSection>
              <div className="flex justify-end">
                <Button
                  onClick={() => void resolve()}
                  loading={resolving}
                  size="sm"
                  className="whitespace-nowrap gap-2"
                >
                  Resolve policy
                </Button>
              </div>
            </div>
            <PolicyResolutionResult result={result} sourceColor={sourceColor} />
          </div>
        )}
      </div>
    </div>
  );
};

const PolicyResolutionResult: React.FC<{
  result: WorkflowActionPolicyEffectiveResponse | null;
  sourceColor: (source: string) => "blue" | "emerald" | "slate";
}> = ({ result, sourceColor }) => (
  <aside className="min-h-72 rounded-xl border border-slate-200 bg-slate-50/60 p-4 xl:col-span-2 xl:sticky xl:top-4 xl:h-fit">
    <div className="flex items-center gap-2">
      <h2 className="text-sm font-semibold text-slate-900">Resolution</h2>
      {result && (
        <Badge color={sourceColor(result.source)} size="sm">
          {result.source.replaceAll("_", " ")}
        </Badge>
      )}
    </div>
    {!result ? (
      <div className="flex min-h-52 items-center justify-center text-center text-sm text-slate-500">
        Select a transition, then resolve it to view the active policy and
        decision path.
      </div>
    ) : (
      <div className="mt-4 space-y-4">
        {result.decisionMessage && (
          <p className="text-sm text-slate-600">{result.decisionMessage}</p>
        )}
        {result.source === "NOT_CONFIGURED" && (
          <WarningBanner
            variant="warning"
            description="No matching active policy exists. The runtime denies the action until a policy is configured."
          />
        )}
        {result.policy && (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
              <ResolutionField
                label="Action"
                value={result.policy.actionLabel ?? result.policy.actionCode}
              />
              <ResolutionField
                label="From status"
                value={
                  result.policy.fromStatusLabel ?? result.policy.fromStatus
                }
              />
              <ResolutionField
                label="Permission"
                value={result.policy.requiredPermissionCode}
              />
              <ResolutionField
                label="Priority"
                value={String(result.policy.priority)}
              />
              <ResolutionField
                label="Document type"
                value={result.policy.documentTypeName ?? "Global"}
              />
              <ResolutionField
                label="Actors"
                value={
                  result.policy.actors.length
                    ? result.policy.actors
                        .map(
                          (actor) =>
                            `${actor.actorTypeLabel ?? actor.actorType}${actor.actorCode ? ` (${actor.actorCode})` : ""}`,
                        )
                        .join(", ")
                    : "None"
                }
              />
            </dl>
          </div>
        )}
        {result.trace.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Decision path
            </p>
            <ol className="space-y-3">
              {result.trace.map((step, index) => (
                <li
                  key={`${step.scope}-${step.reasonCode}`}
                  className="flex gap-2 text-xs text-slate-600"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-500">
                    {index + 1}
                  </span>
                  <span>
                    <span className="font-medium text-slate-700">
                      {step.scope.replaceAll("_", " ")}:{" "}
                    </span>
                    {step.message}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    )}
  </aside>
);

const ResolutionField: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div>
    <dt className="text-slate-500">{label}</dt>
    <dd className="mt-0.5 break-words font-medium text-slate-800">{value}</dd>
  </div>
);
