import type { BadgeColor } from "@/components/ui/badge/Badge";
import { localized } from "../shared/trainingLabels";
import { statusColors } from "@/components/ui/badge/statusColors";

/** The events that open a training review (SOP.0003 5.3.11) and the states of a review, as the screens name them. */
export const REVIEW_KIND_LABEL: Record<string, string> = localized({
  NEW_HIRE: "New employee",
  ABSENCE_RETURN: "Return after absence",
  DEPT_TRANSFER: "Transfer to another department",
  LOCATION_TRANSFER: "Transfer to another site",
});

export const REVIEW_STATUS_LABEL: Record<string, string> = localized({
  OPEN: "Open",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
});

/** The filter of the list also has "Ready to close": an open review whose items are all settled. */
export const REVIEW_STATUS_FILTER_LABEL: Record<string, string> = localized({
  OPEN: "Open",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
  READY_TO_CLOSE: "Ready to close",
});

export const REVIEW_STATUS_COLOR = statusColors("OPEN", "CLOSED", "CANCELLED") as Record<string, BadgeColor>;
