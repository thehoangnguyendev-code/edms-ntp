import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, waitFor, fireEvent, within } from "@testing-library/react";

const stableToast = { showToast: vi.fn() };
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => stableToast }));

const permissions = vi.hoisted(() => ({ canRevoke: true }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermissionAlias: () => permissions.canRevoke }) }));

const { sharesApi } = vi.hoisted(() => ({ sharesApi: { listLinks: vi.fn(), revokeLink: vi.fn(async () => undefined) } }));
vi.mock("@/services/api/knowledgeShares", () => ({ knowledgeSharesApi: sharesApi }));

import { KnowledgeLinksPanel } from "../KnowledgeLinksPanel";

const link = (id: string, extra: Record<string, unknown> = {}) => ({
  id, ownerName: "Quality Control", scopeKind: "DOCUMENT", scopeLabel: "Document", label: "SOP.0001 - Balance calibration", status: "ACTIVE",
  createdBy: "Trainer One", createdByLevel: "DELEGATE", createdAt: "2026-11-03T03:00:00Z", expiresAt: "2026-12-03T03:00:00Z", revokedAt: null, revokedBy: null, opens: 2, ...extra,
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
  sharesApi.listLinks.mockResolvedValue(page([
    link("l1"),
    link("l2", { status: "REVOKED", revokedAt: "2026-11-04T03:00:00Z", revokedBy: "Head", expiresAt: null, scopeKind: "DEPARTMENT", scopeLabel: "Whole Department", label: "Quality Control" }),
  ]));
});
afterEach(cleanup);

const headers = () => screen.getAllByRole("columnheader").map((h) => h.textContent?.trim());

describe("KnowledgeLinksPanel", () => {
  it("lists every link with its owner, target, status, maker and how often it was opened, behind the common No. column", async () => {
    render(<KnowledgeLinksPanel />);
    expect(await screen.findByText("SOP.0001 - Balance calibration")).toBeTruthy();
    expect(screen.getAllByText("Quality Control").length).toBeGreaterThan(0);
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("Revoked")).toBeTruthy();
    expect(screen.getAllByText("Trainer One")).toHaveLength(2);
    expect(screen.getAllByText("Shares for the Head")).toHaveLength(2);
    expect(screen.getAllByText("2 people")).toHaveLength(2);
    expect(headers().slice(0, 3)).toEqual(["No.", "Department / Unit", "Points to"]);
    expect(sharesApi.listLinks).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 10, sortBy: "createdAt", sortDir: "desc" }));
  });

  it("sorts on the server and flips the direction on the second press", async () => {
    render(<KnowledgeLinksPanel />);
    await screen.findByText("SOP.0001 - Balance calibration");
    const header = () => screen.getAllByRole("columnheader").find((h) => h.textContent?.trim() === "Status")!;
    fireEvent.click(header());
    await waitFor(() => expect(sharesApi.listLinks).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: "status", sortDir: "asc" })));
    fireEvent.click(header());
    await waitFor(() => expect(sharesApi.listLinks).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: "status", sortDir: "desc" })));
  });

  it("searches on the server and says so when nothing matches", async () => {
    render(<KnowledgeLinksPanel />);
    await screen.findByText("SOP.0001 - Balance calibration");
    sharesApi.listLinks.mockResolvedValue(page([]));
    fireEvent.change(screen.getAllByLabelText("Search links")[0], { target: { value: "zzz" } });
    await waitFor(() => expect(sharesApi.listLinks).toHaveBeenCalledWith(expect.objectContaining({ search: "zzz", page: 1 })));
    expect(await screen.findByText("No link matches the filters")).toBeTruthy();
  });

  it("says so when nobody has made a link", async () => {
    sharesApi.listLinks.mockResolvedValue(page([]));
    render(<KnowledgeLinksPanel />);
    expect(await screen.findByText("No link yet")).toBeTruthy();
  });

  it("revokes an active link after a confirmation, and offers nothing for a link that is already dead", async () => {
    render(<KnowledgeLinksPanel />);
    await screen.findByText("SOP.0001 - Balance calibration");
    fireEvent.click(screen.getByRole("button", { name: "Actions for the link to Quality Control" }));
    expect(await screen.findByText("This link no longer opens anything.")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Actions for the link to SOP.0001 - Balance calibration" }));
    fireEvent.click(await screen.findByText("Revoke this link"));
    const buttons = await screen.findAllByRole("button", { name: "Revoke" });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(sharesApi.revokeLink).toHaveBeenCalledWith("l1"));
    await waitFor(() => expect(sharesApi.listLinks.mock.calls.length).toBeGreaterThan(1));
  });

  it("offers no revoke to someone who may only view", async () => {
    permissions.canRevoke = false;
    render(<KnowledgeLinksPanel />);
    await screen.findByText("SOP.0001 - Balance calibration");
    expect(screen.queryByRole("button", { name: /Actions for the link/ })).toBeNull();
    expect(within(document.body).queryByText("Revoke this link")).toBeNull();
  });
});
