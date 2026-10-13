import React, { useEffect, useState } from "react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { getApiErrorMessage } from "@/utils/apiError";
import { DocumentPdfViewer } from "./DocumentPdfViewer";

interface ScanPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Identifies the file being shown; the file is loaded again when it changes. */
  fileKey: string;
  /** Loads the scan. The server sets the type from the file's own bytes (PDF, PNG or JPEG). */
  loadFile: () => Promise<Blob>;
}

/**
 * Read-only preview of one scanned paper copy in the shared form modal: a PDF in the document viewer (download and print
 * hidden) or an image. The scan is fetched with the user's session (never a public link) and only held as a temporary object
 * URL while open.
 */
export const ScanPreviewModal: React.FC<ScanPreviewModalProps> = ({ isOpen, onClose, title, subtitle, fileKey, loadFile }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<"pdf" | "image" | "other" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    setUrl(null);
    setKind(null);
    loadFile()
      .then((blob) => {
        if (!active) return;
        const type = (blob.type || "").toLowerCase();
        setKind(type.includes("pdf") ? "pdf" : type.startsWith("image/") ? "image" : "other");
        if (type.includes("pdf") || type.startsWith("image/")) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch((err) => {
        if (active) setError(getApiErrorMessage(err, "The scan could not be loaded."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // loadFile is intentionally not a dependency: callers pass an inline closure; fileKey identifies the file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fileKey]);

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={subtitle}
      confirmText="Close"
      showCancel={false}
      className="h-[92vh] max-w-6xl"
    >
      <div className="h-full min-h-[60vh] overflow-hidden rounded-xl border border-slate-200 bg-white" onContextMenu={(event) => event.preventDefault()}>
        {loading && <SectionLoading text="Loading scan..." minHeight="320px" />}
        {!loading && error && (
          <div className="flex h-full min-h-[240px] items-center justify-center px-4 text-center text-sm text-slate-600">{error}</div>
        )}
        {!loading && !error && url && kind === "pdf" && (
          <DocumentPdfViewer fileUrl={url} forceHideDownloadAndPrint allowContextMenu={false} withFrame={false} height="100%" minHeight="0px" />
        )}
        {!loading && !error && url && kind === "image" && (
          <div className="flex min-h-full items-start justify-center">
            <img src={url} alt={title} className="max-h-full max-w-full select-none object-contain" draggable={false} />
          </div>
        )}
        {!loading && !error && kind === "other" && (
          <div className="flex h-full min-h-[240px] items-center justify-center px-4 text-center text-sm text-slate-600">
            This file type cannot be previewed.
          </div>
        )}
      </div>
    </FormModal>
  );
};
