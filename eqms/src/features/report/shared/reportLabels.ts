import { statusColor } from "@/components/ui/badge/statusColors";
import type { BadgeColor } from "@/components/ui/badge/Badge";

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

/** Colour of a run badge: Completed green, Failed and Dead-lettered red, Processing blue, Queued and Retry scheduled amber. */
export const runStatusColor = (status?: string | null): BadgeColor =>
  statusColor(status);

/** Status of a report run. */
export const runStatusLabel = (status?: string | null): string => (status ? (RUN_STATUS[status] ?? humanize(status)) : "—");

const SCHEDULE_REASON: Record<string, string> = {
  SUSPENDED_AUTHORIZATION_CHANGED: "Authorization changed",
  SUSPENDED_INVALID_SCHEDULE: "Invalid schedule",
  SUSPENDED_TEMPLATE_NOT_APPROVED: "Template not approved",
  SUSPENDED_TEMPLATE_DISABLED: "Template disabled",
  SUSPENDED_SIGNATURE_REQUIRED: "Signature required",
};

/** Status of a report schedule: Active, Paused or Suspended. Why a schedule is suspended is `scheduleReasonLabel`, a column of its own. */
export const scheduleStatusLabel = (status?: string | null): string =>
  !status ? "—" : status === "ACTIVE" ? "Active" : status === "PAUSED" ? "Paused" : status.startsWith("SUSPENDED_") ? "Suspended" : humanize(status);

/** Colour of the status badge: Active green, Paused amber, Suspended red. */
export const scheduleStatusColor = (status?: string | null): BadgeColor =>
  statusColor(status);

/** Why a schedule is suspended ("Template not approved"); "—" when it is not suspended. */
export const scheduleReasonLabel = (status?: string | null): string =>
  status && status.startsWith("SUSPENDED_") ? (SCHEDULE_REASON[status] ?? humanize(status.replace(/^SUSPENDED_/, ""))) : "—";

/** A reason code or an event name as ordinary text; "—" when there is none. */
export const codeLabel = (code?: string | null): string => (code ? humanize(code) : "—");

/** A revision written and not yet effective (the server's stored number is the whole number of the revision, 1, 2, 3...). */
const REVISION_BEING_WRITTEN = new Set(["DRAFT", "PENDING_APPROVAL", "DISCARDED"]);

/**
 * The number people read for a template revision, in step with the Document revisions: the first revision is 0.0.1 while it is written and 1.0.0 when it
 * is effective; the next one is 1.0.1 and then 2.0.0. Worked out from the stored number and the status (the server's search of the list reads the same label).
 */
export const reportRevisionLabel = (revision?: number | null, status = "EFFECTIVE"): string =>
  revision == null ? "—" : REVISION_BEING_WRITTEN.has(status) ? `${Math.max(revision - 1, 0)}.0.1` : `${revision}.0.0`;
