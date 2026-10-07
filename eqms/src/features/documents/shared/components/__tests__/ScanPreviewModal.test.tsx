import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../DocumentPdfViewer", () => ({
  DocumentPdfViewer: ({ fileUrl, forceHideDownloadAndPrint }: { fileUrl: string; forceHideDownloadAndPrint?: boolean }) => (
    <div data-testid="pdf-viewer" data-url={fileUrl} data-locked={String(Boolean(forceHideDownloadAndPrint))} />
  ),
}));

import { ScanPreviewModal } from "../ScanPreviewModal";

const createUrl = vi.fn(() => "blob:scan-1");
const revokeUrl = vi.fn();

beforeEach(() => {
  createUrl.mockClear();
  revokeUrl.mockClear();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: createUrl });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: revokeUrl });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const blobOf = (type: string) => new Blob(["x"], { type });

describe("ScanPreviewModal", () => {
  it("renders nothing and loads nothing while closed", () => {
    const loadFile = vi.fn();
    const { container } = render(<ScanPreviewModal isOpen={false} onClose={() => {}} title="REC-1" fileKey="a" loadFile={loadFile} />);
    expect(container).toBeEmptyDOMElement();
    expect(loadFile).not.toHaveBeenCalled();
  });

  it("shows a PDF in the read-only viewer with download and print hidden", async () => {
    render(<ScanPreviewModal isOpen onClose={() => {}} title="REC-1" subtitle="CC-1 · SOP.1" fileKey="a" loadFile={() => Promise.resolve(blobOf("application/pdf"))} />);

    const viewer = await screen.findByTestId("pdf-viewer");
    expect(viewer).toHaveAttribute("data-url", "blob:scan-1");
    expect(viewer).toHaveAttribute("data-locked", "true");
    expect(screen.getByRole("dialog")).toHaveAccessibleName("REC-1");
    expect(screen.getByText("CC-1 · SOP.1")).toBeInTheDocument();
  });

  it("shows an image scan as an image", async () => {
    render(<ScanPreviewModal isOpen onClose={() => {}} title="REC-2" fileKey="b" loadFile={() => Promise.resolve(blobOf("image/jpeg"))} />);

    const image = await screen.findByRole("img", { name: "REC-2" });
    expect(image).toHaveAttribute("src", "blob:scan-1");
    expect(screen.queryByTestId("pdf-viewer")).toBeNull();
  });

  it("never renders a file it cannot identify as a PDF or image", async () => {
    render(<ScanPreviewModal isOpen onClose={() => {}} title="REC-3" fileKey="c" loadFile={() => Promise.resolve(blobOf("application/octet-stream"))} />);

    expect(await screen.findByText("This file type cannot be previewed.")).toBeInTheDocument();
    expect(createUrl).not.toHaveBeenCalled();
  });

  it("says so when the scan cannot be loaded", async () => {
    render(<ScanPreviewModal isOpen onClose={() => {}} title="REC-4" fileKey="d" loadFile={() => Promise.reject(new Error("403"))} />);

    await waitFor(() => expect(screen.getByText(/could not be loaded|403/i)).toBeInTheDocument());
    expect(screen.queryByTestId("pdf-viewer")).toBeNull();
  });

  it("closes on Escape, on either close button and on a click on the backdrop, but not on a click inside the dialog", async () => {
    const onClose = vi.fn();
    render(<ScanPreviewModal isOpen onClose={onClose} title="REC-5" fileKey="e" loadFile={() => Promise.resolve(blobOf("application/pdf"))} />);
    await screen.findByTestId("pdf-viewer");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    // The header cross and the footer "Close" button.
    const closeButtons = screen.getAllByRole("button", { name: "Close" });
    expect(closeButtons).toHaveLength(2);
    closeButtons.forEach((button) => fireEvent.click(button));
    expect(onClose).toHaveBeenCalledTimes(3);

    fireEvent.click(document.body.querySelector(".absolute.inset-0") as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(4);
    // A click INSIDE the dialog does not close it.
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(4);
  });

  it("releases the temporary object URL when it is closed", async () => {
    const view = render(<ScanPreviewModal isOpen onClose={() => {}} title="REC-6" fileKey="f" loadFile={() => Promise.resolve(blobOf("application/pdf"))} />);
    await screen.findByTestId("pdf-viewer");

    view.unmount();

    expect(revokeUrl).toHaveBeenCalledWith("blob:scan-1");
  });

  it("loads again when a different file is shown", async () => {
    const loadFile = vi.fn(() => Promise.resolve(blobOf("application/pdf")));
    const view = render(<ScanPreviewModal isOpen onClose={() => {}} title="REC-7" fileKey="g" loadFile={loadFile} />);
    await screen.findByTestId("pdf-viewer");

    view.rerender(<ScanPreviewModal isOpen onClose={() => {}} title="REC-8" fileKey="h" loadFile={loadFile} />);

    await waitFor(() => expect(loadFile).toHaveBeenCalledTimes(2));
  });
});
