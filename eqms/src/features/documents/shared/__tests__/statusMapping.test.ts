import { describe, expect, it } from "vitest";
import { mapRevisionSummaryFromApi } from "../statusMapping";

/** STATUS-CONTRACT-2026-11-14: the mapping gives the code, the label and the badge key under three names, and leaves `status` as the server sent it. */
describe("mapRevisionSummaryFromApi", () => {
  const row = { id: "r1", revisionNumber: "1.0.0", created: "", openedBy: "", revisionName: "R" };

  it("keeps the three things apart: code for logic, label for people, badge key for the colour", () => {
    const mapped = mapRevisionSummaryFromApi({ ...row, status: "Pending Review", statusCode: "PENDING_REVIEW", statusInfo: { id: "PENDING_REVIEW", name: "Pending Review" } });
    expect(mapped.statusCode).toBe("PENDING_REVIEW");
    expect(mapped.statusLabel).toBe("Pending Review");
    expect(mapped.statusBadge).toBe("pendingReview");
    expect(mapped.status).toBe("Pending Review");
  });

  it("never turns `status` into the badge key", () => {
    for (const code of ["DRAFT", "READY_FOR_PUBLISHING", "EFFECTIVE", "OBSOLETED", "CLOSED_CANCELLED"]) {
      const mapped = mapRevisionSummaryFromApi({ ...row, status: "x", statusCode: code });
      expect(mapped.status).toBe("x");
      expect(mapped.statusCode).toBe(code);
    }
  });

  it("reads a label written in words the same as the code, so a record that carries only the words still gets its code", () => {
    expect(mapRevisionSummaryFromApi({ ...row, status: "Ready for Publishing" }).statusCode).toBe("READY_FOR_PUBLISHING");
    expect(mapRevisionSummaryFromApi({ ...row, status: "Closed - Cancelled" }).statusCode).toBe("CLOSED_CANCELLED");
  });

  it("the label of a row comes from the name the server gave the status", () => {
    expect(mapRevisionSummaryFromApi({ ...row, status: "old words", statusInfo: { id: "EFFECTIVE", name: "Effective" } }).statusLabel).toBe("Effective");
  });
});
