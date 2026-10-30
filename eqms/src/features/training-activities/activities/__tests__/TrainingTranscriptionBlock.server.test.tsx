import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ listPage: vi.fn(), files: vi.fn(), toast: vi.fn() }));
vi.mock("@/services/api/trainingActivities", async (original) => ({ ...(await original<object>()), trainingTranscriptionApi: { listPage: api.listPage }, trainingFilesApi: { list: api.files } }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: api.toast }) }));
import { TrainingTranscriptionBlock } from "../components/TrainingTranscriptionBlock";
import type { TrainingActivityDetail } from "@/services/api/trainingActivities";
afterEach(() => { cleanup(); api.listPage.mockReset(); api.files.mockReset(); });
const activity = { id: "a", trainingNumber: "TR-1", trainingTopics: "Training", sessions: [{ id: "s", sessionNo: 1, status: "PLANNED", heldOn: "2026-10-26", deliveryMode: "PAPER" }], participants: [{ id: "p", fullName: "Person", sessionId: "s", state: "INVITED" }] } as TrainingActivityDetail;
it("prevents another transcription when the pending record is on a different page", async () => {
  api.listPage.mockResolvedValue({ data: [], pendingSessionIds: ["s"], pagination: { total: 11, totalPages: 2 } });
  api.files.mockResolvedValue({ evidence: [] });
  render(<TrainingTranscriptionBlock activity={activity} canEnter canVerify={false} onChanged={vi.fn()} />);
  const button = await screen.findByRole("button", { name: /Type results of session 1/ });
  await waitFor(() => expect(button.textContent).toContain("waiting to be checked"));
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(api.listPage).toHaveBeenCalledWith("a", 1, 10);
});
it("does not enable entry if the pending status could not be loaded", async () => {
  api.listPage.mockRejectedValue(new Error("unavailable")); api.files.mockResolvedValue({ evidence: [] });
  render(<TrainingTranscriptionBlock activity={activity} canEnter canVerify={false} onChanged={vi.fn()} />);
  await screen.findByRole("alert");
  expect((screen.getByRole("button", { name: /Type results of session 1/ }) as HTMLButtonElement).disabled).toBe(true);
});
