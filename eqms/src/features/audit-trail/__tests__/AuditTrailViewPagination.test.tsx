import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  getAuditTrail: vi.fn(),
  getAuditTrailUsers: vi.fn(),
}));

vi.mock("@/services/api/auditTrail", () => ({
  auditTrailApi: { getAuditTrail: mocks.getAuditTrail, getAuditTrailUsers: mocks.getAuditTrailUsers },
}));
vi.mock("@/components/ui/page/PageHeader", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/ui/breadcrumb/breadcrumbs.config", () => ({ auditTrail: () => [] }));
vi.mock("@/hooks", async () => {
  const actual = await vi.importActual<typeof import("@/hooks")>("@/hooks");
  return { ...actual, useDebounce: (value: unknown) => value };
});

import { AuditTrailView } from "../AuditTrailView";

const record = (n: number) => ({
  id: `a${n}`,
  timestamp: "2026-11-16T03:00:00Z",
  fullName: "Test User",
  module: "Document",
  action: "Update",
  metadata: { objectCodeLabel: `DOC-${n}` },
});

const Location: React.FC = () => <span data-testid="url">{useLocation().search}</span>;

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: true, media: query, addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  mocks.getAuditTrailUsers.mockReset().mockResolvedValue([]);
  mocks.getAuditTrail.mockReset().mockImplementation(({ page }: { page: number }) =>
    Promise.resolve({ data: [record(page)], pagination: { total: 40, totalPages: 4, page, limit: 10 } }));
});

describe("Audit Trail pagination", () => {
  it("goes to the page that was clicked and stays there, with the page kept in the URL", async () => {
    render(
      <MemoryRouter initialEntries={["/audit-trail"]}>
        <AuditTrailView />
        <Location />
      </MemoryRouter>,
    );
    await screen.findByText("DOC-1");

    fireEvent.click(screen.getByRole("button", { name: "2" }));

    await waitFor(() => expect(mocks.getAuditTrail).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    expect(await screen.findByText("DOC-2")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("url").textContent).toContain("page=2"));
    // nothing sends it back to the first page afterwards
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mocks.getAuditTrail).not.toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
    expect(screen.getByText("DOC-2")).toBeInTheDocument();
  });

  it("opens on the page named in the URL", async () => {
    render(
      <MemoryRouter initialEntries={["/audit-trail?page=3"]}>
        <AuditTrailView />
        <Location />
      </MemoryRouter>,
    );

    expect(await screen.findByText("DOC-3")).toBeInTheDocument();
    expect(mocks.getAuditTrail).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));
  });
});
