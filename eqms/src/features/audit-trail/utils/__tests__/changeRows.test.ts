import { describe, expect, it } from "vitest";
import { expandChange, isTechnicalField } from "../changeRows";

describe("changeRows", () => {
  it("tells what happened to a value: set, changed or cleared", () => {
    expect(expandChange({ field: "Department", oldValue: "Not specified", newValue: "QA" })[0].kind).toBe("set");
    expect(expandChange({ field: "Department", oldValue: "QA", newValue: "QC" })[0].kind).toBe("changed");
    expect(expandChange({ field: "Department", oldValue: "QA", newValue: "-" })[0].kind).toBe("cleared");
    expect(expandChange({ field: "Department", oldValue: "-", newValue: "null" })).toEqual([]);
  });

  it("splits a setting into the values that really changed", () => {
    const rows = expandChange({
      field: "Documents Configuration",
      oldValue: '{"pdfPreview":{"defaultZoom":"actual-size","showSearch":true},"x":1}',
      newValue: '{"pdfPreview":{"defaultZoom":"fit-width","showSearch":true},"x":1,"y":2}',
    });
    expect(rows.map((row) => [row.field, row.oldValue, row.newValue, row.kind])).toEqual([
      ["Documents Configuration › PDF Preview › Default Zoom", "actual-size", "fit-width", "changed"],
      ["Documents Configuration › Y", null, "2", "set"],
    ]);
    expect(rows[0].valueField).toBe("Default Zoom");
  });

  it("gives no row for a value saved as it was", () => {
    expect(expandChange({ field: "Prefix", oldValue: "SRP", newValue: "SRP" })).toEqual([]);
  });

  it("gives no row when a setting was saved without a change", () => {
    expect(expandChange({ field: "Old Style", oldValue: '{"bold":true}', newValue: '{"bold":true}' })).toEqual([]);
  });

  it("shows a list as what was added and what was removed", () => {
    const rows = expandChange({ field: "Meaning Codes", oldValue: "[APPROVED, CANCELLED]", newValue: "[APPROVED, REVIEWED]" });
    expect(rows.map((row) => [row.field, row.oldValue, row.newValue])).toEqual([
      ["Meaning Codes › Added", null, "REVIEWED"],
      ["Meaning Codes › Removed", "CANCELLED", null],
    ]);
  });

  it("keeps file internals out of the changes", () => {
    for (const field of ["Source File Checksum", "sourceFileChecksum", "Malware Scan", "Server Detected Content Type", "Docx Ooxml Validation", "Preview File Path", "Storage Edit Url", "SharePoint Edit Link"]) {
      expect(isTechnicalField(field), field).toBe(true);
    }
    for (const field of ["File Name", "File Size", "Status", "Department", "Document Number"]) {
      expect(isTechnicalField(field), field).toBe(false);
    }
  });
});
