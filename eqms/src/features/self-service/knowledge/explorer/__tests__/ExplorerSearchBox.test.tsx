import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const { api } = vi.hoisted(() => ({ api: { suggest: vi.fn() } }));
vi.mock("@/services/api/knowledge", () => ({ knowledgeApi: api }));

import { ExplorerSearchBox } from "../ExplorerSearchBox";

const suggestion = (id: string, number: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, documentNumber: number, documentName: name, revisionNumber: "1.0", documentType: "SOP", department: "Quality Control", ...extra,
});

const Harness: React.FC<{ onSubmit?: () => void; onOpen?: (s: unknown) => void }> = ({ onSubmit = () => undefined, onOpen = () => undefined }) => {
  const [value, setValue] = useState("");
  return <ExplorerSearchBox value={value} onChange={setValue} inputRef={() => undefined} onSubmit={onSubmit} onOpenSuggestion={onOpen} />;
};

const box = () => screen.getByRole("combobox", { name: "Search all documents" });
const type = (text: string) => fireEvent.change(box(), { target: { value: text } });

describe("ExplorerSearchBox (auto-complete)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.suggest.mockResolvedValue([suggestion("d1", "SOP.0001", "Balance calibration"), suggestion("d2", "SOP.0002", "Balance cleaning")]);
  });

  it("asks the server only after a pause and only for two characters or more", async () => {
    render(<Harness />);
    type("b");
    await new Promise((r) => setTimeout(r, 400));
    expect(api.suggest).not.toHaveBeenCalled();
    type("ba");
    type("bal");
    expect(api.suggest).not.toHaveBeenCalled();
    await waitFor(() => expect(api.suggest).toHaveBeenCalledTimes(1));
    expect(api.suggest).toHaveBeenCalledWith("bal", expect.any(AbortSignal));
  });

  it("lists what the server returned and nothing else, with the last row searching everything", async () => {
    render(<Harness />);
    type("bal");
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0].textContent).toContain("Balance calibration");
    expect(options[0].textContent).toContain("SOP.0001");
    expect(options[0].textContent).toContain("Quality Control");
    expect(options[2].textContent).toContain('Search all documents for "bal"');
  });

  it("says plainly that nothing the user may open matches, and never names a document", async () => {
    api.suggest.mockResolvedValue([]);
    render(<Harness />);
    type("secret");
    expect(await screen.findByText('No document you can open matches "secret".')).toBeTruthy();
    expect(screen.queryByText(/SOP\./)).toBeNull();
  });

  it("opens the highlighted suggestion with the arrow keys and Enter", async () => {
    const onOpen = vi.fn();
    render(<Harness onOpen={onOpen} />);
    type("bal");
    await screen.findAllByRole("option");
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    expect(box().getAttribute("aria-activedescendant")).toMatch(/-1$/);
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "d2", documentNumber: "SOP.0002" }));
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });

  it("opens a suggestion with a click", async () => {
    const onOpen = vi.fn();
    render(<Harness onOpen={onOpen} />);
    type("bal");
    fireEvent.click((await screen.findAllByRole("option"))[0]);
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "d1" }));
  });

  it("searches everything on Enter when no suggestion is highlighted, and on the last row", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    type("bal");
    await screen.findAllByRole("option");
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    type("bala");
    const options = await screen.findAllByRole("option");
    fireEvent.click(options[options.length - 1]);
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("closes the list with the first Escape and keeps the text", async () => {
    render(<Harness />);
    type("bal");
    await screen.findByRole("listbox");
    fireEvent.keyDown(box(), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect((box() as HTMLInputElement).value).toBe("bal");
  });

  it("falls back to the normal search when suggestions fail", async () => {
    api.suggest.mockRejectedValue(new Error("boom"));
    render(<Harness />);
    type("bal");
    expect(await screen.findByText(/Suggestions are not available right now/)).toBeTruthy();
  });

  it("shows no list for text that is too short or when the box is cleared", async () => {
    render(<Harness />);
    type("b");
    expect(screen.queryByRole("listbox")).toBeNull();
    type("bal");
    await screen.findByRole("listbox");
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
