import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn() }));
vi.mock("@/services/api/trainingActivities", () => ({
  trainingMandatoryTopicsApi: { list: mocks.list, save: mocks.save },
  trainingError: (e: unknown) => String((e as Error)?.message ?? e),
}));

import { MandatoryTopicsDialog } from "../MandatoryTopicsDialog";

const topic = { id: "t1", name: "General GMP", nameVi: "GMP chung", keyword: "GMP", active: true };

beforeEach(() => { vi.clearAllMocks(); mocks.list.mockResolvedValue([topic]); mocks.save.mockResolvedValue(topic); });
afterEach(() => cleanup());

describe("MandatoryTopicsDialog", () => {
  it("lists the contents and keeps Save disabled until the reason is written", async () => {
    render(<MandatoryTopicsDialog onClose={vi.fn()} />);
    await screen.findByText("General GMP");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: /Reason/ }), { target: { value: "SOP revised" } });
    expect(save.disabled).toBe(false);
  });

  it("saves the item with its reason and reloads the list", async () => {
    render(<MandatoryTopicsDialog onClose={vi.fn()} />);
    await screen.findByText("General GMP");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Reason/ }), { target: { value: "SOP revised" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith("t1", { name: "General GMP", nameVi: "GMP chung", keyword: "GMP", active: true, reason: "SOP revised" }));
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
  });

  it("shows the server's refusal and keeps the form open", async () => {
    mocks.save.mockRejectedValue(new Error("A content with this name already exists."));
    render(<MandatoryTopicsDialog onClose={vi.fn()} />);
    await screen.findByText("General GMP");
    fireEvent.click(screen.getByRole("button", { name: "New Item" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^Item\s*\*?$/ }), { target: { value: "General GMP" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Keyword/ }), { target: { value: "GMP" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Reason/ }), { target: { value: "dup" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toContain("already exists");
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });
});
