import { displayDate, displayDateTime } from "@/utils/format";
export const formatBytes = (bytes?: number | null) => {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value >= 100 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
};

export const formatDateTime = (value?: string | null) => (value ? displayDateTime(value) : "—");
export const formatDate = (value?: string | null) => (value ? displayDate(value) : "—");

export const formatDuration = (seconds?: number | null) => {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes}m ${seconds % 60}s` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

/** The date picker gives local time as dd/MM/yyyy HH:mm (or dd/MM/yyyy); the server takes an instant. */
export const pickerToInstant = (value: string): string => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!match) return new Date(value).toISOString();
  const [, day, month, year, hours = "0", minutes = "0"] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes)).toISOString();
};

/** The current local time in the picker's dd/MM/yyyy HH:mm format. */
export const nowForPicker = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

/** The date picker's dd/MM/yyyy as the yyyy-MM-dd date the server takes; undefined when it is empty. */
export const pickerDateToIsoDate = (value: string): string | undefined => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
};
