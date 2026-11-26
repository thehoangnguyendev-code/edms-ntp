import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const page = vi.hoisted(() => vi.fn());
vi.mock("@/services/api/trainingActivities", () => ({ trainingMatrixApi: { positionsPage: page } }));

import { WorkPositionChecklist } from "../WorkPositionChecklist";

const row = { id: "r1", code: "QA-01", name: "QA Officer", departmentId: "d1", departmentName: "Quality Assurance" };

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
  page.mockReset().mockResolvedValue({ data: [row], departments: [{ id: "d1", name: "Quality Assurance" }], pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("WorkPositionChecklist", () => {
  it("has a visible label for the search and the filter, and asks the server for a page without the held ones", async () => {
    const onToggle = vi.fn();
    render(<WorkPositionChecklist selectedIds={[]} excludedIds={["h1", "h2"]} onToggle={onToggle} />);

    fireEvent.click(await screen.findByRole("checkbox", { name: /QA Officer/ }));
    expect(onToggle).toHaveBeenCalledWith(row);
    expect(screen.getByLabelText("Search")).toBeTruthy();
    expect(screen.getByText("Department")).toBeTruthy();
    expect(page).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20, exclude: "h1,h2", search: undefined, departmentId: undefined }));
  });

  it("sends the search and the next page to the server", async () => {
    render(<WorkPositionChecklist selectedIds={[]} excludedIds={[]} onToggle={vi.fn()} />);
    await screen.findByRole("checkbox", { name: /QA Officer/ });

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await waitFor(() => expect(page).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })));
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "officer" } });
    await waitFor(() => expect(page).toHaveBeenLastCalledWith(expect.objectContaining({ search: "officer", page: 1 })));
  });

  it("says when the list could not be loaded", async () => {
    page.mockRejectedValue(new Error("down"));
    render(<WorkPositionChecklist selectedIds={[]} excludedIds={[]} onToggle={vi.fn()} />);
    expect(await screen.findByText(/The Work Positions could not be loaded/)).toBeTruthy();
  });
});
