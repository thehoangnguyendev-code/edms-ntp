import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "@/app/routes.constants";
import { AccessProfilePermissionSetModal } from "../AccessProfilePermissionSetModal";

const api = vi.hoisted(() => ({ getPermissionSetPermissions: vi.fn(), navigate: vi.fn() }));
vi.mock("@/services/api/settings", () => ({ settingsApi: api }));
vi.mock("@/services/api/navigation", () => ({ navigationApi: { getNavigation: () => Promise.reject(new Error("offline")) } }));
vi.mock("react-router-dom", async (original) => ({ ...(await original<typeof import("react-router-dom")>()), useNavigate: () => api.navigate }));

const row = (n: number, over: Record<string, unknown> = {}) => ({
  code: `documents.thing${n}.view`, name: `Thing ${n}`, description: `Description ${n}`, module: "documents", requiresAudit: false, lifecycleUsages: [], ...over,
});
const answer = (rows: ReturnType<typeof row>[], total = rows.length, page = 1) => ({
  data: rows,
  pagination: { page, limit: 10, total, totalPages: Math.max(1, Math.ceil(total / 10)) },
  modules: [{ module: "documents", count: total }, { module: "report", count: 2 }],
});
const ps = { id: "set-a", name: "Read only", description: "Assigned permissions" } as never;
const renderModal = (onClose = vi.fn()) => render(<MemoryRouter><AccessProfilePermissionSetModal ps={ps} onClose={onClose} /></MemoryRouter>);

beforeEach(() => api.getPermissionSetPermissions.mockResolvedValue(answer([row(1), row(2)])));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Permission Set dialog: search, filter and paging are done by the server", () => {
  it("asks the server for the first ten and shows them with a No. column", async () => {
    renderModal();
    expect(screen.getByRole("dialog", { name: "Permission Set: Read only" })).toBeInTheDocument();
    await screen.findByText("Thing 1");
    expect(api.getPermissionSetPermissions).toHaveBeenCalledWith("set-a", { page: 1, limit: 10, search: undefined, module: undefined });
    expect(screen.getByText("No.")).toBeInTheDocument();
    expect(screen.getByLabelText("Search permissions")).toBeInTheDocument();
  });

  it("sends the typed search to the server and goes back to the first page", async () => {
    renderModal();
    await screen.findByText("Thing 1");
    fireEvent.change(screen.getByLabelText("Search permissions"), { target: { value: "reports" } });
    await waitFor(() => expect(api.getPermissionSetPermissions).toHaveBeenLastCalledWith("set-a", { page: 1, limit: 10, search: "reports", module: undefined }));
  });

  it("asks for the next page from the server instead of cutting the list itself", async () => {
    api.getPermissionSetPermissions.mockResolvedValue(answer(Array.from({ length: 10 }, (_, i) => row(i + 1)), 25));
    renderModal();
    await screen.findByText("Thing 1");
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    await waitFor(() => expect(api.getPermissionSetPermissions).toHaveBeenLastCalledWith("set-a", { page: 2, limit: 10, search: undefined, module: undefined }));
  });

  it("has the main button Open Permission Sets, which goes to the list", async () => {
    const onClose = vi.fn();
    renderModal(onClose);
    await screen.findByText("Thing 1");
    fireEvent.click(screen.getByRole("button", { name: "Open Permission Sets" }));
    expect(api.navigate).toHaveBeenCalledWith(ROUTES.SECURITY.PERMISSION_SETS);
  });

  it("says so when the search finds nothing", async () => {
    api.getPermissionSetPermissions.mockResolvedValue({ ...answer([], 0), modules: [] });
    renderModal();
    expect(await screen.findByText("No permissions assigned")).toBeInTheDocument();
  });
});
