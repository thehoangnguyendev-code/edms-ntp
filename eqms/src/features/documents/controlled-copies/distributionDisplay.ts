import type { ControlledCopy } from "./types";
import { isControlledCopyBatchRow } from "./controlledCopyActions";

type ControlledCopyDistributionTarget = Partial<ControlledCopy> & {
  copyIds?: string[];
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
      return "Individual";
    }
    if (mode === "internal") {
      return firstText(copy.distributionList, copy.distributionRecipients);
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
