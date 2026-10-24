import type { BadgeColor } from "@/components/ui/badge/Badge";

/** The events that open a training review (SOP.0003 5.3.11) and the states of a review, as the screens name them. */
export const REVIEW_KIND_LABEL: Record<string, string> = {
  NEW_HIRE: "New employee",
  ABSENCE_RETURN: "Return after absence",
  DEPT_TRANSFER: "Transfer to another department",
  LOCATION_TRANSFER: "Transfer to another site",
};

export const REVIEW_STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

/** The filter of the list also has "Ready to close": an open review whose items are all settled. */
export const REVIEW_STATUS_FILTER_LABEL: Record<string, string> = { ...REVIEW_STATUS_LABEL, READY_TO_CLOSE: "Ready to close" };

export const REVIEW_STATUS_COLOR: Record<string, BadgeColor> = { OPEN: "amber", CLOSED: "emerald", CANCELLED: "slate" };
