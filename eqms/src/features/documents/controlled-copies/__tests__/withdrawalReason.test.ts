import { describe, expect, it } from "vitest";
import { withdrawalReason } from "../detail/withdrawalReason";

describe("reason for recall of a Controlled Copy", () => {
  it("shows the reason the person gave when they recalled it", () => {
    expect(withdrawalReason({ obsoleteReason: "RECALLED", recallReason: "Wrong location" })).toBe("Wrong location");
  });

  it("says what happened when the system withdrew it", () => {
    expect(withdrawalReason({ obsoleteReason: "NEW_REVISION_PUBLISHED" })).toBe("Withdrawn automatically by the system: replaced by a newer revision");
    expect(withdrawalReason({ obsoleteReason: "EXPIRED" })).toBe("Withdrawn automatically by the system: the expiry date was reached");
  });

  it("names a report of loss or damage", () => {
    expect(withdrawalReason({ obsoleteReason: "LOST" })).toBe("Reported lost");
  });

  it("is empty while the copy is still in use", () => {
    expect(withdrawalReason({})).toBe("");
  });
});
