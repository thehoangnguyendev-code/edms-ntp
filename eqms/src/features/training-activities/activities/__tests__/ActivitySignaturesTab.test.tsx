import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), overview: vi.fn(), participantPage: vi.fn() }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({ ...(await importOriginal<object>()), trainingActivitiesApi: api }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => true, hasPermissionAlias: () => true }) }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/features/documents/shared/components/AuditTrailTab", () => ({ AuditTrailTab: () => <div>audit</div> }));
import { withParticipantSummary } from "./trainingQueryFixture";
import { TrainingActivityDetailPage } from "../TrainingActivityDetailPage";

beforeEach(() => {
  window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }) as MediaQueryList);
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  api.participantPage.mockResolvedValue({ data: [], pagination: { total: 0, totalPages: 1 } });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("the tab Signatures lists only the steps that matter, in the order of the flow, each as a person on the left and a time on the right", async () => {
  const a = {
    id: "a1", trainingNumber: "TRN/QA/26-099", trainingTopics: "Flow", status: "PENDING_QA_CONFIRMATION", kind: "UNPLANNED", kindReason: "NEW_SOP", version: 1, departmentName: "QA", createdAt: "2026-10-20T07:00:00Z", createdByName: "Admin",
    documentNumber: "SOP.1", approvedOn: "2026-10-19", completedOn: null, sessions: [], participants: [], approvers: [], qaList: null, resultsToQa: null, proposedParticipantCount: 0, passPercent: 70, capabilities: {},
    confirmations: [{ id: "c1", kind: "CONTENT_APPROVED", confirmedAt: "2026-10-20T08:00:00Z", confirmedByName: "Approver A" }],
    documentApprovedByName: "Doc Approver", documentApprovedAt: "19/10/2026 16:00:00", notifiedAt: "20/10/2026 09:00:00", notifiedByName: "Organizer O", attendanceSentAt: "21/10/2026 10:00:00", attendanceSentByName: "Trainer T", resultsFinishedAt: "21/10/2026 11:00:00", resultsFinishedByName: "Trainer T",
  };
  api.get.mockResolvedValue(a);
  api.overview.mockImplementation(async () => withParticipantSummary(await api.get()));
  render(<BreadcrumbProvider><MemoryRouter initialEntries={["/training-management/activities/a1"]}><Routes><Route path="/training-management/activities/:activityId" element={<TrainingActivityDetailPage mode="view" />} /></Routes></MemoryRouter></BreadcrumbProvider>);
  fireEvent.click((await screen.findAllByText(/^Signatures$/))[0]);
  const labels = await waitFor(() => {
    const found = screen.getAllByText(/ By$/).map((e) => e.textContent);
    expect(found.length).toBe(6);
    return found;
  });
  expect(labels).toEqual(["Document Approved By", "Content Reviewed By", "Content Approved By", "Attendance List Sent to QA By", "Training Finished and Results Sent to QA By", "Completion Confirmed by QA By"]);
  // the person is the left field and the time the right one of the same row
  const by = screen.getByText("Document Approved By"), on = screen.getByText("Document Approved On (Date - Time)");
  expect(by.compareDocumentPosition(on) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByDisplayValue("Doc Approver")).toBeTruthy();
  expect(screen.queryByText(/Participants Notified/)).toBeNull();
  expect(screen.queryByText(/Attendee List Confirmed/)).toBeNull();
  expect(screen.getByDisplayValue("Approver A")).toBeTruthy();
  expect(screen.queryByText(/^Approvers$/)).toBeNull();
});
