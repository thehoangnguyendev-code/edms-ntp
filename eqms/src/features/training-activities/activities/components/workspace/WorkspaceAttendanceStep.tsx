import type { ReactNode } from "react";
import type { TrainingActivityDetail, TrainingCapabilities } from "@/services/api/trainingActivities";
import { TrainingCheckInBlock } from "../TrainingCheckInBlock";
import { TrainingRollCallBlock } from "../TrainingRollCallBlock";

/** Step 2 of the session workspace: the self check-in, the quick roll-call and the list of people with their attendance. */
export function WorkspaceAttendanceStep({ scoped, caps, onActivity, table, reading = false }: {
  scoped: TrainingActivityDetail;
  caps?: TrainingCapabilities;
  onActivity: (next: TrainingActivityDetail) => void;
  table: ReactNode;
  /** A self-reading: nobody is checked in or called, the person signs the reading in the system. */
  reading?: boolean;
}) {
  return (
    <>
      {caps?.rollCall && !reading && <TrainingCheckInBlock activity={scoped} onChanged={onActivity} />}
      {caps?.rollCall && !reading && <TrainingRollCallBlock activity={scoped} onChanged={onActivity} />}
      {table}
    </>
  );
}
