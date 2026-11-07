import { describe, expect, it } from "vitest";
import { revisionRowActions } from "../revisionRowActions";

describe("revisionRowActions", () => {
  it("gives every revision a View entry, so the row menu is never empty", () => {
    expect(revisionRowActions({ state: "Draft" })).toEqual(["view"]);
    expect(revisionRowActions({ state: "Draft", canReviewRevision: true })).toEqual(["view"]);
  });

  it("puts View first and gives the author or the person who submits a Draft Edit Revision after it", () => {
    expect(revisionRowActions({ state: "Draft", canEditRevision: true })).toEqual(["view", "edit"]);
    expect(revisionRowActions({ state: "Draft", canSubmitForReview: true })).toEqual(["view", "edit"]);
  });

  it("keeps View at every stage, with the stage action the server allows", () => {
    expect(revisionRowActions({ state: "Effective" })).toEqual(["view"]);
    expect(revisionRowActions({ state: "Pending Review", canReviewRevision: true })).toEqual(["view", "review"]);
    expect(revisionRowActions({ state: "Pending Review" })).toEqual(["view"]);
    expect(revisionRowActions({ state: "Pending Approval", canApproveRevision: true })).toEqual(["view", "approve"]);
    expect(revisionRowActions({ state: "Pending Training", canCompleteTraining: true })).toEqual(["view", "training"]);
    expect(revisionRowActions({ state: "Ready for Publishing", canPublishRevision: true })).toEqual(["view", "publish"]);
  });

  it("offers Request Controlled Copy only on an Effective revision the server allows", () => {
    expect(revisionRowActions({ state: "Effective", canRequestControlledCopy: true })).toEqual(["view", "controlledCopy"]);
    expect(revisionRowActions({ state: "Pending Review", canRequestControlledCopy: true })).toEqual(["view"]);
  });

  it("leaves Publish out on a screen that cannot publish", () => {
    const revision = { state: "Ready for Publishing", canPublishRevision: true };
    expect(revisionRowActions(revision, { publish: false })).toEqual(["view"]);
    expect(revisionRowActions(revision)).toEqual(["view", "publish"]);
  });
});
