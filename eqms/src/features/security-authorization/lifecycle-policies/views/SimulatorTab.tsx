import React, { useEffect, useMemo, useState } from "react";
import { FlaskConical, Play, ShieldCheck, ShieldX, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { FormSection } from "@/components/ui/form/FormSection";
import { Badge } from "@/components/ui/badge/Badge";
import { Select, type SelectOption, type SelectOptionGroup } from "@/components/ui/select/Select";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { cn } from "@/components/ui/utils";
import { securityApi, type AuthorizationEngineDecision } from "@/services/api/security";
import { ActorPickerModal, type SimulatorActor } from "./ActorPickerModal";
import { tr, trFormat } from "@/i18n";

const RESOURCE_TYPE_OPTIONS: SelectOption[] = [
  { label: "Document", value: "DOCUMENT" },
  { label: "Revision", value: "REVISION" },
  { label: tr("Controlled Copy"), value: "CONTROLLED_COPY" },
  { label: tr("Controlled Copy Batch"), value: "CONTROLLED_COPY_BATCH" },
  { label: tr("Report Template (review)"), value: "REPORT_TEMPLATE" },
  { label: tr("Training Requirement"), value: "TRAINING_REQUIREMENT" },
  { label: tr("Training Matrix Version"), value: "TRAINING_MATRIX_VERSION" },
  { label: tr("Training Activity"), value: "TRAINING_ACTIVITY" },
  { label: tr("Training Participant"), value: "TRAINING_PARTICIPANT" },
  { label: tr("Training Assessment"), value: "TRAINING_ASSESSMENT" },
  { label: tr("Training Job Assignment"), value: "TRAINING_JOB_ASSIGNMENT" },
  { label: tr("Training Personnel Review"), value: "TRAINING_PERSONNEL_REVIEW" },
  { label: tr("Training Record Export"), value: "TRAINING_RECORD_EXPORT" },
  { label: tr("Training Record Export Batch"), value: "TRAINING_RECORD_EXPORT_BATCH" },
  { label: tr("Training Trainer Exception"), value: "TRAINING_TRAINER_EXCEPTION" },
  { label: tr("Training Suspension"), value: "TRAINING_SUSPENSION" },
  { label: tr("Training Vendor"), value: "TRAINING_VENDOR" },
  { label: tr("Training Record"), value: "TRAINING_RECORD" },
  { label: tr("Report Schedule"), value: "REPORT_SCHEDULE" },
  { label: tr("Report Run"), value: "REPORT_RUN" },
  { label: tr("Report File (legal hold)"), value: "REPORT_ARTIFACT" },
  { label: tr("Access Review Campaign"), value: "ACCESS_REVIEW_CAMPAIGN" },
  { label: tr("Audit Trail Review Campaign"), value: "AUDIT_REVIEW_CAMPAIGN" },
  { label: tr("Uncontrolled Copy"), value: "UNCONTROLLED_COPY" },
];

const ACTIONS_BY_RESOURCE_TYPE: Record<string, SelectOption[]> = {
  DOCUMENT: ["CANCEL", "OBSOLETE", "UPDATE_METADATA"].map((v) => ({ label: v, value: v })),
  REVISION: [
    "UPDATE_DRAFT_METADATA", "UPLOAD_SOURCE", "OPEN_PUBLISHING_WORKSPACE",
    "GENERATE_REVIEW_SNAPSHOT", "SUBMIT_FOR_REVIEW", "COMPLETE_REVIEW", "REJECT_REVIEW",
    "COMPLETE_APPROVAL", "REJECT_APPROVAL", "COMPLETE_TRAINING", "PUBLISH", "CANCEL", "OBSOLETE",
    "UPGRADE_REVISION", "REGENERATE_SNAPSHOT",
  ].map((v) => ({ label: v, value: v })),
  CONTROLLED_COPY: [
    "VIEW_COPY", "PREVIEW_FILE", "DOWNLOAD_FILE", "PRINT_COPY", "DISTRIBUTE_COPY", "RECALL_COPY",
    "REPORT_LOST_DAMAGED", "REPLACE_LOST_DAMAGED", "UPLOAD_EVIDENCE", "EXPIRE_COPY", "CANCEL_REQUEST",
  ].map((v) => ({ label: v, value: v })),
  CONTROLLED_COPY_BATCH: ["DISTRIBUTE_BATCH", "RECALL_BATCH", "CANCEL_REQUEST"].map((v) => ({ label: v, value: v })),
  // the GMP variant is chosen by the engine from the template itself: the simulator asks for APPROVE or REJECT
  REPORT_TEMPLATE: ["APPROVE", "REJECT"].map((v) => ({ label: v, value: v })),
  TRAINING_REQUIREMENT: ["SUBMIT", "REVIEW", "APPROVE", "REJECT"].map((v) => ({ label: v, value: v })),
  TRAINING_MATRIX_VERSION: ["SUBMIT", "APPROVE", "REJECT"].map((v) => ({ label: v, value: v })),
  TRAINING_ACTIVITY: ["UPDATE", "ADD_SESSION", "ADD_PARTICIPANTS", "CONFIRM_LIST", "NOTIFY", "CANCEL", "REOPEN_CONTENT", "SUPPLEMENTARY", "CONTENT_REVIEW", "CONTENT_APPROVE", "SEND_ATTENDANCE_LIST", "FINISH", "CONFIRM_COMPLETION", "RETURN_FOR_CORRECTION", "HOLD_SESSION", "RECORD_ATTENDANCE", "POSTPONE_SESSION", "UPDATE_SESSION", "SET_CONTENT_EXEMPTIONS", "RECORD_ASSESSMENT", "DESIGNATE"].map((v) => ({ label: v, value: v })),
  TRAINING_PARTICIPANT: ["REMIND_TO_READ", "EXCUSE_READER", "CORRECT_ATTENDANCE", "SET_PARTICIPATION", "REMOVE_PARTICIPANT", "SET_PLANNED_ABSENCE", "CONFIRM_READ"].map((v) => ({ label: v, value: v })),
  TRAINING_ASSESSMENT: ["UPDATE", "DELETE", "SUBMIT", "APPROVE", "RETURN_TO_DRAFT", "UPGRADE_REVISION"].map((v) => ({ label: v, value: v })),
  TRAINING_JOB_ASSIGNMENT: ["UPDATE", "REQUEST_EXCEPTION", "APPROVE_EXCEPTION", "SUBMIT", "ACCEPT", "CANCEL"].map((v) => ({ label: v, value: v })),
  TRAINING_PERSONNEL_REVIEW: ["UPDATE_ITEM", "CREATE_ACTIVITY", "CLOSE", "CANCEL", "CHANGE_CLOSER"].map((v) => ({ label: v, value: v })),
  TRAINING_RECORD_EXPORT: ["APPROVE", "REJECT"].map((v) => ({ label: v, value: v })),
  TRAINING_RECORD_EXPORT_BATCH: ["APPROVE", "REJECT"].map((v) => ({ label: v, value: v })),
  TRAINING_TRAINER_EXCEPTION: ["APPROVE", "REJECT"].map((v) => ({ label: v, value: v })),
  TRAINING_SUSPENSION: ["RESUME"].map((v) => ({ label: v, value: v })),
  TRAINING_VENDOR: ["APPROVE"].map((v) => ({ label: v, value: v })),
  TRAINING_RECORD: ["VOID"].map((v) => ({ label: v, value: v })),
  REPORT_SCHEDULE: ["PAUSE", "RESUME", "DELETE", "CHANGE_OWNER"].map((v) => ({ label: v, value: v })),
  REPORT_RUN: ["RETRY"].map((v) => ({ label: v, value: v })),
  REPORT_ARTIFACT: ["PLACE_HOLD", "RELEASE_HOLD"].map((v) => ({ label: v, value: v })),
  ACCESS_REVIEW_CAMPAIGN: ["DECIDE_ITEM", "COMPLETE", "CANCEL"].map((v) => ({ label: v, value: v })),
  AUDIT_REVIEW_CAMPAIGN: ["DECIDE_ITEM", "COMPLETE", "CANCEL"].map((v) => ({ label: v, value: v })),
  UNCONTROLLED_COPY: ["DISTRIBUTE", "CANCEL"].map((v) => ({ label: v, value: v })),
};

type FoundRecord = { id: string; label: string; state: string | null };

const humanize = (code: string | null | undefined) => {
  if (!code) return "";
  const text = code.toLowerCase().replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const RESOURCE_GROUPS: SelectOptionGroup[] = [
  { groupLabel: "Document Control", match: (v: string) => ["DOCUMENT", "REVISION", "CONTROLLED_COPY", "CONTROLLED_COPY_BATCH", "UNCONTROLLED_COPY"].includes(v) },
  { groupLabel: "Training Management", match: (v: string) => v.startsWith("TRAINING_") },
  { groupLabel: "Reports", match: (v: string) => v.startsWith("REPORT_") },
  { groupLabel: "Access Review & Audit Trail Review", match: (v: string) => v === "ACCESS_REVIEW_CAMPAIGN" || v === "AUDIT_REVIEW_CAMPAIGN" },
].map((g) => ({ groupLabel: g.groupLabel, options: RESOURCE_TYPE_OPTIONS.filter((o) => g.match(String(o.value))) })).filter((g) => g.options.length > 0);

const slotLabel = "mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm";
const inputClass = "h-9 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

const Step: React.FC<{ n: number; title: string; hint?: string; children: React.ReactNode }> = ({ n, title, hint, children }) => (
  <div className="flex gap-3">
    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700">{n}</span>
    <div className="min-w-0 flex-1 space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      {children}
    </div>
  </div>
);

const ActorField: React.FC<{ actor: SimulatorActor | null; onPick: () => void; onClear: () => void; label?: string }> = ({ actor, onPick, onClear, label }) => (
  <div className="min-w-0">
    {label && <span className={slotLabel}>{label}</span>}
    {actor ? (
      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><UserRound className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-800">{actor.fullName}</span>
          <span className="block truncate text-xs text-slate-500">{[actor.employeeCode, actor.department].filter(Boolean).join(" · ") || actor.email}</span>
        </span>
        <Button size="xs" variant="outline" onClick={onPick}>{tr("Change")}</Button>
        <button type="button" onClick={onClear} className="rounded-lg p-1 text-slate-400 transition hover:bg-white hover:text-slate-600" aria-label={tr("Clear selected actor")}><X className="h-4 w-4" /></button>
      </div>
    ) : (
      <button type="button" onClick={onPick} className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-3 text-left transition hover:border-emerald-400 hover:bg-emerald-50/40 focus:outline-none focus:ring-1 focus:ring-emerald-500">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm"><UserRound className="h-4 w-4" /></span>
        <span><span className="block text-sm font-medium text-slate-700">{tr("Choose a person")}</span><span className="block text-xs text-slate-500">{tr("Search active users")}</span></span>
      </button>
    )}
  </div>
);

/**
 * Runs AuthorizationEngineService.authorize() for a chosen actor/resource/action without
 * executing any mutation, via POST /authorization/evaluate. The record is found by number or name.
 */
export const SimulatorTab: React.FC = () => {
  const { showToast } = useToast();

  const [actorId, setActorId] = useState("");
  const [actor, setActor] = useState<SimulatorActor | null>(null);
  const [isActorPickerOpen, setIsActorPickerOpen] = useState(false);
  const [resourceType, setResourceType] = useState("REVISION");
  const [resourceId, setResourceId] = useState("");
  const [resourceSearch, setResourceSearch] = useState("");
  const [found, setFound] = useState<FoundRecord[]>([]);
  const [chosen, setChosen] = useState<FoundRecord | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [actionCode, setActionCode] = useState("");
  const [running, setRunning] = useState(false);
  const [decision, setDecision] = useState<AuthorizationEngineDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actionOptions = useMemo(
    () => (ACTIONS_BY_RESOURCE_TYPE[resourceType] ?? []).map((o) => ({ ...o, label: humanize(String(o.value)) })),
    [resourceType],
  );
  const isValidUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());

  // a report template is named by its code (RPT.0004), as everywhere else; the server makes the id from it
  const byCode = resourceType === "REPORT_TEMPLATE";
  const recordOk = byCode ? resourceId.trim().length > 0 : isValidUuid(resourceId);
  const canRun = Boolean(actorId) && recordOk && Boolean(actionCode);
  const missing = !actorId ? "Choose a person first" : !recordOk ? "Choose a record" : !actionCode ? "Choose an action" : "";

  useEffect(() => {
    if (byCode || chosen) return undefined;
    let cancelled = false;
    setLookingUp(true);
    const timer = window.setTimeout(() => {
      securityApi.lookupAuthorizationResources(resourceType, resourceSearch.trim())
        .then((rows) => { if (!cancelled) setFound(rows); })
        .catch(() => { if (!cancelled) setFound([]); })
        .finally(() => { if (!cancelled) setLookingUp(false); });
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [resourceType, resourceSearch, byCode, chosen]);

  const resourceLabel = RESOURCE_TYPE_OPTIONS.find((o) => o.value === resourceType)?.label ?? resourceType;
  const actionLabel = humanize(actionCode);
  const recordLabel = byCode ? resourceId.trim() : chosen?.label ?? "";
  const what = `${actionLabel.toLowerCase() || "[action]"} ${recordLabel || `[${resourceLabel.toLowerCase()}]`}`;

  const evaluate = (subject: string) => securityApi.evaluateAuthorization({
    subjectUserId: subject,
    resourceType,
    ...(byCode ? { resourceCode: resourceId.trim() } : { resourceId: resourceId.trim() }),
    actionCode,
  });

  const runSimulation = async () => {
    if (!canRun) return;
    setRunning(true);
    setError(null);
    setDecision(null);
    try {
      setDecision(await evaluate(actorId));
    } catch (e: any) {
      const message = e?.response?.data?.message ?? "Failed to evaluate decision.";
      setError(message);
      showToast({ type: "error", message });
    } finally {
      setRunning(false);
    }
  };

  /* ------------------------------ shared pieces ------------------------------ */
  const typeField = (
    <Select
      label={tr("Resource type")}
      value={resourceType}
      onChange={(value) => { setResourceType(value); setActionCode(""); setResourceId(""); setChosen(null); setResourceSearch(""); setFound([]); }}
      options={[]}
      groups={RESOURCE_GROUPS}
      enableSearch
      searchPlaceholder={tr("Search resource type...")}
    />
  );

  const recordList = !byCode && !chosen && (
    <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
      {found.length === 0 ? (
        <p className="p-3 text-xs text-slate-500">{lookingUp ? "Searching..." : "No record found."}</p>
      ) : (
        found.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => { setChosen(row); setResourceId(row.id); }}
            className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-emerald-50/50"
          >
            <span className="min-w-0 truncate text-slate-800">{row.label}</span>
            {row.state && <Badge semantic="neutral" size="xs">{row.state}</Badge>}
          </button>
        ))
      )}
    </div>
  );

  const recordInput = (
    <div className="min-w-0">
      <span className={slotLabel}>{byCode ? "Template code" : "Record"}</span>
      {byCode ? (
        <input type="text" value={resourceId} onChange={(e) => setResourceId(e.target.value)} placeholder={tr("e.g. RPT.0004")} className={inputClass} />
      ) : chosen ? (
        <div className="flex min-h-9 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 py-1.5 pl-3 pr-1.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-slate-800" title={chosen.label}>{chosen.label}</span>
                  {chosen.state && <span className="block text-2xs text-slate-500">{tr("State:")} {chosen.state}</span>}
          </span>
          <Button size="xs" variant="outline" onClick={() => { setChosen(null); setResourceId(""); }}>{tr("Change")}</Button>
        </div>
      ) : (
        <input type="text" value={resourceSearch} onChange={(e) => setResourceSearch(e.target.value)} placeholder={tr("Search by number or name")} className={inputClass} />
      )}
    </div>
  );

  const actionField = (
    <Select label={tr("Action")} value={actionCode} onChange={setActionCode} options={actionOptions} enableSearch placeholder={tr("Select action...")} />
  );

  const runButton = (cls?: string) => (
    <div className={cn("flex flex-wrap items-center gap-3", cls)}>
      <Button size="sm" onClick={() => void runSimulation()} disabled={!canRun || running} className="gap-2 whitespace-nowrap">
        <Play className="h-4 w-4" />
        {running ? "Evaluating..." : "Evaluate"}
      </Button>
      {missing && <span className="text-xs text-slate-500">{missing}</span>}
    </div>
  );

  const verdictBody = (d: AuthorizationEngineDecision, who: string) => (
    <div className="space-y-5">
      <div className={cn("flex items-start gap-3 rounded-xl border p-4", d.allowed ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50")}>
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white", d.allowed ? "bg-emerald-600" : "bg-red-600")}>
          {d.allowed ? <ShieldCheck className="h-5 w-5" /> : <ShieldX className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <p className={cn("text-lg font-bold", d.allowed ? "text-emerald-800" : "text-red-800")}>{d.allowed ? "Allowed" : "Denied"}</p>
          <p className={cn("text-sm break-words", d.allowed ? "text-emerald-800" : "text-red-800")}>
            {who || "This person"} {d.allowed ? "can" : "cannot"} {what}.
          </p>
          {d.reasonCode && (
            <p className="mt-2 flex flex-wrap items-center gap-2">
              <Badge semantic={d.allowed ? "success" : "danger"} size="sm">{humanize(d.reasonCode)}</Badge>
              <span className="font-mono text-2xs text-slate-500">{d.reasonCode}</span>
            </p>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div className="min-w-0"><dt className="text-xs text-slate-500">{tr("Resource state")}</dt><dd className="mt-0.5 break-words font-medium text-slate-900">{d.resourceState ?? "—"}</dd></div>
        <div className="min-w-0"><dt className="text-xs text-slate-500">{tr("Policy version")}</dt><dd className="mt-0.5 font-medium text-slate-900">{d.matchedPolicyVersion ?? "—"}</dd></div>
        <div className="col-span-2 min-w-0"><dt className="text-xs text-slate-500">{tr("Required permission")}</dt><dd className="mt-0.5 break-all font-mono text-xs font-medium text-slate-900">{d.requiredPermission ?? "—"}</dd></div>
      </dl>
      <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-slate-500">{tr("Matched relations")}</p>
          <div className="flex flex-wrap gap-1">
            {d.matchedRelations.length > 0 ? d.matchedRelations.map((r) => <Badge key={r} semantic="info" size="xs">{r}</Badge>) : <span className="text-sm text-slate-400">{tr("None")}</span>}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-slate-500">{tr("Required controls")}</p>
          {d.requiredControls && Object.keys(d.requiredControls).length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {Object.entries(d.requiredControls).map(([key, value]) => (
                <span key={key} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-2xs text-slate-600">{key}={String(value)}</span>
              ))}
            </div>
          ) : <span className="text-sm text-slate-400">{tr("None")}</span>}
        </div>
      </div>
    </div>
  );

  const decisionArea = (d: AuthorizationEngineDecision | null, who: string, emptyHint = "Fill in the request and click Evaluate.") =>
    running ? <SectionLoading />
      : error ? <TableEmptyState title={tr("Evaluation Failed")} description={error} />
      : !d ? <TableEmptyState title={tr("No Decision Yet")} description={emptyHint} />
      : verdictBody(d, who);

  const decisionCard = (title = "Decision") => (
    <FormSection title={title} icon={<ShieldCheck className="h-4 w-4" />} contentClassName="p-4 md:p-5">
      {decisionArea(decision, actor?.fullName ?? "")}
    </FormSection>
  );

  return (
    <div className="grid grid-cols-1 items-start gap-4 md:gap-6 xl:grid-cols-2">
      <FormSection title={tr("Simulate a decision")} icon={<FlaskConical className="h-4 w-4" />} description={tr("Runs the hybrid engine only. Nothing is executed.")} contentClassName="space-y-5 p-4 md:p-5">
        <Step n={1} title={tr("Who is acting?")}>
          <ActorField actor={actor} onPick={() => setIsActorPickerOpen(true)} onClear={() => { setActor(null); setActorId(""); }} />
        </Step>
        <div className="border-t border-slate-100" />
        <Step n={2} title={tr("On which record?")}>
          {typeField}
          {recordInput}
          {recordList}
        </Step>
        <div className="border-t border-slate-100" />
        <Step n={3} title={tr("What do they want to do?")}>{actionField}</Step>
        {runButton("pt-1")}
      </FormSection>
      <div className="xl:sticky xl:top-4">{decisionCard()}</div>
      <ActorPickerModal
        isOpen={isActorPickerOpen}
        selectedActor={actor}
        onClose={() => setIsActorPickerOpen(false)}
        onSelect={(picked) => { setActor(picked); setActorId(picked.id); }}
      />
    </div>
  );
};
