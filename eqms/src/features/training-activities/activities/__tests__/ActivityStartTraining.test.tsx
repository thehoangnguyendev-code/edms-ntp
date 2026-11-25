import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), overview: vi.fn(), participantPage: vi.fn(), startTraining: vi.fn(), resendNotifications: vi.fn(), people: vi.fn() }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({ ...(await importOriginal<object>()), trainingActivitiesApi: api, trainingDocumentSourcesApi: { get: async () => ({ documents: [], sessionDefaults: null }) } }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => true, hasPermissionAlias: () => true }) }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/features/documents/shared/components/AuditTrailTab", () => ({ AuditTrailTab: () => <div>audit</div> }));
import { withParticipantSummary } from "./trainingQueryFixture";
import { TrainingActivityDetailPage } from "../TrainingActivityDetailPage";

const notified = {
  id: "a1", trainingNumber: "TRN/QA/26-098", trainingTopics: "Start", status: "NOTIFIED", kind: "UNPLANNED", kindReason: "OTHER", version: 4, departmentName: "QA", createdAt: "2026-10-20T07:00:00Z", createdByName: "Admin",
  approvedOn: null, completedOn: null, sessions: [], participants: [], approvers: [] as unknown[], confirmations: [] as unknown[], qaList: null, resultsToQa: null, proposedParticipantCount: 0, passPercent: 70,
  capabilities: { adjustPlan: true, printPaper: true, startTraining: true, cancel: true, edit: false } as Record<string, unknown>,
};

const open = async (a: Record<string, unknown>) => {
  api.get.mockResolvedValue(a);
  api.overview.mockImplementation(async () => withParticipantSummary(await api.get()));
  render(
    <BreadcrumbProvider>
      <MemoryRouter initialEntries={["/training-management/activities/a1/prepare"]}>
        <Routes><Route path="/training-management/activities/:activityId/prepare" element={<TrainingActivityDetailPage mode="prepare" />} /></Routes>
      </MemoryRouter>
    </BreadcrumbProvider>,
  );
};

beforeEach(() => {
  window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }) as MediaQueryList);
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Object.values(api).forEach((f) => f.mockReset());
  api.participantPage.mockResolvedValue({ data: [], pagination: { total: 0, totalPages: 1 } });
  api.people.mockResolvedValue([]);
});
afterEach(cleanup);

describe("Prepare Training and Start Training of a notified activity", () => {
  it("shows Prepare Training with Start Training off while the tests are not printed, and says why", async () => {
    await open({ ...notified, capabilities: { ...notified.capabilities, startBlockers: ["TRAINING_TESTS_NOT_PRINTED"] } });

    const start = (await screen.findAllByRole("button", { name: "Start Training" }))[0] as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect(screen.getByText(/Before the training can start/)).toBeTruthy();
    expect(screen.getAllByText(/Prepare Training/).length).toBeGreaterThan(0);
  });

  it("turns Start Training on once nothing is missing and asks for the signature", async () => {
    await open({ ...notified, capabilities: { ...notified.capabilities, startBlockers: [] } });

    const start = (await screen.findAllByRole("button", { name: "Start Training" }))[0] as HTMLButtonElement;
    expect(start.disabled).toBe(false);
    expect(screen.queryByText(/Before the training can start/)).toBeNull();
    fireEvent.click(start);
    // the signing window opens; nothing is sent before the person signs
    expect(await screen.findByText(/Training Started/)).toBeTruthy();
    expect(api.startTraining).not.toHaveBeenCalled();
  });

  it("offers no Start Training to a person who may not conduct, or before Notified", async () => {
    await open({ ...notified, capabilities: { adjustPlan: false, startTraining: false, cancel: false } });
    await screen.findAllByText(/Prepare Training/);
    expect(screen.queryByRole("button", { name: "Start Training" })).toBeNull();
  });
});

describe("Invitations of a notified activity and Fill in from the record", () => {
  it("tells how many e-mails went, how many failed, and sends again to the ones not reached", async () => {
    api.resendNotifications.mockResolvedValue({ ...notified });
    await open({ ...notified, invitations: { total: 5, sent: 3, failed: 2, notSent: 0, waiting: 0, startedAt: "2026-11-23T08:00:00Z" }, capabilities: { ...notified.capabilities, startBlockers: [], resendNotifications: true } });

    expect(await screen.findByText(/Invitations: 3 of 5 e-mails sent/)).toBeTruthy();
    expect(screen.getByText(/2 failed/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send again to those not reached" }));
    await waitFor(() => expect(api.resendNotifications).toHaveBeenCalledWith("a1"));
  });

  it("offers no resend when everybody was reached, and offers Fill in from the record while preparing", async () => {
    await open({ ...notified, invitations: { total: 4, sent: 4, failed: 0, notSent: 0, waiting: 0, startedAt: "2026-11-23T08:00:00Z" }, capabilities: { ...notified.capabilities, startBlockers: [], resendNotifications: false } });

    expect(await screen.findByText(/Invitations: 4 of 4 e-mails sent/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Send again to those not reached" })).toBeNull();
    expect(screen.getByRole("button", { name: "Fill in from the record" })).toBeTruthy();
  });
});
