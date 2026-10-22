import type { TrainingParticipant } from "@/services/api/trainingActivities";
import type { ActivityMode } from "../../TrainingActivityDetailPage";
import { TrainingActivityFilesTab } from "../TrainingActivityFilesTab";

/** Step 3 of the session workspace: the approved material to teach with. Nothing is typed here. */
export function WorkspaceTrainingStep({ activityId, mode, external, participants }: {
  activityId: string;
  mode: ActivityMode;
  external: boolean;
  participants: TrainingParticipant[];
}) {
  return <TrainingActivityFilesTab key="ws-materials" part="materials" mode={mode} external={external} activityId={activityId} participants={participants} />;
}
