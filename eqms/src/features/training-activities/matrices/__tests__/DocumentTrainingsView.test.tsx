import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ documentTrainings: vi.fn(), impactContext: vi.fn(), assess: vi.fn() }));
const page = (data: unknown[]) => ({ data, pagination: { page: 1, limit: 10, total: data.length, totalPages: 1 } });
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({ ...(await importOriginal<object>()), trainingFollowUpApi: api }));
vi.mock("@/services/api/dictionary", () => ({ dictionaryApi: { getDepartments: () => Promise.resolve([{ id: "d1", name: "Quality Assurance" }]) } }));
const toast = vi.hoisted(() => ({ showToast: () => undefined }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => toast }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));
vi.mock("@/components/ui/page/PageHeader", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));

import { DocumentTrainingsView } from "../DocumentTrainingsView";

const row = { id: "a1", trainingNumber: "TRN/QA/26-002", trainingTitle: "SOP.10292 Cleaning", activityStatus: "PLANNED", documentId: "doc1", documentNumber: "SOP.10292", documentName: "Cleaning", revisionNumber: "02", departmentName: "Quality Assurance", createdAt: "2026-10-20T00:00:00Z", impactStatus: "PENDING", canAssess: true };
const context = { activityId: "a1", trainingNumber: "TRN/QA/26-002", documentNumber: "SOP.10292", documentName: "Cleaning", revisionNumber: "02", effectiveMatrix: { id: "m1", versionNo: 3 }, inEffectiveMatrix: false, positionsInMatrix: [], positions: [{ id: "p1", name: "QA Specialist" }, { id: "p2", name: "Operator" }], latest: [] };

beforeEach(() => {
  window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }) as MediaQueryList);
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Object.values(api).forEach((f) => f.mockReset());
  api.documentTrainings.mockResolvedValue(page([row]));
  api.impactContext.mockResolvedValue(context);
  try { window.localStorage.clear(); } catch { /* storage may be unavailable */ }
});
afterEach(cleanup);

const openDialog = async () => {
  render(<MemoryRouter><DocumentTrainingsView /></MemoryRouter>);
  await screen.findByText("SOP.10292");
  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  fireEvent.click(await screen.findByText("Assess Impact"));
  await screen.findByText("Result of the assessment");
};

describe("DocumentTrainingsView", () => {
  it("lists the documents that wait for an impact assessment, the ones not done yet by default", async () => {
    render(<MemoryRouter><DocumentTrainingsView /></MemoryRouter>);

    expect(await screen.findByText("SOP.10292")).toBeTruthy();
    expect(screen.getByText("Pending Impact Assessment")).toBeTruthy();
    expect(api.documentTrainings).toHaveBeenCalledWith(expect.objectContaining({ status: "OPEN" }));
  });

  it("tells what the effective matrix has and cannot go on until the result and the reason are given", async () => {
    await openDialog();

    expect(api.impactContext).toHaveBeenCalledWith("a1");
    expect(screen.getByText(/does not have this document/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("needs the positions to be trained when the matrix must be updated", async () => {
    await openDialog();

    fireEvent.click(screen.getByLabelText("The matrix must be updated"));
    fireEvent.change(screen.getAllByRole("textbox").at(-1) as HTMLElement, { target: { value: "New SOP for the QA team" } });
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText("QA Specialist"));
    await waitFor(() => expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false));
  });

  it("does not offer 'already covers' when no effective matrix has the document", async () => {
    await openDialog();

    expect((screen.getByLabelText("The effective matrix already covers the document") as HTMLInputElement).disabled).toBe(true);
  });
});
