import { describe, expect, it } from "vitest";
import { codeLabel, humanize, runStatusLabel, scheduleStatusLabel } from "../reportLabels";

describe("report display labels", () => {
  it("shows a run status as ordinary text", () => {
    expect(runStatusLabel("COMPLETED")).toBe("Completed");
    expect(runStatusLabel("RETRY_SCHEDULED")).toBe("Retry scheduled");
    expect(runStatusLabel("DEAD_LETTERED")).toBe("Dead-lettered");
    expect(runStatusLabel(undefined)).toBe("—");
  });

  it("shows a schedule status as ordinary text", () => {
    expect(scheduleStatusLabel("ACTIVE")).toBe("Active");
    expect(scheduleStatusLabel("SUSPENDED_TEMPLATE_NOT_APPROVED")).toBe("Suspended: template not approved");
  });

  it("turns an unknown code into a sentence-case phrase, never leaving capitals", () => {
    expect(humanize("REPORT_ROW_LIMIT_EXCEEDED")).toBe("Report row limit exceeded");
    expect(runStatusLabel("SOMETHING_NEW")).toBe("Something new");
    expect(codeLabel("LEGAL_HOLD_APPLIED")).toBe("Legal hold applied");
  });

  it("shows a dash for nothing", () => {
    expect(codeLabel(null)).toBe("—");
    expect(humanize("")).toBe("");
  });
});
