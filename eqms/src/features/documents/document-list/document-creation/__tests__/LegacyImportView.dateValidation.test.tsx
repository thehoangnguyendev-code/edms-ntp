import { describe, it, expect } from "vitest";
import {
  parseDateTimePickerValue,
  getSectionDateErrors,
  emptySection,
} from "../LegacyImportView";

// Regression coverage for two real bugs found and fixed in this codebase:
// 1) DateTimePicker emits "DD/MM/YYYY", which `new Date(string)` silently mis-parses (or returns
//    Invalid Date) -- every chronology check built on that was effectively a no-op until this was
//    replaced with parseDateTimePickerValue.
// 2) The 4/5-date chronology chain (Authored -> Review -> Approval -> Training -> Effective) must
//    reject out-of-order and future dates on BOTH sides of a violated pair, not just one.

describe("parseDateTimePickerValue", () => {
  it("parses a valid DD/MM/YYYY date correctly (not as MM/DD)", () => {
    // 09/08/2026 means 9 August, not September 8th -- a naive `new Date("09/08/2026")` in most JS
    // engines would silently produce the wrong month.
    const time = parseDateTimePickerValue("09/08/2026");
    const date = new Date(time as number);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7); // August (0-indexed)
    expect(date.getDate()).toBe(9);
  });

  it("returns null for an out-of-range day/month combination instead of silently rolling over", () => {
    // 31 February does not exist -- naive Date arithmetic would roll this into March.
    expect(parseDateTimePickerValue("31/02/2026")).toBeNull();
  });

  it("returns null for empty or malformed input", () => {
    expect(parseDateTimePickerValue("")).toBeNull();
    expect(parseDateTimePickerValue("not-a-date")).toBeNull();
  });

  it("orders two DD/MM/YYYY dates correctly where a naive Date() parse would get it backwards", () => {
    // 31/08/2026 (31 Aug) really is before 15/09/2026 (15 Sep); naive M/D/Y parsing of "31/08/2026"
    // produces an Invalid Date (month 31), which made every comparison against it silently false.
    const earlier = parseDateTimePickerValue("31/08/2026");
    const later = parseDateTimePickerValue("15/09/2026");
    expect(earlier).not.toBeNull();
    expect(later).not.toBeNull();
    expect((earlier as number) < (later as number)).toBe(true);
  });
});

describe("getSectionDateErrors", () => {
  const validSection = () => ({
    ...emptySection("1.0.0"),
    legacyHistoricalAuthoredDate: "01/08/2026",
    legacyHistoricalReviewDate: "08/08/2026",
    legacyHistoricalApprovalDate: "09/08/2026",
    effectiveDate: "20/08/2026",
    trainingCompletionDate: "",
  });

  it("reports no errors for a fully chronological section", () => {
    const errors = getSectionDateErrors(validSection());
    expect(errors.authored).toBeNull();
    expect(errors.review).toBeNull();
    expect(errors.approval).toBeNull();
    expect(errors.effective).toBeNull();
    expect(errors.training).toBeNull();
  });

  it("flags Approval Date landing after Effective Date on the Approval field", () => {
    const section = { ...validSection(), legacyHistoricalApprovalDate: "15/09/2026", effectiveDate: "31/08/2026" };
    const errors = getSectionDateErrors(section);
    expect(errors.approval).toMatch(/Effective Date/i);
  });

  it("flags the SAME conflict symmetrically on Effective Date too (not just one side)", () => {
    const section = { ...validSection(), legacyHistoricalApprovalDate: "15/09/2026", effectiveDate: "31/08/2026" };
    const errors = getSectionDateErrors(section);
    expect(errors.effective).toMatch(/Approval Date/i);
  });

  it("flags a Review Date before the Authored Date", () => {
    const section = { ...validSection(), legacyHistoricalAuthoredDate: "10/08/2026", legacyHistoricalReviewDate: "05/08/2026" };
    const errors = getSectionDateErrors(section);
    expect(errors.review).toMatch(/Authored Date/i);
  });

  it("flags any historical date set in the future", () => {
    const section = { ...validSection(), legacyHistoricalAuthoredDate: "01/01/2099" };
    const errors = getSectionDateErrors(section);
    expect(errors.authored).toMatch(/future/i);
  });

  it("requires Training Completion Date to fall between Approval and Effective when present", () => {
    // Training only happens after Approval and before/at Effective in the real lifecycle
    // (Approval -> Pending Training -> Effective) -- this was the second real bug reported live.
    const tooEarly = {
      ...validSection(),
      legacyHistoricalApprovalDate: "09/08/2026",
      trainingCompletionDate: "05/08/2026", // before Approval
    };
    expect(getSectionDateErrors(tooEarly).training).toMatch(/Approval Date/i);

    const tooLate = {
      ...validSection(),
      effectiveDate: "20/08/2026",
      trainingCompletionDate: "25/08/2026", // after Effective
    };
    expect(getSectionDateErrors(tooLate).training).toMatch(/Effective Date/i);

    const justRight = {
      ...validSection(),
      legacyHistoricalApprovalDate: "09/08/2026",
      effectiveDate: "20/08/2026",
      trainingCompletionDate: "15/08/2026",
    };
    expect(getSectionDateErrors(justRight).training).toBeNull();
  });
});
