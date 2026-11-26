import { describe, expect, it } from "vitest";
import { codeLabel, humanize, runStatusLabel, scheduleReasonLabel, scheduleStatusColor, scheduleStatusLabel } from "../reportLabels";

describe("report display labels", () => {
  it("shows a run status as ordinary text", () => {
    expect(runStatusLabel("COMPLETED")).toBe("Completed");
    expect(runStatusLabel("RETRY_SCHEDULED")).toBe("Retry scheduled");
    expect(runStatusLabel("DEAD_LETTERED")).toBe("Dead-lettered");
    expect(runStatusLabel(undefined)).toBe("—");
  });

  it("shows a schedule status as ordinary text", () => {
    expect(scheduleStatusLabel("ACTIVE")).toBe("Active");
    expect(scheduleStatusLabel("PAUSED")).toBe("Paused");
    expect(scheduleStatusLabel("SUSPENDED_TEMPLATE_NOT_APPROVED")).toBe("Suspended");
  });

  it("gives the reason of a suspension on its own, and every status a colour", () => {
    expect(scheduleReasonLabel("SUSPENDED_TEMPLATE_NOT_APPROVED")).toBe("Template not approved");
    expect(scheduleReasonLabel("SUSPENDED_SIGNATURE_REQUIRED")).toBe("Signature required");
    expect(scheduleReasonLabel("ACTIVE")).toBe("—");
    expect(scheduleReasonLabel("PAUSED")).toBe("—");
    expect(scheduleStatusColor("ACTIVE")).toBe("emerald");
    expect(scheduleStatusColor("PAUSED")).toBe("amber");
    // a suspension has the colour of "Suspended" everywhere (shared status table)
    expect(scheduleStatusColor("SUSPENDED_INVALID_SCHEDULE")).toBe("orange");
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
