import type { TrainingActivityDetail, TrainingCapabilities, TrainingParticipant } from "@/services/api/trainingActivities";
import type { ActivityMode } from "../../TrainingActivityDetailPage";
import { TrainingActivityFilesTab } from "../TrainingActivityFilesTab";
import { TrainingExamBlock } from "../TrainingExamBlock";
import { TrainingPaperBlock } from "../TrainingPaperBlock";
import { TrainingTranscriptionBlock } from "../TrainingTranscriptionBlock";

/** Step 4 of the session workspace: the test, the paper test and its scan, and the evidence of a checked file. */
export function WorkspaceAssessmentStep({ activityId, scoped, people, caps, mode, external, userId, onChanged }: {
  activityId: string;
  scoped: TrainingActivityDetail;
  people: TrainingParticipant[];
  caps?: TrainingCapabilities;
  mode: ActivityMode;
  external: boolean;
  userId?: string;
  onChanged: () => void;
}) {
  return (
    <>
      {!external && <TrainingExamBlock activityId={activityId} editable={false} />}
      <TrainingPaperBlock activity={scoped} canPrint={Boolean(caps?.printPaper)} canMode={Boolean(caps?.adjustPlan)} onChanged={onChanged} />
      <TrainingTranscriptionBlock activity={scoped} userId={userId} canEnter={Boolean(caps?.transcribe)} canVerify={Boolean(caps?.verifyTranscription)} onChanged={onChanged} />
      <TrainingActivityFilesTab key="ws-evidence" part="assessment" mode={mode} external={external} activityId={activityId} participants={people} />
    </>
  );
}
