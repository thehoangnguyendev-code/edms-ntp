import { useEffect, useState } from "react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { DocumentPdfViewer } from "@/features/documents/shared/components/DocumentPdfViewer";
import { OnlyOfficeDocumentViewer } from "@/features/documents/shared/components/OnlyOfficeDocumentViewer";
import { trainingError, trainingFilesApi } from "@/services/api/trainingActivities";

/**
 * A training file looked at in a window over the screen: a PDF in the project PDF viewer, a Word file in the read-only OnlyOffice viewer. Nothing is converted. Nobody can edit, download or print
 * from here; every opening is recorded in the Audit Trail.
 */
export function TrainingMaterialPreviewModal({ materialId, name, kind, onClose }: { materialId: string; name?: string | null; kind: "pdf" | "docx"; onClose: () => void }) {
  const [pdfUrl, setPdfUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (kind !== "pdf") return;
    let url = "";
    let live = true;
    trainingFilesApi.previewMaterial(materialId).then((blob) => { if (live) { url = URL.createObjectURL(blob); setPdfUrl(url); } }).catch((e) => { if (live) setError(trainingError(e)); });
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [materialId, kind]);

  return (
    <FormModal isOpen onClose={onClose} title={name ? `Preview: ${name}` : "Training Material Preview"} showFooter={false} size="2xl" className="max-w-5xl">
      {error ? (
        <p role="alert" className="text-sm text-red-700">{error}</p>
      ) : kind === "docx" ? (
        <OnlyOfficeDocumentViewer key={materialId} revisionId={materialId} watchForChanges={false} height="68dvh" loadConfig={() => trainingFilesApi.viewConfig(materialId)} />
      ) : !pdfUrl ? (
        <SectionLoading text="Loading preview…" />
      ) : (
        <DocumentPdfViewer fileUrl={pdfUrl} height="68dvh" showThumbnailSidebar={false} forceHideDownloadAndPrint allowContextMenu={false} />
      )}
    </FormModal>
  );
}
