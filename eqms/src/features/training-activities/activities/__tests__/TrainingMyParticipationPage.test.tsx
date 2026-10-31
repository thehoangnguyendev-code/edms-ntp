import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mine = vi.hoisted(() => ({ participation: vi.fn() }));
const activities = vi.hoisted(() => ({ confirmRead: vi.fn() }));
vi.mock("@/services/api/myTraining", () => ({ myTrainingApi: mine }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({ ...(await importOriginal<object>()), trainingActivitiesApi: activities }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/components/ui/esign-modal/ESignatureModal", () => ({
  ESignatureModal: ({ isOpen, actionTitle, onConfirm }: { isOpen: boolean; actionTitle?: string; onConfirm: (d: { signatureToken: string; reason?: string }) => void }) =>
    isOpen ? <button onClick={() => onConfirm({ signatureToken: "tok", reason: "I read it" })}>SIGN: {actionTitle}</button> : null,
}));

import { TrainingMyParticipationPage } from "../TrainingMyParticipationPage";

const participation = (over: Record<string, unknown> = {}) => ({
  participantId: "p1", activityId: "a1", trainingNumber: "TRN/QA/26-900", status: "IN_PROGRESS", dueDate: "2026-11-10", scheduledOn: "2026-10-31", state: "INVITED", method: "SELF_READING",
  trainingTopics: "Data integrity", materials: [{ id: "m1", title: "SOP link", linkUrl: "https://example.com/sop" }], canConfirmRead: true, ...over,
});

const renderPage = (p: object) => {
  mine.participation.mockResolvedValue(p);
  return render(
    <BreadcrumbProvider>
      <MemoryRouter initialEntries={["/training-management/participations/p1"]}>
        <Routes><Route path="/training-management/participations/:participantId" element={<TrainingMyParticipationPage />} /></Routes>
      </MemoryRouter>
    </BreadcrumbProvider>,
  );
};

beforeEach(() => {
  window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }) as MediaQueryList);
  mine.participation.mockReset();
  activities.confirmRead.mockReset().mockResolvedValue({});
});
afterEach(cleanup);

describe("TrainingMyParticipationPage", () => {
  it("shows the training, the link to read and the button to sign, and signs the reading with the e-signature", async () => {
    renderPage(participation());
    expect(await screen.findByText("TRN/QA/26-900")).toBeTruthy();
    expect(screen.getByRole("link", { name: "SOP link" }).getAttribute("href")).toBe("https://example.com/sop");
    fireEvent.click(screen.getByRole("button", { name: "I have read and understood" }));
    fireEvent.click(await screen.findByRole("button", { name: /SIGN: Confirm Self-Reading/ }));
    await waitFor(() => expect(activities.confirmRead).toHaveBeenCalledWith("p1", "tok", "I read it"));
  });

  it("offers no button once the reading is confirmed, and says so", async () => {
    renderPage(participation({ state: "READ_CONFIRMED", canConfirmRead: false, readConfirmedAt: "2026-10-31T10:00:00Z" }));
    expect(await screen.findByText("You confirmed the reading")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "I have read and understood" })).toBeNull();
  });

  it("offers no button when the training is not open for the signature", async () => {
    renderPage(participation({ canConfirmRead: false, status: "COMPLETED" }));
    expect(await screen.findByText(/not open for your signature now/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "I have read and understood" })).toBeNull();
  });
});
