import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ getEntityPage: vi.fn(), getAuditTrail: vi.fn(), getAuditTrailUsers: vi.fn() }));
const branding = vi.hoisted(() => ({ auditTabView: "TIMELINE", auditTabTimelineStyle: "RAIL" }) as Record<string, string>);
vi.mock("@/services/api/auditTrail", () => ({ auditTrailApi: api }));
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => branding }));
vi.mock("@/features/audit-trail/components/AuditExportModal", () => ({ AuditExportModal: () => null }));
import { AuditTrailTab } from "../AuditTrailTab";

const page = (ids: string[], totalPages: number) => ({
  data: ids.map((id) => ({ id, action: "Update", fullName: `Person ${id}`, userId: id, timestamp: "2026-11-15T03:00:00Z", module: "Revision", entityId: "e", entityName: `Revision ${id}`, description: "", ipAddress: "", severity: "Low" })),
  pagination: { total: 3, totalPages },
});

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.getAuditTrailUsers.mockResolvedValue([]);
  branding.auditTabView = "TIMELINE";
  branding.auditTabTimelineStyle = "RAIL";
});
afterEach(cleanup);

/** AUDIT-TAB-TIMELINE-2026-11-15: the tab of a record is a timeline when the administrator chose it; older pages are added at its end, newest first. */
it("draws the audit tab as a timeline, newest first, and adds older pages at its end", async () => {
  api.getEntityPage.mockResolvedValueOnce(page(["a", "b"], 2)).mockResolvedValueOnce(page(["c"], 2));
  render(<MemoryRouter><AuditTrailTab entityType="REVISION" entityId="rev" /></MemoryRouter>);
  expect(await screen.findByText("Person a")).toBeInTheDocument();
  expect(screen.getByLabelText("Audit trail timeline")).toBeInTheDocument();
  expect(screen.queryByRole("table")).toBeNull();
  expect(api.getEntityPage).toHaveBeenCalledWith("REVISION", "rev", expect.objectContaining({ page: 1, limit: 20, sortBy: "timestamp", sortDirection: "desc" }));
  fireEvent.click(screen.getByRole("button", { name: "Load older records" }));
  expect(await screen.findByText("Person c")).toBeInTheDocument();
  expect(screen.getByText("Person a")).toBeInTheDocument();
  expect(api.getEntityPage).toHaveBeenLastCalledWith("REVISION", "rev", expect.objectContaining({ page: 2, limit: 20 }));
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
});

it("is the table it always was when the administrator chose the table", async () => {
  branding.auditTabView = "TABLE";
  api.getEntityPage.mockResolvedValue(page(["a"], 1));
  render(<MemoryRouter><AuditTrailTab entityType="REVISION" entityId="rev" /></MemoryRouter>);
  expect(await screen.findByRole("table")).toBeInTheDocument();
  expect(screen.queryByLabelText("Audit trail timeline")).toBeNull();
  expect(api.getEntityPage).toHaveBeenCalledWith("REVISION", "rev", expect.objectContaining({ page: 1, limit: 10 }));
});

it("says so when there is nothing to show, in a timeline too", async () => {
  api.getEntityPage.mockResolvedValue({ data: [], pagination: { total: 0, totalPages: 0 } });
  render(<MemoryRouter><AuditTrailTab entityType="REVISION" entityId="rev" /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText("No Audit Records Found")).toBeInTheDocument());
});
