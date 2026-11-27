import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ list: vi.fn(), count: vi.fn(), dismiss: vi.fn() }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({ ...(await importOriginal<object>()), trainingPersonnelEventsApi: api }));
const toast = vi.hoisted(() => ({ showToast: () => undefined }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => toast }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));

vi.mock("@/components/ui/esign-modal/ESignatureModal", () => ({
  ESignatureModal: ({ isOpen, onConfirm }: { isOpen: boolean; onConfirm: (d: { signatureToken: string; reason: string }) => void }) =>
    isOpen ? <button onClick={() => onConfirm({ signatureToken: "tok", reason: "  No training needed  " })}>Sign</button> : null,
}));

import { PersonnelAlertsTab } from "../PersonnelAlertsTab";

const base = { personUserId: "p1", fullName: "Anne Tran", employeeCode: "E-001", status: "OPEN", canAct: true, eventDate: "2026-11-20" };
const events = [
  { ...base, id: "e1", kind: "NEW_HIRE" },
  { ...base, id: "e2", personUserId: "p2", fullName: "Binh Le", kind: "ABSENCE_RETURN", absenceFrom: "2026-01-01", absenceTo: "2026-11-19" },
  { ...base, id: "e3", personUserId: "p3", fullName: "Chi Pham", kind: "DEPT_TRANSFER", departmentFrom: "Warehouse", departmentTo: "Quality Assurance" },
  { ...base, id: "e4", personUserId: "p4", fullName: "Dung Vo", kind: "POSITION_CHANGE", positionFrom: "Operator", positionTo: "Supervisor" },
];
const page = (data: unknown[]) => ({ data, pagination: { page: 1, limit: 20, total: data.length, totalPages: 1 } });

const renderTab = (canManage: boolean, onOpenReview = vi.fn()) => {
  render(<MemoryRouter initialEntries={["/"]}><Routes><Route path="/" element={<PersonnelAlertsTab canManage={canManage} onOpenReview={onOpenReview} />} /><Route path="/training-management/job-assignments/new" element={<div>Job assignment page</div>} /></Routes></MemoryRouter>);
  return onOpenReview;
};

beforeEach(() => {
  window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }) as MediaQueryList);
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  api.list.mockReset().mockResolvedValue(page(events));
  api.count.mockReset().mockResolvedValue(4);
  api.dismiss.mockReset();
  try { window.localStorage.clear(); } catch { /* storage may be unavailable */ }
});
afterEach(cleanup);

describe("PersonnelAlertsTab", () => {
  it("lists each person with what happened and what the SOP asks for, asking the server for the open alerts", async () => {
    renderTab(true);
    expect(await screen.findByText("Anne Tran")).toBeTruthy();
    expect(screen.getByText("New employee")).toBeTruthy();
    expect(screen.getByText("Return after absence")).toBeTruthy();
    expect(screen.getByText(/Absent from 01\/01\/2026 until 19\/11\/2026/)).toBeTruthy();
    expect(screen.getByText(/From Warehouse to Quality Assurance/)).toBeTruthy();
    await waitFor(() => expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ status: "OPEN", page: 1, sortBy: "eventDate", sortDirection: "desc" })));
  });

  it("opens the review already filled in from the alert", async () => {
    const open = renderTab(true);
    await screen.findByText("Binh Le");
    fireEvent.click(screen.getAllByRole("button", { name: "More actions" })[1]);
    fireEvent.click(await screen.findByText("Open review"));
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toMatchObject({ personId: "p2", kind: "ABSENCE_RETURN", eventDate: "2026-11-20", absenceFrom: "2026-01-01", absenceTo: "2026-11-19" });
    expect(open.mock.calls[0][1]).toEqual([{ label: "Binh Le (E-001)", value: "p2" }]);
  });

  it("sends a change of position to the job assignment, with the person", async () => {
    renderTab(true);
    await screen.findByText("Dung Vo");
    fireEvent.click(screen.getAllByRole("button", { name: "More actions" })[3]);
    fireEvent.click(await screen.findByText("Make a job assignment"));
    expect(await screen.findByText("Job assignment page")).toBeTruthy();
  });

  it("offers no action to a person who cannot manage, and says so when there is no alert", async () => {
    renderTab(false);
    await screen.findByText("Anne Tran");
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
    cleanup();
    api.list.mockResolvedValue(page([]));
    renderTab(true);
    expect(await screen.findByText("No Alerts Found")).toBeTruthy();
  });

  it("asks for the reason once, in the signature, and sends both", async () => {
    api.dismiss.mockResolvedValue({});
    renderTab(true);
    await screen.findByText("Anne Tran");
    fireEvent.click(screen.getAllByRole("button", { name: "More actions" })[0]);
    fireEvent.click(await screen.findByText("Dismiss"));
    fireEvent.click(await screen.findByRole("button", { name: "Sign" }));
    await waitFor(() => expect(api.dismiss).toHaveBeenCalledWith("e1", "No training needed", "tok"));
    expect(screen.queryByRole("button", { name: "Continue to Signature" })).toBeNull();
  });

  it("shows the server's refusal instead of an empty list", async () => {
    api.list.mockRejectedValue(new Error("denied"));
    renderTab(true);
    expect((await screen.findByRole("alert")).textContent).toBeTruthy();
  });

  it("reports the number of open alerts to the page", async () => {
    const seen = vi.fn();
    render(<MemoryRouter><PersonnelAlertsTab canManage onOpenReview={vi.fn()} onCount={seen} /></MemoryRouter>);
    await waitFor(() => expect(seen).toHaveBeenCalledWith(4));
  });
});
