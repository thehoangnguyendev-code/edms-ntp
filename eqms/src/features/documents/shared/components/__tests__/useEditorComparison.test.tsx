import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEditorComparison } from "../useEditorComparison";

const api = vi.hoisted(() => ({
  getRevisionById: vi.fn(),
  getRevisionComparisonBaselines: vi.fn(),
  getRevisionComparisonConfig: vi.fn(),
}));
vi.mock("@/services/api/documents", () => ({ documentApi: api }));
vi.mock("../OnlyOfficeDocumentViewer", () => ({
  OnlyOfficeDocumentViewer: ({ revisionId }: { revisionId: string }) => <div data-testid="comparison">{revisionId}</div>,
}));

vi.mock("../OnlyOfficeSideBySide", () => ({
  OnlyOfficeSideBySide: ({ baselineId }: { baselineId: string }) => <div data-testid="side-by-side">{baselineId}</div>,
}));

const Frame = () => {
  const comparison = useEditorComparison("r1");
  return <>{comparison.actions}{comparison.view}{comparison.chooser}</>;
};

const baselines = [
  { revisionId: "eff", revisionNumber: "2.0.0", statusCode: "EFFECTIVE" },
  { revisionId: "old", revisionNumber: "1.0.0", statusCode: "OBSOLETED" },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.getRevisionById.mockResolvedValue({ statusCode: "PENDING_REVIEW" });
  api.getRevisionComparisonBaselines.mockResolvedValue(baselines);
});

describe("Compare with Effective in the review editor", () => {
  it("lets the reviewer choose a revision, shows the comparison and closes it", async () => {
    render(<Frame />);
    fireEvent.click(await screen.findByRole("button", { name: /Compare with Effective/ }));
    fireEvent.click(screen.getByLabelText(/Obsoleted revision 1\.0\.0/));
    fireEvent.click(screen.getByLabelText("One document with changes marked"));
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    expect(screen.getByTestId("comparison").textContent).toBe("compare-r1-old");
    fireEvent.click(screen.getByRole("button", { name: /Close Compare/ }));
    expect(screen.queryByTestId("comparison")).toBeNull();
  });

  it("preselects the effective revision, side by side", async () => {
    render(<Frame />);
    fireEvent.click(await screen.findByRole("button", { name: /Compare with Effective/ }));
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    expect(screen.getByTestId("side-by-side").textContent).toBe("eff");
  });

  it("is disabled when the document has nothing to compare with", async () => {
    api.getRevisionComparisonBaselines.mockResolvedValue([]);
    render(<Frame />);
    expect((await screen.findByRole("button", { name: /Compare with Effective/ })).hasAttribute("disabled")).toBe(true);
  });

  it("is not offered while authoring", async () => {
    api.getRevisionById.mockResolvedValue({ statusCode: "DRAFT" });
    render(<Frame />);
    await waitFor(() => expect(api.getRevisionById).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /Compare with Effective/ })).toBeNull();
    expect(api.getRevisionComparisonBaselines).not.toHaveBeenCalled();
  });
});
