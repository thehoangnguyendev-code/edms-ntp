import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
import { trainingSpecimenApi, type TrainingSpecimenRevision } from "@/services/api/trainingActivities";
import { RevisionLink, RevisionsCard } from "../shared/RevisionsCard";
import { day, when } from "../shared/trainingLabels";
import { SPECIMEN_STATUS_COLOR, SPECIMEN_STATUS_LABEL } from "./specimenLabels";

/** Every version of the specimen signature of the person, under the footer buttons of the details of one of them (the Revisions sub-tab of Document Details). */
export function SpecimenRevisionsCard({ specimenId, signature }: { specimenId: string; signature: string }) {
  const navigate = useNavigate();
  return (
    <RevisionsCard<TrainingSpecimenRevision>
      tabLabel="Specimen Signature Revision"
      searchPlaceholder="Search by version, uploader, confirmer, or reason..."
      defaultSortKey="versionNo"
      objectId={specimenId}
      signature={signature}
      fetchPage={(params) => trainingSpecimenApi.revisions(specimenId, params)}
      columns={[
        { header: "Version", sortKey: "versionNo", link: true, cell: (r) => <RevisionLink label={String(r.versionNo)} current={r.current} onOpen={() => navigate(`/training-management/specimen-signatures/${r.id}`)} /> },
        { header: "Uploaded On", sortKey: "created", hideOnPhone: true, cell: (r) => when(r.createdAt) },
        { header: "Uploaded By", sortKey: "uploadedBy", hideOnPhone: true, cell: (r) => r.uploadedByName },
        { header: "Confirmed By", sortKey: "confirmedBy", hideOnPhone: true, cell: (r) => r.confirmedByName ?? "—" },
        { header: "Effective Date", sortKey: "effective", cell: (r) => day(r.effectiveDate) },
        { header: "Status", sortKey: "status", link: true, cell: (r) => <Badge color={SPECIMEN_STATUS_COLOR[r.status]}>{SPECIMEN_STATUS_LABEL[r.status] ?? r.status}</Badge> },
      ]}
    />
  );
}
