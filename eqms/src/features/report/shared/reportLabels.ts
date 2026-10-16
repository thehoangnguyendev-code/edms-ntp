/**
 * Display text for the machine values of the report module (REPORT-LIST-STANDARD-2026-10-14). The machine value (COMPLETED, RETRY_SCHEDULED) stays
 * what the server sends and what the logic and the API use; only what the person reads is turned into ordinary text ("Completed", "Retry scheduled").
 */

/** "REPORT_ROW_LIMIT_EXCEEDED" -> "Report row limit exceeded". An empty value stays empty. */
export function humanize(code?: string | null): string {
  if (!code) return "";
  const words = code.replace(/[_\-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const RUN_STATUS: Record<string, string> = {
  QUEUED: "Queued",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  RETRY_SCHEDULED: "Retry scheduled",
  FAILED: "Failed",
  DEAD_LETTERED: "Dead-lettered",
};

/** Status of a report run. */
export const runStatusLabel = (status?: string | null): string => (status ? (RUN_STATUS[status] ?? humanize(status)) : "—");

const SCHEDULE_STATUS: Record<string, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  SUSPENDED_AUTHORIZATION_CHANGED: "Suspended: authorization changed",
  SUSPENDED_INVALID_SCHEDULE: "Suspended: invalid schedule",
  SUSPENDED_TEMPLATE_NOT_APPROVED: "Suspended: template not approved",
  SUSPENDED_TEMPLATE_DISABLED: "Suspended: template disabled",
};

/** Status of a report schedule. */
export const scheduleStatusLabel = (status?: string | null): string => (status ? (SCHEDULE_STATUS[status] ?? humanize(status)) : "—");

/** A reason code or an event name as ordinary text; "—" when there is none. */
export const codeLabel = (code?: string | null): string => (code ? humanize(code) : "—");
