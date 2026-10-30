import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rows = vi.hoisted(() => [
  { id: "APD.0117", code: "APD.0117", status: "ACTIVE", title: "Training attendance sheet", enabledVersion: "1.1", tokenMode: "TOKENS", enabledAt: "2026-10-28T02:00:00Z", templateCount: 2, tokenChecked: true, actions: { view: true, edit: true, enable: true, disable: true } },
  { id: "APD.0118", code: "APD.0118", status: "INACTIVE", title: "Training requirement", enabledVersion: null, tokenMode: null, enabledAt: null, templateCount: 0, tokenChecked: true, actions: { view: true, edit: true, enable: false, disable: false } },
  { id: "APD.0009", code: "APD.0009", status: "ACTIVE", title: "Training assessment", enabledVersion: "2.0", tokenMode: "NOT_APPLICABLE", enabledAt: null, templateCount: 1, tokenChecked: false, actions: { view: true, edit: false, enable: false, disable: false } },
]);
const page = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const detail = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async (importOriginal) => ({ ...(await importOriginal<object>()), useNavigate: () => navigate }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  trainingAnnexApi: { page, detail },
}));
const toast = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => toast }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));
vi.mock("@/components/ui/page/PageHeader", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));

import { TrainingAnnexView } from "../TrainingAnnexView";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  page.mockResolvedValue({ data: rows, pagination: { page: 1, limit: 10, total: rows.length, totalPages: 1 } });
  window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }) as MediaQueryList);
});
afterEach(() => { cleanup(); page.mockReset(); navigate.mockReset(); detail.mockReset(); });

describe("TrainingAnnexView", () => {
  it("lists each form with the revision in force and how its template is written", async () => {
    render(<MemoryRouter><TrainingAnnexView /></MemoryRouter>);
    expect(await screen.findByText("Training attendance sheet")).toBeTruthy();
    expect(screen.getByText("Tokens")).toBeTruthy();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getByText("Inactive")).toBeTruthy();
    expect(screen.getByText("Built by the assessment builder")).toBeTruthy();
  });

  it("opens the details of a form from its document number", async () => {
    render(<MemoryRouter><TrainingAnnexView /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "APD.0117" }));
    expect(navigate).toHaveBeenCalledWith("/settings/administration/training/annex/APD.0117");
  });

  it("asks the server for the search and the status filter", async () => {
    render(<MemoryRouter><TrainingAnnexView /></MemoryRouter>);
    await screen.findByText("Training requirement");
    fireEvent.change(screen.getAllByPlaceholderText(/Search document number or name/)[0], { target: { value: "matrix" } });
    await vi.waitFor(() => expect(page).toHaveBeenCalledWith(expect.objectContaining({ search: "matrix" })));
  });
  it("explains that the list is fixed by the system", async () => {
    render(<MemoryRouter><TrainingAnnexView /></MemoryRouter>);
    expect(await screen.findByText(/fixed by the system/)).toBeTruthy();
  });

  it("offers in the menu of a row only what the server allows", async () => {
    render(<MemoryRouter><TrainingAnnexView /></MemoryRouter>);
    await screen.findByText("Training attendance sheet");
    fireEvent.click(screen.getAllByLabelText(/More actions/i)[0]);
    expect(await screen.findByText("View Details")).toBeTruthy();
    expect(screen.getByText("Edit Training Annex")).toBeTruthy();
    expect(screen.getByText("Enable Another Version")).toBeTruthy();
    expect(screen.getByText("Disable Training Annex")).toBeTruthy();
    expect(screen.queryByText("Enable Training Annex")).toBeNull();
  });

  it("goes to the edit page from the menu", async () => {
    render(<MemoryRouter><TrainingAnnexView /></MemoryRouter>);
    await screen.findByText("Training attendance sheet");
    fireEvent.click(screen.getAllByLabelText(/More actions/i)[0]);
    fireEvent.click(await screen.findByText("Edit Training Annex"));
    expect(navigate).toHaveBeenCalledWith("/settings/administration/training/annex/APD.0117/edit");
  });
});
