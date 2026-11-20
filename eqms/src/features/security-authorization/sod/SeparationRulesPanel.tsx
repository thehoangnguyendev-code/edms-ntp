import React, { useMemo } from "react";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import type { SeparationRule } from "@/services/api";
import { inSentence, statusText } from "../shared/humanizeCode";

/** The rule as one plain sentence, e.g. "The author of the version cannot approve template". */
export const separationRuleSentence = (rule: SeparationRule) => `The ${inSentence(rule.relationLabel)} cannot ${inSentence(rule.actionLabel)}`;

// ── Separation Rules panel (presentational) ─────────────────────────────────
// One tab per module, laid out exactly like Document Revision Integrity: a title and a short explanation, then one tick box per rule with its sentence and a line saying what it means.
// Edit / Cancel / Reset / Save live in the page header (same row as every other screen's primary actions); the state and the save are owned by SegregationOfDutiesView, which keeps
// the ticks in a draft until Save (one reason, one electronic signature for all of them).
export const SeparationRulesPanel: React.FC<{
  moduleLabel: string;
  isLoading: boolean;
  failed: boolean;
  isEditing: boolean;
  canManage: boolean;
  rules: SeparationRule[];
  draft: Record<string, boolean>;
  onToggle: (id: string, checked: boolean) => void;
}> = ({ moduleLabel, isLoading, failed, isEditing, canManage, rules, draft, onToggle }) => {
  // The steps of one workflow stay together, so a long list (Training Management) can be read step by step.
  const groups = useMemo(() => {
    const byWorkflow = new Map<string, SeparationRule[]>();
    rules.forEach((r) => byWorkflow.set(r.workflowLabel, [...(byWorkflow.get(r.workflowLabel) ?? []), r]));
    return [...byWorkflow.entries()];
  }, [rules]);

  return (
    <div>
      {isLoading && <FullPageLoading text="Loading separation rules..." />}
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-800">{moduleLabel} Separation Rules</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Tick a rule to stop the same person from doing two jobs on the same record, for example writing something and then approving it. Untick it to allow that. A ticked rule applies
          to everyone, including administrators.
        </p>
      </div>

      <div className="space-y-2">
        {groups.map(([workflow, items]) => (
          <div key={workflow}>
            {groups.length > 1 && <p className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{workflow}</p>}
            {items.map((rule) => (
              <label key={rule.id} className="flex items-start gap-3 py-2 transition-colors group cursor-pointer">
                <Checkbox
                  id={`separation-rule-${rule.id}`}
                  checked={!!draft[rule.id]}
                  disabled={!isEditing || !canManage}
                  onChange={(checked) => onToggle(rule.id, checked)}
                />
                <span className="min-w-0">
                  <span className="block text-xs sm:text-sm text-slate-700 group-hover:text-emerald-600 transition-colors font-medium">{separationRuleSentence(rule)}</span>
                  <span className="mt-0.5 block text-2xs sm:text-xs leading-5 text-slate-500">
                    {rule.description ? `${rule.description} ` : ""}
                    {rule.fromStatus && rule.fromStatus !== "ANY" ? `Applies when the record is "${statusText(rule.fromStatusLabel, rule.fromStatus)}".` : "Applies at any stage."}
                    {!rule.policyActive ? " This step's policy is switched off, so the rule has no effect for now." : ""}
                  </span>
                </span>
              </label>
            ))}
          </div>
        ))}
        {!isLoading && rules.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs sm:text-sm text-slate-600">
            {failed ? "The separation rules could not be loaded. You may not have permission to view them." : `There are no separation rules for ${moduleLabel}.`}
          </div>
        )}
        <WarningBanner variant="success">
          These rules are enforced by the server. Saving needs a reason and an electronic signature, and is recorded in the audit trail. A change applies from the next action; work that is already
          done is not undone.
        </WarningBanner>
      </div>
    </div>
  );
};
