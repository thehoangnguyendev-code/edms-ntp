import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { TrainingCodeRulesView } from "../TrainingCodeRulesView";

const permissions = vi.hoisted(() => ({ manage: true }));
const page = (data: unknown[]) => ({ data, pagination: { page: 1, limit: 10, total: data.length, totalPages: 1 } });
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => permissions.manage }) }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/services/api/trainingActivities", () => ({
  trainingError: (e: unknown) => String(e),
  trainingCodeRulesApi: {
    list: vi.fn(async (_params?: Record<string, unknown>) => page([
      { entity: "REQUIREMENT", label: "Training Requirement", pattern: "TRQ/{YYYY}-{SEQ:3}", example: "TRQ/2026-001", version: 1, updatedAt: null, updatedByName: null },
      { entity: "MATRIX", label: "Training Matrix", pattern: "TMX/{DEPT}", example: "TMX/QA", version: 2, updatedAt: "2026-10-01T03:00:00Z", updatedByName: "An Nguyen" },
      { entity: "ASSESSMENT", label: "Training Assessment", pattern: "TAS-{SEQ:4}", example: "TAS-0001", version: 1, updatedAt: null, updatedByName: null },
    ])),
    preview: vi.fn(async () => ({ example: "TRQ/2026-002" })),
    update: vi.fn(),
  },
}));

const renderView = () => render(<MemoryRouter><BreadcrumbProvider><TrainingCodeRulesView /></BreadcrumbProvider></MemoryRouter>);

describe("TrainingCodeRulesView", () => {
  beforeEach(() => {
    permissions.manage = true;
    window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
    window.matchMedia = ((query: string) => ({
      matches: true, media: query, addEventListener: () => undefined, removeEventListener: () => undefined,
      addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });

  it("lists the three rules as a table, numbered, with the pattern and the next code", async () => {
    renderView();
    expect(await screen.findByText("TRQ/{YYYY}-{SEQ:3}")).toBeInTheDocument();
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent?.trim());
    expect(headers).toEqual(expect.arrayContaining(["No.", "Code Of", "Pattern", "Next Code Looks Like", "Last Changed", "Notes"]));
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect(screen.getByText("TMX/QA")).toBeInTheDocument();
    expect(screen.getAllByText("Default rule")).toHaveLength(2);
    expect(screen.getByText(/SOP.0003 sets the rule of the Training Number only/)).toBeInTheDocument();
  });

  it("asks the server for the search and the filter, sorted and paged", async () => {
    const { trainingCodeRulesApi } = await import("@/services/api/trainingActivities");
    renderView();
    await screen.findByText("TRQ/{YYYY}-{SEQ:3}");
    expect(trainingCodeRulesApi.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 10, sortBy: "entity" }));
    fireEvent.change(screen.getAllByPlaceholderText(/Search code, pattern/)[0], { target: { value: "tmx" } });
    await waitFor(() => expect(trainingCodeRulesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: "tmx", page: 1 })));
  });

  it("opens the rule in the edit window from the row menu", async () => {
    renderView();
    await screen.findByText("TMX/{DEPT}");
    const row = screen.getByText("TMX/{DEPT}").closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "More actions" }));
    fireEvent.click(await screen.findByText("Edit Rule"));
    await waitFor(() => expect(screen.getByLabelText("Pattern")).toHaveValue("TMX/{DEPT}"));
  });

  it("shows no row menu without the permission to manage", async () => {
    permissions.manage = false;
    renderView();
    await screen.findByText("TRQ/{YYYY}-{SEQ:3}");
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
  });
});
