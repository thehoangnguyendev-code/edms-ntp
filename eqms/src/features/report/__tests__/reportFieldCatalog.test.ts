import { describe, expect, it } from "vitest";
import { CORE_GROUP, fieldMatches, groupNames, initialFields, maxColumnsOf } from "../shared/reportFieldCatalog";
import type { ReportSource } from "@/services/api/reportTemplates";

const source = (extra: Partial<ReportSource> = {}): ReportSource => ({
  code: "USER_ACCESS",
  name: "Users",
  fields: { fullName: "Name", status: "Status", email: "Email", phone: "Phone" },
  requiredFields: ["fullName", "status"],
  fieldGroups: { email: "Contact", phone: "Contact" },
  sensitiveFields: ["email", "phone"],
  ...extra,
});

describe("report field catalogue", () => {
  it("a new template allows the Core group and the required fields, not the other groups", () => {
    const fields = initialFields(source(), undefined, true);
    expect(fields.map((f) => [f.code, f.allowed, f.defaultSelected])).toEqual([
      ["fullName", true, true],
      ["status", true, true],
      ["email", false, false],
      ["phone", false, false],
    ]);
  });

  it("a new template selects at most the limit of columns, the required ones first", () => {
    const wide = source({
      fields: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`f${i}`, `Field ${i}`])),
      requiredFields: ["f0"],
      fieldGroups: {},
      maxColumns: 5,
    });
    const fields = initialFields(wide, undefined, true);
    expect(fields.filter((f) => f.defaultSelected)).toHaveLength(5);
    expect(fields.every((f) => f.allowed)).toBe(true);
  });

  it("a template that exists keeps what it allowed; a field added later is not allowed", () => {
    const fields = initialFields(source(), [
      { code: "fullName", allowed: true, defaultSelected: true, required: true },
      { code: "status", allowed: true, defaultSelected: true, required: true },
      { code: "email", allowed: true, defaultSelected: false, required: false },
    ], false);
    expect(fields.find((f) => f.code === "email")?.allowed).toBe(true);
    expect(fields.find((f) => f.code === "phone")).toMatchObject({ allowed: false, defaultSelected: false });
  });

  it("the limit is 30 unless the server says another", () => {
    expect(maxColumnsOf(undefined)).toBe(30);
    expect(maxColumnsOf({ maxColumns: 12 })).toBe(12);
  });

  it("the search ignores case and accents and also matches the group; the group narrows", () => {
    expect(fieldMatches("Ngày hiệu lực", "Dates", "hieu luc", "")).toBe(true);
    expect(fieldMatches("Email", "Contact", "contact", "")).toBe(true);
    expect(fieldMatches("Email", "Contact", "", "Dates")).toBe(false);
    expect(fieldMatches("Email", "Contact", "", "Contact")).toBe(true);
  });

  it("Core is listed first", () => {
    expect(groupNames(["Dates", CORE_GROUP, "People", "Dates"])).toEqual([CORE_GROUP, "Dates", "People"]);
  });
});
