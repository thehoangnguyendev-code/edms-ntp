import type { ControlledCopy } from "./types";
import { isControlledCopyBatchRow } from "./controlledCopyActions";

type ControlledCopyDistributionTarget = Partial<ControlledCopy> & {
  copyIds?: string[];
  quantity?: number;
};

const firstText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const normalize = (value?: string | null) => firstText(value).toLowerCase();

export const getControlledCopyDistributionModeLabel = (copy?: ControlledCopyDistributionTarget | null) => {
  const mode = normalize(copy?.distributionMode);
  if (mode === "internal") {
    return "Internal";
  }
  if (mode === "external") {
    return "External";
  }
  if (firstText(copy?.externalRecipients)) {
    return "External";
  }
  if (mode === "internal" || firstText(copy?.distributionList) || firstText(copy?.recipientName)) {
    return "Internal";
  }
  return "";
};

export const getControlledCopyDistributionListText = (copy?: ControlledCopyDistributionTarget | null) => {
  if (!copy) {
    return "";
  }

  const isBatchRow = isControlledCopyBatchRow(copy);
  const mode = normalize(copy.distributionMode);

  if (isBatchRow) {
    if (mode === "internal" && normalize(copy.distributionScope) === "individual") {
      const count = copy.quantity ?? copy.totalCopies;
      return count ? `Internal: Individual (${count})` : "Internal: Individual";
    }
    if (mode === "internal") {
      // distributionList already carries every selected business unit/department's name,
      // "; "-joined (backend), not just the first -- see ControlledCopyService#createRequest.
      const units = firstText(copy.distributionList, copy.distributionRecipients);
      if (!units) {
        return "Internal";
      }
      // Safety net for rows whose distributionScope wasn't recorded as "individual" (older
      // batches created before that field was populated) but whose distributionList is still a
      // long, comma-joined dump of every recipient's name -- the exact unreadable cell this
      // guards against, even without the scope hint above to catch it directly.
      const names = units.split(",").map((name) => name.trim()).filter(Boolean);
      if (names.length > 3) {
        const count = copy.quantity ?? copy.totalCopies ?? names.length;
        return `Internal: Individual (${count})`;
      }
      return `Internal: ${units}`;
    }
    if (mode === "external" || firstText(copy.externalRecipients)) {
      return "External";
    }
    return firstText(copy.distributionList, copy.distributionRecipients);
  }

  if (mode === "internal") {
    return firstText(copy.recipientName, copy.distributionRecipients, copy.distributionList);
  }

  if (mode === "external" || firstText(copy.externalRecipients)) {
    // Individual records carry one recipientName. Prefer it over the
    // legacy batch-level externalRecipients value, which may contain all
    // addresses from the original request.
    return firstText(copy.recipientName, copy.distributionRecipients, copy.externalRecipients);
  }

  return firstText(copy.recipientName, copy.distributionRecipients, copy.distributionList);
};

/**
 * The actual recipient assigned to ONE member copy inside a batch: their full name for internal
 * distribution (Business Unit / Department / Individual all resolve to a named person per copy),
 * their email for external -- regardless of the batch's own distribution scope/label. Used by the
 * expanded per-copy rows, where the batch-level "Internal: X" / "External" collapse would be
 * meaningless (every row here IS one specific person, per ControlledCopyService#createRequest
 * setting each ControlledCopyRecord's own recipientName at request time).
 */
export const getControlledCopyMemberRecipientText = (copy?: ControlledCopyDistributionTarget | null) => {
  if (!copy) {
    return "";
  }
  return firstText(copy.recipientName, copy.distributionRecipients);
};
