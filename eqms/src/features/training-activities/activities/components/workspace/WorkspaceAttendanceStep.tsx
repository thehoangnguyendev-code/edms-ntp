import type { ReactNode } from "react";
import type { TrainingActivityDetail, TrainingCapabilities } from "@/services/api/trainingActivities";
import { TrainingCheckInBlock } from "../TrainingCheckInBlock";
import { TrainingRollCallBlock } from "../TrainingRollCallBlock";

/** Step 2 of the session workspace: the self check-in, the quick roll-call and the list of people with their attendance. */
export function WorkspaceAttendanceStep({ scoped, caps, onActivity, table }: {
  scoped: TrainingActivityDetail;
  caps?: TrainingCapabilities;
  onActivity: (next: TrainingActivityDetail) => void;
  table: ReactNode;
}) {
  return (
    <>
      {caps?.rollCall && <TrainingCheckInBlock activity={scoped} onChanged={onActivity} />}
      {caps?.rollCall && <TrainingRollCallBlock activity={scoped} onChanged={onActivity} />}
      {table}
    </>
  );
}
