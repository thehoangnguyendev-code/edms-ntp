import type { ControlledCopy, ControlledCopyDistributionBatch } from "./types";

// A list row can contain either child-copy fields, batch fields, or the merged
// singleton-batch representation returned by the server. Keep both optional
// contracts available without forcing callers to cast at every action surface.
type ControlledCopyActionRow = Partial<ControlledCopy> & Partial<ControlledCopyDistributionBatch>;

export const isControlledCopyBatchRow = (copy?: ControlledCopyActionRow | null) =>
  Boolean(copy && Array.isArray(copy.copyIds) && copy.copyIds.length > 1);

export const getControlledCopyActionTargetId = (copy?: ControlledCopyActionRow | null) => {
  if (!copy) return "";
  if (isControlledCopyBatchRow(copy)) {
    return copy.distributionBatchId || copy.id || copy.copyIds?.[0] || "";
  }
  // A singleton batch is represented by one controlled-copy record in the UI;
  // target the child copy endpoint instead of the batch endpoint.
  return copy.primaryControlledCopyId || copy.copyIds?.[0] || copy.id || copy.distributionBatchId || "";
};
