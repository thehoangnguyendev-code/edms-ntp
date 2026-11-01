import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ uploadPreview: vi.fn() }));
vi.mock("@/services/api/imageWatermark", () => ({ imageWatermarkApi: { uploadPreview: api.uploadPreview } }));

import { SpecimenImagePicker } from "../SpecimenImagePicker";

const png = () => new File([new Uint8Array(10)], "signature.png", { type: "image/png" });

beforeEach(() => {
  api.uploadPreview.mockReset();
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:${++n}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

describe("SpecimenImagePicker", () => {
  it("accepts a PNG or JPEG only", () => {
    const onChange = vi.fn();
    const { container } = render(<SpecimenImagePicker file={null} onChange={onChange} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe("image/png,image/jpeg");

    fireEvent.change(input, { target: { files: [new File(["x"], "a.webp", { type: "image/webp" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent("Only a PNG or JPEG image is accepted.");
    fireEvent.change(input, { target: { files: [new File(["x"], "a.bmp", { type: "image/bmp" })] } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { files: [png()] } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("shows the picture at once and then the one the server stamped, with the note about the time", async () => {
    api.uploadPreview.mockResolvedValue({ blob: new Blob(["stamped"]), applied: true });
    render(<SpecimenImagePicker file={png()} onChange={vi.fn()} />);

    expect(screen.getByAltText("Specimen signature preview")).toHaveAttribute("src", "blob:1");
    const stamped = await screen.findByAltText("Specimen signature preview with the watermark");
    expect(stamped).toHaveAttribute("src", "blob:2");
    expect(api.uploadPreview).toHaveBeenCalledWith("specimenSignature", expect.any(File));
    expect(screen.getByText(/The upload time is the time of upload/)).toBeInTheDocument();
  });

  it("keeps the picture as it is when no watermark is applied, and says why when the server tells", async () => {
    api.uploadPreview.mockResolvedValue({ blob: new Blob(["same"]), applied: false, note: "The picture is too small for the watermark" });
    render(<SpecimenImagePicker file={png()} onChange={vi.fn()} />);

    expect(await screen.findByText("The picture is too small for the watermark.")).toBeInTheDocument();
    expect(screen.getByAltText("Specimen signature preview")).toHaveAttribute("src", "blob:1");
    expect(screen.getByText(/Preview before upload/)).toBeInTheDocument();
  });

  it("still shows the picture when the preview cannot be made", async () => {
    api.uploadPreview.mockRejectedValue(new Error("offline"));
    render(<SpecimenImagePicker file={png()} onChange={vi.fn()} />);

    await waitFor(() => expect(api.uploadPreview).toHaveBeenCalled());
    expect(screen.getByAltText("Specimen signature preview")).toHaveAttribute("src", "blob:1");
  });
});
