import { describe, expect, it } from "vitest";
import { revisionRowActions } from "../revisionRowActions";

describe("revisionRowActions", () => {
  it("gives every revision a View entry, so the row menu is never empty", () => {
    expect(revisionRowActions({ status: "Draft", statusCode: "DRAFT" })).toEqual(["view"]);
    expect(revisionRowActions({ status: "Draft", statusCode: "DRAFT", canReviewRevision: true })).toEqual(["view"]);
  });

  it("puts View first and gives the author or the person who submits a Draft Edit Revision after it", () => {
    expect(revisionRowActions({ status: "Draft", statusCode: "DRAFT", canEditRevision: true })).toEqual(["view", "edit"]);
    expect(revisionRowActions({ status: "Draft", statusCode: "DRAFT", canSubmitForReview: true })).toEqual(["view", "edit"]);
  });

  it("keeps View at every stage, with the stage action the server allows", () => {
    expect(revisionRowActions({ status: "Effective", statusCode: "EFFECTIVE" })).toEqual(["view"]);
    expect(revisionRowActions({ status: "Pending Review", statusCode: "PENDING_REVIEW", canReviewRevision: true })).toEqual(["view", "review"]);
    expect(revisionRowActions({ status: "Pending Review", statusCode: "PENDING_REVIEW" })).toEqual(["view"]);
    expect(revisionRowActions({ status: "Pending Approval", statusCode: "PENDING_APPROVAL", canApproveRevision: true })).toEqual(["view", "approve"]);
    expect(revisionRowActions({ status: "Pending Training", statusCode: "PENDING_TRAINING", canCompleteTraining: true })).toEqual(["view", "training"]);
    expect(revisionRowActions({ status: "Ready for Publishing", statusCode: "READY_FOR_PUBLISHING", canPublishRevision: true })).toEqual(["view", "publish"]);
  });

  it("offers Request Controlled Copy only on an Effective revision the server allows", () => {
    expect(revisionRowActions({ status: "Effective", statusCode: "EFFECTIVE", canRequestControlledCopy: true })).toEqual(["view", "controlledCopy"]);
    expect(revisionRowActions({ status: "Pending Review", statusCode: "PENDING_REVIEW", canRequestControlledCopy: true })).toEqual(["view"]);
  });

  it("leaves Publish out on a screen that cannot publish", () => {
    const revision = { status: "Ready for Publishing", statusCode: "READY_FOR_PUBLISHING", canPublishRevision: true };
    expect(revisionRowActions(revision, { publish: false })).toEqual(["view"]);
    expect(revisionRowActions(revision)).toEqual(["view", "publish"]);
  });

  it("decides on the status code, not on the words shown for it", () => {
    // the label may change (a rename, another wording); the code is what the server and the menu agree on
    expect(revisionRowActions({ status: "In Review", statusCode: "PENDING_REVIEW", canReviewRevision: true })).toEqual(["view", "review"]);
    expect(revisionRowActions({ status: "Pending Review", statusCode: "EFFECTIVE", canReviewRevision: true })).toEqual(["view"]);
    expect(revisionRowActions({ status: "x", statusInfo: { id: "PENDING_APPROVAL" }, canApproveRevision: true })).toEqual(["view", "approve"]);
    expect(revisionRowActions({ status: "Effective", statusCode: "EFFECTIVE", canRequestControlledCopy: true })).toEqual(["view", "controlledCopy"]);
  });
});
