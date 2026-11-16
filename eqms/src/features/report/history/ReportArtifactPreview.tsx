import { useEffect, useState } from "react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { PdfPreviewModal } from "@/features/documents/shared/components/PdfPreviewModal";
import { OnlyOfficeDocumentViewer } from "@/features/documents/shared/components/OnlyOfficeDocumentViewer";
import { reportsApi } from "@/services/api/reports";
import { reportError } from "@/services/api/reportTemplates";

/**
 * A report file looked at in the page, never saved to the computer (REPORT-ARTIFACT-PREVIEW-2026-11-14): a PDF in the project PDF viewer (EmbedPDF), a CSV or XLSX in
 * the read-only OnlyOffice viewer. The server checks the permission of a download again for each preview and records it in the Audit Trail.
 */
export function ReportArtifactPreview({ runId, artifactId, format, title, onClose }: { runId: string; artifactId: string; format: string; title: string; onClose: () => void }) {
  return format === "PDF" ? (
    <PdfArtifact runId={runId} artifactId={artifactId} title={title} onClose={onClose} />
  ) : (
    <FormModal isOpen onClose={onClose} onConfirm={onClose} title={title} description="Read-only preview" confirmText="Close" cancelText="Close" showCancel={false} size="2xl" className="backdrop-blur-none !max-w-[96vw]">
      <OnlyOfficeDocumentViewer key={artifactId} revisionId={artifactId} watchForChanges={false} height="72dvh" loadConfig={() => reportsApi.artifactViewConfig(runId, artifactId)} />
    </FormModal>
  );
}

function PdfArtifact({ runId, artifactId, title, onClose }: { runId: string; artifactId: string; title: string; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    let created = "";
    reportsApi
      .previewArtifact(runId, artifactId)
      .then((blob) => {
        created = URL.createObjectURL(blob);
        if (alive) setUrl(created);
        else URL.revokeObjectURL(created);
      })
      .catch((failure) => alive && setError(reportError(failure)));
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [runId, artifactId]);

  if (url) return <PdfPreviewModal title={title} description="Read-only preview" fileUrl={url} onClose={onClose} showCancel={false} wide />;
  return (
    <FormModal isOpen onClose={onClose} onConfirm={onClose} title={title} confirmText="Close" cancelText="Close" showCancel={false} size="2xl" className="backdrop-blur-none !max-w-[96vw]">
      {error ? <WarningBanner variant="error" description={error} /> : <SectionLoading text="Opening the report…" />}
    </FormModal>
  );
}
