import { describe, expect, it } from "vitest";
import { dateTimeToInstant } from "../dateFilters";

describe("dateTimeToInstant", () => {
  it("turns a day into its first moment or its very last, in local time", () => {
    const start = new Date(dateTimeToInstant("08/10/2026", "start")!);
    const end = new Date(dateTimeToInstant("08/10/2026", "end")!);
    expect([start.getDate(), start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([8, 0, 0, 0]);
    expect([end.getDate(), end.getHours(), end.getMinutes(), end.getSeconds(), end.getMilliseconds()]).toEqual([8, 23, 59, 59, 999]);
  });

  it("turns a date and time into that minute: its first second for a start, its last millisecond for an end", () => {
    const start = new Date(dateTimeToInstant("08/10/2026 14:30", "start")!);
    const end = new Date(dateTimeToInstant("08/10/2026 14:30", "end")!);
    expect([start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds()]).toEqual([14, 30, 0, 0]);
    expect([end.getHours(), end.getMinutes(), end.getSeconds(), end.getMilliseconds()]).toEqual([14, 30, 59, 999]);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });

  it("reads a time to the second as exactly that second (what the date range picker gives)", () => {
    const start = new Date(dateTimeToInstant("08/10/2026 14:30:15", "start")!);
    const end = new Date(dateTimeToInstant("08/10/2026 14:30:15", "end")!);
    expect([start.getMinutes(), start.getSeconds(), start.getMilliseconds()]).toEqual([30, 15, 0]);
    expect([end.getMinutes(), end.getSeconds(), end.getMilliseconds()]).toEqual([30, 15, 999]);
    const wholeDay = new Date(dateTimeToInstant("08/10/2026 23:59:59", "end")!);
    expect([wholeDay.getDate(), wholeDay.getHours(), wholeDay.getSeconds(), wholeDay.getMilliseconds()]).toEqual([8, 23, 59, 999]);
  });

  it("returns an ISO instant", () => {
    expect(dateTimeToInstant("08/10/2026 14:30", "start")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("means no limit when the value is empty, incomplete or not a real moment", () => {
    for (const bad of ["", "08/10", "31/02/2026", "08-10-2026", "08/10/2026 25:00", "08/10/2026 12:61", "08/10/2026 12:30:61", "tomorrow"]) {
      expect(dateTimeToInstant(bad, "start"), bad).toBeUndefined();
    }
  });
});
