import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { FormDownloadButtons } from "../FormDownloadButtons";

const saved = vi.hoisted(() => ({ saveBlob: vi.fn() }));
vi.mock("../trainingLabels", async (importOriginal) => ({ ...(await importOriginal<object>()), saveBlob: saved.saveBlob }));

afterEach(() => { cleanup(); saved.saveBlob.mockReset(); });

describe("Download of the same form for several departments", () => {
  it("saves one file for each department, named by it, and never a ZIP", async () => {
    const blob = new Blob(["%PDF"]);
    const parts = ["Quản lý chất lượng", "Sản xuất"].map((name) => ({ key: name, load: vi.fn().mockResolvedValue(blob), fileName: (format: string) => `APD.0108-${name}.${format}` }));
    render(<ToastProvider><FormDownloadButtons buttonText="Self-reading List" parts={parts} /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: /Self-reading List/ }));
    fireEvent.click(await screen.findByText("PDF File (.pdf)"));
    await waitFor(() => expect(saved.saveBlob).toHaveBeenCalledTimes(2));
    expect(saved.saveBlob.mock.calls.map((c) => c[1])).toEqual(["APD.0108-Quản lý chất lượng.pdf", "APD.0108-Sản xuất.pdf"]);
    expect(parts[0].load).toHaveBeenCalledWith("pdf");
  });
});
