import React, { useEffect, useState } from "react";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { DocumentPdfViewer } from "@/features/documents/shared/components/DocumentPdfViewer";
import { documentApi } from "@/services/api/documents";
import { getApiErrorMessage } from "@/utils/apiError";

interface CopyDocumentTabProps {
  controlledCopyId: string;
  /** Changes when the copy changes (status, file), so the PDF is loaded again. */
  versionKey?: string | null;
}

/**
 * The controlled copy's own PDF. The server decides what is shown (the issued file, a preview before distribution, or the file with
 * a status text once the copy is withdrawn); this only loads and displays it, read-only.
 */
export const CopyDocumentTab: React.FC<CopyDocumentTabProps> = ({ controlledCopyId, versionKey }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    documentApi
      .getControlledCopyDocument(controlledCopyId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => {
        if (active) {
          setUrl(null);
          setError(getApiErrorMessage(err, "The document could not be loaded."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [controlledCopyId, versionKey]);

  if (loading) {
    return <FullPageLoading text="Loading document..." />;
  }
  if (error || !url) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-600">
        {error || "The document is not available."}
      </div>
    );
  }
  return (
    <div className="select-none" onContextMenu={(e) => e.preventDefault()}>
      <DocumentPdfViewer fileUrl={url} forceHideDownloadAndPrint allowContextMenu={false} />
    </div>
  );
};
