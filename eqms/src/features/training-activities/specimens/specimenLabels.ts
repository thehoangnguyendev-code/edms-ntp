/** Status of a specimen signature: machine value to the name shown. */
export const SPECIMEN_STATUS_LABEL: Record<string, string> = {
  PENDING_CONFIRMATION: "Not confirmed (earlier workflow)",
  APPROVED: "Current",
  OBSOLETED: "Superseded",
};
export const SPECIMEN_STATUS_COLOR: Record<string, "amber" | "emerald" | "slate"> = {
  PENDING_CONFIRMATION: "amber",
  APPROVED: "emerald",
  OBSOLETED: "slate",
};
