import type { AnnouncementSeverity } from "@/components/ui/announcement-modal";
import { MESSAGE_MAX, TITLE_MAX } from "./types";

/** The form's own shape. Times are the date picker's local "dd/MM/yyyy HH:mm" text. */
export interface AnnouncementFormValues {
  title: string;
  message: string;
  severity: AnnouncementSeverity;
  startsAt: string;
  endsAt: string;
  enabled: boolean;
}

export type AnnouncementFormErrors = Partial<Record<"title" | "message" | "startsAt" | "endsAt", string>>;

const pad = (value: number) => String(value).padStart(2, "0");

/** A date as the picker shows it, in the browser's time zone. */
export const toPickerValue = (value: string | Date): string => {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** The picker's text back to a date (browser time zone), or null when it is not a complete date and time. */
export const fromPickerValue = (value: string): Date | null => {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, day, month, year, hours, minutes] = match.map(Number) as number[];
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const valid =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day && date.getHours() === hours && date.getMinutes() === minutes;
  return valid ? date : null;
};

/** A new announcement starts now and ends a day later, the common case for a notice about the next day. */
export const defaultFormValues = (now: Date = new Date()): AnnouncementFormValues => ({
  title: "",
  message: "",
  severity: "INFO",
  startsAt: toPickerValue(now),
  endsAt: toPickerValue(new Date(now.getTime() + 24 * 60 * 60 * 1000)),
  enabled: true,
});

/** The same rules the server enforces, so a mistake is caught before the request. The server stays the authority. */
export const validateAnnouncementForm = (values: AnnouncementFormValues, creating: boolean, now: Date = new Date()): AnnouncementFormErrors => {
  const errors: AnnouncementFormErrors = {};
  const title = values.title.trim();
  const message = values.message.trim();
  if (!title) errors.title = "A title is required.";
  else if (title.length > TITLE_MAX) errors.title = `The title must not exceed ${TITLE_MAX} characters.`;
  if (!message) errors.message = "A message is required.";
  else if (message.length > MESSAGE_MAX) errors.message = `The message must not exceed ${MESSAGE_MAX} characters.`;
  const start = fromPickerValue(values.startsAt);
  const end = fromPickerValue(values.endsAt);
  if (!start) errors.startsAt = "Choose a start date and time.";
  if (!end) errors.endsAt = "Choose an end date and time.";
  if (start && end) {
    if (end.getTime() <= start.getTime()) errors.endsAt = "The end must be after the start.";
    else if (creating && end.getTime() <= now.getTime()) errors.endsAt = "The end must be in the future.";
  }
  return errors;
};
