import React, { useMemo, useState } from "react";
import { AlertTriangle, Shield } from "lucide-react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { Badge } from "@/components/ui/badge/Badge";
import { workflowActionPolicyApi } from "@/services/api/workflowActionPolicy";
import { useToast } from "@/components/ui/toast/Toast";
import { extractApiError } from "../workflowPolicyUtils";
import type { WorkflowActionPolicyEffectiveResponse, WorkflowActionPolicyOptions } from "../types";

interface WorkflowPolicyEffectiveLookupProps {
  isOpen: boolean;
  onClose: () => void;
  options: WorkflowActionPolicyOptions | null;
}

export const WorkflowPolicyEffectiveLookup: React.FC<WorkflowPolicyEffectiveLookupProps> = ({
  isOpen,
  onClose,
  options,
}) => {
  const { showToast } = useToast();
  const [moduleKey, setModuleKey] = useState("");
  const [workflowKey, setWorkflowKey] = useState("");
  const [objectType, setObjectType] = useState("");
  const [actionCode, setActionCode] = useState("");
  const [fromStatus, setFromStatus] = useState("");
  const [documentTypeId, setDocumentTypeId] = useState("");
  const [result, setResult] = useState<WorkflowActionPolicyEffectiveResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const moduleOptions: SelectOption[] = [
    { label: "Select module", value: "" },
    ...(options?.modules ?? []).map((m) => ({ label: m, value: m })),
  ];
  const workflowOptions: SelectOption[] = [
    { label: "Select workflow", value: "" },
    ...((options?.workflowOptions?.length
      ? options.workflowOptions
      : (options?.workflows ?? []).map((value) => ({ value, label: value, moduleKey: "" }))
    ).map((workflow) => ({ label: workflow.label, value: workflow.value }))),
  ];
  const objectTypeOptions: SelectOption[] = useMemo(() => {
    const base = [{ label: "Select object type", value: "" }];
    if (!workflowKey || !options?.actions?.length) {
      return [...base, ...(options?.objectTypes ?? []).map((o) => ({ label: o, value: o }))];
    }
    const types = [...new Set(
      options.actions.filter((a) => a.workflowKey === workflowKey).map((a) => a.objectType ?? "")
    )].filter(Boolean).sort();
    return [...base, ...types.map((o) => ({ label: o, value: o }))];
  }, [workflowKey, options]);

  const actionOptions: SelectOption[] = useMemo(() => {
    const base = [{ label: "Select action", value: "" }];
    const all = options?.actions ?? [];
    const relevant = workflowKey
      ? all.filter((a) => a.workflowKey === workflowKey && (!objectType || a.objectType === objectType || !a.objectType))
      : all;
    const seen = new Set<string>();
    const deduped = relevant.filter((a) => { if (seen.has(a.value)) return false; seen.add(a.value); return true; });
    return [...base, ...deduped.map((a) => ({ label: a.label || a.value, value: a.value }))];
  }, [workflowKey, objectType, options]);

  const selectedAction = useMemo(
    () => options?.actions?.find((a) => a.value === actionCode && (!workflowKey || a.workflowKey === workflowKey)),
    [actionCode, workflowKey, options],
  );

  const fromStatusOptions: SelectOption[] = useMemo(() => {
    const statuses = selectedAction?.defaultFromStatuses ?? [];
    if (statuses.length === 0) return [];
    return [{ label: "Select status", value: "" }, ...statuses.map((s) => ({ label: s, value: s }))];
  }, [selectedAction]);

  const docTypeOptions: SelectOption[] = [
    { label: "Any (global)", value: "" },
    ...(options?.documentTypes ?? []).map((d) => ({ label: d.name, value: d.id })),
  ];

  const handleLookup = async () => {
    if (!moduleKey || !workflowKey || !objectType || !actionCode || !fromStatus) {
      showToast({ type: "warning", title: "Incomplete", message: "Fill in all required fields." });
      return;
    }
    setLoading(true);
    try {
      const res = await workflowActionPolicyApi.getEffectivePolicy({
        moduleKey,
        workflowKey,
        objectType,
        actionCode,
        fromStatus,
        documentTypeId: documentTypeId || null,
      });
      setResult(res);
    } catch (err) {
      const { message } = extractApiError(err);
      showToast({ type: "error", title: "Lookup Failed", message });
    } finally {
      setLoading(false);
    }
  };

  const sourceColor = (source: string) => {
    if (source === "DOCUMENT_TYPE_OVERRIDE") return "blue";
    if (source === "GLOBAL") return "emerald";
    return "slate";
  };

  const handleWorkflowChange = (v: string) => {
    setWorkflowKey(v);
    setObjectType("");
    setActionCode("");
    setFromStatus("");
    setResult(null);
  };

  const handleObjectTypeChange = (v: string) => {
    setObjectType(v);
    setActionCode("");
    setFromStatus("");
    setResult(null);
  };

  const handleActionChange = (v: string) => {
    setActionCode(v);
    setResult(null);
    // Auto-select fromStatus when exactly one option exists
    const action = options?.actions?.find((a) => a.value === v && (!workflowKey || a.workflowKey === workflowKey));
    const statuses = action?.defaultFromStatuses ?? [];
    if (statuses.length === 1) {
      setFromStatus(statuses[0]);
    } else {
      setFromStatus("");
    }
  };

  const handleClose = () => {
    setResult(null);
    setModuleKey("");
    setWorkflowKey("");
    setObjectType("");
    setActionCode("");
    setFromStatus("");
    setDocumentTypeId("");
    onClose();
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleLookup}
      title="Effective Policy Lookup"
      description="Find which policy the runtime would use for a specific workflow action."
      confirmText="Lookup"
      cancelText="Close"
      isLoading={loading}
      showCancel
      size="xl"
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Module *" value={moduleKey} onChange={setModuleKey} options={moduleOptions} />
          <Select label="Workflow *" value={workflowKey} onChange={handleWorkflowChange} options={workflowOptions} />
          <Select label="Object Type *" value={objectType} onChange={handleObjectTypeChange} options={objectTypeOptions} />
          <Select label="Action *" value={actionCode} onChange={handleActionChange} options={actionOptions} />
          {fromStatusOptions.length > 0 ? (
            <Select
              label={`From Status${fromStatusOptions.filter((o) => o.value).length === 1 ? " (auto-selected)" : ""} *`}
              value={fromStatus}
              onChange={setFromStatus}
              options={fromStatusOptions}
            />
          ) : (
            <div>
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">From Status <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={fromStatus}
                onChange={(e) => setFromStatus(e.target.value)}
                placeholder={actionCode ? "Enter status" : "Select an action first"}
                disabled={!actionCode}
                className="h-9 w-full border border-slate-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
          )}
          <Select label="Document Type (optional)" value={documentTypeId} onChange={setDocumentTypeId} options={docTypeOptions} />
        </div>

        {result && (
          <div className="mt-2 border-t border-slate-200 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-semibold text-slate-700">Result</span>
              <Badge color={sourceColor(result.source) as "blue" | "emerald" | "slate"} size="sm">
                {result.source}
              </Badge>
            </div>

            {result.source === "NOT_CONFIGURED" && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm mb-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-amber-800 text-xs">
                  No matching policy was found. The action will be denied until an active policy is configured.
                </p>
              </div>
            )}

            {result.policy ? (
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <span className="text-slate-500">Action:</span>{" "}
                    <span className="font-medium">{result.policy.actionLabel ?? result.policy.actionCode}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">From Status:</span>{" "}
                    <span className="font-medium">{result.policy.fromStatusLabel ?? result.policy.fromStatus}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Permission:</span>{" "}
                    <span className="font-medium">{result.policy.requiredPermissionCode}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Priority:</span>{" "}
                    <span className="font-medium">{result.policy.priority}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Document Type:</span>{" "}
                    <span className="font-medium">{result.policy.documentTypeName ?? "Global"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Active:</span>{" "}
                    <Badge color={result.policy.active ? "emerald" : "slate"} size="xs">
                      {result.policy.active ? "Yes" : "No"}
                    </Badge>
                  </div>
                </div>
                {result.policy.actors.length > 0 && (
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <p className="text-xs text-slate-500 mb-1">Actors:</p>
                    <div className="flex flex-wrap gap-1">
                      {result.policy.actors.map((a, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-medium"
                        >
                          {a.actorTypeLabel ?? a.actorType}
                          {a.actorCode ? ` (${a.actorCode})` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No policy found.</p>
            )}
          </div>
        )}
      </div>
    </FormModal>
  );
};
