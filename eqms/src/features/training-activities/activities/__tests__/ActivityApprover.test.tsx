import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), overview: vi.fn(), participantPage: vi.fn(), eligibleApprovers: vi.fn(), saveApprovers: vi.fn(), people: vi.fn() }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({ ...(await importOriginal<object>()), trainingActivitiesApi: api, trainingDocumentSourcesApi: { get: async () => ({ documents: [], sessionDefaults: null }) } }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => true, hasPermissionAlias: () => true }) }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/features/documents/shared/components/AuditTrailTab", () => ({ AuditTrailTab: () => <div>audit</div> }));
import { withParticipantSummary } from "./trainingQueryFixture";
import { TrainingActivityDetailPage } from "../TrainingActivityDetailPage";

const base = {
  id: "a1", trainingNumber: "TRN/QA/26-099", trainingTopics: "Flow", status: "PLANNED", kind: "UNPLANNED", kindReason: "OTHER", version: 1, departmentName: "QA", createdAt: "2026-10-20T07:00:00Z", createdByName: "Admin",
  approvedOn: null, completedOn: null, sessions: [], participants: [], approvers: [] as unknown[], confirmations: [] as unknown[], qaList: null, resultsToQa: null, proposedParticipantCount: 0, passPercent: 70,
  capabilities: { designateApprovers: true, edit: true, cancel: true } as Record<string, boolean>,
};

const open = async (a: Record<string, unknown>, mode: "edit" | "approve" = "edit") => {
  api.get.mockResolvedValue(a);
  api.overview.mockImplementation(async () => withParticipantSummary(await api.get()));
  render(
    <BreadcrumbProvider>
      <MemoryRouter initialEntries={[`/training-management/activities/a1/${mode}`]}>
        <Routes><Route path={`/training-management/activities/:activityId/${mode}`} element={<TrainingActivityDetailPage mode={mode} />} /></Routes>
      </MemoryRouter>
    </BreadcrumbProvider>,
  );
  fireEvent.click((await screen.findAllByText(/^Signatures$/))[0]);
};

beforeEach(() => {
  window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }) as MediaQueryList);
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Object.values(api).forEach((f) => f.mockReset());
  api.participantPage.mockResolvedValue({ data: [], pagination: { total: 0, totalPages: 1 } });
  api.people.mockResolvedValue([]);
  api.eligibleApprovers.mockResolvedValue({ data: [
    { id: "u9", fullName: "Approver Nine", employeeCode: "E-9", position: "QA Manager", department: "Quality Assurance", role: "QUALITY_MANAGER" },
    { id: "u8", fullName: "Head Eight", employeeCode: "E-8", position: "Unit Head", department: "Production", role: "UNIT_HEAD" },
    { id: "u7", fullName: "Head Seven", employeeCode: "E-7", position: "Head", department: "Warehouse", role: "DEPARTMENT_HEAD" },
  ], pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } });
});
afterEach(cleanup);

describe("Select Approver and Submit for Approval in the row of command buttons of an activity that is being prepared", () => {
  it("offers Select Approver in the row of buttons with Cancel, and the tab Signatures has the two approvals as in the details", async () => {
    await open(base);

    const select = await screen.findByRole("button", { name: "Select Approver" });
    const cancel = screen.getAllByRole("button", { name: "Cancel" });
    // Cancel is also at the top, beside Back; Select Approver is only in the row below the tabs, with Cancel
    expect(cancel.length).toBe(2);
    expect(select.parentElement).toBe(cancel[1].parentElement);
    // nothing to submit before the two approvers are saved
    expect(screen.queryByRole("button", { name: "Submit for Approval" })).toBeNull();
    // the fields of the details: what exists is filled, the rest waits
    expect(screen.getByText("Created By")).toBeTruthy();
    expect(screen.getByText("Created On (Date - Time)")).toBeTruthy();
    expect(screen.getByDisplayValue("Admin")).toBeTruthy();
    expect(screen.getByText("First Approval By")).toBeTruthy();
    expect(screen.getByText("First Approval On (Date - Time)")).toBeTruthy();
    expect(screen.getByText("Second Approval By")).toBeTruthy();
    expect(screen.getByText("Second Approval On (Date - Time)")).toBeTruthy();
    expect(screen.queryByText(/Content Reviewed/)).toBeNull();
  });

  it("lists the heads the server finds eligible, saves only when two are chosen, and says who approves first", async () => {
    api.saveApprovers.mockResolvedValue({ ...base });
    await open(base);
    fireEvent.click(await screen.findByRole("button", { name: "Select Approver" }));

    const nine = await screen.findByRole("button", { name: /Approver Nine/ });
    expect(api.eligibleApprovers).toHaveBeenCalledWith("a1", "CONTENT_APPROVE", undefined, 1);
    // the role of each head is named, and the dialog says whom to choose
    expect(screen.getByText("Quality Manager")).toBeTruthy();
    expect(screen.getByText("Head of the unit concerned")).toBeTruthy();
    expect(screen.getByText(/Select two people who hold the permission to approve/)).toBeTruthy();
    // nothing is chosen yet, so no notice
    expect(screen.queryByText(/Notice: SOP.0003 5.3.5/)).toBeNull();
    const save = () => screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save().disabled).toBe(true);
    fireEvent.click(nine);
    expect(save().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Head Eight/ }));
    expect(save().disabled).toBe(false);
    // only two can be chosen
    expect((screen.getByRole("button", { name: /Head Seven/ }) as HTMLButtonElement).disabled).toBe(true);
    // the first one ticked approves first; the order can be swapped
    expect(screen.getByText("Approves first").parentElement?.textContent).toContain("Approver Nine");
    fireEvent.click(screen.getByRole("button", { name: "Swap order" }));
    expect(screen.getByText("Approves first").parentElement?.textContent).toContain("Head Eight");
    fireEvent.click(save());
    await waitFor(() => expect(api.saveApprovers).toHaveBeenCalledWith("a1", "u8", "u9"));
  });

  it("never blocks the choice when the two chosen are not the head of the unit and the Quality Manager, and shows no extra warning", async () => {
    await open(base);
    fireEvent.click(await screen.findByRole("button", { name: "Select Approver" }));

    fireEvent.click(await screen.findByRole("button", { name: /Approver Nine/ }));
    fireEvent.click(screen.getByRole("button", { name: /Head Eight/ }));
    // any other pair: Save stays on and the dialog does not repeat the SOP in a warning
    fireEvent.click(screen.getByRole("button", { name: /Head Eight/ }));
    fireEvent.click(screen.getByRole("button", { name: /Head Seven/ }));
    expect(screen.queryByText(/Notice: SOP.0003 5.3.5/)).toBeNull();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("offers Submit for Approval once the two approvers are saved, and shows who was selected", async () => {
    await open({
      ...base,
      approverPlan: { firstUserId: "u8", firstName: "Head Eight", secondUserId: "u9", secondName: "Approver Nine", savedAt: "2026-10-21T08:00:00Z" },
      capabilities: { designateApprovers: true, submitForApproval: true, edit: true, cancel: true },
    });
    expect(await screen.findByRole("button", { name: "Submit for Approval" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Select Approver" })).toBeTruthy();
    expect(screen.getByDisplayValue("Head Eight (selected)")).toBeTruthy();
    expect(screen.getByDisplayValue("Approver Nine (selected)")).toBeTruthy();
  });

  it("is not offered once it is submitted, to a person who may not designate, or before the activity is open; the person to sign is named", async () => {
    // Pending Approval: the first approver waits to sign, the second one is only selected
    await open({
      ...base,
      status: "PENDING_APPROVAL",
      approverPlan: { firstUserId: "u8", firstName: "Head Eight", secondUserId: "u9", secondName: "Approver Nine", savedAt: "2026-10-21T08:00:00Z" },
      approvers: [{ id: "as1", stepCode: "CONTENT_APPROVE_FIRST", assigneeId: "u8", assigneeName: "Head Eight", status: "PENDING", assignedAt: "2026-10-21T08:00:00Z" }],
      capabilities: { designateApprovers: false, submitForApproval: false, edit: false, cancel: true },
    });
    expect(await screen.findByDisplayValue("Head Eight (waiting for the approval)")).toBeTruthy();
    expect(screen.getByDisplayValue("Approver Nine (selected)")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Select Approver" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Submit for Approval" })).toBeNull();
    cleanup();

    await open({
      ...base,
      status: "PENDING_APPROVAL",
      confirmations: [
        { id: "c1", kind: "CONTENT_APPROVED_FIRST", confirmedAt: "2026-10-22T08:00:00Z", confirmedByName: "Head Eight" },
        { id: "c2", kind: "CONTENT_APPROVED", confirmedAt: "2026-10-23T08:00:00Z", confirmedByName: "Approver Nine" },
      ],
      capabilities: { designateApprovers: false, edit: false, cancel: true },
    });
    expect(await screen.findByDisplayValue("Head Eight")).toBeTruthy();
    expect(screen.getByDisplayValue("Approver Nine")).toBeTruthy();
    cleanup();

    await open({ ...base, capabilities: { designateApprovers: false, edit: true, cancel: false } });
    await screen.findByText("First Approval By");
    expect(screen.queryByRole("button", { name: "Select Approver" })).toBeNull();
    cleanup();

    await open({ ...base, status: "RESERVED" });
    await screen.findByText("First Approval By");
    expect(screen.queryByRole("button", { name: "Select Approver" })).toBeNull();
  });
});
