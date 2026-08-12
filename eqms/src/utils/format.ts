import { readSystemLocalizationSettings } from '@/config/localization';

/**
 * Renders an hours/minutes(/seconds) triple honoring the current user's Regional Formats
 * Time Format preference (12-hour with AM/PM, or 24-hour) — display-only, reads from
 * localStorage via readLocalizationPreferences(), never touches the backend/DB.
 */
function formatTimeSegment(hours: number, minutes: number, seconds?: number): string {
  const { dateTimeFormat } = readSystemLocalizationSettings();
  const mm = String(minutes).padStart(2, '0');
  const ss = seconds === undefined ? null : String(seconds).padStart(2, '0');

  const hh = String(hours).padStart(2, '0');
  const includeSeconds = dateTimeFormat.includes('ss');
  return includeSeconds && ss !== null ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
}

/**
 * Renders a day/month/year triple honoring the current user's Regional Formats Date Format
 * preference (component order + separator) — display-only, same source as formatTimeSegment.
 */
function formatDateSegment(day: number, month: number, year: number): string {
  const { dateTimeFormat, language } = readSystemLocalizationSettings();
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  const yyyy = String(year);

  const dateFormat = dateTimeFormat.split(' ')[0];
  const shortMonth = new Intl.DateTimeFormat(language || 'en', { month: 'short' }).format(new Date(2000, month - 1, 1));
  const longMonth = new Intl.DateTimeFormat(language || 'en', { month: 'long' }).format(new Date(2000, month - 1, 1));
  switch (dateFormat) {
    case 'MM/DD/YYYY':
      return `${mm}/${dd}/${yyyy}`;
    case 'YYYY-MM-DD':
      return `${yyyy}-${mm}-${dd}`;
    case 'YYYY/MM/DD':
      return `${yyyy}/${mm}/${dd}`;
    case 'DD-MM-YYYY':
      return `${dd}-${mm}-${yyyy}`;
    case 'DD.MM.YYYY':
      return `${dd}.${mm}.${yyyy}`;
    case 'DD-MMM-YYYY':
      return `${dd}-${shortMonth}-${yyyy}`;
    case 'MMMM':
      return `${longMonth} ${dd}, ${yyyy}`;
    case 'DD/MM/YYYY':
    default:
      return `${dd}/${mm}/${yyyy}`;
  }
}

function getSystemDateParts(date: Date) {
  const { timeZone } = readSystemLocalizationSettings();
  const normalizedTimeZone = timeZone === 'UTC+7' || timeZone === 'GMT+7'
    ? 'Asia/Ho_Chi_Minh'
    : timeZone || 'Asia/Ho_Chi_Minh';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: normalizedTimeZone,
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

export function formatDate(date: string | Date, format: 'short' | 'long' | 'full' = 'short'): string {
  const dateObj = typeof date === 'string' ? parseAnyDate(date) : date;

  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }

  const parts = getSystemDateParts(dateObj);
  const year = parts.year;

  if (format === 'short') {
    return formatDateSegment(parts.day, parts.month, year);
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLong = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (format === 'long') {
    return `${parts.day} ${monthNames[parts.month - 1]} ${year}`;
  }

  // full format
  return `${weekdays[dateObj.getDay()]}, ${parts.day} ${monthLong[parts.month - 1]} ${year}`;
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
 * Format date and time as dd/MM/yyyy, HH:mm:ss
 * Returns "-" if invalid date
 */
export function formatDateTime(dateString: string | Date): string {
  if (!dateString) return "-";
  const date = parseAnyDate(dateString);
  if (isNaN(date.getTime())) return "-";

  const parts = getSystemDateParts(date);
  const datePart = formatDateSegment(parts.day, parts.month, parts.year);
  const timePart = formatTimeSegment(parts.hour, parts.minute, parts.second);
  return `${datePart}, ${timePart}`;
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
 * Format date+time as dd/MM/yyyy, HH:mm:ss
 * Returns "-" if invalid
 */
export function formatDateTimeLong(dateInput: string | Date): string {
  if (!dateInput) return "-";
  const date = parseAnyDate(dateInput);
  if (isNaN(date.getTime())) return "-";

  const parts = getSystemDateParts(date);
  const datePart = formatDateSegment(parts.day, parts.month, parts.year);
  const timePart = formatTimeSegment(parts.hour, parts.minute, parts.second);
  return `${datePart}, ${timePart}`;
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
 * (e.g., date="2026-01-15", time="14:30:00" => "15/01/2026, 14:30:00")
 * Returns "-" if invalid
 */
export function formatDateTimeParts(date: string, time: string): string {
  if (!date || !time) return "-";
  const dateObj = parseAnyDate(date);
  if (isNaN(dateObj.getTime())) return "-";

  const datePart = formatDateSegment(dateObj.getDate(), dateObj.getMonth() + 1, dateObj.getFullYear());
  const timePart = formatTimeSegment(Number(time.substring(0, 2)), Number(time.substring(3, 5)), time.length >= 8 ? Number(time.substring(6, 8)) : 0);
  return `${datePart}, ${timePart}`;
}

/**
 * Format date and time from separate date and time strings
 * (e.g., date="2026-01-15", time="14:30:00" => "15/01/2026, 14:30:00")
 * Returns "-" if invalid
 */
export function formatDateTimePartsNumeric(date: string, time: string): string {
  if (!date || !time) return "-";
  const dateObj = parseAnyDate(date);
  if (isNaN(dateObj.getTime())) return "-";

  const datePart = formatDateSegment(dateObj.getDate(), dateObj.getMonth() + 1, dateObj.getFullYear());
  const timePart = formatTimeSegment(Number(time.substring(0, 2)), Number(time.substring(3, 5)), time.length >= 8 ? Number(time.substring(6, 8)) : 0);
  return `${datePart}, ${timePart}`;
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
