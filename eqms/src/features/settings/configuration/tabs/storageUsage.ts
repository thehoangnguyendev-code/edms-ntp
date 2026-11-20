import { formatDate, formatDateTime } from '@/utils/format';

export type UsageSnapshot = {
  measuredAt: string;
  totalBytes: number;
  objectVersions: number;
  byDomain: Record<string, number>;
  byFileType: Record<string, number>;
};

const DAY_MS = 86400000;

/** The longest wait the estimate is allowed to announce: further than this the figure says nothing and is left out. */
const MAX_FORECAST_DAYS = 3650;

/** The growth between the oldest and the newest measurement of `snapshots` (newest first), from real measurements only; nothing is estimated without at least a day between two of them. */
export const growthOf = (snapshots: UsageSnapshot[]) => {
  if (snapshots.length < 2) return null;
  const newest = snapshots[0], oldest = snapshots[snapshots.length - 1];
  const days = (new Date(newest.measuredAt).getTime() - new Date(oldest.measuredAt).getTime()) / DAY_MS;
  if (!(days >= 1)) return null;
  const delta = newest.totalBytes - oldest.totalBytes;
  return { days, delta, perDay: delta / days };
};

/** The measurements of the last `days` days, counted back from the newest one (newest first, like the history). All of them when `days` covers the whole history. */
export const withinDays = (snapshots: UsageSnapshot[], days: number): UsageSnapshot[] => {
  if (snapshots.length === 0) return snapshots;
  const since = new Date(snapshots[0].measuredAt).getTime() - days * DAY_MS;
  return snapshots.filter((snapshot) => new Date(snapshot.measuredAt).getTime() >= since);
};

/** One measurement for each day: the last of the day (the history is newest first). Newest first. The day is the one the screen shows, in the system's time zone. */
export const dailySeries = (snapshots: UsageSnapshot[]): UsageSnapshot[] => {
  const seen = new Set<string>();
  const days: UsageSnapshot[] = [];
  for (const snapshot of snapshots) {
    const day = formatDate(snapshot.measuredAt);
    if (seen.has(day)) continue;
    seen.add(day);
    days.push(snapshot);
  }
  return days;
};

export interface Jump {
  snapshot: UsageSnapshot;
  delta: number;
}

/**
 * The days when the size jumped, biggest first: at most `limit` of them, and only those that added at least `minShare` of the current size (a growth of a few percent
 * is the normal run of things, not an event). `daily` is newest first.
 */
export const jumpsOf = (daily: UsageSnapshot[], limit = 2, minShare = 0.1): Jump[] => {
  if (daily.length < 2) return [];
  const floor = daily[0].totalBytes * minShare;
  const jumps: Jump[] = [];
  for (let i = 0; i < daily.length - 1; i += 1) {
    const delta = daily[i].totalBytes - daily[i + 1].totalBytes;
    if (delta >= floor && delta > 0) jumps.push({ snapshot: daily[i], delta });
  }
  return jumps.sort((a, b) => b.delta - a.delta).slice(0, limit);
};

export interface Forecast {
  /** When, at the growth of the period, the size reaches the budget. */
  reachesAt: number;
  days: number;
}

/** The time the budget would be reached at the current growth: a straight-line estimate, left out when the size is already past the budget, is not growing, or is too far away to mean anything. */
export const forecastOf = (latest: UsageSnapshot | undefined, perDay: number | null, budgetBytes: number | null): Forecast | null => {
  if (!latest || !budgetBytes || perDay === null || !(perDay > 0) || latest.totalBytes >= budgetBytes) return null;
  const days = (budgetBytes - latest.totalBytes) / perDay;
  if (!(days <= MAX_FORECAST_DAYS)) return null;
  return { reachesAt: new Date(latest.measuredAt).getTime() + days * DAY_MS, days };
};

export interface GrowthRow {
  name: string;
  delta: number;
  /** The size at each measurement of the period, oldest first, for a sparkline. */
  series: number[];
}

/** What grew between the first and the last measurement of the period, by `domain` or by `file type`: the parts that grew, biggest first. `snapshots` is newest first. */
export const growthByPart = (snapshots: UsageSnapshot[], key: 'byDomain' | 'byFileType'): { rows: GrowthRow[]; unchanged: number } => {
  if (snapshots.length < 2) return { rows: [], unchanged: 0 };
  const ordered = [...snapshots].reverse();
  const names = new Set<string>();
  ordered.forEach((snapshot) => Object.keys(snapshot[key] ?? {}).forEach((name) => names.add(name)));
  const all = [...names].map((name) => {
    const series = ordered.map((snapshot) => snapshot[key]?.[name] ?? 0);
    return { name, delta: series[series.length - 1] - series[0], series };
  });
  const rows = all.filter((row) => row.delta > 0).sort((a, b) => b.delta - a.delta);
  return { rows, unchanged: all.length - rows.length };
};

/** The measurements as CSV (newest first): the time as the screens show it, the size in bytes and the number of object versions. Numbers and dates only, so nothing can read as a formula. */
export const measurementsToCsv = (snapshots: UsageSnapshot[]): string => {
  const lines = ['Measured,Total bytes,Object versions'];
  snapshots.forEach((snapshot) => lines.push(`${formatDateTime(snapshot.measuredAt)},${snapshot.totalBytes},${snapshot.objectVersions}`));
  return `${lines.join('\r\n')}\r\n`;
};
