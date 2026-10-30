import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { TrainingMaterialsBoard, type MaterialItem, type TrainingMaterialsLayout } from "../components/TrainingMaterialsBoard";

beforeAll(() => {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

const file: MaterialItem = { id: "f1", title: "SOP slides", fileName: "sop-slides.pdf", sizeBytes: 2_516_582, sha256: "9f3c2a7b41d0e86c5a3f0b9d7e12c4a6f8b3d5e7091a2c4e6f8a0b1c3d5e7f90", addedBy: "Nguyen The Hoang (27/10/2026)" };
const link: MaterialItem = { id: "l1", title: "E2E-TEST material", linkUrl: "https://example.com/e2e", addedBy: "Nguyen The Hoang (27/10/2026)" };

function board(layout: TrainingMaterialsLayout, over: Partial<Parameters<typeof TrainingMaterialsBoard>[0]> = {}) {
  const props = { layout, items: [file, link], canAdd: true, canRemove: true, emptyText: "No material yet.", onAddFile: vi.fn(() => true), onAddLink: vi.fn(() => true), onRemove: vi.fn(), onPreview: vi.fn(), onDownload: vi.fn(), ...over };
  render(<TrainingMaterialsBoard {...props} />);
  return props;
}

function menuOf_link(layout: TrainingMaterialsLayout) {
  fireEvent.click(screen.getByRole("button", { name: "More actions for E2E-TEST material" }));
  // a table row has only the menu; a tile has the Open button, so its menu keeps the other actions
  expect(screen.queryAllByText("Open")).toHaveLength(1);
  expect(screen.queryByText("Download")).toBeNull();
}

describe.each<TrainingMaterialsLayout>(["TABLE", "TILES"])("the materials board as %s", (layout) => {
  it("says what each material is, with the same facts in both layouts", () => {
    board(layout);
    expect(screen.getByText("SOP slides")).toBeTruthy();
    expect(screen.getByText(/sop-slides\.pdf · 2\.4 MB/)).toBeTruthy();
    expect(screen.getByText(/SHA-256 9f3c2a7b41d0…5e7f90/)).toBeTruthy();
    expect(screen.getByText("example.com/e2e")).toBeTruthy();
    // a link is never fingerprinted and is always marked as not a controlled file
    expect(screen.getAllByText("Link, not a controlled file")).toHaveLength(1);
    expect(screen.getAllByText(/SHA-256/)).toHaveLength(1);
    expect(screen.getByText("2 materials")).toBeTruthy();
  });

  it("offers each action once: the menu of a row, and on a tile also the one main button", () => {
    const props = board(layout);
    const menuOf = (title: string) => fireEvent.click(screen.getByRole("button", { name: `More actions for ${title}` }));
    if (layout === "TABLE") {
      menuOf("SOP slides");
      fireEvent.click(screen.getByText("Preview"));
    } else {
      fireEvent.click(screen.getByRole("button", { name: /Preview/ }));
      menuOf("SOP slides");
      expect(screen.getAllByText("Preview")).toHaveLength(1); // the main button only: the menu does not say it again
    }
    expect(props.onPreview).toHaveBeenCalledWith(file);
    if (layout === "TABLE") menuOf("SOP slides");
    fireEvent.click(screen.getByText("Download"));
    expect(props.onDownload).toHaveBeenCalledWith(file);
    menuOf("SOP slides");
    fireEvent.click(screen.getByText("Remove"));
    expect(props.onRemove).toHaveBeenCalledWith(file);
  });

  it("never says Open twice for a link", () => {
    board(layout);
    menuOf_link(layout);
  });

  it("is locked as one: no add, no remove, and it says why", () => {
    board(layout, { canAdd: false, canRemove: false, lockedNote: "Materials can be added or removed in the planning step." });
    expect(screen.queryByRole("button", { name: /Add material|Add link/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "More actions for SOP slides" }));
    expect(screen.queryByText("Remove")).toBeNull();
    expect(screen.getByText("Download")).toBeTruthy();
    expect(screen.getByText("Materials can be added or removed in the planning step.")).toBeTruthy();
    // nothing to put in the menu of a link on a tile (its one action is the button): no dead control
    if (layout === "TILES") expect(screen.queryByRole("button", { name: "More actions for E2E-TEST material" })).toBeNull();
    else expect(screen.getByRole("button", { name: "More actions for E2E-TEST material" })).toBeTruthy();
  });

  it("marks a material that waits for the save and has no file to open yet", () => {
    board(layout, { items: [{ id: "s1", title: "Slides", fileName: "slides.pptx", sizeBytes: 1024, staged: true }] });
    expect(screen.getByText("Not saved yet")).toBeTruthy();
    expect(screen.getByText("Saved with the activity")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "More actions for Slides" }));
    expect(screen.queryByText("Download")).toBeNull();
    expect(screen.getByText("Remove")).toBeTruthy();
  });

  it("says why it is empty", () => {
    board(layout, { items: [] });
    expect(screen.getByText("No material yet.")).toBeTruthy();
    expect(screen.getByText("0 materials")).toBeTruthy();
  });
});

describe("the two layouts", () => {
  it("the table has the numbered column of the other tables", () => {
    board("TABLE");
    expect(screen.getByText("No.")).toBeTruthy();
    expect(screen.getByText("Uploaded by")).toBeTruthy();
  });

  it("a tile has the one button a person most likely wants", () => {
    const props = board("TILES");
    fireEvent.click(screen.getByRole("button", { name: /Preview/ }));
    expect(props.onPreview).toHaveBeenCalledWith(file);
    expect(screen.getByRole("button", { name: /Open/ })).toBeTruthy();
  });
});

describe("where the add area is", () => {
  it("the table opens it from one button, the tiles show it on top", () => {
    board("TABLE");
    expect(screen.queryByText("Upload file")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Add material/ }));
    expect(screen.getByText("Upload file")).toBeTruthy();
  });

  it("the tiles show it without a click", () => {
    board("TILES");
    expect(screen.getByText("Upload file")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add material" })).toBeTruthy();
  });
});
