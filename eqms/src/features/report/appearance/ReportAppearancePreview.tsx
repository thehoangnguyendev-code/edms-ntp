import { useEffect, useState } from "react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { PdfPreviewModal } from "@/features/documents/shared/components/PdfPreviewModal";
import { reportAppearanceApi } from "@/services/api/reportAppearance";
import { reportError } from "@/services/api/reportTemplates";

/**
 * Every page of an appearance, drawn by the server with made-up values and rows and shown in the project PDF viewer (EmbedPDF): the cover, the pages of the table and the last
 * page, as a real report would have them (REPORT-APPEARANCE-LIST-2026-11-15). Nothing is saved and no run is made.
 */
export function ReportAppearancePreview({ id, name, onClose }: { id: string; name: string; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    let created = "";
    reportAppearanceApi
      .preview(id)
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
  }, [id]);

  if (url) return <PdfPreviewModal title={`Preview: ${name}`} description="All pages of this appearance, with sample values" fileUrl={url} onClose={onClose} showCancel={false} wide />;
  return (
    <FormModal isOpen onClose={onClose} onConfirm={onClose} title={`Preview: ${name}`} confirmText="Close" cancelText="Close" showCancel={false} size="2xl" className="backdrop-blur-none !max-w-[96vw]">
      {error ? <WarningBanner variant="error" description={error} /> : <SectionLoading text="Drawing the pages…" />}
    </FormModal>
  );
}
