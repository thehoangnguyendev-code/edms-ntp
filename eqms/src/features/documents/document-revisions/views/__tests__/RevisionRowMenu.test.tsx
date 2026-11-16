import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RevisionRowMenu } from "../RevisionRowMenu";
import type { Revision } from "../types";

const position = { top: 0, left: 0 };
const revision = (overrides: Partial<Revision>) => ({ id: "rev-1", status: "Pending Review", statusCode: "PENDING_REVIEW", ...overrides }) as Revision;

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

const open = (rev: Revision | null, extra: Partial<React.ComponentProps<typeof RevisionRowMenu>> = {}) => {
  const onClose = vi.fn();
  const onAction = vi.fn();
  render(<RevisionRowMenu revision={rev} isOpen onClose={onClose} position={position} onAction={onAction} {...extra} />);
  return { onClose, onAction };
};

describe("RevisionRowMenu", () => {
  it("draws nothing without a revision", () => {
    open(null);
    expect(screen.queryByText("View Details")).toBeNull();
  });

  it("offers only what the server allowed for this person and this revision", () => {
    open(revision({ canReviewRevision: true, canApproveRevision: true }));
    expect(screen.getByText("View Details")).toBeTruthy();
    expect(screen.getByText("Review Revision")).toBeTruthy();
    expect(screen.queryByText("Approve Revision")).toBeNull();
    expect(screen.queryByText("Publish Revision")).toBeNull();
  });

  it("gives a Draft the person can edit Edit Revision as well as View Details", () => {
    open(revision({ status: "Draft", statusCode: "DRAFT", canEditRevision: true }));
    expect(screen.getByText("Edit Revision")).toBeTruthy();
    expect(screen.getByText("View Details")).toBeTruthy();
  });

  it("leaves Publish out when the screen cannot publish", () => {
    open(revision({ status: "Ready for Publishing", statusCode: "READY_FOR_PUBLISHING", canPublishRevision: true }), { publish: false });
    expect(screen.queryByText("Publish Revision")).toBeNull();
    cleanup();
    open(revision({ status: "Ready for Publishing", statusCode: "READY_FOR_PUBLISHING", canPublishRevision: true }));
    expect(screen.getByText("Publish Revision")).toBeTruthy();
  });

  it("closes the menu and hands over the chosen action with its revision", () => {
    const rev = revision({ canReviewRevision: true });
    const { onClose, onAction } = open(rev);
    fireEvent.click(screen.getByText("Review Revision"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith("review", rev);
  });
});
