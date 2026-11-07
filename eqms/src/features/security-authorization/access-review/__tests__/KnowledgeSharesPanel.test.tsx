import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, waitFor, fireEvent, within } from "@testing-library/react";

const stableToast = { showToast: vi.fn() };
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => stableToast }));

const permissions = vi.hoisted(() => ({ canRevoke: true }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermissionAlias: () => permissions.canRevoke }) }));

const { sharesApi, metadataApiMock } = vi.hoisted(() => ({
  sharesApi: {
    list: vi.fn(),
    revoke: vi.fn(async () => undefined),
    searchUsers: vi.fn(async () => []),
    searchDocuments: vi.fn(async () => []),
    explain: vi.fn(),
  },
  metadataApiMock: { getDepartments: vi.fn(async () => [{ id: "d1", name: "Quality Control", code: "QC" }]) },
}));
vi.mock("@/services/api/knowledgeShares", () => ({ knowledgeSharesApi: sharesApi }));
vi.mock("@/services/api/metadata", () => ({ metadataApi: metadataApiMock }));

import { KnowledgeSharesPanel } from "../KnowledgeSharesPanel";
import { CheckKnowledgeAccessModal } from "../CheckKnowledgeAccessModal";

const row = (id: string, extra: Record<string, unknown> = {}) => ({
  ruleId: id,
  departmentId: "d1",
  departmentName: "Quality Control",
  scopeKind: "DEPARTMENT",
  scopeLabel: "Whole Department",
  effect: "ALLOW",
  grantees: ["Everyone in Quality Control"],
  createdBy: "Head Of QC",
  createdAt: "2026-11-03T03:00:00Z",
  active: true,
  ...extra,
});

const page = (rows: unknown[]) => ({ data: rows, pagination: { page: 1, limit: 10, total: rows.length, totalPages: 1 } });

beforeEach(() => {
  vi.clearAllMocks();
  permissions.canRevoke = true;
  window.matchMedia = ((query: string) => ({
    matches: true, media: query, addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  sharesApi.list.mockResolvedValue(page([row("r1"), row("r2", { effect: "DENY", scopeLabel: "Document: SOP.0001", grantees: ["Nguyen Van A"] })]));
});
afterEach(cleanup);

const headers = () => screen.getAllByRole("columnheader").map((h) => h.textContent?.trim());

describe("KnowledgeSharesPanel", () => {
  it("lists every share in a table that starts with the common No. column", async () => {
    render(<KnowledgeSharesPanel />);
    expect(await screen.findByText("Whole Department")).toBeTruthy();
    expect(screen.getByText("Document: SOP.0001")).toBeTruthy();
    expect(screen.getByText("Everyone in Quality Control")).toBeTruthy();
    expect(screen.getByText("Shared")).toBeTruthy();
    expect(screen.getByText("Excluded")).toBeTruthy();
    expect(headers().slice(0, 4)).toEqual(["No.", "Department", "Shared item", "Effect"]);
    const bodyRows = screen.getAllByRole("row").slice(1);
    expect(within(bodyRows[0]).getAllByRole("cell")[0].textContent).toBe("1");
    expect(within(bodyRows[1]).getAllByRole("cell")[0].textContent).toBe("2");
    expect(sharesApi.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 10, sortBy: "createdAt", sortDir: "desc" }));
  });

  it("does not offer Check access here: it is in the page title", async () => {
    render(<KnowledgeSharesPanel />);
    await screen.findByText("Whole Department");
    expect(screen.queryByRole("button", { name: "Check access" })).toBeNull();
  });

  it("sorts on the server when a header is pressed and flips the direction on the second press", async () => {
    render(<KnowledgeSharesPanel />);
    await screen.findByText("Whole Department");
    const departmentHeader = () => screen.getAllByRole("columnheader").find((h) => h.textContent?.trim() === "Department")!;
    fireEvent.click(departmentHeader());
    await waitFor(() => expect(sharesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: "department", sortDir: "asc", page: 1 })));
    fireEvent.click(departmentHeader());
    await waitFor(() => expect(sharesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: "department", sortDir: "desc" })));
  });

  it("searches on the server and says so when nothing matches", async () => {
    render(<KnowledgeSharesPanel />);
    await screen.findByText("Whole Department");
    sharesApi.list.mockResolvedValue(page([]));
    fireEvent.change(screen.getAllByLabelText("Search shares")[0], { target: { value: "zzz" } });
    await waitFor(() => expect(sharesApi.list).toHaveBeenCalledWith(expect.objectContaining({ search: "zzz", page: 1 })));
    expect(await screen.findByText("No share matches the filters")).toBeTruthy();
  });

  it("says so when nobody has shared anything", async () => {
    sharesApi.list.mockResolvedValue(page([]));
    render(<KnowledgeSharesPanel />);
    expect(await screen.findByText("No share yet")).toBeTruthy();
  });

  it("removes a share on behalf of the Department Head after a confirmation", async () => {
    render(<KnowledgeSharesPanel />);
    await screen.findByText("Whole Department");
    fireEvent.click(screen.getByRole("button", { name: "Actions for the share of Whole Department" }));
    fireEvent.click(await screen.findByText("Remove this share"));
    const buttons = await screen.findAllByRole("button", { name: "Remove" });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(sharesApi.revoke).toHaveBeenCalledWith("r1"));
    await waitFor(() => expect(sharesApi.list.mock.calls.length).toBeGreaterThan(1));
  });

  it("offers no removal to someone who may only view", async () => {
    permissions.canRevoke = false;
    render(<KnowledgeSharesPanel />);
    await screen.findByText("Whole Department");
    expect(screen.queryByRole("button", { name: /Actions for the share/ })).toBeNull();
  });
});

describe("CheckKnowledgeAccessModal", () => {
  it("opens with Check disabled until a user and a document are chosen", () => {
    render(<CheckKnowledgeAccessModal isOpen onClose={() => undefined} />);
    expect(screen.getByText("Check access to the Knowledge Base")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check" }).hasAttribute("disabled")).toBe(true);
  });

  it("renders nothing when closed", () => {
    render(<CheckKnowledgeAccessModal isOpen={false} onClose={() => undefined} />);
    expect(screen.queryByText("Check access to the Knowledge Base")).toBeNull();
  });
});
