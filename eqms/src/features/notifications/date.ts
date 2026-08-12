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

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
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

  if (diffMins < 1) return `Just now • ${clock}`;
  if (diffMins < 60) return `${diffMins}m ago • ${clock}`;
  if (diffHours < 24) return `${diffHours}h ago • ${clock}`;
  if (diffDays < 7) return `${diffDays}d ago • ${clock}`;
  return `${formatShortDate(date)} • ${clock}`;
};
