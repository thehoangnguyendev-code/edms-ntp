import type { BadgeColor } from "./Badge";

/**
 * The one table of status colours of the application: the same status has the same colour on every screen. It is read by the machine value the API sends
 * (ACTIVE, PENDING_APPROVAL...), never by a translated label. A screen that has a new status adds it here and does not choose a colour of its own.
 *
 * emerald: in force, done, passed — amber: waits for someone or needs attention — blue: planned, under way, ready — red: failed, refused, cancelled —
 * rose: switched off — orange: suspended — slate: not started or no longer in use.
 */
const BY_COLOR: Partial<Record<BadgeColor, readonly string[]>> = {
  emerald: ["FINALIZED", "OK", "ACTIVE", "ENABLED", "EFFECTIVE", "APPROVED", "PUBLISHED", "COMPLETED", "CLOSED", "HANDLED", "RESOLVED", "QUALIFIED", "PASS", "PASSED", "SUCCESS", "SUCCEEDED",
    "VERIFIED", "DISTRIBUTED", "IMPLEMENTED", "MITIGATED", "CLEARED", "FILED", "SENT", "DELIVERED", "ACCEPTED", "GRANTED", "HEALTHY", "TRANSLATED"],
  amber: ["PENDING_FINALIZATION", "PENDING_RECEIVER", "PENDING_CONFIRMATION", "POSTPONED", "UPDATE_NEEDED", "PENDING", "PENDING_REVIEW", "PENDING_QA_CONFIRMATION", "PENDING_ACCEPTANCE", "OBSOLETE", "OBSOLETED", "DUE", "OPEN", "ABSENCE_RETURN", "WARNING", "PAUSED", "QUEUED",
    "RETRY_SCHEDULED", "ENTERED", "NOT_VERIFIED", "OUTDATED", "EXPIRING"],
  blue: ["PENDING_APPROVAL", "IN_PROGRESS", "RUNNING", "PROCESSING", "PLANNED", "SCHEDULED", "NOTIFIED", "READY", "READY_FOR_DISTRIBUTION", "CURRENT", "SUBMITTED", "INFO", "NEW_HIRE"],
  purple: ["PENDING_TRAINING", "DEPT_TRANSFER", "POSITION_CHANGE"],
  indigo: ["READY_FOR_PUBLISHING"],
  red: ["REQUIRED", "CANCELLED", "CLOSED_CANCELLED", "REJECTED", "FAILED", "FAIL", "DEAD_LETTERED", "BLOCKED", "OVERDUE", "CRITICAL", "REVOKED", "ERROR", "MISSING",
    "DISQUALIFIED", "REFUSED", "DECLINED", "DENIED", "START_DATE_MISSING"],
  rose: ["INACTIVE", "DISABLED", "TERMINATED", "NOT_TRANSLATED"],
  orange: ["SUSPENDED"],
  slate: ["ROLLED_BACK", "SKIPPED", "NOT_REQUIRED", "DRAFT", "ARCHIVED", "ARCHIVE", "EXPIRED", "DISCARDED", "SUPERSEDED", "RESERVED", "NOT_STARTED", "DISMISSED"],
};

const BY_STATUS = new Map<string, BadgeColor>(
  (Object.entries(BY_COLOR) as [BadgeColor, readonly string[]][]).flatMap(([color, codes]) => codes.map((code) => [code, color] as const)),
);

/** "Closed - Cancelled", "closed-cancelled" and CLOSED_CANCELLED are the same status. */
const codeOf = (status?: string | null) => status?.trim().toUpperCase().replace(/[\s-]+/g, "_") ?? "";

/** The colour of a status, or undefined for a status the table does not know. A reason added to a suspension (SUSPENDED_...) is a suspension. */
export const knownStatusColor = (status?: string | null): BadgeColor | undefined => {
  const code = codeOf(status);
  return BY_STATUS.get(code) ?? (code.startsWith("SUSPENDED_") ? "orange" : undefined);
};

/** The colour of a status; grey for a status the table does not know. */
export const statusColor = (status?: string | null): BadgeColor => knownStatusColor(status) ?? "slate";

/** The statuses of one screen with their colours from the table, for a lookup such as `colours[row.status]`. */
export const statusColors = <K extends string>(...codes: K[]): Record<K, BadgeColor> =>
  Object.fromEntries(codes.map((code) => [code, statusColor(code)])) as Record<K, BadgeColor>;

/** The channel a notification goes out on. */
export const channelColor = (channel?: string | null): BadgeColor => (codeOf(channel) === "EMAIL" ? "blue" : "violet");

/** The colour of a priority or a severity, in any letter case. */
export const priorityColor = (priority?: string | null): BadgeColor =>
  ({ CRITICAL: "red", HIGH: "red", MEDIUM: "amber", WARNING: "amber", LOW: "emerald", INFO: "blue" } as Record<string, BadgeColor>)[codeOf(priority)] ?? "slate";
