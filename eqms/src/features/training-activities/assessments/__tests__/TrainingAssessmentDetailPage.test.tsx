import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), create: vi.fn(), update: vi.fn(), submit: vi.fn(), returnToDraft: vi.fn(), approve: vi.fn(), newVersion: vi.fn(), remove: vi.fn(), list: vi.fn(), approved: vi.fn(), preview: vi.fn(), revisions: vi.fn() }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({ ...(await importOriginal<object>()), trainingAssessmentsApi: api }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/features/documents/shared/components/AuditTrailTab", () => ({ AuditTrailTab: () => <div>audit</div> }));
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: () => true }));
vi.mock("@/features/documents/shared/components/DocumentPdfViewer", () => ({
  DocumentPdfViewer: ({ fileUrl }: { fileUrl: string }) => <span data-testid="pdf">{fileUrl}</span>,
}));
vi.mock("@/components/ui/esign-modal/ESignatureModal", () => ({
  ESignatureModal: ({ isOpen, onConfirm }: { isOpen: boolean; onConfirm: (d: { signatureToken: string }) => void }) => (isOpen ? <button onClick={() => onConfirm({ signatureToken: "tok" })}>SIGN</button> : null),
}));

import { TrainingAssessmentDetailPage, distributePoints, reorderAnswers, type Draft } from "../TrainingAssessmentDetailPage";

const NO_CAPS = { edit: false, delete: false, submit: false, returnToDraft: false, approve: false, newVersion: false };
const detail = (over: Record<string, unknown> = {}, caps: Record<string, boolean> = {}) => ({
  id: "d1", code: "TAS-0001", versionNo: 1, revisionNumber: "0.0.1", name: "Kiểm tra SOP.0006", kind: "QUESTIONS", status: "DRAFT", version: 3, itemCount: 1, maxScore: 2,
  updatedAt: "2026-10-24T07:00:00Z", updatedByName: "Designer", approvedAt: null, approvedByName: null, createdByName: "Designer", usedByActivities: 0,
  items: [{ no: 1, kind: "SINGLE", prompt: "Câu 1", options: [{ id: "A", text: "Một" }, { id: "B", text: "Hai" }], correct: ["A"], points: 2, modelAnswer: null }],
  capabilities: { ...NO_CAPS, edit: true, delete: true, submit: true, ...caps }, approveBlocker: null, ...over,
});
const draftOf = (points: string): Draft => ({ id: "x", kind: "ESSAY", prompt: "q", options: [], correct: [], points, modelAnswer: "" });

const renderPage = (path: string, isNew = false) =>
  render(
    <BreadcrumbProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/training-management/assessments/new" element={<TrainingAssessmentDetailPage isNew />} />
          <Route path="/training-management/assessments/:assessmentId" element={<TrainingAssessmentDetailPage isNew={isNew} />} />
        </Routes>
      </MemoryRouter>
    </BreadcrumbProvider>,
  );
const openItems = async () => fireEvent.click(await screen.findByRole("tab", { name: /Questions|Checklist Lines/ }));
const totalField = () => screen.getByLabelText("Total Score") as HTMLInputElement;

beforeEach(() => {
  window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }) as MediaQueryList);
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Object.values(api).forEach((f) => f.mockReset());
  api.revisions.mockResolvedValue({ data: [{ id: "d1", revisionNumber: "0.0.1", name: "Kiểm tra SOP.0006", status: "DRAFT", createdAt: "2026-10-24T08:00:00Z", createdByName: "Nguyen The Hoang", current: true }], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } });
  URL.createObjectURL = vi.fn((blob: Blob) => `blob:preview-${(blob as Blob & { tag?: string }).tag ?? "x"}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

describe("distributePoints: the total score shared among the questions", () => {
  it("keeps the proportions and adds up to the total exactly", () => {
    expect(distributePoints([draftOf("1"), draftOf("1"), draftOf("2")], 8)).toEqual(["2", "2", "4"]);
    const shared = distributePoints([draftOf("1"), draftOf("1"), draftOf("1")], 10) as string[];
    expect(shared.reduce((a, b) => a + Math.round(Number(b) * 100), 0)).toBe(1000);
    expect(shared.every((x) => Number(x) >= 3.33)).toBe(true);
  });
  it("shares equally when no question has points, and refuses a total too small to give each one a hundredth", () => {
    expect(distributePoints([draftOf("0"), draftOf("")], 10)).toEqual(["5", "5"]);
    expect(distributePoints([draftOf("1"), draftOf("1"), draftOf("1")], 0.02)).toBeNull();
  });
});

describe("Training Assessment (APD.0009) in the library", () => {
  it("has the two types as the SOP names them, no Document and no Remarks", async () => {
    renderPage("/training-management/assessments/new", true);
    expect(await screen.findByText("Essay or multiple-choice test (APD.0009) (SOP default)")).toBeTruthy();
    expect(screen.queryByText(/Document \(for example/)).toBeNull();
    expect(screen.queryByText("Remarks")).toBeNull();
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pending Approval").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Effective").length).toBeGreaterThan(0);
  });

  it("a new assessment cannot be created until it is complete, and the draft is created with the typed content", async () => {
    api.create.mockResolvedValue(detail());
    renderPage("/training-management/assessments/new", true);
    const create = (await screen.findByRole("button", { name: "Create draft" })) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("Kiểm tra đào tạo SOP.0006"), { target: { value: "Kiểm tra SOP.0006" } });
    await openItems();
    expect(create.disabled).toBe(true);
    fireEvent.change(document.querySelector("textarea") as HTMLTextAreaElement, { target: { value: "Câu 1" } });
    fireEvent.change(screen.getByLabelText("Answer A"), { target: { value: "Một" } });
    fireEvent.change(screen.getByLabelText("Answer B"), { target: { value: "Hai" } });
    expect(create.disabled).toBe(true); // no right answer yet
    fireEvent.click(screen.getAllByRole("checkbox")[0]); // the right answer is A
    await waitFor(() => expect(create.disabled).toBe(false));
    fireEvent.click(create);
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create).toHaveBeenCalledWith({
      version: undefined, name: "Kiểm tra SOP.0006", kind: "QUESTIONS",
      items: [{ kind: "SINGLE", prompt: "Câu 1", options: [{ text: "Một" }, { text: "Hai" }], correct: ["A"], points: 1, modelAnswer: undefined }],
    });
  });

  it("editing the Total Score shares it among the questions in the tab Questions", async () => {
    api.get.mockResolvedValue(detail({ items: [
      { no: 1, kind: "ESSAY", prompt: "A", options: [], correct: [], points: 1, modelAnswer: null },
      { no: 2, kind: "ESSAY", prompt: "B", options: [], correct: [], points: 3, modelAnswer: null },
    ] }));
    renderPage("/training-management/assessments/d1");
    await waitFor(() => expect(totalField().value).toBe("4"));
    fireEvent.change(totalField(), { target: { value: "10" } });
    fireEvent.blur(totalField());
    await waitFor(() => expect(totalField().value).toBe("10"));
    await openItems();
    const fields = Array.from(document.querySelectorAll('input[type="number"]')).map((e) => (e as HTMLInputElement).value);
    expect(fields).toEqual(["2.5", "7.5"]);
    expect(await screen.findByText(/total 10 points/)).toBeTruthy();
  });

  it("a checklist has no score: no Total Score, no Points, a key per line", async () => {
    api.get.mockResolvedValue(detail({ kind: "CHECKLIST", maxScore: null, items: [{ no: 1, kind: "CHECK", prompt: "Khu vực sạch", options: [], correct: ["INCORRECT"], points: 1, modelAnswer: null }] }));
    renderPage("/training-management/assessments/d1");
    await screen.findByText("Checklist test (APD.0009)");
    expect(screen.queryByLabelText("Total Score")).toBeNull();
    await openItems();
    expect(await screen.findByText("Correct (Đúng)")).toBeTruthy();
    expect(screen.queryByText("Points")).toBeNull();
    expect(screen.queryByLabelText("Answer A")).toBeNull();
    expect(((screen.getByRole("radio", { name: "Incorrect (Không đúng)" })) as HTMLInputElement).checked).toBe(true);
  });

  it("an essay has a model answer for the trainer and no answers to tick", async () => {
    api.get.mockResolvedValue(detail({ items: [{ no: 1, kind: "ESSAY", prompt: "Mô tả", options: [], correct: [], points: 5, modelAnswer: "Ý chính" }] }));
    renderPage("/training-management/assessments/d1");
    await openItems();
    expect(await screen.findByDisplayValue("Ý chính")).toBeTruthy();
    expect(screen.queryByLabelText("Answer A")).toBeNull();
  });

  it("the answers of a question are dragged by a grip, the questions too: no arrow buttons", async () => {
    api.get.mockResolvedValue(detail({ items: [
      { no: 1, kind: "SINGLE", prompt: "Q1", options: [{ id: "A", text: "Một" }, { id: "B", text: "Hai" }], correct: ["A"], points: 1, modelAnswer: null },
      { no: 2, kind: "ESSAY", prompt: "Q2", options: [], correct: [], points: 1, modelAnswer: null },
    ] }));
    renderPage("/training-management/assessments/d1");
    await openItems();
    expect(await screen.findByLabelText("Drag Question 1")).toBeTruthy();
    expect(screen.getByLabelText("Drag Question 2")).toBeTruthy();
    expect(screen.getByLabelText("Drag answer A")).toBeTruthy();
    expect(screen.getByLabelText("Drag answer B")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Move .* (up|down)/ })).toBeNull();
    // the content of a question stays with it
    expect((screen.getByLabelText("Answer A") as HTMLInputElement).value).toBe("Một");
  });

  it("an effective version has no grip: it cannot be re-ordered", async () => {
    api.get.mockResolvedValue(detail({ status: "EFFECTIVE" }, { ...NO_CAPS, newVersion: true }));
    renderPage("/training-management/assessments/d1");
    await openItems();
    await screen.findByLabelText("Answer A");
    expect(screen.queryByLabelText(/^Drag /)).toBeNull();
  });
});

describe("reorderAnswers: the ticks follow the answers", () => {
  const q = (correct: string[], kind: "SINGLE" | "MULTI" = "SINGLE"): Draft => ({
    id: "q", kind, prompt: "Q", correct, points: "1", modelAnswer: "",
    options: [{ key: "k1", text: "Một" }, { key: "k2", text: "Hai" }, { key: "k3", text: "Ba" }],
  });
  const order = (d: Draft, keys: string[]) => keys.map((k) => d.options.find((o) => o.key === k) as Draft["options"][number]);

  it("the right answer keeps its text when it changes place", () => {
    const d = q(["A"]);
    const moved = reorderAnswers(d, order(d, ["k2", "k1", "k3"]));
    expect(moved.options.map((o) => o.text)).toEqual(["Hai", "Một", "Ba"]);
    expect(moved.correct).toEqual(["B"]); // "Một" is now the second
  });
  it("several right answers each follow their answer, and a drag to the end works", () => {
    const d = q(["A", "C"], "MULTI");
    const moved = reorderAnswers(d, order(d, ["k2", "k3", "k1"]));
    expect(moved.options.map((o) => o.text)).toEqual(["Hai", "Ba", "Một"]);
    expect(moved.correct.sort()).toEqual(["B", "C"]);
  });
  it("an order that does not change leaves the ticks as they are", () => {
    const d = q(["B"]);
    expect(reorderAnswers(d, order(d, ["k1", "k2", "k3"])).correct).toEqual(["B"]);
  });
});
describe("the flow of the assessment", () => {
  it("the flow: the designer saves and submits; the approver signs; the effective version is read only and has New Version", async () => {
    api.get.mockResolvedValue(detail());
    api.submit.mockResolvedValue(detail({ status: "PENDING_APPROVAL", submittedByName: "Designer" }, { ...NO_CAPS, returnToDraft: true, approve: true }));
    api.approve.mockResolvedValue(detail({ status: "EFFECTIVE", approvedByName: "Approver", approvedAt: "2026-10-24T08:00:00Z" }, { ...NO_CAPS, newVersion: true }));
    renderPage("/training-management/assessments/d1");
    expect(await screen.findByRole("button", { name: "Save draft" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete Draft" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Submit for Approval" }));
    await waitFor(() => expect(api.submit).toHaveBeenCalledWith("d1"));
    // pending: nothing to edit, the approver may approve or return it
    expect(await screen.findByRole("button", { name: "Approve" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Return to Draft" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save draft" })).toBeNull();
    expect((screen.getByPlaceholderText("Kiểm tra đào tạo SOP.0006") as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.click(await screen.findByRole("button", { name: "SIGN" }));
    await waitFor(() => expect(api.approve).toHaveBeenCalledWith("d1", "tok"));
    expect((await screen.findAllByRole("button", { name: "New Version" })).length).toBe(2);
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Submit for Approval" })).toBeNull();
  });

  it("Return to Draft needs a reason", async () => {
    api.get.mockResolvedValue(detail({ status: "PENDING_APPROVAL" }, { ...NO_CAPS, returnToDraft: true, approve: true }));
    api.returnToDraft.mockResolvedValue(detail());
    renderPage("/training-management/assessments/d1");
    fireEvent.click(await screen.findByRole("button", { name: "Return to Draft" }));
    const confirm = (await screen.findAllByRole("button", { name: "Return" })).at(-1) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(document.querySelector("textarea") as HTMLTextAreaElement, { target: { value: "Câu 2 sai" } });
    await waitFor(() => expect(confirm.disabled).toBe(false));
    fireEvent.click(confirm);
    await waitFor(() => expect(api.returnToDraft).toHaveBeenCalledWith("d1", "Câu 2 sai"));
    expect(await screen.findByRole("button", { name: "Submit for Approval" })).toBeTruthy();
  });

  it("a person who may approve but sent the draft is told why the approval is not offered", async () => {
    api.get.mockResolvedValue(detail({ status: "PENDING_APPROVAL", approveBlocker: "TRAINING_SEGREGATION_OF_DUTIES" }, { ...NO_CAPS, returnToDraft: true }));
    renderPage("/training-management/assessments/d1");
    expect(await screen.findByText(/You cannot approve this assessment/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("an effective version cannot be edited: its fields are read only", async () => {
    api.get.mockResolvedValue(detail({ status: "EFFECTIVE" }, { ...NO_CAPS, newVersion: true }));
    renderPage("/training-management/assessments/d1");
    const title = (await screen.findByPlaceholderText("Kiểm tra đào tạo SOP.0006")) as HTMLInputElement;
    expect(title.disabled).toBe(true);
    expect(totalField().disabled).toBe(true);
    await openItems();
    expect((screen.getByLabelText("Answer A") as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /Add a question/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Move answer/ })).toBeNull();
  });
  it("Preview shows the paper from what is in the editor; the answer key is a tab, made when it is first looked at, and both can be seen at the same time", async () => {
    api.get.mockResolvedValue(detail());
    api.preview.mockImplementation(async (b: { key: boolean; sideBySide?: boolean }) => Object.assign(new Blob(["%PDF"]), { tag: b.sideBySide ? "both" : b.key ? "key" : "paper" }));
    renderPage("/training-management/assessments/d1");
    // an unsaved change is part of the preview
    fireEvent.change(await screen.findByPlaceholderText("Kiểm tra đào tạo SOP.0006"), { target: { value: "Đổi tên chưa lưu" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Preview" })[0]);
    expect(await screen.findByRole("dialog", { name: "Preview: Đổi tên chưa lưu" })).toBeTruthy();
    expect(api.preview).toHaveBeenCalledTimes(1);
    expect(api.preview).toHaveBeenCalledWith({
      name: "Đổi tên chưa lưu", kind: "QUESTIONS", key: false, code: "TAS-0001", revisionNumber: "0.0.1",
      items: [{ kind: "SINGLE", prompt: "Câu 1", options: [{ text: "Một" }, { text: "Hai" }], correct: ["A"], points: 2, modelAnswer: undefined }],
    });
    expect(screen.getByTestId("pdf").textContent).toBe("blob:preview-paper");
    // no button that swaps the papers: tabs
    expect(screen.queryByRole("button", { name: /Show the/ })).toBeNull();
    expect(within(screen.getByRole("dialog")).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Test Paper", "Answer Key", "Side by Side"]);
    // the answer key is made only when it is looked at
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("tab", { name: "Answer Key" }));
    await waitFor(() => expect(api.preview).toHaveBeenLastCalledWith(expect.objectContaining({ key: true })));
    expect(api.preview).toHaveBeenCalledTimes(2);
    expect((await screen.findByTestId("pdf")).textContent).toBe("blob:preview-key");
    // both at the same time: one file with the two papers page beside page, in ONE viewer (scroll and zoom apply to both)
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("tab", { name: "Side by Side" }));
    await waitFor(() => expect(api.preview).toHaveBeenCalledTimes(3));
    expect(api.preview).toHaveBeenLastCalledWith(expect.objectContaining({ sideBySide: true }));
    expect((await screen.findByTestId("pdf")).textContent).toBe("blob:preview-both");
    expect(screen.getAllByTestId("pdf").length).toBe(1);
    // going back to a paper that was made does not make it again
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("tab", { name: "Answer Key" }));
    await waitFor(() => expect(screen.getByTestId("pdf").textContent).toBe("blob:preview-key"));
    expect(api.preview).toHaveBeenCalledTimes(3);
    // one button closes the window
    // one "Close" button in the foot of the window (the cross of its corner is the standard one of every window)
    expect(within(screen.getByRole("dialog")).getAllByText("Close").length).toBe(1);
    fireEvent.click(within(screen.getByRole("dialog")).getByText("Close"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /Preview/ })).toBeNull());
  });

  it("Preview loads on its own: the other buttons do not look busy, and nothing is created by it", async () => {
    api.get.mockResolvedValue(detail({ status: "EFFECTIVE" }, { ...NO_CAPS, newVersion: true }));
    let release: (b: Blob) => void = () => undefined;
    api.preview.mockImplementation(() => new Promise<Blob>((resolve) => { release = resolve; }));
    renderPage("/training-management/assessments/d1");
    fireEvent.click((await screen.findAllByRole("button", { name: "Preview" }))[0]);
    await waitFor(() => expect(api.preview).toHaveBeenCalled());
    // while the paper is being drawn, New Version is not loading (a loading button is disabled)
    for (const button of screen.getAllByRole("button", { name: "New Version" })) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(api.newVersion).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
    release(new Blob(["%PDF"]));
    await waitFor(() => expect(screen.getByRole("dialog", { name: /Preview/ })).toBeTruthy());
    for (const button of screen.getAllByRole("button", { name: "New Version" })) expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(api.newVersion).not.toHaveBeenCalled();
  });

  it("Preview is not offered while a question is not complete, and a refusal of the server opens nothing", async () => {
    renderPage("/training-management/assessments/new", true);
    const preview = (await screen.findAllByRole("button", { name: "Preview" }))[0] as HTMLButtonElement;
    expect(preview.disabled).toBe(true);
    expect(preview.title).toMatch(/Complete the assessment name and every question/);
    cleanup();
    api.get.mockResolvedValue(detail());
    api.preview.mockRejectedValue({ response: { data: { message: "TRAINING_ASSESSMENT_ITEM_INVALID" } } });
    renderPage("/training-management/assessments/d1");
    fireEvent.click((await screen.findAllByRole("button", { name: "Preview" }))[0]);
    await waitFor(() => expect(api.preview).toHaveBeenCalled());
    expect(screen.queryByRole("dialog", { name: /Preview/ })).toBeNull();
  });

  it("Preview is also there for an effective version, which is read only", async () => {
    api.get.mockResolvedValue(detail({ status: "EFFECTIVE" }, { ...NO_CAPS, newVersion: true }));
    renderPage("/training-management/assessments/d1");
    expect((await screen.findAllByRole("button", { name: "Preview" })).length).toBe(2);
  });
});

describe("Assessment Revision sub-tab", () => {
  it("lists the revisions under the footer buttons of General Information and opens another one", async () => {
    api.get.mockResolvedValue(detail());
    api.revisions.mockResolvedValue({
      data: [
        { id: "d1", revisionNumber: "1.0.1", name: "Kiểm tra SOP.0006", status: "DRAFT", createdAt: "2026-10-24T08:00:00Z", createdByName: "An", current: true },
        { id: "d0", revisionNumber: "1.0.0", name: "Kiểm tra SOP.0006", status: "OBSOLETED", createdAt: "2026-10-20T08:00:00Z", createdByName: "An", current: false },
      ],
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });
    renderPage("/training-management/assessments/d1");

    expect(await screen.findByRole("tab", { name: "Assessment Revision" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "1.0.0" })).toBeTruthy();
    expect(screen.getAllByText("Assessment Name").length).toBeGreaterThan(1);
    expect(api.revisions).toHaveBeenCalledWith("d1", expect.objectContaining({ sortBy: "revisionNumber", sortDirection: "desc", page: 1 }));
  });
});
