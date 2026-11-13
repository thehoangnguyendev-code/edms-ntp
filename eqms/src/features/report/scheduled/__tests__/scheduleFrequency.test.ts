import { describe, expect, it } from "vitest";
import { DEFAULT_SPEC, describeFrequency, fromCron, toCron, type FrequencySpec } from "../scheduleFrequency";

const spec = (patch: Partial<FrequencySpec>): FrequencySpec => ({ ...DEFAULT_SPEC, ...patch });

describe("the frequency of a scheduled report", () => {
  it("builds the cron expression of each choice", () => {
    expect(toCron(spec({ kind: "HOURLY", everyHours: 1, minute: 15 }))).toBe("0 15 * * * *");
    expect(toCron(spec({ kind: "HOURLY", everyHours: 6, minute: 0 }))).toBe("0 0 */6 * * *");
    expect(toCron(spec({ kind: "DAILY", hour: 6, minute: 30 }))).toBe("0 30 6 * * *");
    expect(toCron(spec({ kind: "WEEKLY", hour: 8, minute: 0, weekdays: ["MON", "TUE", "WED", "THU", "FRI"] }))).toBe("0 0 8 * * MON-FRI");
    expect(toCron(spec({ kind: "WEEKLY", hour: 8, minute: 0, weekdays: ["FRI", "MON", "WED"] }))).toBe("0 0 8 * * MON,WED,FRI");
    expect(toCron(spec({ kind: "WEEKLY", hour: 8, minute: 0, weekdays: ["MON", "TUE"] }))).toBe("0 0 8 * * MON,TUE");
    expect(toCron(spec({ kind: "WEEKLY", hour: 8, minute: 0, weekdays: ["MON", "TUE", "WED", "FRI", "SAT", "SUN"] }))).toBe("0 0 8 * * MON-WED,FRI-SUN");
    expect(toCron(spec({ kind: "MONTHLY", hour: 8, minute: 0, dayOfMonth: 1 }))).toBe("0 0 8 1 * *");
    expect(toCron(spec({ kind: "MONTHLY", hour: 17, minute: 45, dayOfMonth: "L" }))).toBe("0 45 17 L * *");
    expect(toCron(spec({ kind: "CUSTOM", custom: "0 0 7 ? * MON#1" }))).toBe("0 0 7 ? * MON#1");
  });

  it("a weekly schedule on no day is a Monday one, so it can run", () => {
    expect(toCron(spec({ kind: "WEEKLY", weekdays: [] }))).toBe("0 0 8 * * MON");
  });

  it("reads a cron expression back into the choices it was made from", () => {
    for (const choice of [
      spec({ kind: "HOURLY", everyHours: 4, minute: 30 }),
      spec({ kind: "HOURLY", everyHours: 1, minute: 0 }),
      spec({ kind: "DAILY", hour: 7, minute: 5 }),
      spec({ kind: "WEEKLY", hour: 18, minute: 0, weekdays: ["MON", "WED", "FRI"] }),
      spec({ kind: "WEEKLY", hour: 8, minute: 0, weekdays: ["MON", "TUE", "WED", "THU", "FRI"] }),
      spec({ kind: "MONTHLY", hour: 8, minute: 0, dayOfMonth: 28 }),
      spec({ kind: "MONTHLY", hour: 8, minute: 0, dayOfMonth: "L" }),
    ]) {
      const back = fromCron(toCron(choice));
      expect(back.kind).toBe(choice.kind);
      expect(toCron(back)).toBe(toCron(choice));
    }
  });

  it("the old choices of the page are still understood", () => {
    expect(fromCron("0 0 8 * * *").kind).toBe("DAILY");
    expect(fromCron("0 0 8 * * MON-FRI")).toMatchObject({ kind: "WEEKLY", weekdays: ["MON", "TUE", "WED", "THU", "FRI"] });
    expect(fromCron("0 0 8 * * MON")).toMatchObject({ kind: "WEEKLY", weekdays: ["MON"] });
    expect(fromCron("0 0 8 1 * *")).toMatchObject({ kind: "MONTHLY", dayOfMonth: 1 });
    expect(fromCron("0 30 8 * * *")).toMatchObject({ kind: "DAILY", hour: 8, minute: 30 });
  });

  it("a cron that is none of these forms stays a custom one, exactly as it is", () => {
    for (const cron of ["0 0 7 ? * MON#1", "0 */10 * * * *", "30 0 8 * * *", "0 0 8 31 * *", "0 0 8 * 6 *", "0 0 8 * * 1-5", "0 0 8 * * SUN-MON", "0 0 25 * * *", "0 0 8 * *"]) {
      const read = fromCron(cron);
      expect(read.kind, cron).toBe("CUSTOM");
      expect(toCron(read)).toBe(cron);
    }
  });

  it("says the schedule in words, with the zone", () => {
    expect(describeFrequency(spec({ kind: "HOURLY", everyHours: 6, minute: 0 }))).toBe("Every 6 hours, at minute 00 (UTC+7).");
    expect(describeFrequency(spec({ kind: "HOURLY", everyHours: 1, minute: 15 }))).toBe("Every hour, at minute 15 (UTC+7).");
    expect(describeFrequency(spec({ kind: "DAILY", hour: 6, minute: 30 }))).toBe("Every day at 06:30 (UTC+7).");
    expect(describeFrequency(spec({ kind: "WEEKLY", weekdays: ["MON", "TUE", "WED", "THU", "FRI"] }))).toBe("Every weekday, Monday to Friday, at 08:00 (UTC+7).");
    expect(describeFrequency(spec({ kind: "WEEKLY", weekdays: ["MON", "WED", "FRI"] }))).toBe("Every Monday, Wednesday and Friday at 08:00 (UTC+7).");
    expect(describeFrequency(spec({ kind: "WEEKLY", weekdays: ["SAT"] }))).toBe("Every Saturday at 08:00 (UTC+7).");
    expect(describeFrequency(spec({ kind: "WEEKLY", weekdays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] }))).toBe("Every day at 08:00 (UTC+7).");
    expect(describeFrequency(spec({ kind: "MONTHLY", dayOfMonth: 15 }))).toBe("On day 15 of every month at 08:00 (UTC+7).");
    expect(describeFrequency(spec({ kind: "MONTHLY", dayOfMonth: "L" }))).toBe("On the last day of every month at 08:00 (UTC+7).");
    expect(describeFrequency(spec({ kind: "CUSTOM", custom: "" }))).toBe("Type a cron expression.");
  });
});
