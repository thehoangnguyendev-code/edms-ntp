import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const getDocumentVersions = vi.fn();
const getRevisionById = vi.fn();
vi.mock("@/services/api/documents", () => ({
  documentApi: {
    getDocumentVersions: (...args: unknown[]) => getDocumentVersions(...args),
    getRevisionById: (...args: unknown[]) => getRevisionById(...args),
  },
}));
vi.mock("@/hooks", () => ({ useNavigateWithLoading: () => ({ navigateTo: vi.fn(), navigateToPrepared: vi.fn(), isNavigating: false }) }));

import { ExpandedDocumentRow, preloadExpandedDocumentDetails } from "../ExpandedDocumentRow";

const versions = [{ id: "v1", revisionNumber: "1.0.0", created: "01/10/2026 10:00:00", openedBy: "Ann", revisionName: "First", status: "Effective", statusCode: "EFFECTIVE" }];

const renderRow = (documentId: string) =>
  render(
    <table>
      <tbody>
        <ExpandedDocumentRow isExpanded hasDocs visibleColumnsLength={4} documentId={documentId} revision={{ id: documentId }} />
      </tbody>
    </table>,
  );

describe("ExpandedDocumentRow prefetch", () => {
  beforeEach(() => {
    getDocumentVersions.mockReset();
    getRevisionById.mockReset();
    getDocumentVersions.mockResolvedValue(versions);
  });

  it("fetches once however many times the chevron is hovered or pressed", async () => {
    preloadExpandedDocumentDetails({ documentId: "doc-once" });
    preloadExpandedDocumentDetails({ documentId: "doc-once" });
    preloadExpandedDocumentDetails({ documentId: "doc-once" });
    await Promise.resolve();

    expect(getDocumentVersions).toHaveBeenCalledTimes(1);
    expect(getDocumentVersions).toHaveBeenCalledWith("doc-once");
  });

  it("opens with the revisions already in it when they were fetched before the click: no spinner, no second request", async () => {
    preloadExpandedDocumentDetails({ documentId: "doc-ready" });
    await vi.waitFor(() => expect(getDocumentVersions).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));

    renderRow("doc-ready");

    // On the very first render: the content, not "Loading details...".
    expect(screen.getByText("1.0.0")).toBeInTheDocument();
    expect(screen.queryByText("Loading details...")).toBeNull();
    expect(getDocumentVersions).toHaveBeenCalledTimes(1);
  });

  it("still loads on demand when nothing was fetched ahead (keyboard or touch users that skipped the hover)", async () => {
    renderRow("doc-cold");

    expect(screen.getByText("Loading details...")).toBeInTheDocument();
    expect(await screen.findByText("1.0.0")).toBeInTheDocument();
    expect(getDocumentVersions).toHaveBeenCalledTimes(1);
  });
});
