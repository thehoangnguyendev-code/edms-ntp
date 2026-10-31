import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { PaperPrintButton } from "../PaperPrintButton";

const saved = vi.hoisted(() => ({ saveBlob: vi.fn() }));
vi.mock("../trainingLabels", async (importOriginal) => ({ ...(await importOriginal<object>()), saveBlob: saved.saveBlob }));

afterEach(() => { cleanup(); saved.saveBlob.mockReset(); });

const reasonError = { response: { data: { error: { code: "TRAINING_REASON_REQUIRED" } } } };

describe("Paper print of a form for several departments", () => {
  it("saves one file for each item, named as the item says, and never a ZIP", async () => {
    const blob = new Blob(["%PDF"]);
    const items = ["Quản lý chất lượng", "Sản xuất"].map((name) => ({ key: name, load: vi.fn().mockResolvedValue(blob), fileName: () => `TRN-1-${name}.pdf` }));
    render(<ToastProvider><PaperPrintButton label="Print" items={items} /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Print" }));
    await waitFor(() => expect(saved.saveBlob).toHaveBeenCalledTimes(2));
    expect(saved.saveBlob.mock.calls.map((c) => c[1])).toEqual(["TRN-1-Quản lý chất lượng.pdf", "TRN-1-Sản xuất.pdf"]);
  });

  it("asks for the reason once and prints again only what needed it", async () => {
    const blob = new Blob(["%PDF"]);
    const first = { key: "a", load: vi.fn().mockResolvedValue(blob), fileName: () => "a.pdf" };
    const second = { key: "b", load: vi.fn().mockRejectedValueOnce(reasonError).mockResolvedValue(blob), fileName: () => "b.pdf" };
    render(<ToastProvider><PaperPrintButton label="Print" items={[first, second]} /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Print" }));
    await waitFor(() => expect(screen.getByText("Print another copy")).toBeTruthy());
    expect(saved.saveBlob).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Lost" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Print" }).at(-1) as HTMLElement);
    await waitFor(() => expect(saved.saveBlob).toHaveBeenCalledTimes(2));
    expect(first.load).toHaveBeenCalledTimes(1);
    expect(second.load).toHaveBeenLastCalledWith("pdf", "Lost");
  });
});
