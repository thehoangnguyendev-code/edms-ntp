import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import type { TrainingSession } from "@/services/api/trainingActivities";
import { ASSESSMENT_LABEL, METHOD_LABEL, day } from "../../shared/trainingLabels";
import { ReadonlyField, ReadonlyGrid } from "../../shared/TrainingDetailLayout";
import { DELIVERY_LABEL } from "./TrainingPaperBlock";

const STATUS_COLOR: Record<string, "emerald" | "slate" | "amber" | "red"> = { PLANNED: "slate", POSTPONED: "amber", CANCELLED: "red" };

/**
 * The sessions of an activity as the form that created them, read only: the same fields in the same order as the Sessions tab of New Training Activity (topic, method and
 * assessment, instructor, date, location), one block for each session, instead of a table. What a person may do about a session (the trainer check, the buttons) is given by the page.
 */
export function SessionDetails({ sessions, external, trainerOf, trainerCheck, actions }: {
  sessions: TrainingSession[];
  external: boolean;
  trainerOf: (session: TrainingSession) => string;
  /** What the check of the trainer says and lets the person do, or null when it does not apply. */
  trainerCheck: (session: TrainingSession) => ReactNode;
  /** The buttons that apply to the session. */
  actions: (session: TrainingSession) => ReactNode;
}) {
  const several = sessions.length > 1;
  return (
    <div className="space-y-6">
      {sessions.map((s) => {
        const check = external ? null : trainerCheck(s);
        const buttons = actions(s);
        const online = s.locationType === "ONLINE";
        return (
          <section key={s.id} aria-label={`Session ${s.sessionNo}`} className={several ? "space-y-4 rounded-xl border border-slate-200 p-4" : "space-y-4"}>
            {several && (
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Session {s.sessionNo}</h3>
                {(s.status === "POSTPONED" || s.status === "CANCELLED") && <Badge color={STATUS_COLOR[s.status] ?? "slate"}>{s.status.toLowerCase()}</Badge>}
              </div>
            )}
            <ReadonlyGrid>
              <ReadonlyField label="Topic" value={s.topics.map((t) => t.topicText).join("; ")} wide />
              {!external && <ReadonlyField label="Mode" value={s.method ? (METHOD_LABEL[s.method] ?? s.method) : ""} />}
              {!external && <ReadonlyField label="Assessment" value={s.assessmentMethod ? (ASSESSMENT_LABEL[s.assessmentMethod] ?? s.assessmentMethod) : ""} />}
              <ReadonlyField
                label={external ? "Trainer (outside the company)" : "Instructor"}
                value={`${trainerOf(s)}${external || trainerOf(s) === "—" ? "" : s.trainerUserId ? " (Internal expert)" : " (External expert/consultant)"}`}
                wide
              />
              {check && <div className="md:col-span-2">{check}</div>}
              <ReadonlyField label="Scheduled date" value={day(s.scheduledOn)} />
              <ReadonlyField label="Conducted on" value={s.heldOn ? day(s.heldOn) : ""} />
              {!several && (s.status === "POSTPONED" || s.status === "CANCELLED") && <ReadonlyField label="Status" value={s.status === "POSTPONED" ? "Postponed" : "Cancelled"} />}
              <ReadonlyField label="Delivery" value={DELIVERY_LABEL[s.deliveryMode ?? "ELECTRONIC"]} />
              <ReadonlyField label="Location Type" value={online ? "Online (Virtual)" : "On-site (Physical)"} />
              {online ? (
                <>
                  <ReadonlyField label="Platform" value={s.onlinePlatform} />
                  <ReadonlyField label="Meeting Link">
                    {s.meetingLink ? <a href={s.meetingLink} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-emerald-600 hover:underline">{s.meetingLink}</a> : undefined}
                  </ReadonlyField>
                </>
              ) : (
                <ReadonlyField label="Physical Location" value={s.venue} wide />
              )}
            </ReadonlyGrid>
            {buttons && <div className="flex flex-wrap gap-2">{buttons}</div>}
          </section>
        );
      })}
    </div>
  );
}
