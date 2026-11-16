import { describe, expect, it } from "vitest";
import { describeRevisionPreviewUnavailable } from "../previewHelpers";

/** The answer of the server names a status by {id, name} (there is no "code"): the message of a cancelled revision must follow the code, not the words. */
describe("describeRevisionPreviewUnavailable by status code", () => {
  it("a Closed - Cancelled revision says it has no retained file", () => {
    expect(describeRevisionPreviewUnavailable({ status: "Closed - Cancelled", statusInfo: { id: "CLOSED_CANCELLED" } })).toMatch(/cancelled revision has no retained source file/);
    expect(describeRevisionPreviewUnavailable({ status: "Closed - Cancelled" })).toMatch(/cancelled revision has no retained source file/);
  });

  it("an Effective or Obsoleted revision without a published PDF says so", () => {
    expect(describeRevisionPreviewUnavailable({ status: "Effective", statusInfo: { id: "EFFECTIVE" } })).toMatch(/No published PDF/);
    expect(describeRevisionPreviewUnavailable({ status: "Obsoleted", statusInfo: { id: "OBSOLETED" } })).toMatch(/No published PDF/);
  });
});
