import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Pencil, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Select } from "@/components/ui/select/Select";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Button } from "@/components/ui/button/Button";
import { usePermissions } from "@/hooks/usePermissions";
import { workflowActionPolicyApi } from "@/services/api";
import { lifecycleStatePolicyApi } from "@/services/api/lifecycleStatePolicy";
import { ROUTES } from "@/app/routes.constants";
import type { WorkflowActionPolicy } from "../types";

/**
 * Canonical lifecycle order per object type. Keys must match the raw
 * workflow_action_policies.object_type values (REVISION, CONTROLLED_COPY, …)
 * for the three Document Control workflows: Document Master, Revision and
 * Controlled Copy. Every canonical status renders as a column even with no
 * policy — an empty column is real information ("no action can start here").
 * Every canonical status renders as a column even with no policy — an empty
 * column is real information ("no action can start from this state").
 */
const STATUS_ORDER: Record<string, string[]> = {
  DOCUMENT: ["DRAFT", "ACTIVE", "OBSOLETED", "CLOSED_CANCELLED"],
  REVISION: [
    "DRAFT", "PENDING_REVIEW", "PENDING_APPROVAL", "PENDING_TRAINING",
    "READY_FOR_PUBLISHING", "EFFECTIVE", "OBSOLETED", "CLOSED_CANCELLED",
  ],
  CONTROLLED_COPY: ["READY_FOR_DISTRIBUTION", "DISTRIBUTED", "OBSOLETED", "CLOSED_CANCELLED"],
};

const OBJECT_TYPE_LABELS: Record<string, string> = {
  DOCUMENT: "Document (Master)",
  REVISION: "Document Revision",
  CONTROLLED_COPY: "Controlled Copy",
};

const prettify = (code: string) =>
  code.toLowerCase().split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

/** State-policy rows are retained only while older configuration records exist.
 * New Document Master actions are ordinary workflow action policies. */
type MatrixPolicy = WorkflowActionPolicy & { source?: "WORKFLOW" | "STATE" };

/**
 * Action × From-Status matrix. One object type at a time (each lifecycle has its own
 * status set — mixing them would produce a meaningless sparse grid). Each cell shows
 * the winning policy (highest priority, active); clicking opens its details with a
 * jump to the right editor (workflow policy or state policy, depending on source).
 */
export const ActionStatusMatrix: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermissionAlias } = usePermissions();
  const [policies, setPolicies] = useState<MatrixPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [workflowLoadError, setWorkflowLoadError] = useState(false);
  const [statePolicyLoadError, setStatePolicyLoadError] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [objectType, setObjectType] = useState<string>("REVISION");
  const [actionSearch, setActionSearch] = useState("");
  const [detail, setDetail] = useState<{ policies: MatrixPolicy[]; action: string; status: string } | null>(null);

  const canManage = hasPermissionAlias("security.workflow_authorization.manage");

  useEffect(() => {
    setLoading(true);
    setWorkflowLoadError(false);
    setStatePolicyLoadError(false);
    Promise.allSettled([workflowActionPolicyApi.listPolicies(), lifecycleStatePolicyApi.list()])
      .then(([workflowResult, statePolicyResult]) => {
        const workflowPolicies = workflowResult.status === "fulfilled" ? workflowResult.value : [];
        const statePolicies = statePolicyResult.status === "fulfilled" ? statePolicyResult.value : [];
        setWorkflowLoadError(workflowResult.status === "rejected");
        setStatePolicyLoadError(statePolicyResult.status === "rejected");
        const workflowRows: MatrixPolicy[] = workflowPolicies.map((p) => p.objectType === "CONTROLLED_COPY_BATCH"
          ? { ...p, objectType: "CONTROLLED_COPY", workflowKey: "CONTROLLED_COPY" }
          : p);
        // Compatibility read for older Document Master lifecycle rows. New Master
        // policies are returned in workflowRows and take the normal editor route.
        const documentRows: MatrixPolicy[] = statePolicies
          .filter((sp) => sp.objectType === "DOCUMENT")
          .map((sp) => ({
            id: sp.id,
            moduleKey: sp.moduleKey,
            workflowKey: "DOCUMENT_LIFECYCLE",
            objectType: "DOCUMENT",
            actionCode: sp.capabilityCode,
            fromStatus: sp.statusCode ?? "ANY",
            documentTypeId: sp.documentTypeId,
            documentTypeName: sp.documentTypeName,
            requiredPermissionCode: sp.requiredPermissionCode ?? "—",
            priority: sp.priority,
            active: sp.active,
            system: sp.system,
            description: sp.description,
            actors: [{ actorType: sp.actorScope as never, actorTypeLabel: `Scope: ${prettify(sp.actorScope)}` }],
            source: "STATE" as const,
          }));
        setPolicies([...workflowRows, ...documentRows]);
      })
      .finally(() => setLoading(false));
  }, [loadVersion]);

  const objectTypeOptions = useMemo(() => {
    const types = [...new Set(policies.map((p) => p.objectType))];
    const canonical = Object.keys(STATUS_ORDER);
    types.sort((a, b) => {
      const ia = canonical.indexOf(a); const ib = canonical.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return types.map((t) => ({ label: OBJECT_TYPE_LABELS[t] ?? prettify(t), value: t }));
  }, [policies]);

  const scoped = useMemo(
    () => policies.filter((p) => p.objectType === objectType
      // REQUEST_COPY starts from an Effective Revision; it is an entry condition,
      // not a Controlled Copy lifecycle status and is shown separately below.
      && !(objectType === "CONTROLLED_COPY" && p.actionCode === "REQUEST_COPY")),
    [policies, objectType],
  );

  const statuses = useMemo(() => {
    // Canonical lifecycle first (always shown, even when empty), then any extra
    // statuses that appear in data but aren't in the canonical list.
    const order = STATUS_ORDER[objectType] ?? [];
    const present = [...new Set(scoped.map((p) => p.fromStatus))];
    const extras = present.filter((s) => !order.includes(s)).sort();
    return [...order, ...extras];
  }, [scoped, objectType]);

  const actions = useMemo(() => {
    const all = [...new Set(scoped.map((p) => p.actionCode))].sort();
    const q = actionSearch.trim().toLowerCase();
    if (!q) return all;
    return all.filter((a) => a.toLowerCase().includes(q) || prettify(a).toLowerCase().includes(q));
  }, [scoped, actionSearch]);

  /** All configured policies for a cell. Runtime selects a document-type override
   * only when the evaluated document matches its document type. */
  const cellPolicies = (action: string, status: string) =>
    scoped
      .filter((p) => p.actionCode === action && p.fromStatus === status)
      .sort((a, b) =>
        Number(b.active) - Number(a.active)
        || Number(a.documentTypeId !== null) - Number(b.documentTypeId !== null)
        || b.priority - a.priority,
      );

  if (loading) return <SectionLoading />;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <p className="text-xs text-blue-700">
          Who may perform which action, at which lifecycle status. Each ✓ is an active policy —
          click it to see the required permission, allowed actors and priority. Document Master,
          Document Revision and Controlled Copy are shown separately because their status sets differ.
        </p>
      </div>

      {objectType === "CONTROLLED_COPY" && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800">
          <p>
            <strong>Create controlled copy request:</strong> access is determined by the configured action policy. The source Document Master must be Active and its Revision must be Effective. This is an entry condition, not a Controlled Copy status.
          </p>
        </div>
      )}

      {/* Filter bar — same layout language as DocumentFilters (labeled search + selects, items-end grid) */}
      {(workflowLoadError || statePolicyLoadError) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <span>
            {workflowLoadError && statePolicyLoadError
              ? "Workflow and document-master policy data could not be loaded. The matrix is incomplete."
              : workflowLoadError
                ? "Workflow transition policy data could not be loaded. The matrix is incomplete."
                : "Document-master capability policy data could not be loaded. The matrix is incomplete."}
          </span>
          <Button size="sm" variant="outline" onClick={() => setLoadVersion((version) => version + 1)}>
            Retry
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
        <div className="w-full">
          <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Search</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search actions..."
              value={actionSearch}
              onChange={(e) => setActionSearch(e.target.value)}
              className="block w-full pl-10 pr-9 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
            />
            {actionSearch && (
              <button
                type="button"
                onClick={() => setActionSearch("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="w-full">
          <Select
            label="Object Type"
            value={objectType}
            onChange={(v) => setObjectType(String(v))}
            options={objectTypeOptions}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs sm:text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 text-2xs md:text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap border-r border-slate-200">
                Action
              </th>
              {statuses.map((s, i) => (
                <th key={s} className={`text-center px-3 py-3 text-2xs md:text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap ${i > 0 ? "border-l border-slate-100" : ""}`}>
                  {prettify(s)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {actions.length === 0 && (
              <tr>
                <td colSpan={statuses.length + 1} className="px-4 py-10 text-center text-sm text-slate-400">
                  No actions match your search.
                </td>
              </tr>
            )}
            {actions.map((action) => (
              <tr key={action}>
                <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap border-r border-slate-200">{prettify(action)}</td>
                {statuses.map((status, i) => {
                  const colBorder = i > 0 ? "border-l border-slate-100" : "";
                  const cell = cellPolicies(action, status);
                  const top = cell[0];
                  if (!top) return <td key={status} className={`px-3 py-3 ${colBorder}`} />;
                  const hasOverride = cell.some((p) => p.documentTypeId);
                  const hasActivePolicy = cell.some((p) => p.active);
                  return (
                    <td key={status} className={`px-3 py-3 text-center ${colBorder}`}>
                      <button
                        type="button"
                        onClick={() => setDetail({ policies: cell, action, status })}
                        title={`${top.requiredPermissionCode} — ${cell.length} policy(ies)`}
                        className={
                          hasActivePolicy
                            ? "inline-flex items-center justify-center h-7 w-7 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                            : "inline-flex items-center justify-center h-7 w-7 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors"
                        }
                      >
                        <Check className="h-4 w-4" />
                        {hasOverride && <span className="sr-only">has document-type overrides</span>}
                      </button>
                      {hasOverride && (
                        <Badge color="amber" size="xs" className="mt-0.5">+doc-type</Badge>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FormModal
        isOpen={Boolean(detail)}
        onClose={() => setDetail(null)}
        onConfirm={() => setDetail(null)}
        title={detail ? `${prettify(detail.action)} - ${prettify(detail.status)}` : ""}
        showCancel={false}
        confirmText="Close"
      >
        {detail && (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-slate-500">
              This list shows configuration scope, not one universal effective policy. A document-type override applies only when its document type matches.
            </p>
            {detail.policies.map((winner) => (
            <div key={winner.id} className="rounded-lg border border-slate-200 p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={winner.documentTypeId ? "amber" : "blue"} size="sm">
                  {winner.documentTypeId ? `Document Type: ${winner.documentTypeName ?? winner.documentTypeId}` : "Global"}
                </Badge>
              </div>
              <p className="text-2xs md:text-xs font-semibold uppercase tracking-wider text-slate-400">Required permission</p>
              <p className="font-mono text-xs text-slate-700 mt-0.5">{winner.requiredPermissionCode}</p>
              {winner.requiredPermissionName && <p className="text-xs text-slate-500">{winner.requiredPermissionName}</p>}
            <div>
              <p className="text-2xs md:text-xs font-semibold uppercase tracking-wider text-slate-400">Allowed actors</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {winner.actors.length === 0 ? (
                  <span className="text-xs text-slate-500">No actor restriction rows</span>
                ) : (
                  winner.actors.map((a, i) => (
                    <Badge key={i} color="blue" size="sm">
                      {a.actorTypeLabel ?? a.actorType}{a.actorDisplayName ? `: ${a.actorDisplayName}` : a.actorCode ? `: ${a.actorCode}` : ""}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge color={winner.active ? "emerald" : "slate"} size="sm">{winner.active ? "Active" : "Inactive"}</Badge>
              <Badge color="slate" size="sm">Priority {winner.priority}</Badge>
              {winner.system && <Badge color="purple" size="sm">System</Badge>}
              {detail.policies.length > 1 && (
                <span className="text-xs text-slate-500">
                  +{detail.policies.length - 1} more policy(ies) for this cell (doc-type overrides / lower priority)
                </span>
              )}
            </div>
            {canManage && (
              <Button
                size="sm"
                variant="outline-emerald"
                className="gap-1.5"
                onClick={() =>
                  navigate(
                    winner.source === "STATE"
                      ? `${ROUTES.SECURITY.WORKFLOW_AUTHORIZATION}/state-policies/${winner.id}/edit`
                      : `${ROUTES.SECURITY.WORKFLOW_AUTHORIZATION}/${winner.id}/edit`,
                  )
                }
              >
                {winner.source === "STATE" ? "Edit state policy" : "Edit policy"}
              </Button>
            )}
            </div>
            ))}
          </div>
        )}
      </FormModal>
    </div>
  );
};
