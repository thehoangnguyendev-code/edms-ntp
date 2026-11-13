/**
 * The frequency of a scheduled report as a person thinks of it (every few hours, every day, on some days of the week, on a day of the month) and the cron expression the server
 * keeps. The page builds the cron from what the person chooses and reads it back when a schedule is opened; a cron that is none of these forms stays a custom one, untouched.
 * The server checks the cron again; the times are in the time zone of the server (UTC+7).
 */
export type FrequencyKind = "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM";
export const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const WEEKDAY_NAMES: Record<Weekday, string> = { MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday", FRI: "Friday", SAT: "Saturday", SUN: "Sunday" };
export const HOUR_STEPS = [1, 2, 3, 4, 6, 8, 12] as const;
export const MINUTE_CHOICES = [0, 5, 10, 15, 20, 30, 45] as const;

export interface FrequencySpec {
  kind: FrequencyKind;
  /** HOURLY: every this many hours. */
  everyHours: number;
  /** HOURLY: at this minute of the hour; DAILY, WEEKLY and MONTHLY: the minute of the time. */
  minute: number;
  hour: number;
  weekdays: Weekday[];
  /** MONTHLY: a day from 1 to 28, or "L" for the last day of the month. */
  dayOfMonth: number | "L";
  custom: string;
}

export const DEFAULT_SPEC: FrequencySpec = { kind: "WEEKLY", everyHours: 1, minute: 0, hour: 8, weekdays: ["MON", "TUE", "WED", "THU", "FRI"], dayOfMonth: 1, custom: "" };

const sortDays = (days: Weekday[]) => WEEKDAYS.filter((d) => days.includes(d));

/** MON,TUE,WED -> MON-WED when three or more days follow one another; otherwise the days are listed. */
function weekdayField(days: Weekday[]): string {
  const sorted = sortDays(days);
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && WEEKDAYS.indexOf(sorted[j + 1]) === WEEKDAYS.indexOf(sorted[j]) + 1) j++;
    if (j - i >= 2) parts.push(`${sorted[i]}-${sorted[j]}`);
    else for (let k = i; k <= j; k++) parts.push(sorted[k]);
    i = j + 1;
  }
  return parts.join(",");
}

export function toCron(spec: FrequencySpec): string {
  switch (spec.kind) {
    case "HOURLY":
      return `0 ${spec.minute} ${spec.everyHours <= 1 ? "*" : `*/${spec.everyHours}`} * * *`;
    case "DAILY":
      return `0 ${spec.minute} ${spec.hour} * * *`;
    case "WEEKLY":
      return `0 ${spec.minute} ${spec.hour} * * ${weekdayField(spec.weekdays.length ? spec.weekdays : ["MON"])}`;
    case "MONTHLY":
      return `0 ${spec.minute} ${spec.hour} ${spec.dayOfMonth} * *`;
    default:
      return spec.custom;
  }
}

function expandWeekdays(field: string): Weekday[] | null {
  const days = new Set<Weekday>();
  for (const part of field.split(",")) {
    const range = /^([A-Z]{3})-([A-Z]{3})$/.exec(part);
    if (range) {
      const from = WEEKDAYS.indexOf(range[1] as Weekday);
      const to = WEEKDAYS.indexOf(range[2] as Weekday);
      if (from < 0 || to < from) return null;
      for (let k = from; k <= to; k++) days.add(WEEKDAYS[k]);
    } else if ((WEEKDAYS as readonly string[]).includes(part)) days.add(part as Weekday);
    else return null;
  }
  return days.size ? sortDays([...days]) : null;
}

/** The choices a cron expression stands for, or a custom one when it is none of the forms above. */
export function fromCron(cron: string): FrequencySpec {
  const custom: FrequencySpec = { ...DEFAULT_SPEC, kind: "CUSTOM", custom: cron };
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 6 || fields[0] !== "0" || !/^\d{1,2}$/.test(fields[1])) return custom;
  const minute = Number(fields[1]);
  if (minute > 59) return custom;
  const [, , hourField, dayField, monthField, weekField] = fields;
  if (monthField !== "*") return custom;
  const hourly = /^\*(?:\/(\d{1,2}))?$/.exec(hourField);
  if (hourly && dayField === "*" && weekField === "*") {
    const every = hourly[1] ? Number(hourly[1]) : 1;
    return (HOUR_STEPS as readonly number[]).includes(every) ? { ...DEFAULT_SPEC, kind: "HOURLY", everyHours: every, minute } : custom;
  }
  if (!/^\d{1,2}$/.test(hourField) || Number(hourField) > 23) return custom;
  const hour = Number(hourField);
  if (dayField === "*" && weekField === "*") return { ...DEFAULT_SPEC, kind: "DAILY", hour, minute };
  if (dayField === "*") {
    const weekdays = expandWeekdays(weekField);
    return weekdays && weekdayField(weekdays) === weekField ? { ...DEFAULT_SPEC, kind: "WEEKLY", hour, minute, weekdays } : custom;
  }
  if (weekField === "*" && (dayField === "L" || (/^\d{1,2}$/.test(dayField) && Number(dayField) >= 1 && Number(dayField) <= 28))) {
    return { ...DEFAULT_SPEC, kind: "MONTHLY", hour, minute, dayOfMonth: dayField === "L" ? "L" : Number(dayField) };
  }
  return custom;
}

const two = (n: number) => String(n).padStart(2, "0");
export const timeOf = (spec: FrequencySpec) => `${two(spec.hour)}:${two(spec.minute)}`;

function list(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The schedule in words, for the person who is setting it. */
export function describeFrequency(spec: FrequencySpec): string {
  switch (spec.kind) {
    case "HOURLY":
      return spec.everyHours <= 1 ? `Every hour, at minute ${two(spec.minute)} (UTC+7).` : `Every ${spec.everyHours} hours, at minute ${two(spec.minute)} (UTC+7).`;
    case "DAILY":
      return `Every day at ${timeOf(spec)} (UTC+7).`;
    case "WEEKLY": {
      const days = sortDays(spec.weekdays.length ? spec.weekdays : ["MON"]);
      const text =
        days.length === 7 ? "Every day" : days.join() === "MON,TUE,WED,THU,FRI" ? "Every weekday, Monday to Friday," : `Every ${list(days.map((d) => WEEKDAY_NAMES[d]))}`;
      return `${text} at ${timeOf(spec)} (UTC+7).`;
    }
    case "MONTHLY":
      return `${spec.dayOfMonth === "L" ? "On the last day of every month" : `On day ${spec.dayOfMonth} of every month`} at ${timeOf(spec)} (UTC+7).`;
    default:
      return spec.custom.trim() ? `A custom schedule: ${spec.custom.trim()} (UTC+7).` : "Type a cron expression.";
  }
}
