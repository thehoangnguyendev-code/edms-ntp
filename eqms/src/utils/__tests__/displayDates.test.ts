import { describe, expect, it } from "vitest";
import { displayDate, displayDateTime, displayTime, formatDateTime } from "../format";

describe("display of dates and times", () => {
  it("writes a date as dd/MM/yyyy", () => {
    expect(displayDate("2026-10-03")).toBe("03/10/2026");
    expect(displayDate(new Date(2026, 0, 31, 12))).toBe("31/01/2026");
    expect(displayDate(null)).toBe("-");
    expect(displayDate("not a date")).toBe("-");
  });

  it("writes a moment as dd/MM/yyyy HH:mm:ss in the zone of the site, with one space and no comma", () => {
    // 07:00:05 UTC is 14:00:05 in Ho Chi Minh City.
    expect(displayDateTime("2026-10-23T07:00:05Z")).toBe("23/10/2026 14:00:05");
    expect(formatDateTime("2026-10-23T07:00:05Z")).toBe("23/10/2026 14:00:05");
    expect(displayDateTime(undefined)).toBe("-");
  });

  it("writes the time of day with seconds, 24 hours", () => {
    expect(displayTime("2026-10-23T18:05:09Z")).toBe("01:05:09");
  });

  it("stays on the right day after seven in the evening UTC", () => {
    expect(displayDate("2026-10-23T18:30:00Z")).toBe("24/10/2026");
  });

  it("does not follow a format stored in the browser", () => {
    window.localStorage.setItem("eqms.system.localization", JSON.stringify({ dateTimeFormat: "MM/DD/YYYY HH:mm", timeZone: "Asia/Ho_Chi_Minh" }));
    try {
      expect(displayDateTime("2026-10-23T07:00:05Z")).toBe("23/10/2026 14:00:05");
    } finally {
      window.localStorage.removeItem("eqms.system.localization");
    }
  });
});
