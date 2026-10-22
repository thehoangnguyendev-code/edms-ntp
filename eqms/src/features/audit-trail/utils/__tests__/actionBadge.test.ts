import { describe, expect, it } from "vitest";
import { formatAuditActionLabel, formatAuditModuleLabel } from "../actionBadge";

describe("formatAuditActionLabel", () => {
  it("shows the code of the server as words, without underscores, whatever its case", () => {
    expect(formatAuditActionLabel("Training_activity_created")).toBe("Training Activity Created");
    expect(formatAuditActionLabel("TRAINING_NUMBER_CANCELLED")).toBe("Training Number Cancelled");
    expect(formatAuditActionLabel("training-paper-evidence-viewed")).toBe("Training Paper Evidence Viewed");
    expect(formatAuditActionLabel("Send_email")).toBe("Send Email");
    expect(formatAuditActionLabel("Login")).toBe("Login");
  });
  it("keeps acronyms and product names, and the wording that is set by hand", () => {
    expect(formatAuditActionLabel("EXPORT_PDF")).toBe("Export PDF");
    expect(formatAuditActionLabel("SYNC_TO_MINIO")).toBe("Sync To MinIO");
    expect(formatAuditActionLabel("publish_to_effective")).toBe("Publish to Effective");
  });
});

describe("formatAuditModuleLabel", () => {
  it("turns a machine code into words and leaves a name that is already written for people", () => {
    expect(formatAuditModuleLabel("TRAINING_ACTIVITY")).toBe("Training Activity");
    expect(formatAuditModuleLabel("Controlled Copy")).toBe("Controlled Copy");
    expect(formatAuditModuleLabel("Document")).toBe("Document");
    expect(formatAuditModuleLabel("")).toBe("-");
    expect(formatAuditModuleLabel(undefined)).toBe("-");
  });
});
