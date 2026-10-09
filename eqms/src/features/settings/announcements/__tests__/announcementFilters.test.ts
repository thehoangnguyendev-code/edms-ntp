import { expect, it } from "vitest";
import { dateToInstant } from "../announcementFilters";

it("turns a picked day into the start or the very end of that day, in local time", () => {
  const start = new Date(dateToInstant("08/10/2026", "start")!);
  expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([2026, 9, 8, 0, 0, 0]);
  const end = new Date(dateToInstant("08/10/2026", "end")!);
  expect([end.getFullYear(), end.getMonth(), end.getDate(), end.getHours(), end.getMinutes(), end.getSeconds(), end.getMilliseconds()]).toEqual([2026, 9, 8, 23, 59, 59, 999]);
});

it("returns an ISO instant", () => {
  expect(dateToInstant("08/10/2026", "start")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

it("means no limit when the date is empty, incomplete or not a real day", () => {
  expect(dateToInstant("", "start")).toBeUndefined();
  expect(dateToInstant("08/10", "start")).toBeUndefined();
  expect(dateToInstant("31/02/2026", "end")).toBeUndefined();
  expect(dateToInstant("08-10-2026", "end")).toBeUndefined();
});

it("keeps a one-day range inclusive: the end of the day is after its start", () => {
  expect(new Date(dateToInstant("08/10/2026", "end")!).getTime()).toBeGreaterThan(new Date(dateToInstant("08/10/2026", "start")!).getTime());
});
