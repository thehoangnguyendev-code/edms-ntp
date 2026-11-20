import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ConfiguredDesktopFilters } from '@/components/ui/filter/ConfiguredDesktopFilters';

import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { useNavigate } from "react-router-dom";
import { Check, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { flagColor } from "@/utils/status";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { Select } from "@/components/ui/select/Select";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Button } from "@/components/ui/button/Button";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce } from "@/hooks/useDebounce";
import { workflowActionPolicyApi } from "@/services/api";
import { lifecycleStatePolicyApi } from "@/services/api/lifecycleStatePolicy";
import { ROUTES } from "@/app/routes.constants";
import type { WorkflowActionPolicy } from "../types";

import { TableMarkup } from "@/components/ui/table/TablePrimitives";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { moduleDisplayName } from "@/utils/moduleDisplay";
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
  // Report template review: the only state from which an action starts is Pending Approval
  REPORT_TEMPLATE: ["DRAFT", "PENDING_APPROVAL", "EFFECTIVE", "OBSOLETE", "DISCARDED"],
  TRAINING_REQUIREMENT: ["DRAFT", "PENDING_REVIEW", "PENDING_APPROVAL", "APPROVED"],
  TRAINING_MATRIX_VERSION: ["DRAFT", "PENDING_APPROVAL", "EFFECTIVE", "OBSOLETED"],
  TRAINING_ACTIVITY: ["PLANNED", "NOTIFIED", "IN_PROGRESS", "PENDING_QA_CONFIRMATION", "COMPLETED", "CANCELLED"],
  TRAINING_ASSESSMENT: ["DRAFT", "PENDING_APPROVAL", "EFFECTIVE"],
  TRAINING_JOB_ASSIGNMENT: ["DRAFT", "PENDING_RECEIVER"],
  TRAINING_PERSONNEL_REVIEW: ["OPEN"],
  UNCONTROLLED_COPY: ["READY_FOR_DISTRIBUTION", "DISTRIBUTED", "CLOSED_CANCELLED"],
};

/**
 * The matrix lists only the objects whose lifecycle is a status stepper on their own screen: the server defines that stepper
 * (WorkflowProgressService for documents and copies, ReportRevisionWorkflow, TrainingWorkflows), and a status of the object is
 * the "from" status of a policy. Objects that only have a flag or a job status (a participant, a report run, a review campaign...)
 * have no stepper and are not shown here; their policies are still edited on the Transition Policies tab.
 * Keys are the workflow_action_policies.object_type values (the controlled copy batch is shown with the controlled copy).
 */
const STEPPER_OBJECT_TYPES: ReadonlySet<string> = new Set([
  "DOCUMENT", "REVISION", "CONTROLLED_COPY", "UNCONTROLLED_COPY",
  "REPORT_TEMPLATE",
  "TRAINING_REQUIREMENT", "TRAINING_MATRIX_VERSION", "TRAINING_ACTIVITY", "TRAINING_ASSESSMENT", "TRAINING_JOB_ASSIGNMENT", "TRAINING_PERSONNEL_REVIEW",
]);

const OBJECT_TYPE_LABELS: Record<string, string> = {
  DOCUMENT: "Document (Master)",
  REVISION: "Document Revision",
  CONTROLLED_COPY: "Controlled Copy",
  REPORT_TEMPLATE: "Report Template (review)",
  TRAINING_REQUIREMENT: "Training Requirement",
  TRAINING_MATRIX_VERSION: "Training Matrix Version",
  TRAINING_ACTIVITY: "Training Activity",
  TRAINING_ASSESSMENT: "Training Assessment",
  TRAINING_JOB_ASSIGNMENT: "Training Job Assignment",
  TRAINING_PERSONNEL_REVIEW: "Training Personnel Review",
  UNCONTROLLED_COPY: "Uncontrolled Copy",
};

/** The module of a policy as a person knows it (the name of its menu). The policies spell one module in several ways ("DOCUMENT_CONTROL", "documents"). */
const moduleOf = (policy: { moduleKey?: string | null }) => moduleDisplayName(policy.moduleKey);

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
  const [moduleName, setModuleName] = useState<string>(moduleDisplayName("DOCUMENT_CONTROL"));
  const [objectType, setObjectType] = useState<string>("REVISION");
  const [actionSearch, setActionSearch] = useState("");
  const debouncedActionSearch = useDebounce(actionSearch, SEARCH_DEBOUNCE_MS);
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
        setPolicies([...workflowRows, ...documentRows].filter((policy) => STEPPER_OBJECT_TYPES.has(policy.objectType)));
      })
      .finally(() => setLoading(false));
  }, [loadVersion]);

  const moduleOptions = useMemo(() => {
    const names = [...new Set(policies.map(moduleOf))];
    // Document Control first (the original lifecycle), then the others in the order their policies come
    names.sort((a, b) => Number(b === moduleDisplayName("DOCUMENT_CONTROL")) - Number(a === moduleDisplayName("DOCUMENT_CONTROL")));
    return names.map((name) => ({ label: name, value: name }));
  }, [policies]);

  // Object types are those of the chosen module only: each module has its own objects and statuses.
  const objectTypeOptionsOf = useCallback((module: string) => {
    const types = [...new Set(policies.filter((p) => moduleOf(p) === module).map((p) => p.objectType))];
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
  const objectTypeOptions = useMemo(() => objectTypeOptionsOf(moduleName), [objectTypeOptionsOf, moduleName]);

  // A module that has no policy (after a reload) or an object type that belongs to another module is replaced by the first one that exists.
  useEffect(() => {
    if (moduleOptions.length > 0 && !moduleOptions.some((option) => option.value === moduleName)) setModuleName(moduleOptions[0].value);
  }, [moduleOptions, moduleName]);
  useEffect(() => {
    if (objectTypeOptions.length > 0 && !objectTypeOptions.some((option) => option.value === objectType)) setObjectType(objectTypeOptions[0].value);
  }, [objectTypeOptions, objectType]);

  const scoped = useMemo(
    () => policies.filter((p) => moduleOf(p) === moduleName && p.objectType === objectType
      // REQUEST_COPY starts from an Effective Revision; it is an entry condition,
      // not a Controlled Copy lifecycle status and is shown separately below.
      && !(objectType === "CONTROLLED_COPY" && p.actionCode === "REQUEST_COPY")),
    [policies, moduleName, objectType],
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
    const q = debouncedActionSearch.trim().toLowerCase();
    if (!q) return all;
    return all.filter((a) => a.toLowerCase().includes(q) || prettify(a).toLowerCase().includes(q));
  }, [scoped, debouncedActionSearch]);

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
    <div className="compact-filter-stack space-y-4">
      <WarningBanner
        variant="info"
        description={
          <>
          Which action can start from which status. Each ✓ means the action is allowed from that status;
          click it to see who: a person needs the required permission AND must be the right person
          (for example the named Reviewer, or anyone holding the operator permission). A blank cell means
          the action cannot start from that status. Only objects that show a status stepper on their screen are
          listed. Choose the module first, then the object type: each object type has its own statuses, so they are shown one at a time. To change a rule, use the Transition Policies tab.
          </>
        }
      />

      {objectType === "CONTROLLED_COPY" && (
        <WarningBanner
          variant="success"
          description={
            <>
            <strong>Create controlled copy request:</strong> access is determined by the configured action policy. The source Document Master must be Active and its Revision must be Effective. This is an entry condition, not a Controlled Copy status.
            </>
          }
        />
      )}

      {/* Filter bar — same layout language as DocumentFilters (labeled search + selects, items-end grid) */}
      {(workflowLoadError || statePolicyLoadError) && (
        <WarningBanner
          variant="warning"
          description={
            <>
            {workflowLoadError && statePolicyLoadError
              ? "Workflow and document-master policy data could not be loaded. The matrix is incomplete."
              : workflowLoadError
                ? "Workflow transition policy data could not be loaded. The matrix is incomplete."
                : "Document-master capability policy data could not be loaded. The matrix is incomplete."}
            </>
          }
        >
          <Button size="sm" variant="outline" onClick={() => setLoadVersion((version) => version + 1)}>
            Retry
          </Button>
        </WarningBanner>
      )}

      <ConfiguredDesktopFilters preserveMobile
        search={<input aria-label="Search actions" value={actionSearch} onChange={event => setActionSearch(event.target.value)} placeholder="Search actions..." className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm" />}
        filters={[
          { id: 'module', label: 'Module', value: moduleName, options: moduleOptions, resetOnChange: { objectType: '' }, onChange: setModuleName },
          { id: 'objectType', label: 'Object Type', value: objectType, options: objectTypeOptions, dependsOn: ['module'], getOptions: (draft) => objectTypeOptionsOf(draft.module ?? moduleName), onChange: setObjectType },
        ]}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
        <div className="w-full">
          <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block capitalize">Search</label>
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
            label="Module"
            value={moduleName}
            onChange={(v) => { const next = String(v); setModuleName(next); setObjectType(objectTypeOptionsOf(next)[0]?.value ?? ""); }}
            options={moduleOptions}
          />
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

      </ConfiguredDesktopFilters>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <TableMarkup.Root className="w-full text-xs sm:text-sm">
          <TableMarkup.Head className="bg-slate-50">
            <TableMarkup.Row>
              <TableMarkup.HeaderCell className="text-left px-4 py-3 text-2xs md:text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap border-r border-slate-200">
                Action
              </TableMarkup.HeaderCell>
              {statuses.map((s, i) => (
                <TableMarkup.HeaderCell key={s} className={`text-center px-3 py-3 text-2xs md:text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap ${i > 0 ? "border-l border-slate-100" : ""}`}>
                  {prettify(s)}
                </TableMarkup.HeaderCell>
              ))}
            </TableMarkup.Row>
          </TableMarkup.Head>
          <TableMarkup.Body className="divide-y divide-slate-100">
            {actions.length === 0 && (
              <TableMarkup.Row>
                <TableMarkup.Cell colSpan={statuses.length + 1} className="p-0">
                  <TableEmptyState title="No actions found" description="No actions match your search." />
                </TableMarkup.Cell>
              </TableMarkup.Row>
            )}
            {actions.map((action) => (
              <TableMarkup.Row key={action}>
                <TableMarkup.Cell className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap border-r border-slate-200">{prettify(action)}</TableMarkup.Cell>
                {statuses.map((status, i) => {
                  const colBorder = i > 0 ? "border-l border-slate-100" : "";
                  const cell = cellPolicies(action, status);
                  const top = cell[0];
                  if (!top) return <TableMarkup.Cell key={status} className={`px-3 py-3 ${colBorder}`} />;
                  const hasOverride = cell.some((p) => p.documentTypeId);
                  const hasActivePolicy = cell.some((p) => p.active);
                  return (
                    <TableMarkup.Cell key={status} className={`px-3 py-3 text-center ${colBorder}`}>
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
                    </TableMarkup.Cell>
                  );
                })}
              </TableMarkup.Row>
            ))}
          </TableMarkup.Body>
        </TableMarkup.Root>
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
                  {winner.documentTypeId ? `Document Type: ${winner.documentTypeName ?? "—"}` : "Global"}
                </Badge>
              </div>
              <p className="text-2xs md:text-xs font-semibold uppercase tracking-wider text-slate-400">Required permission</p>
              <p className=" text-xs text-slate-700 mt-0.5">{winner.requiredPermissionCode}</p>
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
              <Badge color={flagColor(winner.active)} size="sm">{winner.active ? "Active" : "Inactive"}</Badge>
              <Badge color="slate" size="sm">Priority {winner.priority}</Badge>
              {winner.system && <Badge color="blue" size="sm">System</Badge>}
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
