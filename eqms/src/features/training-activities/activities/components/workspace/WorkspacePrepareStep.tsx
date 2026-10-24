import { sessionNotStarted } from "@/services/api/trainingActivities";
import { Button } from "@/components/ui/button/Button";
import type { TrainingActivityDetail, TrainingCapabilities, TrainingSession } from "@/services/api/trainingActivities";
import { TrainingPreparationBlock } from "../TrainingPreparationBlock";

/** Step 1 of the session workspace: tick what is ready; the training starts with the first attendance. */
export function WorkspacePrepareStep({ activityId, scoped, session, caps, onPostpone, onChanged, onPending }: {
  activityId: string;
  scoped: TrainingActivityDetail;
  session: TrainingSession;
  caps?: TrainingCapabilities;
  onPostpone: () => void;
  onChanged: () => void;
  onPending: (pending: number) => void;
}) {
  return (
    <>
      {sessionNotStarted(session) && caps?.adjustPlan && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={onPostpone}>Postpone</Button>
        </div>
      )}
      <TrainingPreparationBlock activityId={activityId} sessionId={session.id} canManage={Boolean(caps?.adjustPlan)} paper={{ activity: scoped, canPrint: Boolean(caps?.printPaper), onChanged }} onPending={onPending} />
    </>
  );
}
