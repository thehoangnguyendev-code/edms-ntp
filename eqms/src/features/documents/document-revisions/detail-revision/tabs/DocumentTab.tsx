import React, { useEffect, useState } from "react";
import { DocumentPdfViewer } from "@/features/documents/shared/components/DocumentPdfViewer";
import { Loading } from "@/components/ui/loading/Loading";

export interface DocumentTabProps {
  documentFile?: File | null;
  documentType?: "pdf" | "docx" | "image";
  /** Server-side preview state. Supplying this prevents empty previews from being rendered as loading. */
  previewStatus?: "idle" | "loading" | "ready" | "error";
  previewMessage?: string | null;
  /** Revision id */
  revisionId?: string | null;
  primaryPreviewLabel?: string;
  /** Optional authenticated Office Online action for the current workflow state. */
  workspaceAction?: React.ReactNode;
}

export const DocumentTab: React.FC<DocumentTabProps> = ({
  documentFile = null,
  documentType,
  previewStatus,
  previewMessage,
  workspaceAction,
}) => {
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  // Create object URL only for PDF preview and clean it up on changes
  useEffect(() => {
    if (!documentFile) {
      setPdfPreviewUrl(null);
      return;
    }

    const name = documentFile.name.toLowerCase();
    const type = documentFile.type.toLowerCase();
    const isPdf = documentType
      ? documentType === "pdf"
      : name.endsWith(".pdf") || type === "application/pdf";

    if (!isPdf) {
      setPdfPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(documentFile);
    setPdfPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [documentFile, documentType]);

  if (pdfPreviewUrl) {
    return (
      <div className="flex min-w-0 gap-4 select-none" onContextMenu={(e) => e.preventDefault()}>
        <div className="min-w-0 flex-1">
          {workspaceAction ? <div className="mb-3 flex justify-end">{workspaceAction}</div> : null}
          <DocumentPdfViewer fileUrl={pdfPreviewUrl} />
        </div>
      </div>
    );
  }

  const isPreviewLoading = previewStatus === "loading";
  const previewHint = previewMessage || (documentFile
    ? "The uploaded source file has not produced a PDF preview yet."
    : "No source file has been uploaded for this revision.");

  return (
    <div
      className="relative flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {workspaceAction ? <div className="absolute right-4 top-4">{workspaceAction}</div> : null}
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        {isPreviewLoading ? (
          <Loading size="default" text="Preparing PDF preview..." />
        ) : (
          <p className="text-sm font-medium text-slate-600">
            {previewStatus === "error"
              ? "The PDF preview is unavailable."
              : documentFile
                ? "A PDF preview has not been generated yet."
                : "No source file is available for this revision."}
          </p>
        )}
        <p className="text-sm text-slate-600">{previewHint}</p>
      </div>
    </div>
  );
};
