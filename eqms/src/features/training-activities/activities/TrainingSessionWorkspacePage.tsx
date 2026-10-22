import { useParams } from "react-router-dom";
import { TrainingActivityDetailPage } from "./TrainingActivityDetailPage";

/** The workspace of one training session, opened in its own tab: the steps of the day (prepare, attendance, training, assessment, results) for that session only. */
export function TrainingSessionWorkspacePage() {
  const { sessionId = "" } = useParams();
  return <TrainingActivityDetailPage mode="conduct" workspaceSessionId={sessionId} key={sessionId} />;
}
