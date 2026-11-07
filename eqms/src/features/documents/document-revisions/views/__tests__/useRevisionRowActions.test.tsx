import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ROUTES } from "@/app/routes.constants";
import { useRevisionRowActions } from "../useRevisionRowActions";
import type { Revision } from "../types";

vi.mock("@/services/api/documents", () => ({ documentApi: { getRevisionByIdSnapshot: vi.fn() } }));

const FROM = ROUTES.DOCUMENTS.REVISIONS.OWNED;
const revision = { id: "rev-9", documentId: "doc-1", documentNumber: "SOP.1", revisionName: "R", revisionNumber: "1.0.0", state: "Effective" } as Revision;

const setup = (onPublish?: (revision: Revision) => void) => {
  const navigateTo = vi.fn();
  const navigateToPrepared = vi.fn().mockResolvedValue(undefined);
  const { result } = renderHook(
    () => useRevisionRowActions({ from: FROM, navigateTo, navigateToPrepared, onPublish }),
    { wrapper: ({ children }) => <MemoryRouter initialEntries={["/list?x=1"]}>{children}</MemoryRouter> },
  );
  return { result, navigateTo, navigateToPrepared };
};

describe("useRevisionRowActions", () => {
  it("opens the editor directly for Edit", () => {
    const { result, navigateTo } = setup();
    result.current.runRowAction("edit", revision);
    expect(navigateTo).toHaveBeenCalledWith(ROUTES.DOCUMENTS.REVISIONS.EDIT("rev-9"), {
      state: { from: FROM, revisionId: "rev-9", editMode: true },
    });
  });

  it.each([
    ["view", ROUTES.DOCUMENTS.REVISIONS.DETAIL("rev-9")],
    ["review", ROUTES.DOCUMENTS.REVISIONS.REVIEW("rev-9")],
    ["approve", ROUTES.DOCUMENTS.REVISIONS.APPROVAL("rev-9")],
    ["training", ROUTES.DOCUMENTS.REVISIONS.TRAINING("rev-9")],
  ] as const)("preloads the revision and opens its %s page", (action, route) => {
    const { result, navigateToPrepared } = setup();
    result.current.runRowAction(action, revision);
    expect(navigateToPrepared).toHaveBeenCalledTimes(1);
    expect(navigateToPrepared.mock.calls[0][0]).toBe(route);
    expect(navigateToPrepared.mock.calls[0][2].state).toMatchObject({ from: FROM, returnTo: "/list?x=1" });
  });

  it("opens the Training page on its training tab", () => {
    const { result, navigateToPrepared } = setup();
    result.current.runRowAction("training", revision);
    expect(navigateToPrepared.mock.calls[0][2].state.workspaceState).toEqual({ activeTab: "training" });
  });

  it("starts a controlled copy request for the revision's document", () => {
    const { result, navigateTo } = setup();
    result.current.runRowAction("controlledCopy", revision);
    const [route, options] = navigateTo.mock.calls[0];
    expect(route).toBe(ROUTES.DOCUMENTS.CONTROLLED_COPIES.REQUEST);
    expect(options.state).toMatchObject({ documentId: "doc-1", revisionId: "rev-9", sourceRevisionId: "rev-9", from: FROM });
  });

  it("leaves Publish to the screen that owns the publishing flow", () => {
    const onPublish = vi.fn();
    const { result } = setup(onPublish);
    result.current.runRowAction("publish", revision);
    expect(onPublish).toHaveBeenCalledWith(revision);
  });

  it("falls back to a plain navigation when the preload fails", async () => {
    const { result, navigateTo, navigateToPrepared } = setup();
    navigateToPrepared.mockRejectedValueOnce(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    result.current.viewRevision("rev-9");
    await vi.waitFor(() => expect(navigateTo).toHaveBeenCalledWith(ROUTES.DOCUMENTS.REVISIONS.DETAIL("rev-9"), { state: { from: FROM, returnTo: "/list?x=1" } }));
  });
});
