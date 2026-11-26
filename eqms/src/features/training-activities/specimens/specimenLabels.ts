import { localized } from "../shared/trainingLabels";
import { statusColors } from "@/components/ui/badge/statusColors";
import type { BadgeColor } from "@/components/ui/badge/Badge";

/** Status of a specimen signature: machine value to the name shown. */
export const SPECIMEN_STATUS_LABEL: Record<string, string> = localized({
  PENDING_CONFIRMATION: "Not confirmed (earlier workflow)",
  APPROVED: "Current",
  OBSOLETED: "Superseded",
});
export const SPECIMEN_STATUS_COLOR = statusColors("PENDING_CONFIRMATION", "APPROVED", "OBSOLETED") as Record<string, BadgeColor>;
