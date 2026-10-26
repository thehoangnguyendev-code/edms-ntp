import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
import { trainingAssessmentsApi, type TrainingAssessmentRevision } from "@/services/api/trainingActivities";
import { RevisionLink, RevisionsCard } from "../shared/RevisionsCard";
import { when } from "../shared/trainingLabels";
import { ASSESSMENT_STATUS_COLOR, ASSESSMENT_STATUS_LABEL } from "./TrainingAssessmentListView";

/** The revisions of an assessment under the footer buttons of its details (the Revisions sub-tab of Document Details). `signature` changes whenever the assessment does. */
export function AssessmentRevisionsCard({ assessmentId, signature }: { assessmentId: string; signature: string }) {
  const navigate = useNavigate();
  return (
    <RevisionsCard<TrainingAssessmentRevision>
      tabLabel="Assessment Revision"
      searchPlaceholder="Search by revision number, assessment name, or author..."
      defaultSortKey="revisionNumber"
      objectId={assessmentId}
      signature={signature}
      fetchPage={(params) => trainingAssessmentsApi.revisions(assessmentId, params)}
      columns={[
        { header: "Revision Number", sortKey: "revisionNumber", link: true, cell: (r) => <RevisionLink label={r.revisionNumber} current={r.current} onOpen={() => navigate(`/training-management/assessments/${r.id}`)} /> },
        { header: "Created", sortKey: "created", hideOnPhone: true, cell: (r) => when(r.createdAt) },
        { header: "Opened By", sortKey: "openedBy", hideOnPhone: true, cell: (r) => r.createdByName },
        { header: "Assessment Name", sortKey: "name", cell: (r) => r.name },
        { header: "Status", sortKey: "status", link: true, cell: (r) => <Badge color={ASSESSMENT_STATUS_COLOR[r.status]}>{ASSESSMENT_STATUS_LABEL[r.status] ?? r.status}</Badge> },
      ]}
    />
  );
}
