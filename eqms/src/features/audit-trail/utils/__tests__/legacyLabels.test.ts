import { describe, expect, it } from "vitest";
import { formatAuditActionLabel } from "../actionBadge";
import { objectHistoryPath } from "../objectHistory";

describe("audit labels and links", () => {
  it("names one event the same under both codes it was written with", () => {
    expect(formatAuditActionLabel("LEGACY_IMPORT")).toBe(formatAuditActionLabel("DOCUMENT_LEGACY_IMPORTED"));
    expect(formatAuditActionLabel("LEGACY_IMPORT_EFFECTIVE")).toBe(formatAuditActionLabel("DOCUMENT_LEGACY_IMPORT_EFFECTIVE"));
    expect(formatAuditActionLabel("LEGACY_BATCH_SUPERSEDED")).toBe(formatAuditActionLabel("DOCUMENT_LEGACY_BATCH_SUPERSEDED"));
    expect(formatAuditActionLabel("DOCUMENT_UPLOADED")).toBe("Document Uploaded");
  });

  it("links to the whole history of one object by its id, with the code only as words", () => {
    const path = objectHistoryPath("11111111-2222-3333-4444-555555555555", "SOP.0001");
    const params = new URLSearchParams(path.split("?")[1]);
    expect(params.get("entityId")).toBe("11111111-2222-3333-4444-555555555555");
    expect(params.get("objectCode")).toBe("SOP.0001");
    expect(params.get("dateFrom")).toBe("01/01/2000 00:00:00");
  });
});
