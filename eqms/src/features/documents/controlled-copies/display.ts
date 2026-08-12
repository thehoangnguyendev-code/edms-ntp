import type { ControlledCopy } from "./types";
import { formatDocumentDisplayLabel } from "../shared/documentDisplay";

export const formatControlledCopyNumber = (value?: string | null) =>
  (value || "").trim().replace(/-/g, ".");

type DocumentLabelSource = Pick<ControlledCopy, "documentNumber" | "documentName" | "name" | "documentDisplayLabel">;

export const formatDocumentLabel = (copy: DocumentLabelSource) => {
  return copy.documentDisplayLabel || formatDocumentDisplayLabel(copy.documentNumber, copy.documentName || copy.name);
};

export const formatDocumentRevisionLabel = (copy: Pick<ControlledCopy, "documentName" | "name" | "revisionName" | "revisionNumber">) => {
  return copy.revisionName || [copy.documentName || copy.name, copy.revisionNumber].filter(Boolean).join("_");
};
