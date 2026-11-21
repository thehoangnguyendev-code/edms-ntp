import type { ReactNode } from "react";
import { sessionStarted, type TrainingActivityDetail, type TrainingCapabilities } from "@/services/api/trainingActivities";
import { TrainingCheckInBlock } from "../TrainingCheckInBlock";
import { TrainingRollCallBlock } from "../TrainingRollCallBlock";

/**
 * Step 2 of the session workspace: the self check-in with the quick roll-call in one panel (on the left of the list on a desktop, above it on a phone), and the list of people with their attendance.
 */
export function WorkspaceAttendanceStep({ scoped, caps, onActivity, table, reading = false }: {
  scoped: TrainingActivityDetail;
  caps?: TrainingCapabilities;
  onActivity: (next: TrainingActivityDetail) => void;
  table: ReactNode;
  /** A self-reading: nobody is checked in or called, the person signs the reading in the system. */
  reading?: boolean;
}) {
  // The panel is drawn only once a session is held; before that it would leave an empty column beside the list.
  const panel = Boolean(caps?.rollCall) && !reading && scoped.sessions.some(sessionStarted);
  return (
    <div className={panel ? "grid items-start gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-5" : undefined}>
      {panel && (
        <aside className="lg:sticky lg:top-24">
          <TrainingCheckInBlock activity={scoped} onChanged={onActivity} footer={<TrainingRollCallBlock activity={scoped} onChanged={onActivity} bare />} />
        </aside>
      )}
      <div className="flex min-w-0 flex-col gap-6">{table}</div>
    </div>
  );
}
