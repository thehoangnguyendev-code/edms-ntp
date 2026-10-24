import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";

const api = vi.hoisted(() => ({ suspensions: vi.fn(), resume: vi.fn(), retention: vi.fn() }));
const page = (data: unknown[]) => ({ data, pagination: { page: 1, limit: 10, total: data.length, totalPages: 1 }, retentionYears: 10 });
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({ ...(await importOriginal<object>()), trainingFollowUpApi: api }));
const toast = vi.hoisted(() => ({ showToast: () => undefined }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => toast }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));

import { ComplianceSuspensionsTab } from "../ComplianceSuspensionsTab";
import { ComplianceRetentionTab } from "../ComplianceRetentionTab";

const department: ReportSelectFilter = { id: "department", label: "Department", value: "", options: [{ label: "My department", value: "" }], onChange: () => undefined };
const open = { id: "s1", personUserId: "p1", fullName: "Anne Tran", employeeCode: "E-001", position: "Operator", activityId: "a1", trainingNumber: "TRN/QA/26-001", topicText: "Gowning", percent: 55, status: "OPEN", raisedAt: "2026-10-20T08:00:00Z", canResume: true };

beforeEach(() => {
  // The real table observes its header and the browser object is not in the test environment.
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }) as MediaQueryList);
  Object.values(api).forEach((f) => f.mockReset()); try { window.localStorage.clear(); } catch { /* storage may be unavailable */ } });
afterEach(cleanup);

describe("ComplianceSuspensionsTab", () => {
  it("lists the people whose work is suspended and asks only the open ones", async () => {
    api.suspensions.mockResolvedValue(page([open]));
    render(<MemoryRouter><ComplianceSuspensionsTab departmentId="" departmentFilter={department} /></MemoryRouter>);

    expect(await screen.findByText("Anne Tran")).toBeTruthy();
    expect(screen.getAllByText("Work suspended").length).toBeGreaterThan(0);
    expect(api.suspensions).toHaveBeenCalledWith(expect.objectContaining({ status: "OPEN" }));
  });

  it("offers Resume Work to the head of the unit and needs a reason before the signature", async () => {
    api.suspensions.mockResolvedValue(page([open]));
    render(<MemoryRouter><ComplianceSuspensionsTab departmentId="" departmentFilter={department} /></MemoryRouter>);

    await screen.findByText("Anne Tran");
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(await screen.findByText("Resume Work"));

    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getAllByRole("textbox").at(-1) as HTMLElement, { target: { value: "Retrained on the job" } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false));
  });

  it("has no Resume Work for a row the person may not resume", async () => {
    api.suspensions.mockResolvedValue(page([{ ...open, canResume: false }]));
    render(<MemoryRouter><ComplianceSuspensionsTab departmentId="" departmentFilter={department} /></MemoryRouter>);

    await screen.findByText("Anne Tran");
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
  });
});

describe("ComplianceRetentionTab", () => {
  it("shows when the retention of a person who left ends and whether it has ended", async () => {
    api.retention.mockResolvedValue(page([
      { id: "u1", fullName: "Operator Two", employeeCode: "E-9", terminationDate: "2015-12-31", retainedUntil: "2025-12-31", records: 4, ended: true },
      { id: "u2", fullName: "Security Viewer", employeeCode: "E-8", terminationDate: "2026-09-25", retainedUntil: "2036-09-25", records: 2, ended: false },
    ]));
    render(<MemoryRouter><ComplianceRetentionTab departmentId="" departmentFilter={department} /></MemoryRouter>);

    expect(await screen.findByText("Operator Two")).toBeTruthy();
    expect(screen.getByText("Retention ended")).toBeTruthy();
    expect(screen.getByText("Kept")).toBeTruthy();
    expect(screen.getByText(/kept 10 years after the day they left/)).toBeTruthy();
  });
});
