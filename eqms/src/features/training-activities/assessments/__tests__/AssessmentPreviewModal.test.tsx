import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const media = vi.hoisted(() => ({ roomForTwo: true }));
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: () => media.roomForTwo }));
vi.mock("@/features/documents/shared/components/DocumentPdfViewer", () => ({
  DocumentPdfViewer: ({ fileUrl }: { fileUrl: string }) => <span data-testid="pdf">{fileUrl}</span>,
}));

import { AssessmentPreviewModal } from "../AssessmentPreviewModal";

afterEach(() => { cleanup(); vi.restoreAllMocks(); media.roomForTwo = true; });

describe("the window of the preview", () => {
  it("does not release the paper when React sets the window up twice (the paper would not load), and releases it when the window is gone", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const { unmount } = render(<StrictMode><AssessmentPreviewModal title="Preview: x" firstUrl="blob:paper" load={async () => "blob:key"} onClose={() => undefined} /></StrictMode>);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(revoke).not.toHaveBeenCalled();
    unmount();
    await waitFor(() => expect(revoke).toHaveBeenCalledWith("blob:paper"));
  });

  it("has three tabs on a screen with room for two pages and two on a phone, where Side by Side is not offered", () => {
    const open = () => render(<AssessmentPreviewModal title="Preview: x" firstUrl="blob:paper" load={async () => "blob:other"} onClose={() => undefined} />);
    open();
    expect(within(screen.getByRole("dialog")).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Test Paper", "Answer Key", "Side by Side"]);
    cleanup();
    media.roomForTwo = false;
    open();
    expect(within(screen.getByRole("dialog")).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Test Paper", "Answer Key"]);
  });

  it("the window gets wider for Side by Side and comes back for the other tabs (the width moves with a transition)", async () => {
    render(<AssessmentPreviewModal title="Preview: x" firstUrl="blob:paper" load={async (paper) => `blob:${paper}`} onClose={() => undefined} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toMatch(/max-w-6xl/);
    expect(dialog.className).toMatch(/transition-\[max-width\]/);
    fireEvent.click(within(dialog).getByRole("tab", { name: "Side by Side" }));
    await waitFor(() => expect(screen.getByRole("dialog").className).toMatch(/max-w-\[96vw\]/));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("tab", { name: "Test Paper" }));
    await waitFor(() => expect(screen.getByRole("dialog").className).toMatch(/max-w-6xl/));
  });
});
