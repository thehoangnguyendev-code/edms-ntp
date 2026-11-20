import React, { useEffect, useMemo, useState } from "react";
import { Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { FormSection } from "@/components/ui/form/FormSection";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { TableMarkup } from "@/components/ui/table/TablePrimitives";
import { TABLE_STYLES } from "@/components/ui/table/tableStyles";
import { cn } from "@/components/ui/utils";
import type {
  WorkflowActionOption,
  WorkflowActionPolicy,
  WorkflowActionPolicyActorRequest,
  WorkflowActionPolicyOptions,
  WorkflowActorTypeOption,
} from "../types";
import { IconUserQuestion } from "@tabler/icons-react";

/**
 * The same policy, four ways to fill it in. The four layouts only change how the fields are arranged: they read and write the one form
 * state of the page (`PolicyRuleLayoutProps`), so switching from one to another loses nothing and the validation and the save are the same.
 */
export type PolicyLayoutMode = "sentence" | "steps" | "matrix" | "templates";

type IdentityField = "moduleKey" | "workflowKey" | "objectType" | "actionCode" | "fromStatus";

export interface PolicyRuleFormValues {
  moduleKey: string;
  workflowKey: string;
  objectType: string;
  actionCode: string;
  fromStatus: string;
  documentTypeId: string;
  requiredPermissionCode: string;
  actors: WorkflowActionPolicyActorRequest[];
}

export interface PolicyRuleLayoutProps {
  mode: "create" | "edit" | "override";
  form: PolicyRuleFormValues;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setField: (key: IdentityField | "requiredPermissionCode" | "actors", value: any) => void;
  /** The field cannot be changed (the identity of a policy that exists). */
  locked: (field: IdentityField) => boolean;
  options: WorkflowActionPolicyOptions | null;
  moduleOptions: SelectOption[];
  workflowOptions: SelectOption[];
  objectTypeOptions: SelectOption[];
  actionOptions: SelectOption[];
  fromStatusOptions: SelectOption[];
  allowedActorTypes: WorkflowActorTypeOption[];
  /** Every policy now configured: to say when the one being written meets another, and to mark the cells of the matrix that are taken. */
  existing: WorkflowActionPolicy[];
  sourcePolicyId?: string;
  /** The Required Permission picker, the Actors list and the Options block (document type, priority, active, description, reason) of the page. */
  permissionField: React.ReactNode;
  actorsField: React.ReactNode;
  optionsSection: React.ReactNode;
  /**
   * Whether the actors of this policy are read at runtime: only REQUEST_COPY of a Controlled Copy (a step with no record yet, so outside the engine). For every other policy the engine
   * decides from the permission, the relations and the state, so the actors are not asked for. Left out, they are shown (the layouts keep working on their own).
   */
  actorsRelevant?: boolean;
}

const showsActors = (props: PolicyRuleLayoutProps) => props.actorsRelevant !== false;

const prettify = (code: string) =>
  code.toLowerCase().split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

const FIELD_LABEL: Record<IdentityField, string> = {
  moduleKey: "Module",
  workflowKey: "Workflow",
  objectType: "Object Type",
  actionCode: "Action",
  fromStatus: "From Status",
};

/** The label of an option; a code the server sends as its own label ("TRAINING_ACTIVITY", "PLANNED") is shown as words. */
const optionLabel = (list: SelectOption[], value: string) => {
  const label = String(list.find((option) => String(option.value) === value)?.label ?? value);
  return /^[A-Z0-9]+(_[A-Z0-9]+)*$/.test(label) ? prettify(label) : label;
};

// ── Pieces shared by the four layouts ───────────────────────────────────────

const fieldOptions = (props: PolicyRuleLayoutProps, field: IdentityField): SelectOption[] => {
  switch (field) {
    case "moduleKey": return props.moduleOptions;
    case "workflowKey": return props.workflowOptions;
    case "objectType": return props.objectTypeOptions;
    case "actionCode": return props.actionOptions;
    default: return props.fromStatusOptions.length > 0 ? [{ label: "Select status", value: "" }, ...props.fromStatusOptions] : [];
  }
};

/** A select among the words of a sentence, or the plain value when that part of the policy cannot be changed. */
const InlineField: React.FC<{ props: PolicyRuleLayoutProps; field: IdentityField; width?: string }> = ({ props, field, width = "w-48" }) => {
  const value = props.form[field];
  const options = fieldOptions(props, field);
  if (props.locked(field)) {
    return <span className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700">{optionLabel(options, value) || "(none)"}</span>;
  }
  const needsAction = field === "fromStatus" && options.length === 0;
  return (
    <span className={cn("inline-block align-middle", width)}>
      <Select
        aria-label={FIELD_LABEL[field]}
        value={value}
        onChange={(next) => props.setField(field, next)}
        options={options}
        placeholder={needsAction ? "Choose an action" : FIELD_LABEL[field]}
        disabled={needsAction || (field !== "moduleKey" && field !== "workflowKey" && !props.form.workflowKey)}
        enableSearch={false}
      />
    </span>
  );
};

/** The five fields that say which action, on which object, from which status, laid out as labelled fields. */
const IdentityGrid: React.FC<{ props: PolicyRuleLayoutProps; fields: IdentityField[] }> = ({ props, fields }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    {fields.map((field) => {
      const options = fieldOptions(props, field);
      const value = props.form[field];
      const needsWorkflow = field !== "moduleKey" && field !== "workflowKey" && !props.form.workflowKey;
      if (props.locked(field)) {
        return (
          <div key={field}>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">{FIELD_LABEL[field]}</label>
            <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">{optionLabel(options, value) || "(none)"}</div>
          </div>
        );
      }
      return (
        <div key={field}>
          <Select
            label={`${FIELD_LABEL[field]} *`}
            value={value}
            onChange={(next) => props.setField(field, next)}
            options={options}
            disabled={needsWorkflow || (field === "fromStatus" && options.length === 0)}
          />
          {needsWorkflow && <p className="mt-1 text-2xs text-slate-400">Select a workflow first.</p>}
          {field === "fromStatus" && !needsWorkflow && options.length === 0 && <p className="mt-1 text-2xs text-slate-400">Select an action first.</p>}
        </div>
      );
    })}
  </div>
);

/** The actors other than "anyone with the permission", by name, joined with "or". */
const actorsText = (props: PolicyRuleLayoutProps) => {
  const labels = props.form.actors
    .filter((actor) => actor.actorType !== "PERMISSION")
    .map((actor) => props.allowedActorTypes.find((type) => type.value === actor.actorType)?.label ?? prettify(actor.actorType));
  return [...new Set(labels)].join(" or ");
};

/** The rule in one sentence, as far as it is filled in. */
export const describePolicy = (props: PolicyRuleLayoutProps): string => {
  const { form } = props;
  const object = form.objectType ? optionLabel(props.objectTypeOptions, form.objectType) : "…";
  const status = form.fromStatus ? prettify(form.fromStatus) : "…";
  const action = form.actionCode ? optionLabel(props.actionOptions, form.actionCode) : "…";
  const permission = form.requiredPermissionCode || "…";
  const who = !showsActors(props) ? "" : form.actors.length === 0 ? "and is …" : actorsText(props) ? `and is ${actorsText(props)}` : "";
  return `When a ${object} is in ${status}, “${action}” may be done by someone who holds ${permission}${who ? ` ${who}` : ""}.`;
};

/** Another active policy for the same action, status and document type: what the owner should know before saving a second one. */
export const conflictOf = (props: PolicyRuleLayoutProps): WorkflowActionPolicy | undefined => {
  const { form } = props;
  if (!form.objectType || !form.actionCode || !form.fromStatus) return undefined;
  return props.existing.find((policy) => policy.id !== props.sourcePolicyId && policy.active
    && policy.objectType === form.objectType && policy.actionCode === form.actionCode && policy.fromStatus === form.fromStatus
    && (policy.documentTypeId ?? "") === form.documentTypeId);
};

const ConflictNote: React.FC<{ props: PolicyRuleLayoutProps }> = ({ props }) => {
  const other = conflictOf(props);
  if (!other) return null;
  return (
    <WarningBanner variant="warning">
      A policy already exists for this action and status (priority {other.priority}, permission {other.requiredPermissionCode}).
      {props.mode === "create" ? " Edit that policy instead, or give this one a document type or a different priority." : ""}
    </WarningBanner>
  );
};

const SentenceCard: React.FC<{ props: PolicyRuleLayoutProps }> = ({ props }) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">This policy says</p>
    <p className="mt-1 text-sm leading-relaxed text-slate-700">{describePolicy(props)}</p>
  </div>
);

const WhoBlock: React.FC<{ props: PolicyRuleLayoutProps }> = ({ props }) => (
  <div className="flex flex-col gap-4">
    <div>{props.permissionField}</div>
    {showsActors(props) && <div>{props.actorsField}</div>}
  </div>
);

// ── 1. Sentence ─────────────────────────────────────────────────────────────

const SentenceLayout: React.FC<{ props: PolicyRuleLayoutProps }> = ({ props }) => (
  <div className="flex flex-col gap-4 md:gap-6">
    <FormSection title="Rule" icon={<Info className="h-4 w-4" />} contentClassName="p-4 md:p-5">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3 text-sm leading-9 text-slate-700">
          In <InlineField props={props} field="moduleKey" />, workflow <InlineField props={props} field="workflowKey" />, for a{" "}
          <InlineField props={props} field="objectType" />, the action <InlineField props={props} field="actionCode" /> may be done when it is in{" "}
          <InlineField props={props} field="fromStatus" width="w-44" /> by someone who holds the permission{showsActors(props) ? " and is one of the actors below" : ""}.
        </div>
        <SentenceCard props={props} />
        <ConflictNote props={props} />
      </div>
    </FormSection>
    <FormSection icon={<IconUserQuestion className="h-4 w-4" />} title="Who may do it" contentClassName="p-4 md:p-5"><WhoBlock props={props} /></FormSection>
    {props.optionsSection}
  </div>
);

// ── 2. Steps ────────────────────────────────────────────────────────────────

const STEPS = ["What", "Who", "Options", "Review"] as const;

const StepsLayout: React.FC<{ props: PolicyRuleLayoutProps }> = ({ props }) => {
  const identityFixed = (["moduleKey", "workflowKey", "objectType", "actionCode", "fromStatus"] as IdentityField[]).every((field) => props.locked(field));
  const [step, setStep] = useState(identityFixed ? 1 : 0);
  const { form } = props;
  const whatDone = Boolean(form.moduleKey && form.workflowKey && form.objectType && form.actionCode && form.fromStatus);
  const whoDone = Boolean(form.requiredPermissionCode && (!showsActors(props) || form.actors.length > 0));
  const stepReady = [whatDone, whoDone, true, true];
  const hint = step === 0 && !whatDone ? "Choose all five to go on." : step === 1 && !whoDone ? (showsActors(props) ? "Choose the permission and at least one actor to go on." : "Choose the permission to go on.") : "";
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <WorkflowStepper
        steps={STEPS}
        currentStepIndex={step}
        numbered
        onStepClick={(index) => { if (index <= step || stepReady.slice(0, index).every(Boolean)) setStep(index); }}
      />
      {step === 0 && (
        <FormSection title="What is this policy for?" contentClassName="p-4 md:p-5">
          <p className="mb-4 text-xs text-slate-500">Choose in order: each list shows only what fits the one before it.</p>
          <IdentityGrid props={props} fields={["moduleKey", "workflowKey", "objectType", "actionCode", "fromStatus"]} />
        </FormSection>
      )}
      {step === 1 && (
        <FormSection icon={<IconUserQuestion className="h-4 w-4" />} title="Who may do it?" contentClassName="p-4 md:p-5">
          <p className="mb-4 text-xs text-slate-500">{showsActors(props) ? <>The person must hold the permission <b>and</b> be one of the actors.</> : "The person must hold the permission, and the relations of the record and its state decide the rest."}</p>
          <WhoBlock props={props} />
        </FormSection>
      )}
      {step === 2 && props.optionsSection}
      {step === 3 && (
        <FormSection title="Review" contentClassName="p-4 md:p-5">
          <div className="space-y-4">
            <SentenceCard props={props} />
            <ConflictNote props={props} />
            <p className="text-xs text-slate-500">Use the save button at the top of the page to save the policy.</p>
          </div>
        </FormSection>
      )}
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline-emerald" size="sm" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>Back</Button>
        <span className="text-xs text-slate-500">{hint}</span>
        <Button variant="outline-emerald" size="sm" disabled={step === STEPS.length - 1 || !stepReady[step]} onClick={() => setStep((current) => Math.min(STEPS.length - 1, current + 1))}>Next</Button>
      </div>
    </div>
  );
};

// ── 3. Matrix ───────────────────────────────────────────────────────────────

const MatrixLayout: React.FC<{ props: PolicyRuleLayoutProps }> = ({ props }) => {
  const { form, options, existing } = props;
  const actions = useMemo(() => {
    const seen = new Set<string>();
    return (options?.actions ?? []).filter((action: WorkflowActionOption) => {
      if (!form.workflowKey || action.workflowKey !== form.workflowKey) return false;
      if (form.objectType && action.objectType && action.objectType !== form.objectType) return false;
      if (seen.has(action.value)) return false;
      seen.add(action.value);
      return true;
    });
  }, [options, form.workflowKey, form.objectType]);
  const statuses = useMemo(() => [...new Set(actions.flatMap((action) => action.defaultFromStatuses ?? []))], [actions]);
  const taken = (action: string, status: string) => existing.some((policy) => policy.id !== props.sourcePolicyId && policy.active
    && policy.objectType === form.objectType && policy.actionCode === action && policy.fromStatus === status && !policy.documentTypeId);
  const identityLocked = props.locked("actionCode") && props.locked("fromStatus");
  const choose = (action: string, status: string) => {
    if (identityLocked) return;
    props.setField("actionCode", action);
    props.setField("fromStatus", status);
  };
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <FormSection title="Which action, from which status" contentClassName="p-4 md:p-5">
        <div className="space-y-4">
          <IdentityGrid props={props} fields={["moduleKey", "workflowKey", "objectType"]} />
          {!form.objectType ? (
            <p className="text-xs text-slate-500">Choose the module, the workflow and the object type: the actions and the statuses of that object appear as a table.</p>
          ) : (
            <>
              <p className="text-xs text-slate-500">
                {identityLocked ? "The action and the status of an existing policy cannot be changed." : "Click the cell where the action starts. "}
                <span className="inline-flex items-center gap-1 align-middle"><span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" /> a policy already exists there</span>
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <TableMarkup.Root className="w-full text-xs sm:text-sm">
                  <TableMarkup.Head className="bg-slate-50">
                    <TableMarkup.Row>
                      <TableMarkup.HeaderCell className={cn(TABLE_STYLES.headerCell7, "border-r border-slate-200 text-left")}>Action</TableMarkup.HeaderCell>
                      {statuses.map((status) => (
                        <TableMarkup.HeaderCell key={status} className={cn(TABLE_STYLES.headerCell7, "whitespace-nowrap text-center")}>{prettify(status)}</TableMarkup.HeaderCell>
                      ))}
                    </TableMarkup.Row>
                  </TableMarkup.Head>
                  <TableMarkup.Body className="divide-y divide-slate-100">
                    {actions.length === 0 && (
                      <TableMarkup.Row><TableMarkup.Cell colSpan={statuses.length + 1} className="px-4 py-6 text-center text-slate-500">This object has no action to configure.</TableMarkup.Cell></TableMarkup.Row>
                    )}
                    {actions.map((action) => (
                      <TableMarkup.Row key={action.value}>
                        <TableMarkup.Cell className="whitespace-nowrap border-r border-slate-200 px-4 py-2.5 font-medium text-slate-700">{action.label || prettify(action.value)}</TableMarkup.Cell>
                        {statuses.map((status) => {
                          const possible = (action.defaultFromStatuses ?? []).includes(status);
                          const selected = form.actionCode === action.value && form.fromStatus === status;
                          return (
                            <TableMarkup.Cell key={status} className="px-3 py-2.5 text-center">
                              {possible && (
                                <button
                                  type="button"
                                  disabled={identityLocked}
                                  aria-pressed={selected}
                                  aria-label={`${action.label || action.value} from ${prettify(status)}`}
                                  onClick={() => choose(action.value, status)}
                                  className={cn(
                                    "relative inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-default",
                                    selected ? "border-emerald-600 bg-emerald-600 text-white" : "border-dashed border-slate-300 text-slate-300 hover:border-emerald-400 hover:text-emerald-600",
                                  )}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  {taken(action.value, status) && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />}
                                </button>
                              )}
                            </TableMarkup.Cell>
                          );
                        })}
                      </TableMarkup.Row>
                    ))}
                  </TableMarkup.Body>
                </TableMarkup.Root>
              </div>
            </>
          )}
          <ConflictNote props={props} />
        </div>
      </FormSection>
      {form.actionCode && form.fromStatus ? (
        <>
          <FormSection title={`Who may ${optionLabel(props.actionOptions, form.actionCode)} when ${prettify(form.fromStatus)}`} contentClassName="p-4 md:p-5">
            <div className="space-y-4"><SentenceCard props={props} /><WhoBlock props={props} /></div>
          </FormSection>
          {props.optionsSection}
        </>
      ) : null}
    </div>
  );
};

// ── 4. Templates ────────────────────────────────────────────────────────────

interface WhoTemplate {
  id: string;
  title: string;
  description: string;
  /** The type of actor it needs; the template is offered only when the action allows it. */
  actorType: string;
}

const WHO_TEMPLATES: WhoTemplate[] = [
  { id: "PERMISSION", title: "Anyone with the permission", description: "Whoever holds the required permission may do it.", actorType: "PERMISSION" },
  { id: "OWNER", title: "Only the owner", description: "The permission, and being the owner of the record.", actorType: "OWNER" },
  { id: "AUTHOR", title: "Only the author", description: "The permission, and being the author of the record.", actorType: "AUTHOR" },
  { id: "ASSIGNED_REVIEWER", title: "The assigned reviewer", description: "The permission, and being the reviewer named on the record.", actorType: "ASSIGNED_REVIEWER" },
  { id: "ASSIGNED_APPROVER", title: "The assigned approver", description: "The permission, and being the approver named on the record.", actorType: "ASSIGNED_APPROVER" },
  { id: "RECIPIENT", title: "The recipient", description: "The permission, and being the recipient of the record.", actorType: "RECIPIENT" },
];

const TemplatesLayout: React.FC<{ props: PolicyRuleLayoutProps }> = ({ props }) => {
  const { form } = props;
  const allowed = new Set(props.allowedActorTypes.map((type) => type.value));
  const offered = WHO_TEMPLATES.filter((template) => allowed.has(template.actorType));
  const only = form.actors.length === 1 ? form.actors[0] : null;
  const activeId = only && offered.some((template) => template.actorType === only.actorType) ? only.actorType : null;
  const [custom, setCustom] = useState(false);
  const showCustom = custom || (form.actors.length > 0 && activeId === null);

  const actorsFor = (template: WhoTemplate): WorkflowActionPolicyActorRequest[] =>
    [{ actorType: template.actorType, actorCode: template.actorType === "PERMISSION" ? form.requiredPermissionCode || null : null }];

  // "Anyone with the permission" names the permission itself as the actor: it follows the permission when that changes.
  useEffect(() => {
    if (showsActors(props) && only?.actorType === "PERMISSION" && form.requiredPermissionCode && only.actorCode !== form.requiredPermissionCode) {
      props.setField("actors", [{ actorType: "PERMISSION", actorCode: form.requiredPermissionCode }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.requiredPermissionCode, only?.actorType, only?.actorCode]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="grid gap-4 md:gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4 md:gap-6">
          <FormSection title="Which action, when" contentClassName="p-4 md:p-5">
            <IdentityGrid props={props} fields={["moduleKey", "workflowKey", "objectType", "actionCode", "fromStatus"]} />
          </FormSection>
          <FormSection icon={<IconUserQuestion className="h-4 w-4" />} title="Who may do it" contentClassName="p-4 md:p-5">
            <div className="space-y-4">
              {showsActors(props) && offered.length === 0 && <p className="text-xs text-slate-500">Choose an action first: the choices depend on it.</p>}
              {showsActors(props) && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {offered.map((template) => {
                  const active = !showCustom && activeId === template.actorType;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => { setCustom(false); props.setField("actors", actorsFor(template)); }}
                      className={cn("rounded-xl border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500", active ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300")}
                    >
                      <span className="block text-sm font-semibold text-slate-800">{template.title}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{template.description}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-pressed={showCustom}
                  onClick={() => setCustom(true)}
                  className={cn("rounded-xl border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500", showCustom ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300")}
                >
                  <span className="block text-sm font-semibold text-slate-800">Custom</span>
                  <span className="mt-0.5 block text-xs text-slate-500">Choose the actors one by one (several, or with a code).</span>
                </button>
              </div>}
              {showsActors(props) && showCustom && <div>{props.actorsField}</div>}
              <div>{props.permissionField}</div>
            </div>
          </FormSection>
          {props.optionsSection}
        </div>
        <aside className="flex flex-col gap-4 self-start lg:sticky lg:top-4">
          <SentenceCard props={props} />
          <ConflictNote props={props} />
        </aside>
      </div>
    </div>
  );
};

// ── Entry point ─────────────────────────────────────────────────────────────

export const PolicyRuleLayout: React.FC<{ layout: PolicyLayoutMode; props: PolicyRuleLayoutProps }> = ({ layout, props }) => {
  switch (layout) {
    case "steps": return <StepsLayout props={props} />;
    case "matrix": return <MatrixLayout props={props} />;
    case "templates": return <TemplatesLayout props={props} />;
    default: return <SentenceLayout props={props} />;
  }
};
