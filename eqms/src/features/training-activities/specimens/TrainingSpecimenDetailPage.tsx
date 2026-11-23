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
import { tr } from "@/i18n";

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
  const actions = useSpecimenActions();

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
  const tabs: TabItem[] = [{ id: "overview", label: tr("General Information") }, { id: "audit", label: tr("Audit Trail") }];
  const footer = (
    <>
      {caps.viewImage && <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => void actions.view(specimen)}>{tr("View Image")}</Button>}
    </>
  );

  return (
    <>
      <TrainingDetailLayout
        title={title}
        breadcrumbItems={crumbs}
        onBack={() => navigate("/training-management/specimen-signatures")}
        workflow={specimen.workflow}
        tabs={tabs}
        activeTab={tab}
        onTab={setTab}
        tabLayoutId="training-specimen-detail-tab"
        footer={footer}
        afterFooter={tab === "overview" ? <SpecimenRevisionsCard specimenId={specimen.id} signature={`${specimen.status}:${specimen.versionNo}:${specimen.effectiveDate ?? ""}`} /> : undefined}
      >
        {tab === "overview" && (
          <ReadonlyGrid>
            <ReadonlyField label={tr("Employee ID")} value={specimen.employeeCode ?? "—"} />
            <ReadonlyField label={tr("Full Name")} value={specimen.fullName} />
            <ReadonlyField label={tr("Department")} value={specimen.department ?? "—"} />
            <ReadonlyField label={tr("Version")} value={String(specimen.versionNo)} />
            <ReadonlyField label={tr("Status")} value={SPECIMEN_STATUS_LABEL[specimen.status] ?? specimen.status} />
            <ReadonlyField label={tr("Effective Date")} value={day(specimen.effectiveDate)} />
            <ReadonlyField label={tr("Uploaded By")} value={specimen.uploadedByName} />
            <ReadonlyField label={tr("Uploaded On")} value={when(specimen.createdAt)} />
            <ReadonlyField label={tr("Confirmed By (earlier workflow)")} value={specimen.confirmedByName ?? "—"} />
            <ReadonlyField label={tr("Signatures")} value={specimen.hasSecond ? "1st and 2nd signature" : "1st signature only"} />
            {specimen.changeReason && <ReadonlyField label={tr("Reason for the Change")} value={specimen.changeReason} wide />}
          </ReadonlyGrid>
        )}
        {tab === "audit" && <AuditTrailTab entityId={specimen.id} entityType="TRAINING_SPECIMEN_SIGNATURE" />}
      </TrainingDetailLayout>
      {actions.modals}
    </>
  );
}
