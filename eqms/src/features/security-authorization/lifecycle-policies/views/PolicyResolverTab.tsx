import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { History, ScanSearch, SearchCheck } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { Badge } from "@/components/ui/badge/Badge";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { FormSection } from "@/components/ui/form/FormSection";
import { useToast } from "@/components/ui/toast/Toast";
import { workflowActionPolicyApi } from "@/services/api/workflowActionPolicy";
import { extractApiError } from "../workflowPolicyUtils";
import { moduleDisplayName } from "@/utils/moduleDisplay";
import { statusText } from "@/features/security-authorization/shared/humanizeCode";
import type {
  WorkflowActionPolicyEffectiveResponse,
  WorkflowActionPolicyOptions,
} from "../types";
import { tr } from "@/i18n";

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

/** Read-only server-side policy resolution tab of Engine Diagnostics. It never executes a lifecycle transition. */
export const PolicyResolverTab: React.FC = () => {
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
  const [recent, setRecent] = useState<Array<{ fields: ResolverFields; source: string }>>([]);

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);
    setOptionsError(false);
    try {
      setOptions(await workflowActionPolicyApi.getOptions());
    } catch (error) {
      setOptionsError(true);
      showToast({
        type: "error",
        title: tr("Unable to load resolver options"),
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
      { label: tr("Select module"), value: "" },
      ...(options?.modules ?? []).map((moduleKey) => ({
        label: moduleDisplayName(moduleKey),
        value: moduleKey,
      })),
    ],
    [options],
  );

  // Each list depends on the field before it: module -> workflow -> resource type -> action. Nothing is offered
  // until its parent is chosen, and only what belongs to that parent is offered.
  const workflowOptions: SelectOption[] = useMemo(
    () => [
      { label: fields.moduleKey ? "Select workflow" : "Select a module first", value: "" },
      ...(options?.workflowOptions ?? [])
        .filter((workflow) => Boolean(fields.moduleKey) && workflow.moduleKey === fields.moduleKey)
        .map((workflow) => ({ label: workflow.label, value: workflow.value })),
    ],
    [fields.moduleKey, options],
  );

  const objectTypeOptions: SelectOption[] = useMemo(() => {
    const types = fields.workflowKey
      ? [
          ...new Set(
            (options?.actions ?? [])
              .filter((action) => action.workflowKey === fields.workflowKey)
              .map((action) => action.objectType ?? ""),
          ),
        ]
          .filter(Boolean)
          .sort()
      : [];
    return [
      { label: fields.workflowKey ? "Select resource type" : "Select a workflow first", value: "" },
      ...types.map((objectType) => ({ label: objectType, value: objectType })),
    ];
  }, [fields.workflowKey, options]);

  const actionOptions: SelectOption[] = useMemo(() => {
    const relevant =
      fields.workflowKey && fields.objectType
        ? (options?.actions ?? []).filter(
            (action) =>
              action.workflowKey === fields.workflowKey && (action.objectType === fields.objectType || !action.objectType),
          )
        : [];
    const seen = new Set<string>();
    return [
      { label: fields.objectType ? "Select action" : "Select a resource type first", value: "" },
      ...relevant
        .filter((action) => !seen.has(action.value) && Boolean(seen.add(action.value)))
        .map((action) => ({ label: action.label || action.value, value: action.value })),
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
          { label: tr("Select status"), value: "" },
          ...statuses.map((status) => ({ label: status, value: status })),
        ]
      : [];
  }, [selectedAction]);
  const documentTypeOptions: SelectOption[] = useMemo(
    () => [
      { label: tr("Any (Global policy)"), value: "" },
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
        title: tr("Incomplete context"),
        message: tr("Fill in all required fields before resolving a policy."),
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
      setRecent((current) =>
        [{ fields: { ...fields }, source: response.source }, ...current.filter((item) => JSON.stringify(item.fields) !== JSON.stringify(fields))].slice(0, 5),
      );
      // Keep the other query parameters (the active diagnostics tab); only refresh the resolver fields.
      const nextParams = new URLSearchParams(searchParams);
      QUERY_FIELDS.forEach((field) => {
        if (fields[field]) nextParams.set(field, fields[field]);
        else nextParams.delete(field);
      });
      setSearchParams(nextParams, { replace: true });
    } catch (error) {
      showToast({
        type: "error",
        title: tr("Policy resolution failed"),
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

  const complete = Boolean(
    fields.moduleKey && fields.workflowKey && fields.objectType && fields.actionCode && fields.fromStatus,
  );

  return (
    <div className="flex w-full flex-1 flex-col space-y-4 md:space-y-6">
      <p className="text-sm text-slate-500">
        {tr("Resolve the active workflow policy. This is a read-only server lookup: it does not evaluate a user, grant access, or execute a transition.")}
      </p>
      {optionsLoading ? (
        <SectionLoading />
      ) : optionsError || !options ? (
        <div className="space-y-3">
          <WarningBanner
            variant="warning"
            description={tr("Resolver options could not be loaded. Retry when the service is available.")}
          />
          <Button variant="outline" size="sm" onClick={() => void loadOptions()}>
            {tr("Retry")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 md:gap-6 xl:grid-cols-2">
          <div className="space-y-4 md:space-y-6">
            <FormSection title={tr("Policy lookup")} icon={<SearchCheck className="h-4 w-4" />} contentClassName="p-4 md:p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <Select
                  label={tr("Module *")}
                  value={fields.moduleKey}
                  onChange={(moduleKey) =>
                    updateFields({ moduleKey, workflowKey: "", objectType: "", actionCode: "", fromStatus: "", documentTypeId: "" })
                  }
                  options={moduleOptions}
                />
                <Select
                  label={tr("Workflow *")}
                  value={fields.workflowKey}
                  onChange={(workflowKey) => updateFields({ workflowKey, objectType: "", actionCode: "", fromStatus: "" })}
                  options={workflowOptions}
                  disabled={!fields.moduleKey}
                />
                <Select
                  label={tr("Resource type *")}
                  value={fields.objectType}
                  onChange={(objectType) => updateFields({ objectType, actionCode: "", fromStatus: "" })}
                  options={objectTypeOptions}
                  disabled={!fields.workflowKey}
                />
                <Select
                  label={tr("Action *")}
                  value={fields.actionCode}
                  onChange={handleActionChange}
                  options={actionOptions}
                  disabled={!fields.objectType}
                />
                {fromStatusOptions.length ? (
                  <Select
                    label={`From status${fromStatusOptions.filter((option) => option.value).length === 1 ? " (auto-selected)" : ""} *`}
                    value={fields.fromStatus}
                    onChange={(fromStatus) => updateFields({ fromStatus })}
                    options={fromStatusOptions}
                  />
                ) : (
                  <label className="block text-xs font-medium text-slate-700 sm:text-sm capitalize">
                    {tr("From status")} <span className="text-red-500">*</span>
                    <input
                      type="text"
                      value={fields.fromStatus}
                      onChange={(event) => updateFields({ fromStatus: event.target.value })}
                      placeholder={fields.actionCode ? "Enter status" : tr("Select an action first")}
                      disabled={!fields.actionCode}
                      className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </label>
                )}
                {fields.moduleKey === "DOCUMENT_CONTROL" && (
                  <Select
                    label={tr("Document type (optional)")}
                    value={fields.documentTypeId}
                    onChange={(documentTypeId) => updateFields({ documentTypeId })}
                    options={documentTypeOptions}
                    disabled={!fields.fromStatus}
                  />
                )}
              </div>
              <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
                <Button
                  onClick={() => void resolve()}
                  loading={resolving}
                  disabled={!complete}
                  size="sm"
                  className="w-full gap-2 whitespace-nowrap sm:w-auto"
                >
                  <SearchCheck className="h-4 w-4" />
                  {tr("Resolve policy")}
                </Button>
              </div>
            </FormSection>
            <FormSection title={tr("Recent lookups")} icon={<History className="h-4 w-4" />} contentClassName="p-0">
              {recent.length === 0 ? (
                <p className="p-4 text-sm text-slate-500 md:p-5">
                  {tr("Lookups you resolve in this visit are kept here, so you can compare two transitions.")}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {recent.map((item) => (
                    <li key={JSON.stringify(item.fields)}>
                      <button
                        type="button"
                        onClick={() => {
                          setFields(item.fields);
                          setResult(null);
                        }}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 md:px-5"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-900">
                            {item.fields.actionCode} · {item.fields.fromStatus}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {moduleDisplayName(item.fields.moduleKey)} › {item.fields.workflowKey} › {item.fields.objectType}
                          </span>
                        </span>
                        <Badge color={sourceColor(item.source)} size="sm">
                          {item.source.replaceAll("_", " ")}
                        </Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </FormSection>
          </div>
          <div className="xl:sticky xl:top-4">
            <PolicyResolutionResult result={result} resolving={resolving} sourceColor={sourceColor} />
          </div>
        </div>
      )}
    </div>
  );
};

const PolicyResolutionResult: React.FC<{
  result: WorkflowActionPolicyEffectiveResponse | null;
  resolving: boolean;
  sourceColor: (source: string) => "blue" | "emerald" | "slate";
}> = ({ result, resolving, sourceColor }) => (
  <FormSection
    title={tr("Resolution")}
    icon={<ScanSearch className="h-4 w-4" />}
    headerRight={
      result ? (
        <Badge color={sourceColor(result.source)} size="sm">
          {result.source.replaceAll("_", " ")}
        </Badge>
      ) : undefined
    }
    contentClassName="p-4 md:p-5"
  >
    {resolving ? (
      <SectionLoading />
    ) : !result ? (
      <div className="flex min-h-52 flex-col items-center justify-center gap-2 text-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <ScanSearch className="h-4 w-4" />
        </span>
        <p className="text-sm font-medium text-slate-900">{tr("Select a transition")}</p>
        <p className="max-w-xs text-sm text-slate-500">
          {tr("Choose the module, workflow, action and status, then resolve the policy to view the active policy and decision path.")}
        </p>
      </div>
    ) : (
      <div className="space-y-5">
        {result.source === "NOT_CONFIGURED" ? (
          <WarningBanner
            variant="error"
            title={tr("No active policy")}
            description={tr("No matching active policy exists. The runtime denies the action until a policy is configured.")}
          />
        ) : (
          <WarningBanner
            variant="success"
            title={tr("Policy resolved")}
            description={result.decisionMessage || "An active policy applies to this transition."}
          />
        )}
        {result.source === "NOT_CONFIGURED" && result.decisionMessage && (
          <p className="text-sm text-slate-600">{result.decisionMessage}</p>
        )}
        {result.trace.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr("How the engine decided")}</p>
            <ol>
              {result.trace.map((step, index) => (
                <li key={`${step.scope}-${step.reasonCode}`} className="flex gap-3">
                  <span className="flex flex-col items-center">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700">
                      {index + 1}
                    </span>
                    {index < result.trace.length - 1 && <span className="mt-1 w-px flex-1 bg-slate-200" />}
                  </span>
                  <div className="min-w-0 pb-4">
                    <p className="text-sm font-medium text-slate-900">{step.scope.replaceAll("_", " ")}</p>
                    <p className="break-words text-xs text-slate-500">{step.message}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
        {result.policy && (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 border-t border-slate-200 pt-4 text-sm sm:grid-cols-2">
            <ResolutionField label={tr("Action")} value={statusText(result.policy.actionLabel, result.policy.actionCode)} />
            <ResolutionField label={tr("From status")} value={statusText(result.policy.fromStatusLabel, result.policy.fromStatus)} />
            <ResolutionField label={tr("Permission")} value={result.policy.requiredPermissionCode} />
            <ResolutionField label={tr("Priority")} value={String(result.policy.priority)} />
            <ResolutionField label={tr("Document type")} value={result.policy.documentTypeName ?? "Global"} />
            <ResolutionField
              label={tr("Actors")}
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
        )}
      </div>
    )}
  </FormSection>
);

const ResolutionField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="min-w-0">
    <dt className="text-xs text-slate-500">{label}</dt>
    <dd className="mt-0.5 break-words font-medium text-slate-900">{value}</dd>
  </div>
);
