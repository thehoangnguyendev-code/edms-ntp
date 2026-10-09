import { describe, expect, it } from "vitest";
import {
  USAGE_PURPOSE_ALL,
  normalizeUsagePurpose,
  usagePurposeFilterFromParam,
  usagePurposeLabel,
} from "../usagePurpose";

describe("usagePurpose", () => {
  it("accepts only the two machine values", () => {
    expect(normalizeUsagePurpose("READ_AND_COMPLY")).toBe("READ_AND_COMPLY");
    expect(normalizeUsagePurpose("RECORD_KEEPING")).toBe("RECORD_KEEPING");
    expect(normalizeUsagePurpose("Read and comply")).toBeUndefined();
    expect(normalizeUsagePurpose(null)).toBeUndefined();
  });

  it("shows a dash for a legacy copy without purpose", () => {
    expect(usagePurposeLabel(undefined)).toBe("-");
    expect(usagePurposeLabel("READ_AND_COMPLY")).toBe("Read and comply");
    expect(usagePurposeLabel("RECORD_KEEPING")).toBe("Record-keeping");
  });

  it("falls back to All for an unknown address-bar value", () => {
    expect(usagePurposeFilterFromParam(null)).toBe(USAGE_PURPOSE_ALL);
    expect(usagePurposeFilterFromParam("junk")).toBe(USAGE_PURPOSE_ALL);
    expect(usagePurposeFilterFromParam("RECORD_KEEPING")).toBe("RECORD_KEEPING");
  });
});
