import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ catalog: vi.fn(), paged: vi.fn() }));

vi.mock("@/services/api/settings", () => ({
  settingsApi: { getPermissionCatalog: mocks.catalog, getPermissionCatalogPaged: mocks.paged },
}));
vi.mock("@/components/ui/table/useTableColumnPreferences", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/table/useTableColumnPreferences")>("@/components/ui/table/useTableColumnPreferences");
  return { ...actual, useTableColumnPreferences: (_key: string, defaults: unknown[]) => ({ columns: defaults, saveColumns: vi.fn(), resetColumns: vi.fn() }) };
});

vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
import { PermissionCatalogTab } from "../PermissionCatalogTab";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  mocks.catalog.mockResolvedValue([]);
  mocks.paged.mockResolvedValue({
    data: [{ code: "audit.export", name: "Export Audit Trail", module: "audit-trail", groupName: "Audit Trail", description: "Export the audit trail.", audited: true, lifecycleUsage: [] }],
    pagination: { total: 1, totalPages: 1 },
  });
});

describe("Permission catalog: Custom Column", () => {
  it("sits in the filter row, next to Clear Filters, like on every other list, and not in a row of its own above the table", async () => {
    render(<PermissionCatalogTab />);

    const customColumn = await screen.findByRole("button", { name: /Custom Column/ });
    const clearFilters = screen.getByRole("button", { name: "Clear Filters" });
    expect(customColumn.parentElement).toBe(clearFilters.parentElement);

    // The table has no toolbar row: the header of the table is the first thing in its card.
    const table = screen.getByRole("table");
    expect(table.closest("div[class*='overflow']")?.parentElement?.contains(customColumn)).toBe(false);
    expect(await screen.findByText("audit.export")).toBeInTheDocument();
  });
});
