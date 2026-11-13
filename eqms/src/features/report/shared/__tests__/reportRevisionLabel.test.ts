import { describe, expect, it } from "vitest";
import { reportRevisionLabel } from "../reportLabels";

/** A template revision reads as a Document revision does: 0.0.1 while it is written, 1.0.0 once effective, then 1.0.1 and 2.0.0. */
describe("reportRevisionLabel", () => {
  it("the first revision is 0.0.1 while it is written and 1.0.0 when it is effective", () => {
    expect(reportRevisionLabel(1, "DRAFT")).toBe("0.0.1");
    expect(reportRevisionLabel(1, "PENDING_APPROVAL")).toBe("0.0.1");
    expect(reportRevisionLabel(1, "EFFECTIVE")).toBe("1.0.0");
    expect(reportRevisionLabel(1)).toBe("1.0.0");
  });
  it("the next revision is 1.0.1 while it is written and 2.0.0 when it is effective; the earlier one stays 1.0.0", () => {
    expect(reportRevisionLabel(2, "DRAFT")).toBe("1.0.1");
    expect(reportRevisionLabel(2, "DISCARDED")).toBe("1.0.1");
    expect(reportRevisionLabel(2, "EFFECTIVE")).toBe("2.0.0");
    expect(reportRevisionLabel(1, "OBSOLETE")).toBe("1.0.0");
  });
  it("no revision gives a dash", () => {
    expect(reportRevisionLabel(null)).toBe("—");
    expect(reportRevisionLabel(undefined, "DRAFT")).toBe("—");
  });
});
