import React from "react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { DocumentPdfViewer } from "./DocumentPdfViewer";

/**
 * A PDF opened in a window of the page, in the project PDF viewer (EmbedPDF), never in the viewer of the browser. The download and print of the viewer are off: a file that must be
 * downloaded or printed goes through its own audited action.
 */
export function PdfPreviewModal({ title, description, fileUrl, onClose, footerExtra, showCancel = true }: {
  title: string;
  description?: string;
  fileUrl: string;
  onClose: () => void;
  footerExtra?: React.ReactNode;
  /** The secondary "Close" next to the main one; a screen that does not need two ways to close can hide it. */
  showCancel?: boolean;
}) {
  return (
    <FormModal isOpen onClose={onClose} onConfirm={onClose} title={title} description={description} confirmText="Close" cancelText="Close" showCancel={showCancel} footerExtra={footerExtra} size="2xl" className="backdrop-blur-none">
      <DocumentPdfViewer key={fileUrl} fileUrl={fileUrl} height="68dvh" minHeight="420px" forceHideDownloadAndPrint allowContextMenu={false} />
    </FormModal>
  );
}
