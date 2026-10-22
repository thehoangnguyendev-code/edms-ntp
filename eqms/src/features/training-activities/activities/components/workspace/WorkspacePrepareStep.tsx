import { Button } from "@/components/ui/button/Button";
import type { TrainingActivityDetail, TrainingCapabilities, TrainingSession } from "@/services/api/trainingActivities";
import { TrainingPaperBlock } from "../TrainingPaperBlock";
import { TrainingPreparationBlock } from "../TrainingPreparationBlock";

/** Step 1 of the session workspace: hold the session, print the paper pack, see the preparation of the room. */
export function WorkspacePrepareStep({ activityId, scoped, session, caps, busy, userId, onHold, onPostpone, onChanged }: {
  activityId: string;
  scoped: TrainingActivityDetail;
  session: TrainingSession;
  caps?: TrainingCapabilities;
  busy: boolean;
  userId?: string;
  onHold: () => void;
  onPostpone: () => void;
  onChanged: () => void;
}) {
  return (
    <>
      {session.status === "PLANNED" && (caps?.hold || caps?.adjustPlan) && (
        <div className="flex flex-wrap items-center gap-2">
          {caps?.hold && <Button size="sm" variant="default" loading={busy} onClick={onHold}>Mark as held</Button>}
          {caps?.adjustPlan && <Button size="sm" variant="outline" onClick={onPostpone}>Postpone</Button>}
        </div>
      )}
      <TrainingPaperBlock activity={scoped} canPrint={Boolean(caps?.printPaper)} canMode={Boolean(caps?.adjustPlan)} onChanged={onChanged} />
      <TrainingPreparationBlock activityId={activityId} canManage={Boolean(caps?.adjustPlan)} userId={userId} />
    </>
  );
}
