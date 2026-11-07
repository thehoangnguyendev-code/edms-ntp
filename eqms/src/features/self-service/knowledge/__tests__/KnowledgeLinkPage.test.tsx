import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const { api } = vi.hoisted(() => ({ api: { openLink: vi.fn() } }));
vi.mock("@/services/api/knowledge", () => ({ knowledgeApi: api }));

import { explorerAddressFor, KnowledgeLinkPage, previewAddressFor } from "../KnowledgeLinkPage";

const Where: React.FC<{ label: string }> = ({ label }) => {
  const location = useLocation();
  return <div data-testid="where">{label}{location.pathname}{location.search}</div>;
};

const renderAt = (token: string) =>
  render(
    <MemoryRouter initialEntries={[`/documents/knowledge/link/${token}`]}>
      <Routes>
        <Route path="/documents/knowledge/link/:token" element={<KnowledgeLinkPage />} />
        <Route path="/documents/knowledge/preview/:id" element={<Where label="preview:" />} />
        <Route path="/documents/knowledge/explorer" element={<Where label="explorer:" />} />
      </Routes>
    </MemoryRouter>,
  );

const target = (extra: Record<string, unknown> = {}) => ({
  kind: "DOCUMENT", label: "SOP.0001 - Balance calibration", documentId: "d1", documentNumber: "SOP.0001", documentName: "Balance calibration", revisionNumber: "1.0",
  department: "QC Laboratory", hierarchyId: null, knowledgeBaseKey: null, knowledgeBaseLabel: null, path: [], ...extra,
});

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("KnowledgeLinkPage", () => {
  it("opens the token it was given and goes to the preview of a document", async () => {
    api.openLink.mockResolvedValue(target());
    renderAt("tok-abc");
    await waitFor(() => expect(screen.getByTestId("where").textContent).toContain("preview:/documents/knowledge/preview/d1"));
    expect(api.openLink).toHaveBeenCalledWith("tok-abc");
    expect(api.openLink).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("where").textContent).toContain("number=SOP.0001");
    expect(screen.getByTestId("where").textContent).toContain("department=QC+Laboratory");
  });

  it("opens the explorer at the folder a link points to", async () => {
    api.openLink.mockResolvedValue(target({ kind: "DEPARTMENT", documentId: null, hierarchyId: "h1", knowledgeBaseKey: "bu1", knowledgeBaseLabel: "Quality Unit", path: ["dep1", "type1"] }));
    renderAt("tok-folder");
    const where = await screen.findByTestId("where");
    expect(where.textContent).toContain("explorer:/documents/knowledge/explorer?");
    expect(where.textContent).toContain("kb=bu1");
    expect(where.textContent).toContain("kbLabel=Quality+Unit");
    expect(where.textContent).toContain("path=dep1%2Ctype1");
    expect(where.textContent).toContain("hierarchyId=h1");
  });

  it("says the person now has a folder the explorer cannot point at, and offers the Knowledge Base", async () => {
    api.openLink.mockResolvedValue(target({ kind: "DOCUMENT_TYPE", documentId: null, label: "QC / SOP" }));
    renderAt("tok-odd");
    expect(await screen.findByText("You can now open QC / SOP")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go to the Knowledge Base" })).toBeTruthy();
  });

  it("says a link cannot be opened, with the server's words and no more", async () => {
    api.openLink.mockRejectedValue({ response: { data: { message: "x", error: { message: "This link is not valid, has expired or was revoked" } } } });
    renderAt("tok-dead");
    expect(await screen.findByText("This link cannot be opened")).toBeTruthy();
    expect(screen.getByText("This link is not valid, has expired or was revoked")).toBeTruthy();
    expect(screen.getByText("Ask the person who sent it for a new link.")).toBeTruthy();
  });

  it("builds the addresses it navigates to", () => {
    expect(previewAddressFor(target() as never)).toBe("/documents/knowledge/preview/d1?name=Balance+calibration&number=SOP.0001&revision=1.0&department=QC+Laboratory");
    expect(explorerAddressFor(target({ knowledgeBaseKey: "bu1", path: [] }) as never)).toBe("/documents/knowledge/explorer?kb=bu1");
    expect(explorerAddressFor(target() as never)).toBe("/documents/knowledge/explorer");
  });
});
