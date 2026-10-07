import React from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  controlled: { previewMarking: vi.fn() },
  uncontrolled: { previewMarking: vi.fn() },
}));

vi.mock("@/services/api", () => ({ controlledCopyPolicyApi: mocks.controlled }));
vi.mock("@/services/api/uncontrolledCopyPolicy", () => ({ uncontrolledCopyPolicyApi: mocks.uncontrolled }));
vi.mock("konva", () => ({ default: {} }));
vi.mock("react-konva", () => {
  const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return { Group: Box, Image: Box, Layer: Box, Rect: Box, Stage: Box, Text: Box, Transformer: Box };
});

import { MarkingPreviewPane } from "../MarkingPreviewPane";

const preview = { imageBase64: "", pageWidthPt: 595, pageHeightPt: 842, marks: [], warnings: [], note: null };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  mocks.controlled.previewMarking.mockResolvedValue(preview);
  mocks.uncontrolled.previewMarking.mockResolvedValue(preview);
});

describe("MarkingPreviewPane", () => {
  it("draws on one sample paper: nothing to choose, so no document, template, layout or page is sent", async () => {
    const { queryByText } = render(
      <MarkingPreviewPane
        scenario="ISSUED"
        draft={{ distributionSecurity: {}, marking: {}, statusMarking: {} } as never}
        onPlacementChange={vi.fn()}
      />,
    );

    await waitFor(() => expect(mocks.controlled.previewMarking).toHaveBeenCalled(), { timeout: 3000 });
    const request = mocks.controlled.previewMarking.mock.calls[0][0];
    expect(request.scenario).toBe("ISSUED");
    for (const key of ["revisionId", "templateId", "layout", "pageKind"]) {
      expect(request).not.toHaveProperty(key);
    }
    expect(queryByText("Preview on document")).not.toBeInTheDocument();
    expect(queryByText("Preview on template")).not.toBeInTheDocument();
    expect(queryByText("Position for")).not.toBeInTheDocument();
    expect(queryByText("Paper layout")).not.toBeInTheDocument();
  });

  it("the uncontrolled policy previews the same sample paper through its own endpoint", async () => {
    render(<MarkingPreviewPane copyType="UNCONTROLLED" marking={{} as never} onPlacementChange={vi.fn()} />);

    await waitFor(() => expect(mocks.uncontrolled.previewMarking).toHaveBeenCalled(), { timeout: 3000 });
    const request = mocks.uncontrolled.previewMarking.mock.calls[0][0];
    expect(request).toHaveProperty("marking");
    expect(request).not.toHaveProperty("pageKind");
    expect(mocks.controlled.previewMarking).not.toHaveBeenCalled();
  });
});
