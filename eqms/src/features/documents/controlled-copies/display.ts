import type { ControlledCopy } from "./types";
import { formatDocumentDisplayLabel } from "../shared/documentDisplay";

export const formatControlledCopyNumber = (value?: string | null) =>
  (value || "").trim().replace(/-/g, ".");

type ControlledCopyNumberSource = {
  controlledCopyNumber?: string;
  batchNumber?: string;
  distributionBatchNumber?: string;
};

/**
 * The number to display for a controlled-copy record: the batch's own number for a real batch,
 * the record's own number otherwise. Must NOT be read off controlledCopy.controlledCopyNumber
 * directly for a batch -- that field is a pre-baked upstream guess (normalizeControlledCopyBatch's
 * own isSingleton check, itself quantity-based) that is a SEPARATE computation from whatever flag
 * the caller uses to decide "is this a batch" (isBatchParent, isExpandable, ...); the two can drift
 * apart and show one member copy's own number under a "Batch Number" label. Passing `isBatch`
 * explicitly ties this to the same flag the caller already uses for its own batch/single branching,
 * so the number and everything else about the row can never disagree about which it is.
 */
export const controlledCopyDisplayNumber = (copy: ControlledCopyNumberSource | null | undefined, isBatch: boolean) => {
  if (!copy) return "";
  if (isBatch) {
    return formatControlledCopyNumber(copy.batchNumber || copy.distributionBatchNumber || copy.controlledCopyNumber || "");
  }
  return formatControlledCopyNumber(copy.controlledCopyNumber || "");
};

type DocumentLabelSource = Pick<ControlledCopy, "documentNumber" | "documentName" | "name" | "documentDisplayLabel">;

export const formatDocumentLabel = (copy: DocumentLabelSource) => {
  return copy.documentDisplayLabel || formatDocumentDisplayLabel(copy.documentNumber, copy.documentName || copy.name);
};

export const formatDocumentRevisionLabel = (copy: Pick<ControlledCopy, "documentName" | "name" | "revisionName" | "revisionNumber">) => {
  return copy.revisionName || [copy.documentName || copy.name, copy.revisionNumber].filter(Boolean).join("_");
};
