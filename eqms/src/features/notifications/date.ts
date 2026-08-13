import { getI18nLanguage, t } from '@/i18n';

const getLocale = () => getI18nLanguage() === 'vi' ? 'vi-VN' : 'en-US';

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

const formatClockTime = (date: Date) => new Intl.DateTimeFormat(getLocale(), { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);

const formatShortDate = (date: Date) => new Intl.DateTimeFormat(getLocale(), { day: '2-digit', month: '2-digit' }).format(date);

export const formatNotificationDateTime = (value?: string | null): string => {
  const date = parseNotificationDate(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'short', timeStyle: 'medium' }).format(date);
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

  if (diffMins < 1) return t('notificationTime.justNow');
  if (diffMins < 60) return t('notificationTime.minutesAgo', { count: diffMins });
  if (diffHours < 24) return t('notificationTime.hoursAgo', { count: diffHours });
  if (diffDays < 7) return t('notificationTime.daysAgo', { count: diffDays });
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

  if (diffMins < 1) return `${t('notificationTime.justNow')} • ${clock}`;
  if (diffMins < 60) return `${t('notificationTime.minutesAgo', { count: diffMins })} • ${clock}`;
  if (diffHours < 24) return `${t('notificationTime.hoursAgo', { count: diffHours })} • ${clock}`;
  if (diffDays < 7) return `${t('notificationTime.daysAgo', { count: diffDays })} • ${clock}`;
  return `${formatShortDate(date)} • ${clock}`;
};
