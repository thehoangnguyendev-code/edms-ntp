import { formatDateTime } from "@/utils/format";
import { formatAuditActionLabel } from "../../utils/actionBadge";
import { AUDIT_KIND_TONE, auditActionKind, type AuditActionKind, type AuditTone } from "../../utils/actionKind";
import { buildChangeSummary, buildEntityLabel } from "../../utils/recordSummary";
import type { AuditTrailRecord } from "../../types";

export type AuditTimelineStyle = "RAIL" | "CENTER" | "COMPACT" | "SCROLL_LIT";

export const AUDIT_TIMELINE_STYLES: AuditTimelineStyle[] = ["RAIL", "CENTER", "COMPACT", "SCROLL_LIT"];

export const normalizeTimelineStyle = (value: string | null | undefined): AuditTimelineStyle =>
  AUDIT_TIMELINE_STYLES.includes(value as AuditTimelineStyle) ? (value as AuditTimelineStyle) : "COMPACT";

/** One mark of the timeline: who did it, when, and what (REPORT: only these three, read at a glance; the rest stays in the table and the detail page). */
export interface AuditTimelineItem {
  id: string;
  record: AuditTrailRecord;
  who: string;
  initials: string;
  avatar: { bg: string; fg: string };
  /** The picture of the person (the avatar of the profile); null when there is none, and the mark shows the initials. */
  avatarUrl: string | null;
  /** HH:mm:ss, in the one time format of the system (UTC+7). */
  time: string;
  /** dd/MM/yyyy HH:mm:ss: shown on hover. */
  fullTime: string;
  /** dd/MM/yyyy: the day the mark belongs to. */
  dayKey: string;
  verb: string;
  object: string;
  /** What changed, when the record says; empty when it only repeats the action. */
  detail: string;
  kind: AuditActionKind;
  tone: AuditTone;
  signed: boolean;
}

export interface AuditTimelineDay {
  key: string;
  /** "Today", "Yesterday", or the name of the weekday. */
  label: string;
  weekday: string;
  dayOfMonth: string;
  month: string;
  items: AuditTimelineItem[];
}

const AVATARS = [
  { bg: "#d1fae5", fg: "#047857" },
  { bg: "#e0f2fe", fg: "#0369a1" },
  { bg: "#fce7f3", fg: "#be185d" },
  { bg: "#ede9fe", fg: "#6d28d9" },
  { bg: "#fef3c7", fg: "#b45309" },
  { bg: "#dcfce7", fg: "#15803d" },
  { bg: "#ffe4e6", fg: "#be123c" },
  { bg: "#e2e8f0", fg: "#334155" },
];

/** The same person always gets the same colour. */
export const avatarColors = (name: string) => {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATARS[hash % AVATARS.length];
};

export const initialsOf = (name: string) => {
  const words = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

/** The names are written here, not taken from the language of the browser: one display format for the whole system. */
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const parseDay = (key: string) => {
  const [day, month, year] = key.split("/").map(Number);
  return new Date(year, month - 1, day);
};

const dayLabel = (key: string, todayKey: string) => {
  if (key === todayKey) return "Today";
  const today = parseDay(todayKey);
  const day = parseDay(key);
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (diff === 1) return "Yesterday";
  return WEEKDAYS[day.getDay()];
};

/** The avatar of the person who did it, as the audit detail page reads it: the profile when the server sends it, else what the record kept. */
const avatarOf = (record: AuditTrailRecord): string | null => {
  const url = record.user?.avatar || record.metadata?.userAvatar;
  return typeof url === "string" && url.trim() ? url.trim() : null;
};

export function toTimelineItem(record: AuditTrailRecord): AuditTimelineItem {
  const user = record.user;
  const who = user?.fullName || record.fullName || "Unknown user";
  const full = formatDateTime(record.timestamp);
  const kind = auditActionKind(record.action);
  const summary = buildChangeSummary(record);
  const verb = formatAuditActionLabel(record.action || "");
  return {
    id: record.id,
    record,
    who,
    initials: initialsOf(who),
    avatar: avatarColors(who),
    avatarUrl: avatarOf(record),
    time: full === "-" ? "-" : full.slice(11),
    fullTime: full,
    dayKey: full === "-" ? "-" : full.slice(0, 10),
    verb,
    object: buildEntityLabel(record),
    detail: summary === "-" || summary.trim().toLowerCase() === verb.toLowerCase() ? "" : summary,
    kind,
    tone: AUDIT_KIND_TONE[kind],
    signed:
      record.electronicSignatureApplied === true ||
      record.metadata?.electronicSignatureApplied === true ||
      Boolean(record.signatureId || record.metadata?.signatureId || record.metadata?.signature_id),
  };
}

/** The records, newest first as the server gives them, grouped by the day they happened (UTC+7). */
export function groupByDay(records: AuditTrailRecord[], now: Date = new Date()): AuditTimelineDay[] {
  const todayKey = formatDateTime(now).slice(0, 10);
  const days: AuditTimelineDay[] = [];
  for (const record of records) {
    const item = toTimelineItem(record);
    let day = days[days.length - 1];
    if (!day || day.key !== item.dayKey) {
      const date = item.dayKey === "-" ? undefined : parseDay(item.dayKey);
      day = {
        key: item.dayKey,
        label: item.dayKey === "-" ? "Unknown date" : dayLabel(item.dayKey, todayKey),
        weekday: date ? WEEKDAYS[date.getDay()] : "",
        dayOfMonth: date ? String(date.getDate()) : "–",
        month: date ? MONTHS[date.getMonth()] : "",
        items: [],
      };
      days.push(day);
    }
    day.items.push(item);
  }
  return days;
}
