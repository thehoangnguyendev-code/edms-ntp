import { tr, trFormat } from '@/i18n';

const pad2 = (value: number) => value.toString().padStart(2, '0');

const parseNotificationDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  // Backward compatibility for notifications returned by older API versions
  // as `DD/MM/YYYY HH:mm:ss` instead of ISO-8601.
  const displayMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (displayMatch) {
    const [, day, month, year, hour, minute, second = '0'] = displayMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const candidates = [
    raw,
    raw.replace(' ', 'T'),
    raw.includes('Z') || /[+-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw}Z`,
  ];

  for (const candidate of candidates) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
};

const formatClockTime = (date: Date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const formatShortDate = (date: Date) => `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;

export const formatNotificationDateTime = (value?: string | null): string => {
  const date = parseNotificationDate(value);
  if (!date) return '-';
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
};

export const formatNotificationRelativeTime = (value?: string | null): string => {
  const date = parseNotificationDate(value);
  if (!date) {
    return '-';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return tr('Just now');
  if (diffMins < 60) return trFormat('{count}m ago', { count: diffMins });
  if (diffHours < 24) return trFormat('{count}h ago', { count: diffHours });
  if (diffDays < 7) return trFormat('{count}d ago', { count: diffDays });
  return formatShortDate(date);
};

export const formatNotificationRelativeTimeWithClock = (value?: string | null): string => {
  const date = parseNotificationDate(value);
  if (!date) {
    return '';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const clock = formatClockTime(date);

  if (diffMins < 1) return `${tr('Just now')} • ${clock}`;
  if (diffMins < 60) return `${trFormat('{count}m ago', { count: diffMins })} • ${clock}`;
  if (diffHours < 24) return `${trFormat('{count}h ago', { count: diffHours })} • ${clock}`;
  if (diffDays < 7) return `${trFormat('{count}d ago', { count: diffDays })} • ${clock}`;
  return `${formatShortDate(date)} • ${clock}`;
};

/** The day of a notification as dd/MM/yyyy (the day the person sees it on), or empty when the time cannot be read. */
export const notificationDayKey = (value?: string | null): string => {
  const date = parseNotificationDate(value);
  return date ? `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}` : '';
};

export type NotificationDayGroup = 'today' | 'yesterday' | 'earlier';

/** Which heading of the inbox a notification sits under. */
export const notificationDayGroup = (value?: string | null, now: Date = new Date()): NotificationDayGroup => {
  const key = notificationDayKey(value);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const keyOf = (d: Date) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  if (key === keyOf(now)) return 'today';
  if (key === keyOf(yesterday)) return 'yesterday';
  return 'earlier';
};

/** The Monday of the week of `now`, as dd/MM/yyyy (the format the server reads for the date filter). */
export const startOfWeekKey = (now: Date = new Date()): string => {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return `${pad2(monday.getDate())}/${pad2(monday.getMonth() + 1)}/${monday.getFullYear()}`;
};
