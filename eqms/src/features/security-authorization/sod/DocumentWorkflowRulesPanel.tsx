import React from "react";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import type { DocumentAdministrationRule } from "@/services/api/settings";

// ── Document Workflow Rules panel (presentational) ──────────────────────────
// Fixed, non-extensible SoD-style rules specific to the Document/Revision
// Author/Co-Author/Reviewer/Approver workflow (DocumentWorkflowSetting entity,
// read by DocumentService/RevisionService at Save/Submit time). Distinct from
// the flexible permission-pair "Constraint Rules" tab on this same page (backed
// by sod_constraints) — kept as a separate tab rather than merged into one data
// model, since these 8 rules are not expressible as simple permission pairs.
// Relocated here from Settings > System Administration > Document Administration
// (that screen's "Document Workflow Roles" tab was retired in favor of the
// Workflow Roles catalog under Access Profiles — see Workflow Security).
//
// Edit/Cancel/Reset/Save Changes live in the parent's PageHeader (same row as
// every other screen's primary actions) — this component only renders the rule
// checklist body; state and handlers are owned by SegregationOfDutiesView.
export const DocumentWorkflowRulesPanel: React.FC<{
  isLoading: boolean;
  isEditing: boolean;
  canManage: boolean;
  sodRules: Record<string, boolean>;
  setSodRules: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  sodRuleDefinitions: DocumentAdministrationRule[];
  setIsDirty: (dirty: boolean) => void;
}> = ({ isLoading, isEditing, canManage, sodRules, setSodRules, sodRuleDefinitions, setIsDirty }) => {
  return (
    <div>
      {isLoading && <FullPageLoading text="Loading document workflow rules..." />}
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-800">Document Revision Integrity Rules</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Server-enforced controls for revision participants and workflow transitions. Access Profile labels never grant these actions; canonical permissions and the assigned participant determine access.
        </p>
      </div>

      <div className="space-y-2">
        {sodRuleDefinitions.map((rule) => (
          <label key={rule.code} className="flex items-start gap-3 py-2 transition-colors group cursor-pointer">
            <Checkbox
              id={rule.code}
              checked={!!sodRules[rule.code]}
              disabled={!isEditing || !canManage}
              onChange={(checked) => {
                setSodRules((prev) => ({ ...prev, [rule.code]: checked }));
                setIsDirty(true);
              }}
            />
            <span className="min-w-0">
              <span className="block text-xs sm:text-sm text-slate-700 group-hover:text-emerald-600 transition-colors font-medium">
                {rule.label}
              </span>
              {rule.description && (
                <span className="mt-0.5 block text-[11px] sm:text-xs leading-5 text-slate-500">
                  {rule.description}
                </span>
              )}
            </span>
          </label>
        ))}
        {sodRuleDefinitions.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs sm:text-sm text-slate-600">
            No document revision integrity rules are available from the server.
          </div>
        )}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs sm:text-sm text-emerald-800">
          These rules are enforced by the server when a Document Master or Revision is saved/submitted —
          toggling one here changes real validation behavior immediately after saving.
        </div>
      </div>
    </div>
  );
};
