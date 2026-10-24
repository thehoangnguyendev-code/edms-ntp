import { describe, expect, it } from "vitest";
import { statusChange } from "../trainingLabels";

describe("statusChange", () => {
  it("describes the status before and after for the e-signature modal", () => {
    expect(statusChange("Pending Approval", "Effective")).toEqual([
      { action: "Update Status", oldValue: "Pending Approval", newValue: "Effective", category: "status" },
    ]);
  });

  it("can name another thing than the status", () => {
    expect(statusChange("Entered", "Verified", "Typed results")[0]).toMatchObject({ action: "Typed results", category: "status" });
  });
});
