import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TrainingMaterialsReader } from "../components/TrainingMaterialsReader";
import type { MaterialItem } from "../components/TrainingMaterialsBoard";

const items: MaterialItem[] = [
  { id: "m1", title: "SOP slides", fileName: "sop.pdf", sizeBytes: 2048, sha256: "a".repeat(64), addedBy: "Nguyen A (27/10/2026)" },
  { id: "m2", title: "Safety video", fileName: "safety.mp4", sizeBytes: 5242880, sha256: "b".repeat(64), addedBy: "Nguyen A (27/10/2026)" },
  { id: "m3", title: "YouTube lesson", linkUrl: "https://www.youtube.com/watch?v=1", addedBy: "Tran B (28/10/2026)" },
  { id: "m4", title: "Old deck", fileName: "old.pdf", removedAt: "29/10/2026", removeReason: "Superseded" },
];

const setPhone = (phone: boolean) => {
  window.matchMedia = ((q: string) => ({ matches: phone && q.includes("1023px"), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() })) as never;
};

describe("Materials reader (Session Workspace, step 3)", () => {
  beforeEach(() => setPhone(false));

  it("shows the first material that is not removed, with Preview and Download for a PDF", () => {
    const onPreview = vi.fn();
    const onDownload = vi.fn();
    render(<TrainingMaterialsReader items={items} emptyText="none" onPreview={onPreview} onDownload={onDownload} />);
    const panel = screen.getByRole("complementary", { name: "Selected material" });
    expect(panel.textContent).toContain("SOP slides");
    expect(panel.textContent).toContain("a".repeat(64));
    fireEvent.click(screen.getAllByRole("button", { name: /Preview/ })[0]);
    expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({ id: "m1" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Download/ })[0]);
    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ id: "m1" }));
  });

  it("offers Download alone for a video, and Open with the link warning for a link", () => {
    render(<TrainingMaterialsReader items={items} emptyText="none" onPreview={vi.fn()} onDownload={vi.fn()} />);
    fireEvent.click(screen.getByText("Safety video"));
    const panel = screen.getByRole("complementary", { name: "Selected material" });
    expect(panel.querySelector("button")?.textContent).toContain("Download");
    expect(panel.textContent).not.toContain("Preview");
    fireEvent.click(screen.getByText("YouTube lesson"));
    expect(screen.getByRole("complementary", { name: "Selected material" }).textContent).toContain("Link, not a controlled file");
    expect(screen.getByRole("button", { name: /Open/ })).toBeTruthy();
  });

  it("keeps a removed material in the list with its reason and no buttons", () => {
    render(<TrainingMaterialsReader items={items} emptyText="none" onPreview={vi.fn()} onDownload={vi.fn()} />);
    fireEvent.click(screen.getByText("Old deck"));
    const panel = screen.getByRole("complementary", { name: "Selected material" });
    expect(panel.textContent).toContain("Removed 29/10/2026: Superseded");
    expect(panel.querySelectorAll("button")).toHaveLength(0);
  });

  it("opens the facts in a sheet on a phone", async () => {
    setPhone(true);
    render(<TrainingMaterialsReader items={items} emptyText="none" onPreview={vi.fn()} onDownload={vi.fn()} />);
    fireEvent.click(screen.getByText("Safety video"));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("says why the list is empty", () => {
    render(<TrainingMaterialsReader items={[]} emptyText="No material is needed for this training." />);
    expect(screen.getByText("No material is needed for this training.")).toBeTruthy();
  });
});
