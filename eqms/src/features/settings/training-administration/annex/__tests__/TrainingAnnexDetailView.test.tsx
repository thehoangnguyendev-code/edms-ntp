import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const detail = vi.hoisted(() => ({
  code: "APD.0118", title: "Training requirement", starterAvailable: true,
  contract: {
    checked: true, scalars: ["YEAR", "REQUEST_NO"], cases: [], checks: ["KIND_ANNUAL"], blocks: [], required: ["YEAR", "REQUEST_NO", "LINE.NO"],
    groups: [{ name: "LINE", fields: ["NO", "MONTH"], repeatsBlock: false }],
    slots: [{ name: "PREPARED", stage: "M1 the requirement is prepared", meanings: ["TRAINING_REQUIREMENT_PREPARED"], style: null }],
  },
  templates: [
    { id: "t1", code: "APD.0118", title: "Training requirement", versionLabel: "2.0", status: "ENABLED", tokenMode: "TOKENS", checkProblems: null, checkedAt: "2026-10-28T01:00:00Z", enabledByName: "QA", enabledAt: "2026-10-28T02:00:00Z", originalName: "a.docx", sha256: "a".repeat(64), uploadedByName: "QA", uploadedAt: "2026-10-27T01:00:00Z" },
    { id: "t2", code: "APD.0118", title: "Training requirement", versionLabel: "1.0", status: "DISABLED", tokenMode: "TOKENS", checkProblems: "missing token: YEAR\nunknown token: FOO", checkedAt: "2026-10-27T01:00:00Z", originalName: "b.docx", sha256: "b".repeat(64), uploadedByName: "QA", uploadedAt: "2026-10-26T01:00:00Z" },
    { id: "t3", code: "APD.0118", title: "Training requirement", versionLabel: "0.9", status: "DISABLED", tokenMode: "LEGACY", checkProblems: null, originalName: "c.docx", sha256: "c".repeat(64), uploadedByName: "QA", uploadedAt: "2026-10-25T01:00:00Z" },
  ],
}));
const api = vi.hoisted(() => ({ detail: vi.fn(), setStyle: vi.fn(), preview: vi.fn(), starter: vi.fn() }));
const permissions = vi.hoisted(() => ({ granted: new Set(["training.annex.view", "training.annex.manage", "training.annex.enable"]) }));
const toast = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (code: string) => permissions.granted.has(code) }) }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({ ...(await importOriginal<object>()), trainingAnnexApi: api }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => toast }));
vi.mock("@/components/ui/page/PageHeader", () => ({ PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => <div><h1>{title}</h1>{actions}</div> }));
vi.mock("@/features/documents/shared/components/DocumentPdfViewer", () => ({ DocumentPdfViewer: ({ fileUrl }: { fileUrl: string }) => <div>pdf viewer {fileUrl}</div> }));
vi.mock("@/features/documents/shared/components/OnlyOfficeDocumentViewer", () => ({ OnlyOfficeDocumentViewer: () => <div>word viewer</div> }));

import { TrainingAnnexDetailView } from "../TrainingAnnexDetailView";

const open = (mode: "view" | "edit" = "view") => render(<MemoryRouter initialEntries={["/annex/APD.0118"]}><Routes><Route path="/annex/:code" element={<TrainingAnnexDetailView mode={mode} />} /></Routes></MemoryRouter>);

beforeEach(() => {
  window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }) as MediaQueryList);
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
  api.detail.mockResolvedValue(detail);
  api.setStyle.mockResolvedValue({});
  api.preview.mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
});
afterEach(() => { cleanup(); Object.values(api).forEach((f) => f.mockReset()); permissions.granted = new Set(["training.annex.view", "training.annex.manage", "training.annex.enable"]); });

describe("TrainingAnnexDetailView", () => {
  it("opens on the version in force with its check and its preview, all on one page, to read only", async () => {
    open();
    expect(await screen.findByText("Training Annex Details")).toBeTruthy();
    expect(await screen.findByText(/All required tokens are present/)).toBeTruthy();
    await waitFor(() => expect(api.preview).toHaveBeenCalledWith("t1"));
    expect(await screen.findByText("pdf viewer blob:preview")).toBeTruthy();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByRole("button", { name: /Upload Template/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Enable This Version/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Disable/ })).toBeNull();
    expect(screen.queryByText(/Audit Trail/)).toBeNull();
    expect(screen.queryByLabelText("Style of PREPARED")).toBeNull();
  });

  it("lists the problems of a version that does not agree, and offers no preview for it", async () => {
    api.detail.mockResolvedValue({ ...detail, templates: [detail.templates[1]] });
    open();
    expect(await screen.findByText("missing token: YEAR")).toBeTruthy();
    expect(screen.getByText("unknown token: FOO")).toBeTruthy();
    expect(await screen.findByText(/does not agree with the form, so it cannot be previewed/)).toBeTruthy();
    expect(api.preview).not.toHaveBeenCalled();
  });

  it("says that an earlier template is not checked and cannot be previewed", async () => {
    api.detail.mockResolvedValue({ ...detail, templates: [detail.templates[2]] });
    open();
    expect(await screen.findByText(/Earlier template, tokens not checked/)).toBeTruthy();
    expect(await screen.findByText(/Only a template written with tokens can be previewed/)).toBeTruthy();
  });

  it("lists the tokens to write in Word and the slots of the signatures", async () => {
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Expand Tokens for the Word File" }));
    expect(screen.getByText("{{YEAR}}")).toBeTruthy();
    expect(screen.getByText("{{LINE.MONTH}}")).toBeTruthy();
    expect(screen.getByText("{{CHECK:KIND_ANNUAL}}")).toBeTruthy();
    expect(screen.getByText("{{SIGNATURE:PREPARED}}")).toBeTruthy();
    expect(screen.getByText(/M1 the requirement is prepared/)).toBeTruthy();
  });

  it("in the edit page uploads a template and saves the style of a slot only with a reason; it enables and disables nothing", async () => {
    open("edit");
    expect(await screen.findByText("Edit Training Annex")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Upload Template/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Enable This Version/ })).toBeNull();
    fireEvent.click(await screen.findByLabelText("Style of PREPARED"));
    fireEvent.click((await screen.findAllByText("Compact"))[0]);
    const save = (await screen.findByRole("button", { name: "Save" })) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    const boxes = screen.getAllByRole("textbox");
    fireEvent.change(boxes[boxes.length - 1], { target: { value: "Narrow cell" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.setStyle).toHaveBeenCalledWith("APD.0118", "PREPARED", "COMPACT", "Narrow cell"));
  });
});
