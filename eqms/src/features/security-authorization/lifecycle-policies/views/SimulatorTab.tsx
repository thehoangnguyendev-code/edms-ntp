import React, { useMemo, useState } from "react";
import { PlayCircle, ShieldCheck, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { useToast } from "@/components/ui/toast/Toast";
import { useTranslation } from "@/i18n";
import { getApiErrorMessage } from "@/utils/apiError";
import { cn } from "@/components/ui/utils";
import { securityApi, type AuthorizationEngineDecision } from "@/services/api/security";
import { settingsApi } from "@/services/api/settings";

const RESOURCE_TYPE_OPTIONS: SelectOption[] = [
  { label: "Document", value: "DOCUMENT" },
  { label: "Revision", value: "REVISION" },
  { label: "Controlled Copy", value: "CONTROLLED_COPY" },
  { label: "Controlled Copy Batch", value: "CONTROLLED_COPY_BATCH" },
];

const ACTIONS_BY_RESOURCE_TYPE: Record<string, SelectOption[]> = {
  DOCUMENT: ["CANCEL", "OBSOLETE", "UPDATE_METADATA"].map((v) => ({ label: v, value: v })),
  REVISION: [
    "UPDATE_DRAFT_METADATA", "UPLOAD_SOURCE", "COMPLETE_AUTHORING", "OPEN_PUBLISHING_WORKSPACE",
    "GENERATE_REVIEW_SNAPSHOT", "SUBMIT_FOR_REVIEW", "COMPLETE_REVIEW", "REJECT_REVIEW",
    "COMPLETE_APPROVAL", "REJECT_APPROVAL", "COMPLETE_TRAINING", "PUBLISH", "CANCEL", "OBSOLETE",
    "UPGRADE_REVISION", "REGENERATE_SNAPSHOT",
  ].map((v) => ({ label: v, value: v })),
  CONTROLLED_COPY: [
    "VIEW_COPY", "PREVIEW_FILE", "DOWNLOAD_FILE", "PRINT_COPY", "DISTRIBUTE_COPY", "RECALL_COPY",
    "REPORT_LOST_DAMAGED", "REPLACE_LOST_DAMAGED", "UPLOAD_EVIDENCE", "EXPIRE_COPY", "CANCEL_REQUEST",
  ].map((v) => ({ label: v, value: v })),
  CONTROLLED_COPY_BATCH: ["DISTRIBUTE_BATCH", "RECALL_BATCH", "CANCEL_REQUEST"].map((v) => ({ label: v, value: v })),
};

/**
 * Runs AuthorizationEngineService.authorize() for a chosen actor/resource/action without
 * executing any mutation, via POST /authorization/evaluate. Resource ID is a manual UUID paste
 * (no per-resource-type typeahead search endpoint exists yet) -- the Engine Health tab already
 * shows real resource IDs to copy from.
 */
export const SimulatorTab: React.FC = () => {
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [actorId, setActorId] = useState("");
  const [actorLabel, setActorLabel] = useState("");
  const [resourceType, setResourceType] = useState("REVISION");
  const [resourceId, setResourceId] = useState("");
  const [actionCode, setActionCode] = useState("");
  const [running, setRunning] = useState(false);
  const [decision, setDecision] = useState<AuthorizationEngineDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actionOptions = useMemo(() => ACTIONS_BY_RESOURCE_TYPE[resourceType] ?? [], [resourceType]);

  const searchActors = async (query: string): Promise<SelectOption[]> => {
    if (query.trim().length < 2) return [];
    const page = await settingsApi.getUsers({ search: query, limit: 10 });
    return page.data.map((u) => ({ label: `${u.fullName} (${u.email})`, value: u.id }));
  };

  const isValidUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());

  const canRun = Boolean(actorId) && isValidUuid(resourceId) && Boolean(actionCode);

  const runSimulation = async () => {
    if (!canRun) return;
    setRunning(true);
    setError(null);
    setDecision(null);
    try {
      const result = await securityApi.evaluateAuthorization({
        subjectUserId: actorId,
        resourceType,
        resourceId: resourceId.trim(),
        actionCode,
      });
      setDecision(result);
    } catch (e: any) {
      const message = getApiErrorMessage(e, t("simulator.evaluateFailed"));
      setError(message);
      showToast({ type: "error", message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Simulate a decision</h2>
        <p className="text-xs text-slate-500">
          Runs the new hybrid engine only — does not execute the action and does not compare
          against the legacy evaluator (see Engine Health for that comparison).
        </p>

        <Select
          label="Actor *"
          value={actorId}
          onChange={(value) => setActorId(value)}
          options={actorLabel ? [{ label: actorLabel, value: actorId }] : []}
          enableSearch
          onSearch={async (query) => {
            const results = await searchActors(query);
            const found = results.find((r) => r.value === actorId);
            if (found) setActorLabel(found.label);
            return results;
          }}
          placeholder="Search user by name or email..."
        />

        <Select
          label="Resource Type *"
          value={resourceType}
          onChange={(value) => { setResourceType(value); setActionCode(""); }}
          options={RESOURCE_TYPE_OPTIONS}
          enableSearch={false}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Resource ID *</label>
          <input
            type="text"
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            placeholder="Paste a UUID (e.g. from Engine Health)"
            className="w-full h-9 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
          />
          {resourceId && !isValidUuid(resourceId) && (
            <p className="text-2xs text-red-500">Must be a valid UUID.</p>
          )}
        </div>

        <Select
          label="Action *"
          value={actionCode}
          onChange={setActionCode}
          options={actionOptions}
          enableSearch
          placeholder="Select action..."
        />

        <div className="pt-2">
          <Button size="sm" className="gap-2" onClick={() => void runSimulation()} disabled={!canRun || running}>
            <PlayCircle className="h-4 w-4" />
            {running ? "Evaluating..." : "Evaluate"}
          </Button>
        </div>
      </div>

      <div className="bg-slate-50/60 rounded-xl border border-slate-200 p-4 md:p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Decision</h2>
        {!decision && !error ? (
          <TableEmptyState
            icon={<ShieldCheck className="h-10 w-10 text-slate-300" />}
            title="No Decision Yet"
            description="Fill in the fields on the left and click Evaluate."
          />
        ) : error ? (
          <TableEmptyState icon={<ShieldX className="h-10 w-10 text-red-300" />} title="Evaluation Failed" description={error} />
        ) : decision ? (
          <div className="space-y-4">
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 bg-white",
                decision.allowed ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50",
              )}
            >
              {decision.allowed ? (
                <ShieldCheck className="h-6 w-6 text-emerald-600 flex-shrink-0" />
              ) : (
                <ShieldX className="h-6 w-6 text-red-600 flex-shrink-0" />
              )}
              <div>
                <p className={cn("text-sm font-bold", decision.allowed ? "text-emerald-700" : "text-red-700")}>
                  {decision.allowed ? "ALLOWED" : "DENIED"}
                </p>
                {decision.reasonCode && (
                  <p className="text-xs text-slate-600 font-mono">{decision.reasonCode}</p>
                )}
              </div>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="font-medium text-slate-500 uppercase text-2xs mb-1">Required Permission</dt>
                <dd className="font-mono text-slate-800">{decision.requiredPermission ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500 uppercase text-2xs mb-1">Resource State</dt>
                <dd className="font-mono text-slate-800">{decision.resourceState ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500 uppercase text-2xs mb-1">Matched Policy Version</dt>
                <dd className="font-mono text-slate-800">{decision.matchedPolicyVersion ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500 uppercase text-2xs mb-1">Matched Relations</dt>
                <dd className="flex flex-wrap gap-1">
                  {decision.matchedRelations.length > 0 ? (
                    decision.matchedRelations.map((r) => (
                      <Badge key={r} semantic="info" size="xs">{r}</Badge>
                    ))
                  ) : (
                    <span className="font-mono text-slate-400">—</span>
                  )}
                </dd>
              </div>
            </dl>

            {decision.requiredControls && Object.keys(decision.requiredControls).length > 0 && (
              <div>
                <p className="font-medium text-slate-500 uppercase text-2xs mb-1.5">Required Controls</p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(decision.requiredControls).map(([key, value]) => (
                    <span key={key} className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-2xs text-slate-600">
                      {key}={String(value)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
