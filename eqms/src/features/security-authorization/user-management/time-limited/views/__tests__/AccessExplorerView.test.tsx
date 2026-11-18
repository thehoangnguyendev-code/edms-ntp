import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ search: vi.fn(), holders: vi.fn() }));
vi.mock("@/services/api", () => ({ settingsApi: { searchAccessExplorerPermissions: mocks.search, getAccessExplorerHolders: mocks.holders } }));
vi.mock("@/hooks", async (importOriginal) => ({ ...(await importOriginal<object>()), useDebounce: (v: unknown) => v }));

import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { AccessExplorerView } from "../AccessExplorerView";

const verify = { code: "training.paper.verify", name: "Verify Paper Training", moduleKey: "training", category: "Paper", description: "Second-person check of a transcription" };
const holders = {
  permission: verify,
  permissionSets: [{ id: "s1", code: "TP", name: "Training Paper", profiles: [{ id: "p1", code: "TRAINER", name: "Trainer", active: true, holderCount: 2 }] }],
  holders: [
    { userId: "u1", username: "ann", fullName: "Ann Nguyen", employeeCode: "E1", department: "QA", status: "Active", viaProfiles: ["Trainer"], viaPermissionSets: ["Training Paper"], lastLoginAt: "2026-11-17T03:00:00Z", timeLimitedUntil: null },
  ],
  holderCount: 2,
  activeHolderCount: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  mocks.search.mockResolvedValue([verify, { code: "reports.run.create", name: "Create Report Run", moduleKey: "reports" }]);
  mocks.holders.mockResolvedValue(holders);
});
afterEach(() => cleanup());

const open = () => render(<MemoryRouter><BreadcrumbProvider><AccessExplorerView /></BreadcrumbProvider></MemoryRouter>);

describe("Access Explorer", () => {
  it("lists the permissions to choose from and asks for nothing about people until one is chosen", async () => {
    open();

    expect(await screen.findByText("Verify Paper Training")).toBeTruthy();
    expect(screen.getByText(/Choose a permission to see who holds it/)).toBeTruthy();
    expect(mocks.holders).not.toHaveBeenCalled();
  });

  it("shows who holds the chosen permission and through which access profile and permission set", async () => {
    open();
    fireEvent.click(await screen.findByRole("option", { name: /Verify Paper Training/ }));

    expect(await screen.findByText("Ann Nguyen")).toBeTruthy();
    expect(mocks.holders).toHaveBeenCalledWith("training.paper.verify", true);
    expect(screen.getByText("Training Paper", { selector: "p" })).toBeTruthy();
    expect(screen.getByText(/Trainer \(2\)/)).toBeTruthy();
    expect(screen.getByText("1 with an Active account")).toBeTruthy();
    expect(screen.getAllByText("Trainer").length).toBeGreaterThan(0);
  });

  it("asks again, including the people whose account is not Active, when that switch is turned off", async () => {
    open();
    fireEvent.click(await screen.findByRole("option", { name: /Verify Paper Training/ }));
    await screen.findByText("Ann Nguyen");

    fireEvent.click(screen.getByRole("switch", { name: "Only active accounts" }));

    await waitFor(() => expect(mocks.holders).toHaveBeenLastCalledWith("training.paper.verify", false));
  });

  it("says plainly that nobody holds a permission no active set contains, and shows the server's reason when it refuses", async () => {
    mocks.holders.mockResolvedValueOnce({ ...holders, permissionSets: [], holders: [], holderCount: 0, activeHolderCount: 0 });
    open();
    fireEvent.click(await screen.findByRole("option", { name: /Verify Paper Training/ }));
    expect(await screen.findByText(/No active permission set contains this permission/)).toBeTruthy();

    mocks.holders.mockRejectedValueOnce({ response: { data: { message: "Access Explorer requires permission" } } });
    fireEvent.click(screen.getByRole("option", { name: /Create Report Run/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("requires permission");
  });
});
