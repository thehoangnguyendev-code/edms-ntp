import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QrCodeFields } from "../MarkingEditors";

const value = { qrCodePosition: "BOTTOM_RIGHT", qrCodeSizeMm: 20, qrCodePages: "ALL" };

describe("QrCodeFields", () => {
  it("tells the administrator to drag the code while it sits in a corner", () => {
    render(<QrCodeFields value={value} onChange={vi.fn()} positioned={false} />);

    expect(screen.getByText(/Drag the code on the preview/)).toBeInTheDocument();
  });

  it("says the code was placed by hand once it was dragged, and that a corner puts it back", () => {
    render(<QrCodeFields value={value} onChange={vi.fn()} positioned />);

    expect(screen.getByText(/Placed by hand on the preview/)).toBeInTheDocument();
    expect(screen.getByText(/Choosing a corner puts it back there/)).toBeInTheDocument();
  });

  it("offers every page or the first page only, and says what each choice means for sorting loose pages", () => {
    const onChange = vi.fn();
    const { rerender } = render(<QrCodeFields value={value} onChange={onChange} />);

    expect(screen.getByText("Pages")).toBeInTheDocument();
    expect(screen.getByText(/sorted back into their copies and into order/)).toBeInTheDocument();

    rerender(<QrCodeFields value={{ ...value, qrCodePages: "FIRST" }} onChange={onChange} />);
    expect(screen.getByText(/loose pages scanned together cannot be sorted/)).toBeInTheDocument();
  });
});
