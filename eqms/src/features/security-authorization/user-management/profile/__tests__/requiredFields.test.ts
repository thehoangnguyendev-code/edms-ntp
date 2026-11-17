import { describe, expect, it } from "vitest";
import { TOTAL_REQUIRED, countMissingRequired, tabsWithErrors } from "../requiredFields";
import type { NewUser } from "../../types";

describe("countMissingRequired", () => {
  it("counts every required field of an empty form, tab by tab", () => {
    const missing = countMissingRequired({ employeeCode: "", fullName: "", username: "", email: "", accessProfileIds: [] });

    expect(missing).toEqual({ personal: 4, employment: 5, qualifications: 0, account: 1, security: 1 });
    expect(Object.values(missing).reduce((a, b) => a + b, 0)).toBe(TOTAL_REQUIRED);
    expect(TOTAL_REQUIRED).toBe(11);
  });

  it("does not count a field once it holds something, and ignores blanks made of spaces", () => {
    const missing = countMissingRequired({
      employeeCode: "NTP.0043", fullName: "   ", username: "thu.le", email: "thu@example.com",
      businessUnit: "Manufacturing", department: "QA", position: "", startDate: "2026-11-01", employmentType: "Full-time",
      status: "Active", accessProfileIds: ["p1"],
    } as Partial<NewUser>);

    expect(missing).toEqual({ personal: 1, employment: 1, qualifications: 0, account: 0, security: 0 });
  });
});

describe("tabsWithErrors", () => {
  it("lists the tabs that hold an error, in tab order, and skips cleared messages", () => {
    expect(tabsWithErrors({ status: "Account Status is required", fullName: "Full Name is required", position: "", department: "Department is required" }))
      .toEqual(["personal", "employment", "account"]);
  });

  it("ignores a field that belongs to no tab and returns nothing when there are no errors", () => {
    expect(tabsWithErrors({ somethingElse: "x" })).toEqual([]);
    expect(tabsWithErrors({})).toEqual([]);
  });
});
