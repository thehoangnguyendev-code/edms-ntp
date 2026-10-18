import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";

const api = vi.hoisted(() => ({ topicsPage: vi.fn(), saveTopic: vi.fn() }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api/trainingActivities")>()),
  trainingMatrixApi: api,
}));
vi.mock("@/services/api/dictionary", () => ({ dictionaryApi: { getDepartments: vi.fn(async () => []) } }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => true }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { TrainingTopicsView } from "../TrainingTopicsView";

const topic = (code: string, name: string, extra: Record<string, unknown> = {}) => ({
  id: `id-${code}`, code, name, scope: "FACTORY_GENERAL", departmentId: null, departmentName: null, active: true, version: 1, ...extra,
});

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
  api.topicsPage.mockReset();
  api.topicsPage.mockResolvedValue({
    data: [topic("GMP", "Good Manufacturing Practice"), topic("SAFETY", "Workplace safety", { active: false })],
    pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("TrainingTopicsView", () => {
  it("lists the topics the server returned, with the same header, filters and New Topic action as Document Types", async () => {
    render(
      <BreadcrumbProvider>
        <MemoryRouter>
          <TrainingTopicsView />
        </MemoryRouter>
      </BreadcrumbProvider>,
    );

    expect(await screen.findByText("Good Manufacturing Practice")).toBeTruthy();
    expect(screen.getByText("Workplace safety")).toBeTruthy();
    expect(screen.getByRole("button", { name: /New Training Topic/ })).toBeTruthy();
    expect(screen.getByText("Inactive")).toBeTruthy();
    // The search box and the Scope/Status filters are on the page, not only the Clear Filters and column controls.
    expect(screen.getAllByPlaceholderText("Search training topics...").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Scope").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Status").length).toBeGreaterThan(0);
    await waitFor(() => expect(api.topicsPage).toHaveBeenCalledWith(expect.objectContaining({ sortDirection: "asc" })));
  });
});
