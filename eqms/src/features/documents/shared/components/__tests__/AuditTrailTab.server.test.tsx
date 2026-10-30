import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ getEntityPage: vi.fn(), getAuditTrail: vi.fn(), getAuditTrailUsers: vi.fn() }));
vi.mock("@/services/api/auditTrail", () => ({ auditTrailApi: api }));
vi.mock("@/features/audit-trail/components/AuditExportModal", () => ({ AuditExportModal: () => null }));
import { AuditTrailTab, type AuditTrailRecord } from "../AuditTrailTab";
beforeEach(() => {
  Object.values(api).forEach(f => f.mockReset());
  api.getAuditTrailUsers.mockResolvedValue([]);
  api.getEntityPage.mockResolvedValue({ data: [], pagination: { total: 0, totalPages: 0 } });
});
afterEach(cleanup);
it("uses the object endpoint even with preloaded history and sends filters, sort and child scope", async () => {
  const preloaded: AuditTrailRecord[] = [{ id: "old", action: "Update", fullName: "Preloaded actor", userId: "u", timestamp: "2026-10-26T00:00:00Z", module: "DOCUMENT", entityId: "document", entityName: "Document", description: "Update", ipAddress: "", severity: "Low" }];
  render(<MemoryRouter><AuditTrailTab entityType="Controlled Copy Distribution Batch" entityId="batch" includeChildren records={preloaded} /></MemoryRouter>);
  await waitFor(() => expect(api.getEntityPage).toHaveBeenCalledWith("Controlled Copy Distribution Batch", "batch", expect.objectContaining({ includeChildren: true, page: 1, limit: 10, dateFrom: "", dateTo: "" })));
  fireEvent.change(screen.getByPlaceholderText("Search audit trail..."), { target: { value: "query-server" } });
  await waitFor(() => expect(api.getEntityPage).toHaveBeenLastCalledWith("Controlled Copy Distribution Batch", "batch", expect.objectContaining({ searchQuery: "query-server", page: 1 })));
  expect(api.getAuditTrail).not.toHaveBeenCalled();
  expect(screen.queryByRole("cell", { name: "Preloaded actor" })).toBeNull();
});
it("ignores a previous object's response", async () => {
  let finish: (r: unknown) => void = () => {};
  api.getEntityPage.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const view = render(<MemoryRouter><AuditTrailTab entityType="REVISION" entityId="old" /></MemoryRouter>);
  view.rerender(<MemoryRouter><AuditTrailTab entityType="REVISION" entityId="new" /></MemoryRouter>);
  await waitFor(() => expect(api.getEntityPage).toHaveBeenCalledWith("REVISION", "new", expect.any(Object)));
  finish({ data: [{ id: "stale", fullName: "Stale actor" }], pagination: { total: 1, totalPages: 1 } });
  await waitFor(() => expect(screen.queryByText("Stale actor")).toBeNull());
});
