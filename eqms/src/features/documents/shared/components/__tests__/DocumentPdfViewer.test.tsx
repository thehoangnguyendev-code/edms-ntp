import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { PdfPreviewSettings } from "../../useDocumentPreviewSettings";

const state = vi.hoisted(() => ({
  settings: { allowDownloadAndPrint: true, pdfPreview: {} as PdfPreviewSettings },
  config: {} as Record<string, any>,
}));

vi.mock("../../useDocumentPreviewSettings", () => ({
  useDocumentPreviewSettings: () => state.settings,
}));
vi.mock("@embedpdf/react-pdf-viewer", () => ({
  ZoomMode: { FitPage: "fit-page", FitWidth: "fit-width" },
  ZoomPlugin: { id: "zoom" },
  PDFViewer: ({ config }: { config: Record<string, any> }) => {
    state.config = config;
    return <div data-testid="embedpdf" />;
  },
}));

import { DocumentPdfViewer } from "../DocumentPdfViewer";

beforeEach(() => {
  state.settings = { allowDownloadAndPrint: true, pdfPreview: {} };
});

describe("DocumentPdfViewer policy mapping", () => {
  it.each([
    ["page-fit", "fit-page"],
    ["page-width", "fit-width"],
    ["actual-size", 1],
  ] as const)("maps %s to EmbedPDF's zoom value", (setting, expected) => {
    state.settings.pdfPreview.defaultZoom = setting;
    render(<DocumentPdfViewer fileUrl="blob:test" />);
    expect(state.config.zoom.defaultZoomLevel).toBe(expected);
    expect(state.config.theme.preference).toBe("light");
  });

  it("applies disabled Document-menu actions and keeps export denied", () => {
    state.settings = {
      allowDownloadAndPrint: false,
      pdfPreview: {
        showOpenDocumentAction: false,
        showCloseDocumentAction: false,
        showSecurityAction: false,
        showScreenshotAction: false,
        allowTextSelection: true,
      },
    };
    const view = render(<DocumentPdfViewer fileUrl="blob:test" allowDownload allowPrint />);
    expect(state.config.disabledCategories).toEqual(expect.arrayContaining([
      "document-open", "document-close", "document-protect", "security",
      "document-capture", "capture-screenshot", "document-export", "document-print", "selection",
    ]));
    expect(state.config.permissions.overrides).toEqual({ print: false, copyContents: false });

    state.settings.pdfPreview = {
      showOpenDocumentAction: true,
      showCloseDocumentAction: true,
      showSecurityAction: true,
      showScreenshotAction: true,
    };
    view.rerender(<DocumentPdfViewer fileUrl="blob:test" allowDownload allowPrint />);
    for (const category of ["document-open", "document-close", "security", "capture-screenshot"]) {
      expect(state.config.disabledCategories).not.toContain(category);
    }
    expect(state.config.permissions.overrides.print).toBe(false);
  });
});
