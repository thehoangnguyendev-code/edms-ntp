import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ getAccessProfileUsersPage: vi.fn(), getUsersLookupPaged: vi.fn(), toast: vi.fn() }));
vi.mock("@/services/api/settings", () => ({ settingsApi: { getAccessProfileUsersPage: api.getAccessProfileUsersPage } }));
vi.mock("@/services/api/metadata", () => ({ metadataApi: { getUsersLookupPaged: api.getUsersLookupPaged } }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: api.toast }) }));
import { AccessProfileAssignedUsersTab } from "../AccessProfileAssignedUsersTab";
afterEach(() => { cleanup(); Object.values(api).forEach(f => f.mockReset()); });
it("pages existing and searched users while preserving assignments outside the current page", async () => {
  api.getAccessProfileUsersPage.mockImplementation(async (_id, page) => ({
    data: [{ id: page === 1 ? "one" : "two", fullName: page === 1 ? "Alice" : "Bob", email: null, department: null, status: "Active" }],
    assignedIds: ["one", "two"], pagination: { total: 11, totalPages: 2 },
  }));
  api.getUsersLookupPaged.mockResolvedValue({ data: [{ id: "three", fullName: "Charlie" }], pagination: { total: 1, totalPages: 1 } });
  const changed = vi.fn();
  const { container } = render(<AccessProfileAssignedUsersTab profileId="profile" onChangesChange={changed} />);
  await screen.findByText("Alice");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Bob");
  expect((container.querySelector("#profile-user-two") as HTMLInputElement).checked).toBe(true);
  fireEvent.change(screen.getByPlaceholderText("Search all users to assign…"), { target: { value: "Charlie" } });
  await screen.findByText("Charlie");
  expect(api.getUsersLookupPaged).toHaveBeenLastCalledWith(expect.objectContaining({ search: "Charlie", page: 1, limit: 10 }));
  fireEvent.click(container.querySelector("#profile-user-three")!);
  expect(changed).toHaveBeenLastCalledWith({ added: ["three"], removed: [] });
  fireEvent.change(screen.getByPlaceholderText("Search all users to assign…"), { target: { value: "" } });
  await waitFor(() => expect(screen.getByText("Charlie")).toBeTruthy());
  expect(screen.getByText("3 assigned")).toBeTruthy();
});
