import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IconCheck, IconPhotoShare, IconX } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { SectionLoading } from "@/components/ui/loading/Loading";
import type { TabItem } from "@/components/ui/tabs/TabNav";
import { AuditTrailTab } from "@/features/documents/shared/components/AuditTrailTab";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { trainingError, trainingSpecimenApi, type TrainingSpecimen } from "@/services/api/trainingActivities";
import { ReadonlyField, ReadonlyGrid, TrainingDetailLayout } from "../shared/TrainingDetailLayout";
import { day, trainingBreadcrumbs, when } from "../shared/trainingLabels";
import { SpecimenRevisionsCard } from "./SpecimenRevisionsCard";
import { SPECIMEN_STATUS_LABEL } from "./specimenLabels";
import { useSpecimenActions } from "./useSpecimenActions";

/** One specimen signature (FRM.0007): the facts, what can be done with it, and every version of the specimen signature of the person under the footer buttons. */
export function TrainingSpecimenDetailPage() {
  const { specimenId = "" } = useParams();
  const navigate = useNavigate();
  const [specimen, setSpecimen] = useState<TrainingSpecimen>();
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");

  const refetch = useCallback(() => { trainingSpecimenApi.get(specimenId).then(setSpecimen).catch((e) => setError(trainingError(e))); }, [specimenId]);
  useEffect(() => { setSpecimen(undefined); setError(""); refetch(); }, [refetch]);
  useEntityChanged(["TRAINING"], refetch);
  const actions = useSpecimenActions(refetch);

  const title = "Specimen Signature Details";
  const crumbs = trainingBreadcrumbs(navigate, "specimen", title);
  if (!specimen) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader title={title} breadcrumbItems={crumbs} />
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : <SectionLoading text="Loading…" />}
      </div>
    );
  }

  const caps = specimen.capabilities;
  // all three states are always shown; a rejected signature stays in Pending Confirmation until the images are uploaded again
  const wasApproved = specimen.status === "OBSOLETED" && !!specimen.effectiveDate;
  const steps = ["Pending Confirmation", "Approved", "Obsoleted"];
  const stepIndex = specimen.status === "PENDING_CONFIRMATION" ? 0 : specimen.status === "APPROVED" ? 1 : 2;
  const tabs: TabItem[] = [{ id: "overview", label: "General Information" }, { id: "audit", label: "Audit Trail" }];
  const footer = (
    <>
      {caps.viewImage && <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => void actions.view(specimen)}>View Image</Button>}
      {caps.viewImage && (specimen.status === "APPROVED" || wasApproved) && (["docx", "pdf"] as const).map((format) => (
        <Button key={format} size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => void actions.downloadForm(specimen, format)}>{format === "docx" ? "Download Word (FRM.0007)" : "Download PDF (FRM.0007)"}</Button>
      ))}
      {caps.confirm && <Button size="sm" className="whitespace-nowrap" onClick={() => actions.askConfirm(specimen)}>Confirm</Button>}
      {caps.reupload && <Button size="sm" className="whitespace-nowrap" onClick={() => navigate(`/training-management/specimen-signatures?uploadAgain=${specimen.personUserId}`)}>Upload Again</Button>}
      {caps.reject && <Button size="sm" variant="destructive" className="whitespace-nowrap" onClick={() => actions.askReject(specimen)}>Reject</Button>}
    </>
  );

  return (
    <>
      <TrainingDetailLayout
        title={title}
        breadcrumbItems={crumbs}
        onBack={() => navigate("/training-management/specimen-signatures")}
        steps={steps}
        currentStepIndex={stepIndex}
        terminalProgressStep={wasApproved ? "Approved" : "Pending Confirmation"}
        tabs={tabs}
        activeTab={tab}
        onTab={setTab}
        tabLayoutId="training-specimen-detail-tab"
        footer={footer}
        afterFooter={tab === "overview" ? <SpecimenRevisionsCard specimenId={specimen.id} signature={`${specimen.status}:${specimen.versionNo}:${specimen.effectiveDate ?? ""}`} /> : undefined}
      >
        {tab === "overview" && (
          <ReadonlyGrid>
            <ReadonlyField label="Employee ID" value={specimen.employeeCode ?? "—"} />
            <ReadonlyField label="Full Name" value={specimen.fullName} />
            <ReadonlyField label="Department" value={specimen.department ?? "—"} />
            <ReadonlyField label="Version" value={String(specimen.versionNo)} />
            <ReadonlyField label="Status" value={SPECIMEN_STATUS_LABEL[specimen.status] ?? specimen.status} />
            <ReadonlyField label="Effective Date" value={day(specimen.effectiveDate)} />
            <ReadonlyField label="Uploaded By" value={specimen.uploadedByName} />
            <ReadonlyField label="Uploaded On" value={when(specimen.createdAt)} />
            <ReadonlyField label="Confirmed By" value={specimen.confirmedByName ?? "—"} />
            <ReadonlyField label="Signatures" value={specimen.hasSecond ? "1st and 2nd signature" : "1st signature only"} />
            {specimen.changeReason && <ReadonlyField label="Reason for the Change" value={specimen.changeReason} wide />}
            {specimen.rejectReason && <ReadonlyField label={specimen.status === "PENDING_CONFIRMATION" ? "Rejected Because (upload the images again)" : "Rejected Because"} value={specimen.rejectReason} wide />}
          </ReadonlyGrid>
        )}
        {tab === "audit" && <AuditTrailTab entityId={specimen.id} entityType="TRAINING_SPECIMEN_SIGNATURE" />}
      </TrainingDetailLayout>
      {actions.modals}
    </>
  );
}
