import type { DashboardActivityPoint, DashboardPendingWorkflowAction } from '@/services/api/dashboard';

/**
 * Pure helpers that turn dashboard API payloads into figures that are safe to display.
 * They exist because the API has three quirks a chart must not hide:
 *  - series only contain buckets that have rows (a day with no audit events is missing),
 *  - /dashboard/my-tasks is capped, while /dashboard/summary carries the real total,
 *  - status maps list a fixed set of codes, so a total can exceed their sum.
 */

export type ActivityPeriod = 'month' | 'quarter' | 'year';

export const MY_TASKS_LIMIT = 20;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const share = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const pad2 = (value: number) => String(value).padStart(2, '0');

/** Puts every bucket on the axis; if the API returns a label we cannot place, the series is returned untouched. */
function fill(points: DashboardActivityPoint[], labels: string[]): DashboardActivityPoint[] {
  const filled = labels.map((label) => ({ label, value: 0 }));
  const index = new Map(labels.map((label, position) => [label, position]));
  for (const point of points) {
    const position = index.get(point.label);
    if (position === undefined) return points;
    filled[position].value += point.value;
  }
  return filled;
}

/** Audit events per UTC day for the last 30 days (labels are "DD Mon", as the API formats them). */
export function fillAuditDays(points: DashboardActivityPoint[], now: Date = new Date()): DashboardActivityPoint[] {
  const labels: string[] = [];
  for (let back = 30; back >= 0; back -= 1) {
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back));
    labels.push(`${pad2(day.getUTCDate())} ${MONTHS[day.getUTCMonth()]}`);
  }
  return fill(points, labels);
}

/** Documents created per UTC month ("Mon YYYY"), quarter ("Q YYYY") or year ("YYYY"), including empty buckets. */
export function fillActivityPeriods(points: DashboardActivityPoint[], period: ActivityPeriod, now: Date = new Date()): DashboardActivityPoint[] {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const labels: string[] = [];
  if (period === 'month') {
    for (let back = 12; back >= 0; back -= 1) {
      const bucket = new Date(Date.UTC(year, month - back, 1));
      labels.push(`${MONTHS[bucket.getUTCMonth()]} ${bucket.getUTCFullYear()}`);
    }
  } else if (period === 'quarter') {
    for (let back = 4; back >= 0; back -= 1) {
      const bucket = new Date(Date.UTC(year, month - back * 3, 1));
      labels.push(`${Math.floor(bucket.getUTCMonth() / 3) + 1} ${bucket.getUTCFullYear()}`);
    }
  } else {
    for (let back = 5; back >= 0; back -= 1) labels.push(String(year - back));
  }
  return fill(points, labels);
}

export interface MyWork {
  /** Authoritative total from /dashboard/summary. */
  total: number;
  /** Tasks actually loaded (the API caps the list). */
  shown: number;
  /** True when every task is loaded, so the review/approval split is exact. */
  complete: boolean;
  review: number | null;
  approval: number | null;
}

export function describeMyWork(summaryTotal: number | undefined, tasks: DashboardPendingWorkflowAction[]): MyWork {
  const total = Math.max(summaryTotal ?? 0, tasks.length);
  const complete = tasks.length >= total;
  return {
    total,
    shown: tasks.length,
    complete,
    review: complete ? tasks.filter((task) => task.taskType === 'REVIEW').length : null,
    approval: complete ? tasks.filter((task) => task.taskType === 'APPROVAL').length : null,
  };
}

export interface StatusSlice {
  key: string;
  value: number;
}

/** Listed statuses in the given order, plus an OTHER slice when the total is larger than their sum. */
export function statusSlices(total: number, counts: Record<string, number>, order: string[]): StatusSlice[] {
  const slices = order.map((key) => ({ key, value: counts[key] ?? 0 }));
  const known = slices.reduce((sum, slice) => sum + slice.value, 0);
  return total > known ? [...slices, { key: 'OTHER', value: total - known }] : slices;
}

/** Whole days between two instants, never negative. */
export function ageInDays(from: string, now: Date = new Date()): number | null {
  const start = Date.parse(from);
  if (Number.isNaN(start)) return null;
  return Math.max(0, Math.floor((now.getTime() - start) / 86_400_000));
}

export function formatAge(days: number | null): string {
  if (days === null) return '-';
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Oct 2025" -> "October, 2025", "3 2026" -> "Q3, 2026"; anything else is returned untouched. */
export function longPeriodLabel(label: string): string {
  const [first, year] = label.split(' ');
  const month = MONTHS.indexOf(first);
  if (month >= 0 && year) return `${MONTH_NAMES[month]}, ${year}`;
  if (/^[1-4]$/.test(first) && year) return `Q${first}, ${year}`;
  return label;
}

/** Compact axis label: "Oct 2025" -> "Oct", "3 2026" -> "Q3"; years and day labels are kept. */
export function shortPeriodLabel(label: string): string {
  const [first, year] = label.split(' ');
  if (MONTHS.includes(first) && year) return first;
  if (/^[1-4]$/.test(first) && year) return `Q${first}`;
  return label;
}

export interface RankedCount {
  key: string;
  name: string;
  shortCode: string;
  value: number;
}

/** Keeps the `limit - 1` largest rows and sums the rest into one "Other" row, so a chart never needs more colours than it has. */
export function groupTail(rows: RankedCount[], limit: number): RankedCount[] {
  if (rows.length <= limit) return rows;
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, limit - 1);
  const rest = sorted.slice(limit - 1);
  return [...head, { key: 'OTHER', name: `Other (${rest.length} types)`, shortCode: 'Other', value: rest.reduce((sum, row) => sum + row.value, 0) }];
}

/** "3d 4h", "5h 12m", "42m" or "<1m"; the two largest units only, so it stays readable on a card. */
export function formatUptime(milliseconds: number): string {
  const minutes = Math.floor(Math.max(0, milliseconds) / 60_000);
  const days = Math.floor(minutes / 1_440);
  const hours = Math.floor((minutes % 1_440) / 60);
  const rest = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${rest}m`;
  return minutes > 0 ? `${minutes}m` : '<1m';
}

/** Binary units: "512 MB", "1.5 GB". */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const text = unit === 0 || value >= 100 ? Math.round(value).toString() : value.toFixed(1).replace(/\.0$/, '');
  return `${text} ${units[unit]}`;
}
