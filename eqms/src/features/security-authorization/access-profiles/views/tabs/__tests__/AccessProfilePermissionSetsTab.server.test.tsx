import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getPermissionCatalog: vi.fn(), getAccessProfileEditorSummary: vi.fn(), listPermissionSetsPaged: vi.fn() }));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/services/api/settings", () => ({ settingsApi: api }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: toast }) }));
import { PermissionSetsTab } from "../AccessProfilePermissionSetsTab";

afterEach(() => { cleanup(); Object.values(api).forEach(f => f.mockReset()); });
it("queries each server page and retains the complete pending assignment diff across pages", async () => {
  api.getPermissionCatalog.mockResolvedValue([]);
  api.getAccessProfileEditorSummary.mockResolvedValue({ profile: { permissionSets: [{ id: "one", code: "SET_ONE" }, { id: "managed", code: "ROLE_PROFILE" }] }, assignedUserIds: [] });
  api.listPermissionSetsPaged.mockImplementation(async ({ page }: { page: number }) => ({
    data: [{ id: page === 1 ? "one" : "two", name: page === 1 ? "First Set" : "Second Set", code: page === 1 ? "SET_ONE" : "SET_TWO", permissionCount: 0, system: false, permissionCodes: [] }],
    pagination: { total: 11, totalPages: 2 },
  }));
  const changed = vi.fn();
  const { container } = render(<MemoryRouter><PermissionSetsTab profileId="p1" onOpenDrawer={vi.fn()} onChangesChange={changed} /></MemoryRouter>);
  await screen.findByText("First Set");
  expect((container.querySelector("#profile-ps-one") as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Second Set");
  fireEvent.click(container.querySelector("#profile-ps-two")!);
  expect(changed).toHaveBeenLastCalledWith({ added: ["two"], removed: [] });
  fireEvent.change(screen.getByPlaceholderText("Search permission sets…"), { target: { value: "server-query" } });
  await waitFor(() => expect(api.listPermissionSetsPaged).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, limit: 10, search: "server-query" })));
  expect(changed).toHaveBeenLastCalledWith({ added: ["two"], removed: [] });
});

it("read-only details list only this profile's sets from the server, with no tick boxes, and open the drawer from the row", async () => {
  api.getAccessProfileEditorSummary.mockResolvedValue({ profile: { permissionSets: [{ id: "one", code: "SET_ONE" }] }, assignedUserIds: [] });
  api.listPermissionSetsPaged.mockResolvedValue({
    data: [{ id: "one", name: "First Set", code: "SET_ONE", permissionCount: 2, system: false, permissionCodes: [], modules: ["training"] }],
    pagination: { total: 1, totalPages: 1 },
  });
  const onOpenDrawer = vi.fn();
  const { container } = render(<MemoryRouter><PermissionSetsTab profileId="p1" canAssign={false} onOpenDrawer={onOpenDrawer} /></MemoryRouter>);
  await screen.findByText("First Set");
  expect(api.listPermissionSetsPaged).toHaveBeenLastCalledWith(expect.objectContaining({ accessProfileId: "p1" }));
  expect(container.querySelector("#profile-ps-one")).toBeNull();
  fireEvent.click(screen.getByText("First Set"));
  expect(onOpenDrawer).toHaveBeenCalledWith(expect.objectContaining({ id: "one" }));
  fireEvent.click(screen.getByText("Name"));
  await waitFor(() => expect(api.listPermissionSetsPaged).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: "name", sortDir: "desc" })));
});
