import type { AnnouncementState } from "./types";

/** The sortable columns; the server accepts exactly these and falls back to the start time for anything else. */
export type AnnouncementSortKey = "title" | "severity" | "state" | "startsAt" | "endsAt" | "updatedAt" | "updatedBy" | "createdBy";

export type SeverityFilter = "ALL" | "INFO" | "WARNING" | "CRITICAL";
export type StateFilter = "ALL" | AnnouncementState;

export const STATE_FILTER_OPTIONS: { label: string; value: StateFilter }[] = [
  { label: "All", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Scheduled", value: "SCHEDULED" },
  { label: "Expired", value: "EXPIRED" },
  { label: "Switched off", value: "DISABLED" },
];

export const SEVERITY_FILTER_OPTIONS: { label: string; value: SeverityFilter }[] = [
  { label: "All", value: "ALL" },
  { label: "Information", value: "INFO" },
  { label: "Warning", value: "WARNING" },
  { label: "Critical", value: "CRITICAL" },
];

/**
 * The date range pickers work in "dd/MM/yyyy" (local). The server takes an instant: the start of the first day, or the very end
 * of the last day, in the browser's time zone. An incomplete or impossible date means "no limit".
 */
export const dateToInstant = (value: string, boundary: "start" | "end"): string | undefined => {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return undefined;
  const [, day, month, year] = match.map(Number) as number[];
  const date = boundary === "start" ? new Date(year, month - 1, day, 0, 0, 0, 0) : new Date(year, month - 1, day, 23, 59, 59, 999);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined;
  return date.toISOString();
};
