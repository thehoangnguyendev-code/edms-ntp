import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getDiscrepancies = vi.fn();

vi.mock("@/services/api/documents", () => ({
  documentApi: { getControlledCopyBatchStatusDiscrepancies: (...args: unknown[]) => getDiscrepancies(...args) },
}));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/hooks/useTableDragScroll", () => ({ useTableDragScroll: () => ({ scrollerRef: { current: null }, isDragging: false, dragEvents: {} }) }));
vi.mock("@/app/navigation/backNavigation", () => ({ useBackNavigation: () => vi.fn() }));
vi.mock("@/components/ui/page/PageHeader", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));

import { ControlledCopyBatchStatusDiscrepanciesView } from "../ControlledCopyBatchStatusDiscrepanciesView";

const row = (n: number) => ({
  id: `d${n}`, batchId: `b${n}`, batchNumber: `CCB.${n}`, documentNumber: `SOP.${n}`, documentTitle: `Title ${n}`,
  expectedStatusCode: "OBSOLETED", actualStatusCode: "DISTRIBUTED",
  detectedAt: "2026-10-01T00:00:00Z", lastCheckedAt: "2026-10-02T00:00:00Z",
});

describe("ControlledCopyBatchStatusDiscrepanciesView", () => {
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: true, media: query, addEventListener: () => undefined, removeEventListener: () => undefined,
      addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    getDiscrepancies.mockReset();
    getDiscrepancies.mockResolvedValue({ data: [row(1), row(2)], pagination: { page: 1, limit: 20, total: 2, totalPages: 1 } });
  });

  const renderView = () => render(<MemoryRouter><ControlledCopyBatchStatusDiscrepanciesView /></MemoryRouter>);

  it("numbers the rows and loads the newest detection first", async () => {
    renderView();

    expect(await screen.findByRole("columnheader", { name: "No." })).toBeInTheDocument();
    expect(getDiscrepancies).toHaveBeenCalledWith(expect.objectContaining({ page: 1, sortBy: "detectedAt", sortDirection: "desc" }));
    const cells = screen.getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells).toContain("1");
    expect(cells).toContain("2");
  });

  it("asks the server to sort when a column header is clicked, and reverses on the second click", async () => {
    renderView();
    const header = await screen.findByRole("columnheader", { name: /Batch number/ });

    fireEvent.click(header);
    await waitFor(() => expect(getDiscrepancies).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: "batchNumber", sortDirection: "asc" })));
    fireEvent.click(screen.getByRole("columnheader", { name: /Batch number/ }));
    await waitFor(() => expect(getDiscrepancies).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: "batchNumber", sortDirection: "desc" })));
  });

  it("can sort by every data column", async () => {
    renderView();
    for (const [name, key] of [["Document", "document"], ["Stored status", "storedStatus"], ["Expected status", "expectedStatus"],
      ["Detected at", "detectedAt"], ["Last checked", "lastCheckedAt"]] as const) {
      fireEvent.click(await screen.findByRole("columnheader", { name: new RegExp(name) }));
      await waitFor(() => expect(getDiscrepancies).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: key })));
    }
  });
});
