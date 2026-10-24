import { SITE_TIME_ZONE, readSystemLocalizationSettings } from '@/config/localization';

/**
 * The display format of every date and time of the system, the same as the server writes (DateTimeFormatUtils): a date is dd/MM/yyyy and a date with a time is
 * dd/MM/yyyy HH:mm:ss (24 hours, with seconds, one space between them). It is not a setting of the system or of a user. Everything a person reads goes through this file;
 * ISO-8601 is only for what is sent to the server or read from it. `dateFormatGuard.test.ts` fails the build when other code formats a date for display.
 */
export const DISPLAY_DATE_PATTERN = 'dd/MM/yyyy';
export const DISPLAY_DATETIME_PATTERN = 'dd/MM/yyyy HH:mm:ss';

const two = (n: number) => String(n).padStart(2, '0');

/** Time of day as HH:mm:ss (24 hours). */
function formatTimeSegment(hours: number, minutes: number, seconds = 0): string {
  return `${two(hours)}:${two(minutes)}:${two(seconds)}`;
}

/** A day, month and year as dd/MM/yyyy. */
function formatDateSegment(day: number, month: number, year: number): string {
  return `${two(day)}/${two(month)}/${year}`;
}

function getSystemDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SITE_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { day: value('day'), month: value('month'), year: value('year'), hour: value('hour'), minute: value('minute'), second: value('second') };
}

/**
 * Universal date parser - handles ISO (YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss) and
 * localized formats (dd/MM/yyyy, dd/MM/yyyy, HH:mm:ss)
 */
function parseAnyDate(input: string | Date): Date {
  if (input instanceof Date) return input;
  if (!input) return new Date('invalid');

  // dd/MM/yyyy, HH:mm:ss
  const dtMatch = input.match(/^(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (dtMatch) {
    const [, d, m, y, hh, mm, ss] = dtMatch;
    return new Date(+y, +m - 1, +d, +hh, +mm, +ss);
  }

  // dd/MM/yyyy
  const dMatch = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dMatch) {
    const [, d, m, y] = dMatch;
    return new Date(+y, +m - 1, +d);
  }

  // ISO and anything else
  return new Date(input);
}

export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? parseAnyDate(date) : date;
  if (isNaN(dateObj.getTime())) return 'Invalid Date';
  const parts = getSystemDateParts(dateObj);
  return formatDateSegment(parts.day, parts.month, parts.year);
}

/**
 * Format date to dd/MM/yyyy string
 */
export function formatDateISO(date: Date | string): string {
  const dateObj = parseAnyDate(date);
  const { day, month, year } = getSystemDateParts(dateObj);
  const paddedDay = String(day).padStart(2, '0');
  const paddedMonth = String(month).padStart(2, '0');
  return `${paddedDay}/${paddedMonth}/${year}`;
}

/**
 * Format date in dd/MM/yyyy format (e.g., "15/01/2026")
 * Returns "-" if invalid date
 */
export function formatDateUS(dateString: string | Date): string {
  if (!dateString) return "-";
  const date = parseAnyDate(dateString);
  if (isNaN(date.getTime())) return "-";

  const parts = getSystemDateParts(date);
  return formatDateSegment(parts.day, parts.month, parts.year);
}

/**
 * Format date and time as dd/MM/yyyy HH:mm:ss
 * Returns "-" if invalid date
 */
export function formatDateTime(dateString: string | Date): string {
  if (!dateString) return "-";
  const date = parseAnyDate(dateString);
  if (isNaN(date.getTime())) return "-";

  const parts = getSystemDateParts(date);
  const datePart = formatDateSegment(parts.day, parts.month, parts.year);
  const timePart = formatTimeSegment(parts.hour, parts.minute, parts.second);
  return `${datePart} ${timePart}`;
}

/**
 * Format date as dd/MM/yyyy (e.g., "15/01/2026")
 * Returns "-" if invalid
 */
export function formatDateLong(dateInput: string | Date): string {
  if (!dateInput) return "-";
  const date = parseAnyDate(dateInput);
  if (isNaN(date.getTime())) return "-";

  const parts = getSystemDateParts(date);
  return formatDateSegment(parts.day, parts.month, parts.year);
}

/**
 * Format date+time as dd/MM/yyyy HH:mm:ss
 * Returns "-" if invalid
 */
export function formatDateTimeLong(dateInput: string | Date): string {
  if (!dateInput) return "-";
  const date = parseAnyDate(dateInput);
  if (isNaN(date.getTime())) return "-";

  const parts = getSystemDateParts(date);
  const datePart = formatDateSegment(parts.day, parts.month, parts.year);
  const timePart = formatTimeSegment(parts.hour, parts.minute, parts.second);
  return `${datePart} ${timePart}`;
}

/**
 * Format relative time (e.g., "2 days ago", "in 3 hours")
 * Returns "-" if invalid date
 */
export function formatRelativeTime(dateString: string | Date): string {
  if (!dateString) return "-";
  const date = parseAnyDate(dateString);
  if (isNaN(date.getTime())) return "-";
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);
  
  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  if (diffMonth < 12) return `${diffMonth} month${diffMonth > 1 ? 's' : ''} ago`;
  return `${diffYear} year${diffYear > 1 ? 's' : ''} ago`;
}

/**
 * Format date and time from separate date and time strings
 * (e.g., date="2026-01-15", time="14:30:00" => "15/01/2026 14:30:00")
 * Returns "-" if invalid
 */
export function formatDateTimeParts(date: string, time: string): string {
  if (!date || !time) return "-";
  const dateObj = parseAnyDate(date);
  if (isNaN(dateObj.getTime())) return "-";

  const datePart = formatDateSegment(dateObj.getDate(), dateObj.getMonth() + 1, dateObj.getFullYear());
  const timePart = formatTimeSegment(Number(time.substring(0, 2)), Number(time.substring(3, 5)), time.length >= 8 ? Number(time.substring(6, 8)) : 0);
  return `${datePart} ${timePart}`;
}

/**
 * Format date and time from separate date and time strings
 * (e.g., date="2026-01-15", time="14:30:00" => "15/01/2026 14:30:00")
 * Returns "-" if invalid
 */
export function formatDateTimePartsNumeric(date: string, time: string): string {
  if (!date || !time) return "-";
  const dateObj = parseAnyDate(date);
  if (isNaN(dateObj.getTime())) return "-";

  const datePart = formatDateSegment(dateObj.getDate(), dateObj.getMonth() + 1, dateObj.getFullYear());
  const timePart = formatTimeSegment(Number(time.substring(0, 2)), Number(time.substring(3, 5)), time.length >= 8 ? Number(time.substring(6, 8)) : 0);
  return `${datePart} ${timePart}`;
}

/**
 * Format date as dd/MM/yyyy (e.g., "15/01/2026")
 * Returns "-" if invalid
 */
export function formatDateNumeric(dateInput: string | Date): string {
  if (!dateInput) return "-";
  const date = parseAnyDate(dateInput);
  if (isNaN(date.getTime())) return "-";

  return formatDateSegment(date.getDate(), date.getMonth() + 1, date.getFullYear());
}

/**
 * Calculate days between two dates
 */
export function daysBetween(date1: string | Date, date2: string | Date): number {
  const d1 = parseAnyDate(date1);
  const d2 = parseAnyDate(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if date is overdue
 */
export function isOverdue(dueDate: string | Date): boolean {
  const due = parseAnyDate(dueDate);
  return due < new Date();
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Capitalize first letter
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Convert snake_case to Title Case
 */
export function toTitleCase(text: string): string {
  return text
    .split('_')
    .map((word) => capitalize(word))
    .join(' ');
}

/**
 * Format number with thousands separator
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat(readSystemLocalizationSettings().numberFormat || 'en-US').format(num);
}

/**
 * Format currency
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat(readSystemLocalizationSettings().numberFormat || 'en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Get initials from name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** A date for a person: dd/MM/yyyy, or "-" when there is none or it is not a date. The one function new code uses for a date. */
export function displayDate(value: string | Date | null | undefined): string {
  return value ? formatDateLong(value) : '-';
}

/** A moment for a person: dd/MM/yyyy HH:mm:ss in the zone of the site, or "-". The one function new code uses for a date and time. */
export function displayDateTime(value: string | Date | null | undefined): string {
  return value ? formatDateTimeLong(value) : '-';
}

/** A time of day for a person: HH:mm:ss in the zone of the site, or "-". */
export function displayTime(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = parseAnyDate(value);
  if (isNaN(date.getTime())) return '-';
  const parts = getSystemDateParts(date);
  return formatTimeSegment(parts.hour, parts.minute, parts.second);
}
