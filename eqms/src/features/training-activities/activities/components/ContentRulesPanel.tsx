import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Textarea } from "@/components/ui/form/ResponsiveForm";
import type { TrainingActivityDetail } from "@/services/api/trainingActivities";
import { tr, trFormat } from "@/i18n";

export type AssessmentFormKind = "TEST" | "CHECKLIST" | "BOTH" | "NONE";

/** What the sessions that are not cancelled ask of an assessment form: a test, a checklist, both, or no file (observation, self-reading confirmation). */
export function assessmentFormKind(activity: Pick<TrainingActivityDetail, "sessions">): AssessmentFormKind {
  const methods = activity.sessions.filter((s) => s.status !== "CANCELLED").map((s) => s.assessmentMethod);
  const test = methods.includes("TEST");
  const checklist = methods.includes("CHECKLIST");
  return test && checklist ? "BOTH" : test ? "TEST" : checklist ? "CHECKLIST" : "NONE";
}

const FORM_NAME: Record<AssessmentFormKind, string> = { TEST: "test", CHECKLIST: "checklist form", BOTH: "test or checklist form", NONE: "assessment form" };

const NOTE = "rounded-lg border px-3 py-2 text-sm";
const INFO = `${NOTE} border-slate-200 bg-slate-50 text-slate-700`;
const WARN = `${NOTE} border-amber-200 bg-amber-50 text-amber-900`;

/** What the activity needs of this tab and why, as a sentence and its tone (the server decides the rules; this only tells them). */
function describe(activity: TrainingActivityDetail, part: "materials" | "assessment", canExempt: boolean) {
  const rules = activity.contentRules;
  const kind = assessmentFormKind(activity);
  const isMaterials = part === "materials";
  const exempt = isMaterials ? !!activity.materialsExempt : !!activity.assessmentExempt;
  const exemptReason = isMaterials ? activity.materialsExemptReason : activity.assessmentExemptReason;
  const external = activity.kind === "EXTERNAL";
  const visitor = activity.kindReason === "VISITOR";
  const freeByRule = external || visitor;
  const required = isMaterials ? rules?.materialsRequired : rules?.testRequired || rules?.checklistRequired;
  // What the server says is still missing for this tab: the warning follows it, so the screen and the validation of the server never disagree.
  const missingHere = !!rules?.missing.some((code) => (isMaterials ? code === "TRAINING_MATERIALS_REQUIRED" : code === "TRAINING_TEST_REQUIRED" || code === "TRAINING_CHECKLIST_REQUIRED"));

  let text: string | null = null;
  let tone = INFO;
  if (!rules) return { text, tone, kind, isMaterials, exempt, exemptReason, freeByRule };
  if (isMaterials) {
    if (external) text = tr("An external training needs no material of its own; add one if it helps.");
    else if (visitor) text = tr("A visitor is instructed by the department: no material is needed; add one if it helps.");
    else if (exempt) text = tr("Training Materials are not required for this training.");
    else if (rules.materialsSource === "DOCUMENT") text = trFormat("This training is on {document}: the approved document is the material. Add slides or other material below if you want.", { document: activity.documentLabel ?? tr("a document") });
    else if (missingHere && canExempt) { text = tr("Required before the content is approved: a file or a link."); tone = WARN; }
  } else if (external) text = tr("An external training has no test of its own; keep the certificate or the proof of attendance as evidence.");
  else if (visitor) text = tr("A visitor needs no test.");
  else if (exempt) text = tr("No test or checklist is required for this training.");
  else if (kind === "NONE") text = tr("No test or checklist is required: no session of this training is assessed by one (observation or reading confirmation).");
  else if (missingHere && required && canExempt) { text = trFormat("Required before the content is approved: choose an approved assessment of the library for the {form} (APD.0009).", { form: tr(FORM_NAME[kind]) }); tone = WARN; }
  return { text, tone, kind, isMaterials, exempt, exemptReason, freeByRule };
}

/** The sentence that the table of the tab says when it has no line: why there is no test, checklist or material (and the reason of the organizer when it was exempted). */
export function contentRuleNote(activity: TrainingActivityDetail, part: "materials" | "assessment"): string | null {
  const d = describe(activity, part, false);
  if (!d.text) return null;
  return d.exempt && d.exemptReason ? `${d.text} Reason: ${d.exemptReason}` : d.text;
}

/**
 * Says, at the top of the Training Materials and the Assessment tab, whether this activity needs them: a checkbox that is ticked by default, as "Requires Training?" is in Document Control. Unticking it asks
 * for the reason, which stays on the record and in the Audit Trail; it can be given only until the content is approved. The rules are decided by the server; this panel only tells them.
 */
export function ContentRulesPanel({ activity, part, canExempt, onExempt }: {
  activity: TrainingActivityDetail;
  part: "materials" | "assessment";
  canExempt: boolean;
  onExempt: (body: { materialsExempt?: boolean; assessmentExempt?: boolean; reason?: string }) => Promise<boolean>;
}) {
  const { text, tone, kind, isMaterials, exempt, exemptReason, freeByRule } = describe(activity, part, canExempt);
  const savedReason = exemptReason ?? "";
  // Unticked but not saved yet: the reason is being written.
  const [skipping, setSkipping] = useState(false);
  const [reason, setReason] = useState(savedReason);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setReason(savedReason);
    if (!exempt) setSkipping(false);
  }, [savedReason, exempt]);
  // The tab Training Materials and the tab Assessment share this panel: what is being written in one is not carried to the other.
  useEffect(() => {
    setSkipping(false);
  }, [part]);
  if (!activity.contentRules) return null;
  // Nothing to decide: an external training, a visitor, or no session assessed by a test or a checklist (the tab then only says so, in its table).
  const decidable = !freeByRule && (isMaterials || kind !== "NONE");
  if (!decidable) return null;

  const required = !(exempt || skipping);
  const key = isMaterials ? "materialsExempt" : "assessmentExempt";
  const changed = reason.trim() !== savedReason.trim();
  const toggle = (checked: boolean) => {
    if (checked) {
      setSkipping(false);
      if (exempt) void onExempt({ [key]: false });
    } else {
      setSkipping(true);
    }
  };
  const save = async () => {
    setSaving(true);
    try {
      await onExempt({ [key]: true, reason: reason.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-4 space-y-4">
      <div className="flex items-center justify-between font-semibold text-slate-900">
        <Checkbox
          id={`requires-${part}`}
          label={isMaterials ? tr("Required Training Materials?") : tr("Required Assessment?")}
          checked={required}
          onChange={toggle}
          disabled={!canExempt}
        />
      </div>
      {required ? (
        text && tone === WARN ? <p role="status" className={tone}>{text}</p> : null
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`skip-${part}`} className="text-xs font-medium text-slate-700 capitalize sm:text-sm">
              {isMaterials ? tr("Reason for skipping the training materials") : tr("Reason for skipping the assessment")} {canExempt && <span className="text-red-500">*</span>}
            </label>
            <Textarea
              id={`skip-${part}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              disabled={!canExempt}
              placeholder={isMaterials ? tr("Provide a reason for skipping the training materials...") : tr("Provide a reason for skipping the assessment...")}
            />
          </div>
          {canExempt && (
            <>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                <p className="text-xs leading-relaxed text-amber-800">
                  {tr("If this is not required, you must give a reason. It stays on the record and in the Audit Trail, and it can be given only until the content is approved.")}
                </p>
              </div>
              <div>
                <Button size="sm" variant="outline-emerald" loading={saving} disabled={!reason.trim() || (exempt && !changed)} onClick={() => void save()}>
                  {tr("Save")}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
