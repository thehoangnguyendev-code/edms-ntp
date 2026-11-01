import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneralConfig } from "../../types";
import { ImageWatermarkTab } from "../ImageWatermarkTab";

const api = vi.hoisted(() => ({ configPreview: vi.fn() }));
vi.mock("@/services/api/imageWatermark", () => ({ imageWatermarkApi: { configPreview: api.configPreview } }));

const general = (imageWatermark?: GeneralConfig["imageWatermark"]) => ({ systemName: "EQMS", imageWatermark } as unknown as GeneralConfig);

const lastDraft = (target: string) => {
  const call = [...api.configPreview.mock.calls].reverse().find((c) => c[0] === target);
  return call?.[1] as Record<string, unknown> | undefined;
};

describe("ImageWatermarkTab", () => {
  beforeEach(() => {
    api.configPreview.mockReset();
    api.configPreview.mockResolvedValue({ blob: new Blob(["x"], { type: "image/png" }), applied: true });
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
    window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
    window.matchMedia = ((query: string) => ({
      matches: true, media: query, addEventListener: () => undefined, removeEventListener: () => undefined,
      addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });

  it("starts as the earlier behaviour: evidence stamped with the system logo at the top left, specimen signatures not stamped", async () => {
    render(<ImageWatermarkTab config={general()} onChange={vi.fn()} />);
    expect(screen.getAllByRole("checkbox", { name: /Add a watermark to every picture/ })[0]).toBeChecked();
    expect(screen.getAllByRole("checkbox", { name: /Add a watermark to every picture/ })[1]).not.toBeChecked();
    await waitFor(() => expect(api.configPreview).toHaveBeenCalledTimes(1));
    expect(lastDraft("controlledCopyEvidence")).toMatchObject({ enabled: true, position: "TOP_LEFT", sizePercent: 20, opacityPercent: 100, showUploadedBy: false });
    expect(lastDraft("specimenSignature")).toBeUndefined();
  });

  it("asks the server for the preview of the draft after a change, and shows the picture it sends back", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<ImageWatermarkTab config={general()} onChange={onChange} />);
    fireEvent.click(await screen.findByRole("radio", { name: "Bottom Right" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ imageWatermark: { controlledCopyEvidence: { position: "BOTTOM_RIGHT" } } }));

    rerender(<ImageWatermarkTab config={general({ controlledCopyEvidence: { position: "BOTTOM_RIGHT", showUploadedBy: true, showUploadedAt: true, opacityPercent: 55 } })} onChange={onChange} />);
    await waitFor(() => expect(lastDraft("controlledCopyEvidence")).toMatchObject({ position: "BOTTOM_RIGHT", showUploadedBy: true, showUploadedAt: true, opacityPercent: 55 }));
    expect(await screen.findByAltText("Controlled Copy Destruction Evidence watermark preview")).toHaveAttribute("src", "blob:preview");
  });

  it("keeps the choice of the corner on the radio group", async () => {
    render(<ImageWatermarkTab config={general({ controlledCopyEvidence: { position: "TOP_RIGHT" } })} onChange={vi.fn()} />);
    const group = (await screen.findAllByRole("radiogroup", { name: "Watermark position" }))[0];
    expect(group.querySelector('[aria-checked="true"]')).toHaveTextContent("Top Right");
    expect(group.querySelectorAll('[role="radio"]')).toHaveLength(4);
  });

  it("does not ask for a preview when nothing would be stamped, and says so", async () => {
    render(<ImageWatermarkTab config={general({ controlledCopyEvidence: { showLogo: false } })} onChange={vi.fn()} />);
    expect(await screen.findByText(/Choose at least one thing to stamp/)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(api.configPreview).not.toHaveBeenCalled();
  });

  it("asks for the custom logo before it can preview one", async () => {
    render(<ImageWatermarkTab config={general({ specimenSignature: { enabled: true, logoSource: "CUSTOM" } })} onChange={vi.fn()} />);
    expect(await screen.findByText(/Upload the custom logo to see the preview/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload Logo" })).toBeInTheDocument();
  });

  it("refuses a logo that is not a PNG or JPEG and one that is too large", async () => {
    const onChange = vi.fn();
    render(<ImageWatermarkTab config={general({ specimenSignature: { enabled: true, logoSource: "CUSTOM" } })} onChange={onChange} />);
    const input = await screen.findByLabelText("Upload Specimen Signature watermark logo");
    fireEvent.change(input, { target: { files: [new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" })] } });
    expect(await screen.findByText("Use a PNG or JPEG picture.")).toBeInTheDocument();
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [big] } });
    expect(await screen.findByText("The logo is larger than 2 MB.")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows the original picture beside the stamped one: the same picture asked with the watermark switched off", async () => {
    let n = 0;
    URL.createObjectURL = vi.fn(() => "blob:" + ++n);
    render(<ImageWatermarkTab config={general()} onChange={vi.fn()} />);
    const stamped = await screen.findByAltText("Controlled Copy Destruction Evidence watermark preview");
    expect(stamped).toHaveAttribute("src", "blob:1");

    fireEvent.click(screen.getAllByRole("button", { name: "Show Original" })[0]);
    const original = await screen.findByAltText("Controlled Copy Destruction Evidence original picture");
    expect(original).toHaveAttribute("src", "blob:2");
    expect(api.configPreview).toHaveBeenLastCalledWith("controlledCopyEvidence", expect.objectContaining({ enabled: false }), null);

    fireEvent.click(screen.getAllByRole("button", { name: "Show With Watermark" })[0]);
    expect(await screen.findByAltText("Controlled Copy Destruction Evidence watermark preview")).toHaveAttribute("src", "blob:1");
  });

  it("tells the administrator when the server did not stamp the sample", async () => {
    api.configPreview.mockResolvedValue({ blob: new Blob(["x"], { type: "image/png" }), applied: false, note: "The picture is too small for the watermark" });
    render(<ImageWatermarkTab config={general()} onChange={vi.fn()} />);
    expect(await screen.findByText(/Not stamped: The picture is too small for the watermark/)).toBeInTheDocument();
  });
});
