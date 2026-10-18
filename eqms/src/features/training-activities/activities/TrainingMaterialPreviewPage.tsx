import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { dashboard } from "@/components/ui/breadcrumb/breadcrumbs/shared";
import { DocumentPdfViewer } from "@/features/documents/shared/components/DocumentPdfViewer";
import { OnlyOfficeDocumentViewer } from "@/features/documents/shared/components/OnlyOfficeDocumentViewer";
import { trainingError, trainingFilesApi } from "@/services/api/trainingActivities";

/**
 * A training file opened in its own tab: a PDF in the project PDF viewer, a Word file in the read-only OnlyOffice viewer. Nothing is converted. Nobody can edit,
 * download or print from here; every opening is recorded in the Audit Trail.
 */
export function TrainingMaterialPreviewPage() {
  const { materialId = "" } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const kind = search.get("type") === "docx" ? "docx" : "pdf";
  const [pdfUrl, setPdfUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (kind !== "pdf") return;
    let url = "";
    trainingFilesApi.previewMaterial(materialId).then((blob) => { url = URL.createObjectURL(blob); setPdfUrl(url); }).catch((e) => setError(trainingError(e)));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [materialId, kind]);

  return (
    <div className="w-full space-y-4 md:space-y-6">
      <PageHeader title="Training Material Preview" breadcrumbItems={[dashboard(navigate), { label: "Training Management" }, { label: "Training Material Preview", isActive: true }]} />
      {error ? (
        <p role="alert" className="text-sm text-red-700">{error}</p>
      ) : kind === "docx" ? (
        <OnlyOfficeDocumentViewer revisionId={materialId} watchForChanges={false} height="calc(100dvh - 11rem)" loadConfig={() => trainingFilesApi.viewConfig(materialId)} />
      ) : !pdfUrl ? (
        <FullPageLoading text="Loading preview..." />
      ) : (
        <DocumentPdfViewer fileUrl={pdfUrl} withFrame forceHideDownloadAndPrint />
      )}
    </div>
  );
}
