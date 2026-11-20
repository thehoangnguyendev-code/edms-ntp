import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), holders: vi.fn(), modules: vi.fn() }));
vi.mock("@/services/api", () => ({ settingsApi: { listAccessExplorerPermissions: mocks.list, getAccessExplorerHolders: mocks.holders, getAccessExplorerModules: mocks.modules } }));
vi.mock("@/hooks", async (importOriginal) => ({ ...(await importOriginal<object>()), useDebounce: (v: unknown) => v }));

import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { AccessExplorerView } from "../AccessExplorerView";
import { AccessExplorerDetailView } from "../AccessExplorerDetailView";

const verify = { code: "training.paper.verify", name: "Verify Paper Training", moduleKey: "training", category: "Paper", description: "Second-person check of a transcription", permissionSetCount: 2, accessProfileCount: 4, holderCount: 3, activeHolderCount: 2 };
const orphan = { code: "reports.run.create", name: "Create Report Run", moduleKey: "reports", category: "Run", description: null, permissionSetCount: 0, accessProfileCount: 0, holderCount: 0, activeHolderCount: 0 };
const page = { content: [verify, orphan], totalElements: 2, totalPages: 1, page: 0, size: 10 };
const holders = {
  permission: verify,
  permissionSets: [{ id: "s1", code: "TP", name: "Training Paper", profiles: [{ id: "p1", code: "TRAINER", name: "Trainer", active: true, holderCount: 2 }] }],
  holders: [
    { userId: "u1", username: "ann", fullName: "Ann Nguyen", employeeCode: "E1", department: "QA", status: "Active", viaProfiles: ["Trainer"], viaPermissionSets: ["Training Paper"], lastLoginAt: "2026-11-17T03:00:00Z", timeLimitedUntil: null },
  ],
  holderCount: 3,
  activeHolderCount: 2,
  holderTotal: 1,
  totalPages: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  mocks.list.mockResolvedValue(page);
  mocks.holders.mockResolvedValue(holders);
  mocks.modules.mockResolvedValue(["reports", "training"]);
});
afterEach(() => cleanup());

const openList = () => render(
  <MemoryRouter initialEntries={["/settings/users/access-explorer"]}>
    <BreadcrumbProvider><ToastProvider>
      <Routes>
        <Route path="/settings/users/access-explorer" element={<AccessExplorerView />} />
        <Route path="/settings/users/access-explorer/:code" element={<div>detail of the chosen permission</div>} />
      </Routes>
    </ToastProvider></BreadcrumbProvider>
  </MemoryRouter>,
);
const openDetail = () => render(
  <MemoryRouter initialEntries={["/settings/users/access-explorer/training.paper.verify"]}>
    <BreadcrumbProvider>
      <ToastProvider><Routes><Route path="/settings/users/access-explorer/:code" element={<AccessExplorerDetailView />} /></Routes></ToastProvider>
    </BreadcrumbProvider>
  </MemoryRouter>,
);

describe("Access Explorer list", () => {
  it("lists the permissions with how widely each is held and says plainly when nobody holds one", async () => {
    openList();

    expect((await screen.findAllByText("Verify Paper Training")).length).toBeGreaterThan(0);
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ page: 0, size: 10, sortBy: "name", sortDir: "asc" }));
    expect(screen.getAllByText("training.paper.verify").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 with an Active account").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nobody").length).toBeGreaterThan(0);
  });

  it("asks the server again, from the first page, when the search changes", async () => {
    openList();
    await screen.findAllByText("Verify Paper Training");

    fireEvent.change(screen.getAllByPlaceholderText("Search permissions…")[0], { target: { value: "paper verify" } });

    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: "paper verify", page: 0 })));
  });

  it("opens the details of a permission from its row", async () => {
    openList();
    fireEvent.click((await screen.findAllByText("Verify Paper Training"))[0]);

    expect(await screen.findByText("detail of the chosen permission")).toBeTruthy();
  });
});

describe("Access Explorer details", () => {
  it("shows the permission, how widely it is held and who holds it through which profile and set", async () => {
    openDetail();

    expect(await screen.findByText("Ann Nguyen")).toBeTruthy();
    expect(mocks.holders).toHaveBeenCalledWith("training.paper.verify", { activeOnly: true, search: "", page: 0, size: 10 });
    expect(screen.getByRole("heading", { name: "Verify Paper Training" })).toBeTruthy();
    expect(screen.getAllByText("Trainer").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Training Paper").length).toBeGreaterThan(0);
    expect(screen.getByText("Active Accounts")).toBeTruthy();
  });

  it("shows the facts of the permission in read-only fields, like the Access Profile details", async () => {
    openDetail();
    await screen.findByText("Ann Nguyen");
    fireEvent.click(screen.getByRole("tab", { name: "General" }));

    expect(screen.getAllByText("Second-person check of a transcription").length).toBe(2);
    expect(screen.getAllByText("Paper").length).toBeGreaterThan(0);
    expect(screen.getByText(/Read only\./)).toBeTruthy();
  });

  it("asks again, including the people whose account is not Active, when that switch is turned off", async () => {
    openDetail();
    await screen.findByText("Ann Nguyen");

    fireEvent.click(screen.getByRole("switch", { name: "Only active accounts" }));

    await waitFor(() => expect(mocks.holders).toHaveBeenLastCalledWith("training.paper.verify", expect.objectContaining({ activeOnly: false, page: 0 })));
  });

  it("searches the people on the server", async () => {
    openDetail();
    await screen.findByText("Ann Nguyen");

    fireEvent.change(screen.getByLabelText("Search people"), { target: { value: "packaging" } });

    await waitFor(() => expect(mocks.holders).toHaveBeenLastCalledWith("training.paper.verify", expect.objectContaining({ search: "packaging", page: 0 })));
  });

  it("shows the permission sets and access profiles it is granted through, and the server's reason when it refuses", async () => {
    openDetail();
    await screen.findByText("Ann Nguyen");
    fireEvent.click(screen.getByRole("tab", { name: /Granted Through/ }));

    expect(screen.getAllByText("Training Paper").length).toBeGreaterThan(0);
    expect(screen.getByText("TP")).toBeTruthy();
    expect(screen.getAllByText("Trainer").length).toBeGreaterThan(0);

    cleanup();
    mocks.holders.mockRejectedValueOnce({ response: { data: { message: "Access Explorer requires permission" } } });
    openDetail();
    expect((await screen.findByRole("alert")).textContent).toContain("requires permission");
  });
});
