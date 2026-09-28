import type { ControlledCopy, ControlledCopyDistributionBatch } from "./types";

// A list row can contain either child-copy fields, batch fields, or the merged
// singleton-batch representation returned by the server. Keep both optional
// contracts available without forcing callers to cast at every action surface.
// batchQuantity is a ControlledCopiesView.tsx-local addition (set only by mapBatchToRow, never
// by mapRecordToRow or the child/individual-record mapping) -- declared here too so this shared
// check can read it without the caller casting.
type ControlledCopyActionRow = Partial<ControlledCopy> & Partial<ControlledCopyDistributionBatch> & { batchQuantity?: number };

/**
 * Whether a controlled-copy object represents a real multi-copy batch (as opposed to one member
 * copy inside such a batch, or a standalone single copy).
 *
 * copyIds ALONE is not reliable: the paged list endpoint deliberately returns an empty copyIds on
 * every row (avoiding an N+1 child-materialisation query per page), so a genuine multi-copy batch
 * row selected from the list always looked like a single record to a copyIds-only check.
 *
 * ControlledCopy.totalCopies is deliberately EXCLUDED here even though it sounds like the right
 * signal: it means two different things depending on which mapping produced the object --
 * "how many copies does THIS row represent" on a batch-mapped object, but "how many copies exist
 * in the batch I belong to" on one individual member copy (the backend sets totalCopies to the
 * whole batch's size on every ControlledCopyListItemResponse row, e.g. the batch's 3 member
 * copies returned by GET .../batches/{id}/copies each carry totalCopies=3). Using it here made
 * every member of a real batch look like a batch of its own.
 *
 * batchQuantity (list rows) and quantity (raw ControlledCopyDistributionBatch payload) don't have
 * that ambiguity -- neither is ever set on an individual member/standalone copy object -- so they
 * are checked first; copyIds.length is the last-resort fallback for a batch object fetched with
 * its member ids already populated (the detail endpoint).
 */
export const isControlledCopyBatchRow = (copy?: ControlledCopyActionRow | null) => {
  if (!copy) return false;
  const count = Number(copy.batchQuantity ?? copy.quantity ?? copy.copyIds?.length ?? 0);
  return count > 1;
};

export const getControlledCopyActionTargetId = (copy?: ControlledCopyActionRow | null) => {
  if (!copy) return "";
  if (isControlledCopyBatchRow(copy)) {
    return copy.distributionBatchId || copy.id || copy.copyIds?.[0] || "";
  }
  // A singleton batch is represented by one controlled-copy record in the UI;
  // target the child copy endpoint instead of the batch endpoint.
  return copy.primaryControlledCopyId || copy.copyIds?.[0] || copy.id || copy.distributionBatchId || "";
};
