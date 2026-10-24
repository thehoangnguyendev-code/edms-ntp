import { useState } from "react";
import { Button } from "@/components/ui/button/Button";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import type { TrainingActivityDetail } from "@/services/api/trainingActivities";
import { Textarea } from "../../shared/TrainingFields";

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

/**
 * Says, at the top of the Training Materials and the Assessment tab, what this activity needs and why (PLAN-TR-002), and lets the organizer exempt it with a reason until the
 * content is reviewed. The rules are decided by the server; this panel only tells them.
 */
/** What the activity needs of this tab and why, as a sentence and its tone (the server decides the rules; this only tells them). */
function describe(activity: TrainingActivityDetail, part: "materials" | "assessment", canExempt: boolean) {
  const rules = activity.contentRules;
  const kind = assessmentFormKind(activity);
  const isMaterials = part === "materials";
  const exempt = isMaterials ? !!activity.materialsExempt : !!activity.assessmentExempt;
  const exemptReason = isMaterials ? activity.materialsExemptReason : activity.assessmentExemptReason;
  const external = activity.kind === "EXTERNAL";
  const visitor = activity.kindReason === "VISITOR";
  const supplementary = !!rules?.inherited;
  const freeByRule = external || visitor || supplementary;
  const required = isMaterials ? rules?.materialsRequired : rules?.testRequired || rules?.checklistRequired;
  // What the server says is still missing for this tab: the warning follows it, so the screen and the validation of the server never disagree.
  const missingHere = !!rules?.missing.some((code) => (isMaterials ? code === "TRAINING_MATERIALS_REQUIRED" : code === "TRAINING_TEST_REQUIRED" || code === "TRAINING_CHECKLIST_REQUIRED"));

  let text: string | null = null;
  let tone = INFO;
  if (!rules) return { text, tone, kind, isMaterials, exempt, exemptReason, freeByRule };
  if (isMaterials) {
    if (supplementary) text = "This is a supplementary training: it keeps the material of the training it supplements, so nothing has to be added.";
    else if (external) text = "An external training needs no material of its own; add one if it helps.";
    else if (visitor) text = "A visitor is instructed by the department: no material is needed; add one if it helps.";
    else if (exempt) text = "Training Materials are not required for this training.";
    else if (rules.materialsSource === "DOCUMENT") text = `This training is on ${activity.documentNumber ?? "a document"}${activity.revisionNumber ? ` Rev ${activity.revisionNumber}` : ""}: the approved document is the material. Add slides or other material below if you want.`;
    else if (missingHere && canExempt) { text = "Training Materials are required before the content can be reviewed: add a file or a link."; tone = WARN; }
  } else if (supplementary) text = "This is a supplementary training: it uses the test of the training it supplements.";
  else if (external) text = "An external training has no test of its own; keep the certificate or the proof of attendance as evidence.";
  else if (visitor) text = "A visitor needs no test.";
  else if (exempt) text = "No test or checklist is required for this training.";
  else if (kind === "NONE") text = "No test or checklist is required: no session of this training is assessed by one (observation or reading confirmation).";
  else if (rules.onlineTest && (kind === "TEST" || kind === "BOTH")) text = "The test is written in the system (Test in the system), so no test file is needed; a file can still be added.";
  else if (missingHere && required && canExempt) { text = `A session is assessed by ${kind === "CHECKLIST" ? "a checklist" : kind === "TEST" ? "a test" : "a test or a checklist"}: the ${FORM_NAME[kind]} (APD.0009) is required before the content can be reviewed.`; tone = WARN; }
  return { text, tone, kind, isMaterials, exempt, exemptReason, freeByRule };
}

/** The sentence that the table of the tab says when it has no line: why there is no test, checklist or material (and the reason of the organizer when it was exempted). */
export function contentRuleNote(activity: TrainingActivityDetail, part: "materials" | "assessment"): string | null {
  const d = describe(activity, part, false);
  if (!d.text) return null;
  return d.exempt && d.exemptReason ? `${d.text} Reason: ${d.exemptReason}` : d.text;
}

export function ContentRulesPanel({ activity, part, canExempt, onExempt }: {
  activity: TrainingActivityDetail;
  part: "materials" | "assessment";
  canExempt: boolean;
  onExempt: (body: { materialsExempt?: boolean; assessmentExempt?: boolean; reason?: string }) => Promise<boolean>;
}) {
  const rules = activity.contentRules;
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  if (!rules) return null;
  // Only what has to be done is said above the table (a warning); what is not needed is said in the table itself.
  const { text, tone, kind, isMaterials, exempt, freeByRule } = describe(activity, part, canExempt);

  const toggle = (value: boolean, why?: string) => onExempt({ ...(isMaterials ? { materialsExempt: value } : { assessmentExempt: value }), reason: why });
  const showExemptButton = canExempt && !freeByRule && !exempt && (isMaterials || kind !== "NONE");
  // Nothing to say or to do above the table: no block at all, so that the tab starts as the others do (the sentence of what is not needed is in the table).
  if (!(text && tone === WARN) && !showExemptButton && !(canExempt && exempt) && !asking) return null;
  return (
    <div className="mb-4 space-y-2">
      {text && tone === WARN && <p role="status" className={tone}>{text}</p>}
      {(showExemptButton || (canExempt && exempt)) && (
        <div>
          {exempt ? (
            <Button size="sm" variant="outline" onClick={() => void toggle(false)}>
              Require {isMaterials ? "materials" : "the form"} again
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => { setReason(""); setAsking(true); }}>
              {isMaterials ? "Training Materials are not required…" : "An assessment form is not required…"}
            </Button>
          )}
        </div>
      )}
      <FormModal
        isOpen={asking}
        onClose={() => setAsking(false)}
        onConfirm={async () => { if (await toggle(true, reason.trim())) setAsking(false); }}
        title={isMaterials ? "Training Materials not required" : "Assessment form not required"}
        description="The reason stays on the record and in the Audit Trail. It can be set only until the content is reviewed."
        confirmText="Save"
        confirmDisabled={!reason.trim()}
        size="md"
      >
        <FormField label="Reason" required>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </FormModal>
    </div>
  );
}
