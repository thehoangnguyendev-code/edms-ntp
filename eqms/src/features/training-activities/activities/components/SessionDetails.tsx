import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { RadioGroup } from "@/components/ui/radio";
import type { TrainingSession } from "@/services/api/trainingActivities";
import { ASSESSMENT_LABEL, METHOD_LABEL, day } from "../../shared/trainingLabels";
import { ReadonlyField, ReadonlyGrid } from "../../shared/TrainingDetailLayout";
import { DATE_HINT } from "../../shared/TrainingDateField";
import { DELIVERY_LABEL } from "./TrainingPaperBlock";

const STATUS_COLOR: Record<string, "emerald" | "slate" | "amber" | "red"> = { PLANNED: "slate", POSTPONED: "amber", CANCELLED: "red" };

/**
 * The sessions of an activity as the form that created them, read only: the same fields in the same order as the Sessions tab of New Training Activity (topic, method and
 * assessment, instructor, date, location), one block for each session, instead of a table. What a person may do about a session (the trainer check, the buttons) is given by the page.
 */
export function SessionDetails({ sessions, external, trainerOf, trainerCheck, actions, showDelivery = true, dueDate }: {
  /** The Due Date of the activity: shown on the row of the Scheduled date of the first session. */
  dueDate?: ReactNode;
  sessions: TrainingSession[];
  external: boolean;
  trainerOf: (session: TrainingSession) => string;
  /** What the check of the trainer says and lets the person do, or null when it does not apply. */
  trainerCheck: (session: TrainingSession) => ReactNode;
  /** The buttons that apply to the session. */
  actions: (session: TrainingSession) => ReactNode;
  /** The delivery is left out where the Paper block (which lists and changes it) is shown on the same screen. */
  showDelivery?: boolean;
}) {
  const several = sessions.length > 1;
  return (
    <div className="space-y-6">
      {sessions.map((s, index) => {
        const check = external ? null : trainerCheck(s);
        const buttons = actions(s);
        const hybrid = s.locationType === "HYBRID";
        const online = s.locationType === "ONLINE" || hybrid;
        return (
          <section key={s.id} aria-label={`Session ${s.sessionNo}`} className={several ? "space-y-4 rounded-xl border border-slate-200 p-4" : "space-y-4"}>
            {several && (
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Session {s.sessionNo}</h3>
                {(s.status === "POSTPONED" || s.status === "CANCELLED") && <Badge color={STATUS_COLOR[s.status] ?? "slate"}>{s.status.toLowerCase()}</Badge>}
              </div>
            )}
            <ReadonlyGrid>
              <ReadonlyField label="Training Topic" value={s.topics.map((t) => t.topicText).join("; ")} wide />
              {!external && <ReadonlyField label="Mode" value={s.method ? (METHOD_LABEL[s.method] ?? s.method) : ""} />}
              {!external && <ReadonlyField label="Assessment" value={s.assessmentMethod ? (ASSESSMENT_LABEL[s.assessmentMethod] ?? s.assessmentMethod) : ""} />}
              {external ? (
                <ReadonlyField label="Trainer (outside the company)" value={trainerOf(s)} wide />
              ) : (
                // the same choice as in New Training Activity (Internal expert or External expert/consultant), shown as it was chosen, with the name beneath
                <div className="space-y-3 md:col-span-2">
                  <RadioGroup label="Instructor" name={`session-instructor-${s.id}`} layout="horizontal" disabled value={trainerOf(s) === "—" ? "" : s.trainerUserId ? "INTERNAL" : "EXTERNAL"} onChange={() => undefined}
                    options={[{ label: "Internal expert", value: "INTERNAL" }, { label: "External expert/consultant", value: "EXTERNAL" }]} />
                  <ReadonlyField label={s.trainerUserId ? "Internal Expert" : "External Expert/Consultant"} value={trainerOf(s) === "—" ? "" : trainerOf(s)} />
                </div>
              )}
              {check && <div className="md:col-span-2">{check}</div>}
              {index === 0 && dueDate ? dueDate : null}
              <ReadonlyField label="Scheduled date" value={day(s.scheduledOn)} hint={DATE_HINT.scheduled} />
              {s.scheduledAfterDue && <p role="alert" className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">This day is after the due date of the training.</p>}
              <ReadonlyField label="Conducted on" value={s.heldOn ? day(s.heldOn) : ""} hint={DATE_HINT.conducted} />
              {!several && (s.status === "POSTPONED" || s.status === "CANCELLED") && <ReadonlyField label="Status" value={s.status === "POSTPONED" ? "Postponed" : "Cancelled"} />}
              {showDelivery && <ReadonlyField label="Delivery" value={DELIVERY_LABEL[s.deliveryMode ?? "ELECTRONIC"]} />}
              <div className="space-y-3 md:col-span-2">
                <RadioGroup label="Location Type" name={`session-location-${s.id}`} layout="horizontal" disabled value={hybrid ? "HYBRID" : online ? "ONLINE" : "ONSITE"} onChange={() => undefined}
                  options={[{ label: "On-site (Physical)", value: "ONSITE" }, { label: "Online (Virtual)", value: "ONLINE" }, { label: "Hybrid (On-site and Online)", value: "HYBRID" }]} />
                {(!online || hybrid) && <ReadonlyField label="Physical Location" value={s.venue} />}
                {online && (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-4">
                    <ReadonlyField label="Platform" value={s.onlinePlatform} />
                    <ReadonlyField label="Meeting Link">
                      {s.meetingLink ? <a href={s.meetingLink} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-emerald-600 hover:underline">{s.meetingLink}</a> : undefined}
                    </ReadonlyField>
                  </div>
                )}
              </div>
            </ReadonlyGrid>
            {buttons && <div className="flex flex-wrap gap-2">{buttons}</div>}
          </section>
        );
      })}
    </div>
  );
}
