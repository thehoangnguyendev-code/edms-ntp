import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";

const api = vi.hoisted(() => ({ get: vi.fn(), revisions: vi.fn(), image: vi.fn(), confirm: vi.fn(), reject: vi.fn() }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({ ...(await importOriginal<object>()), trainingSpecimenApi: api }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/features/documents/shared/components/AuditTrailTab", () => ({ AuditTrailTab: () => <div>audit</div> }));

import { TrainingSpecimenDetailPage } from "../TrainingSpecimenDetailPage";

const specimen = (over: Record<string, unknown> = {}) => ({
  id: "s2", personUserId: "u1", fullName: "Nguyen Van An", employeeCode: "NTP.0005", department: "Quality Assurance", versionNo: 2, status: "PENDING_CONFIRMATION", effectiveDate: null,
  contentType: "image/png", sizeBytes: 100, createdAt: "2026-10-24T08:00:00Z", uploadedByName: "An", confirmedByName: null, hasSecond: true,
  capabilities: { viewImage: true, confirm: true, reject: true, reupload: false }, ...over,
});
const revisionPage = {
  data: [
    { id: "s2", versionNo: 2, status: "PENDING_CONFIRMATION", effectiveDate: null, createdAt: "2026-10-24T08:00:00Z", uploadedByName: "An", confirmedByName: null, current: true },
    { id: "s1", versionNo: 1, status: "OBSOLETED", effectiveDate: "2026-10-18", createdAt: "2026-10-18T08:00:00Z", uploadedByName: "An", confirmedByName: "Binh", current: false },
  ],
  pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
};

const renderPage = () => render(
  <BreadcrumbProvider>
    <MemoryRouter initialEntries={["/training-management/specimen-signatures/s2"]}>
      <Routes>
        <Route path="/training-management/specimen-signatures/:specimenId" element={<TrainingSpecimenDetailPage />} />
      </Routes>
    </MemoryRouter>
  </BreadcrumbProvider>,
);

beforeEach(() => {
  window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }) as MediaQueryList);
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Object.values(api).forEach((f) => f.mockReset());
  api.get.mockResolvedValue(specimen());
  api.revisions.mockResolvedValue(revisionPage);
});
afterEach(cleanup);

describe("TrainingSpecimenDetailPage", () => {
  it("shows the facts of the version, and the footer offers what the server says the person may do", async () => {
    renderPage();

    expect(await screen.findByDisplayValue("Nguyen Van An")).toBeTruthy();
    expect(screen.getByDisplayValue("Pending Confirmation")).toBeTruthy();
    expect(screen.getByRole("button", { name: /View Image/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Confirm/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Reject/ })).toBeTruthy();
  });

  it("keeps a rejected signature in Pending Confirmation, shows the reason and offers Upload Again instead of Confirm or Reject", async () => {
    api.get.mockResolvedValue(specimen({ rejectReason: "Only the name", capabilities: { viewImage: true, confirm: false, reject: false, reupload: true } }));
    renderPage();

    expect(await screen.findByDisplayValue("Only the name")).toBeTruthy();
    expect(screen.getByDisplayValue("Pending Confirmation")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Upload Again/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Confirm/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Reject/ })).toBeNull();
  });

  it("offers no Confirm or Reject to a person who may not, and no form download for a version that is not approved yet", async () => {
    api.get.mockResolvedValue(specimen({ capabilities: { viewImage: true, confirm: false, reject: false, reupload: false } }));
    renderPage();

    await screen.findByDisplayValue("Nguyen Van An");
    expect(screen.queryByRole("button", { name: /Confirm/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Reject/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /FRM.0007/ })).toBeNull();
  });

  it("lists every version of the person in the sub-tab under the footer, newest first, and marks the one that is open", async () => {
    renderPage();

    expect(await screen.findByRole("tab", { name: "Specimen Signature Revision" })).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Viewing")).toBeTruthy());
    expect(screen.getByRole("button", { name: "1" })).toBeTruthy();
    expect(api.revisions).toHaveBeenCalledWith("s2", expect.objectContaining({ sortBy: "versionNo", sortDirection: "desc", page: 1 }));
  });

  it("opens the images of the version when View Image is pressed", async () => {
    api.image.mockResolvedValue(new Blob(["x"], { type: "image/png" }));
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /View Image/ }));
    await waitFor(() => expect(api.image).toHaveBeenCalledWith("s2", 2));
  });
});
