import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const exam = vi.fn();
const files = vi.fn();
const packs = vi.fn();
const paged = vi.fn();

vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));
vi.mock("@/components/ui/esign-modal/ESignatureModal", () => ({ ESignatureModal: () => null }));
vi.mock("@/services/api/trainingActivities", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/trainingActivities")>("@/services/api/trainingActivities");
  return {
    ...actual,
    trainingExamApi: { ...actual.trainingExamApi, get: (...a: unknown[]) => exam(...a) },
    trainingFilesApi: { ...actual.trainingFilesApi, list: (...a: unknown[]) => files(...a) },
    trainingPaperApi: { ...actual.trainingPaperApi, packs: (...a: unknown[]) => packs(...a) },
    trainingTranscriptionApi: { ...actual.trainingTranscriptionApi, listPage: (...a: unknown[]) => paged(...a) },
  };
});

import { WorkspaceAssessmentStep } from "../components/workspace/WorkspaceAssessmentStep";

const session = { id: "s1", sessionNo: 1, status: "PLANNED", heldOn: "2026-11-03", deliveryMode: "PAPER", assessmentMethod: "TEST" };
const scoped = { id: "a1", trainingNumber: "TRN/QA/26-952", sessions: [session], participants: [{ id: "p1", sessionId: "s1", fullName: "Le Hoang Minh", state: "INVITED", participationRole: "TRAINEE" }] };
const pack = (id: string, status: string, copyNo: number) => ({ id, sessionId: "s1", sessionNo: 1, packKind: "ATTENDANCE", packCode: "PK-0042", copyNo, pageCount: 12, peopleCount: 8, sha256: "x", printedAt: "2026-11-03T01:12:00Z", printedByName: "Tran Thi Lan", scanCount: status === "ISSUED" ? 0 : 1, status });
const typed = { id: "t1", sessionId: "s1", sessionNo: 1, status: "ENTERED", enteredAt: "2026-11-03T02:00:00Z", evidenceId: "e1", evidenceName: "sheet-s1-signed.pdf", enteredBy: "u1", enteredByName: "Tran Thi Lan", lines: new Array(8).fill({}) };

const mount = (over: { userId?: string } = {}) => render(
  <WorkspaceAssessmentStep activityId="a1" scoped={scoped as never} people={scoped.participants as never} caps={{ transcribe: true, verifyTranscription: true } as never} mode={"view" as never} external={false} userId={over.userId ?? "u9"} onChanged={vi.fn()} />,
);

beforeEach(() => {
  vi.clearAllMocks();
  // the table of the step measures its width; jsdom has no ResizeObserver or matchMedia
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false })) as never;
  exam.mockResolvedValue({ canEdit: false, canSeeKey: true, minutes: 20, questions: [{ id: "q1", qNo: 1, kind: "SINGLE", prompt: "Which area needs Grade A?", points: 2, options: [{ id: "A", text: "Filling zone" }], correct: ["A"] }] });
  files.mockResolvedValue({ materials: [], evidence: [{ id: "e1", kind: "ATTENDANCE_SHEET", originalName: "sheet-s1-signed.pdf", sizeBytes: 1200000, sha256: "x", uploadedAt: "2026-11-03T01:00:00Z", uploadedByName: "Tran Thi Lan" }], canUploadMaterial: false, canSeeAnswerKey: true, canUploadEvidence: false, canReceive: true });
  packs.mockResolvedValue([pack("k1", "RETURNED", 1), pack("k2", "ISSUED", 2)]);
  paged.mockResolvedValue({ data: [typed], pagination: { total: 1, totalPages: 1, page: 1, limit: 10 }, pendingSessionIds: [] });
});

describe("Assessment step: one block at a time", () => {
  it("opens on the block that has something waiting, and shows the others as tabs with their number", async () => {
    mount();
    const tabs = await screen.findByRole("tablist", { name: "Assessment blocks" });
    await waitFor(() => expect(within(tabs).getAllByRole("tab")).toHaveLength(5));
    expect(within(tabs).getByRole("tab", { name: /Results from paper/ }).getAttribute("aria-selected")).toBe("true");
    expect(within(tabs).getByRole("tab", { name: /Test in the system/ }).getAttribute("aria-selected")).toBe("false");
    // a desktop table and the list of a phone are both in the page; the style sheet shows one of them
    expect((await screen.findAllByText("Waiting to be checked")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Verify" })).toBeTruthy();
  });

  it("does not offer Verify to the person who typed the results", async () => {
    mount({ userId: "u1" });
    const tabs = await screen.findByRole("tablist", { name: "Assessment blocks" });
    await waitFor(() => expect(within(tabs).getByRole("tab", { name: /Results from paper/ }).getAttribute("aria-selected")).toBe("true"));
    expect(screen.queryByRole("button", { name: "Verify" })).toBeNull();
    expect(screen.getByRole("button", { name: "Lines" })).toBeTruthy();
  });

  it("switches block by the tab and keeps the other blocks out of sight", async () => {
    mount();
    const tabs = await screen.findByRole("tablist", { name: "Assessment blocks" });
    await waitFor(() => expect(within(tabs).getAllByRole("tab")).toHaveLength(5));
    fireEvent.click(within(tabs).getByRole("tab", { name: /Printed packs/ }));
    expect(within(tabs).getByRole("tab", { name: /Printed packs/ }).getAttribute("aria-selected")).toBe("true");
    expect(document.getElementById("ws-assess-pane-packs")?.hasAttribute("hidden")).toBe(false);
    expect(document.getElementById("ws-assess-pane-typed")?.hasAttribute("hidden")).toBe(true);
    expect(screen.getAllByText("Issued").length).toBeGreaterThan(0);
  });

  it("never shows the choices or the right answer of the test", async () => {
    mount();
    const tabs = await screen.findByRole("tablist", { name: "Assessment blocks" });
    await waitFor(() => expect(within(tabs).getAllByRole("tab")).toHaveLength(5));
    fireEvent.click(within(tabs).getByRole("tab", { name: /Test in the system/ }));
    expect(await screen.findByText(/Which area needs Grade A[?]/)).toBeTruthy();
    expect(screen.queryByText("Filling zone")).toBeNull();
    expect(screen.queryByText("Right")).toBeNull();
  });

  it("on a phone the title opens the list of the blocks, with what waits in each", async () => {
    mount();
    const tabs = await screen.findByRole("tablist", { name: "Assessment blocks" });
    await waitFor(() => expect(within(tabs).getAllByRole("tab")).toHaveLength(5));
    fireEvent.click(screen.getByRole("button", { name: /Results from paper/, expanded: undefined, hidden: true }) as HTMLElement);
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("1 still Issued")).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: /Scans and filled files/ }));
    await waitFor(() => expect(document.getElementById("ws-assess-pane-scans")?.hasAttribute("hidden")).toBe(false));
  });
});
