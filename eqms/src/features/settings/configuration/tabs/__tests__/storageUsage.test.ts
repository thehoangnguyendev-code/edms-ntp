import { describe, expect, it } from "vitest";
import { dailySeries, forecastOf, growthByPart, growthOf, jumpsOf, measurementsToCsv, withinDays, type UsageSnapshot } from "../storageUsage";

const GIB = 1024 ** 3;
const DAY = 86400000;
const NOW = Date.UTC(2026, 10, 19, 4, 0, 0);
/** A measurement `daysAgo` days (and `hoursAgo` hours) before NOW. */
const snap = (daysAgo: number, totalBytes: number, parts: Record<string, number> = {}, hoursAgo = 0): UsageSnapshot => ({
  measuredAt: new Date(NOW - daysAgo * DAY - hoursAgo * 3600000).toISOString(),
  totalBytes,
  objectVersions: 10,
  byDomain: parts,
  byFileType: {},
});

describe("withinDays", () => {
  it("keeps the measurements of the last N days counted back from the newest one, and all of them when N covers the history", () => {
    const history = [snap(0, 9), snap(3, 8), snap(10, 7), snap(40, 6)];
    expect(withinDays(history, 7).map((s) => s.totalBytes)).toEqual([9, 8]);
    expect(withinDays(history, 30).map((s) => s.totalBytes)).toEqual([9, 8, 7]);
    expect(withinDays(history, 90)).toHaveLength(4);
    expect(withinDays([], 7)).toEqual([]);
  });
});

describe("growthOf", () => {
  it("is the change between the oldest and the newest measurement, per day, and nothing without a day between two of them", () => {
    expect(growthOf([snap(0, 12 * GIB), snap(10, 2 * GIB)])).toEqual({ days: 10, delta: 10 * GIB, perDay: GIB });
    expect(growthOf([snap(0, GIB)])).toBeNull();
    expect(growthOf([snap(0, GIB), snap(0.2, GIB)])).toBeNull();
  });
});

describe("dailySeries and jumpsOf", () => {
  it("keeps the last measurement of each day, newest first", () => {
    const hourly = [snap(0, 30, {}, 0), snap(0, 29, {}, 1), snap(1, 20, {}, 0), snap(1, 19, {}, 2)];
    const days = dailySeries(hourly);
    expect(days.map((s) => s.totalBytes)).toEqual([30, 20]);
  });

  it("marks the biggest jumps only: at least a tenth of the current size, biggest first, at most the limit", () => {
    // 100 now; +50, +3, +30, +2 on the days before
    const daily = [snap(0, 100), snap(1, 50), snap(2, 47), snap(3, 17), snap(4, 15)];
    const jumps = jumpsOf(daily);
    expect(jumps.map((j) => j.delta)).toEqual([50, 30]);
    expect(jumpsOf(daily, 1).map((j) => j.delta)).toEqual([50]);
    // a steady climb has no event in it
    expect(jumpsOf([snap(0, 100), snap(1, 96), snap(2, 92), snap(3, 88)])).toEqual([]);
    expect(jumpsOf([snap(0, 100)])).toEqual([]);
  });
});

describe("forecastOf", () => {
  const latest = snap(0, 10 * GIB);

  it("says when the budget is reached at the growth of the period", () => {
    const forecast = forecastOf(latest, GIB, 20 * GIB);
    expect(forecast?.days).toBe(10);
    expect(forecast?.reachesAt).toBe(NOW + 10 * DAY);
  });

  it("says nothing when there is no budget, no growth, the budget is already reached, or it is too far away to mean anything", () => {
    expect(forecastOf(latest, GIB, null)).toBeNull();
    expect(forecastOf(latest, 0, 20 * GIB)).toBeNull();
    expect(forecastOf(latest, -GIB, 20 * GIB)).toBeNull();
    expect(forecastOf(latest, null, 20 * GIB)).toBeNull();
    expect(forecastOf(latest, GIB, 10 * GIB)).toBeNull();
    expect(forecastOf(latest, GIB, 5 * GIB)).toBeNull();
    expect(forecastOf(latest, 1, 20 * GIB)).toBeNull(); // thousands of years away
    expect(forecastOf(undefined, GIB, 20 * GIB)).toBeNull();
  });
});

describe("growthByPart", () => {
  it("lists the parts that grew, biggest first, with their line, and counts the ones that did not", () => {
    const history = [
      snap(0, 100, { documents: 60, training: 30, reports: 10 }),
      snap(5, 70, { documents: 30, training: 30, reports: 10 }),
      snap(10, 40, { documents: 10, training: 30, reports: 10 }),
    ];
    const { rows, unchanged } = growthByPart(history, "byDomain");
    expect(rows.map((r) => [r.name, r.delta])).toEqual([["documents", 50]]);
    expect(rows[0].series).toEqual([10, 30, 60]);
    expect(unchanged).toBe(2);
  });

  it("counts a part that appeared during the period as growth from nothing, and says nothing for fewer than two measurements", () => {
    const { rows } = growthByPart([snap(0, 10, { fresh: 10 }), snap(2, 0, {})], "byDomain");
    expect(rows).toEqual([{ name: "fresh", delta: 10, series: [0, 10] }]);
    expect(growthByPart([snap(0, 10, { a: 1 })], "byDomain")).toEqual({ rows: [], unchanged: 0 });
  });
});

describe("measurementsToCsv", () => {
  it("is a header and one line for each measurement, with the time as the screens show it", () => {
    const csv = measurementsToCsv([snap(0, 123, {}), snap(1, 100, {})]);
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("Measured,Total bytes,Object versions");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2},123,10$/);
    expect(lines[2].endsWith(",100,10")).toBe(true);
  });
});
