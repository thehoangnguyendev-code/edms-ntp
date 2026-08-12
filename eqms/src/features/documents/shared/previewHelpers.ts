export const REVISION_PDF_PREVIEW_TYPES = new Set(["REVIEW_PDF", "REVIEW_SNAPSHOT", "PUBLISHED_PDF", "SOURCE_DOCX"]);

export const isRevisionPdfPreviewType = (previewType?: string | null) => {
  const normalized = String(previewType || "").trim().toUpperCase();
  return REVISION_PDF_PREVIEW_TYPES.has(normalized);
};

/**
 * Converts the backend's revision-specific preview contract into a user-facing
 * explanation. This keeps every Document tab consistent and avoids presenting
 * an expected "no file" state as a technical PDF loading failure.
 */
export const describeRevisionPreviewUnavailable = (detail?: {
  status?: string | null;
  statusInfo?: { code?: string | null } | null;
  previewType?: string | null;
  previewStatus?: string | null;
  snapshotStatus?: string | null;
  fileName?: string | null;
} | null) => {
  const status = String(detail?.statusInfo?.code || detail?.status || "").trim().toUpperCase();
  const previewStatus = String(detail?.previewStatus || detail?.snapshotStatus || "").trim().toUpperCase();
  const previewType = String(detail?.previewType || "").trim().toUpperCase();

  if (previewStatus === "GENERATING" && (previewType === "REVIEW_PDF" || previewType === "REVIEW_SNAPSHOT")) {
    return "The immutable review snapshot is being generated. It will be available shortly.";
  }
  if (previewStatus === "FAILED") {
    return "The PDF preview could not be generated. Document Control should review the source file and generation log.";
  }
  if (previewType === "SOURCE_DOCX" || status === "DRAFT") {
    return detail?.fileName
      ? "This is the current working copy for this revision. It has not been issued as an official PDF."
      : "No source file has been uploaded for this revision. Upload a revision file to create a preview.";
  }
  if (status === "CLOSED_CANCELLED" || status === "CANCELLED") {
    return "This cancelled revision has no retained source file or review snapshot available for preview.";
  }
  if (status === "EFFECTIVE" || status === "OBSOLETED") {
    return "No published PDF is stored for this revision.";
  }
  return "No review snapshot has been created for this revision yet.";
};

export const isPdfBlob = async (blob: Blob) => {
  if (!blob || blob.size < 4) return false;
  const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  return header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
};

export const createPdfFileFromBlob = (blob: Blob, fileName: string) =>
  new File([blob], fileName, { type: "application/pdf" });

export const loadPdfPreviewFile = async (
  fetchBlob: () => Promise<Blob>,
  fileName: string,
) => {
  const blob = await fetchBlob();
  if (!(await isPdfBlob(blob))) {
    throw new Error("Server returned a file that is not a valid PDF.");
  }
  return createPdfFileFromBlob(blob, fileName);
};

export const buildRevisionPreviewFileName = (documentNumber?: string | null, revisionNumber?: string | null) => {
  const parts = [documentNumber, revisionNumber].filter((value) => String(value || "").trim().length > 0);
  return parts.length > 0 ? `${parts.join("_")}.pdf` : "revision.pdf";
};

export const buildDocumentPreviewFileName = (documentName?: string | null) => {
  const normalized = String(documentName || "").trim();
  return normalized ? `${normalized}.pdf` : "preview.pdf";
};

export const buildPreviewCacheBuster = (...parts: Array<string | number | boolean | null | undefined>) => {
  const normalized = parts
    .map((part) => String(part ?? "").trim())
    .filter((part) => part.length > 0);
  if (normalized.length === 0) {
    return String(Date.now());
  }
  return normalized.join("::");
};

export const buildPreviewVersionCacheBuster = (previewVersionToken?: string | null) => {
  const normalized = String(previewVersionToken || "").trim();
  return normalized.length > 0 ? normalized : String(Date.now());
};

export const resolveRevisionPreviewVersionToken = (detail?: {
  previewType?: string | null;
  previewVersionToken?: string | null;
  reviewSnapshotVersionToken?: string | null;
  publishingPreviewVersionToken?: string | null;
  publishedPdfVersionToken?: string | null;
} | null) => {
  const previewType = String(detail?.previewType || "").trim().toUpperCase();
  if (previewType === "PUBLISHED_PDF") {
    return detail?.publishedPdfVersionToken || detail?.previewVersionToken || null;
  }
  if (previewType === "REVIEW_PDF" || previewType === "REVIEW_SNAPSHOT") {
    return detail?.reviewSnapshotVersionToken || detail?.publishingPreviewVersionToken || detail?.previewVersionToken || null;
  }
  return detail?.previewVersionToken || null;
};

export const createObjectUrlFromBlob = (blob: Blob) => URL.createObjectURL(blob);

export const replaceObjectUrlPreview = (
  currentUrl: string | null | undefined,
  blob: Blob,
) => {
  revokeObjectUrl(currentUrl);
  return createObjectUrlFromBlob(blob);
};

export const revokeObjectUrl = (url?: string | null) => {
  if (url) {
    URL.revokeObjectURL(url);
  }
};
