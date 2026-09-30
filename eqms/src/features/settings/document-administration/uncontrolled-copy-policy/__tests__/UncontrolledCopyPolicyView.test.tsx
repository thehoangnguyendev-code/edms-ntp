import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";

const mocks = vi.hoisted(() => ({
  toast: { showToast: vi.fn() },
  getPolicy: vi.fn(), listEligibilityRules: vi.fn(), savePolicy: vi.fn(), requestSignature: vi.fn(), updateEligibilityRule: vi.fn(), deleteEligibilityRule: vi.fn(),
  hasPermissionAlias: vi.fn(),
}));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => mocks.toast }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermissionAlias: mocks.hasPermissionAlias }) }));
vi.mock("@/hooks/useNavigateWithLoading", () => ({ useNavigateWithLoading: () => ({ navigateTo: vi.fn() }) }));
vi.mock("@/features/security-authorization/shared/useSecurityESign", () => ({ useSecurityESign: () => ({ requestSignature: mocks.requestSignature, signatureModal: null }) }));
vi.mock("@/services/api", () => ({ dictionaryApi: { getDocumentTypes: async () => [] } }));
vi.mock("@/services/api/uncontrolledCopyPolicy", () => ({ uncontrolledCopyPolicyApi: mocks }));
vi.mock("../../controlled-copies-policy/MarkingPreviewPane", () => ({ MarkingPreviewPane: () => null }));
vi.mock("@/features/documents/uncontrolled-copies/UncontrolledCopyMarkingPreview", () => ({ UncontrolledCopyMarkingPreview: () => null }));

import { UncontrolledCopyPolicyView } from "../UncontrolledCopyPolicyView";

const rule = { id: "default", documentTypeId: null, documentTypeName: null, allowed: false, active: true, system: true, updatedAt: "2026-09-30T00:00:00Z" };
const mount = () => render(<MemoryRouter initialEntries={["/?tab=eligibility-rules"]}><BreadcrumbProvider><UncontrolledCopyPolicyView /></BreadcrumbProvider></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasPermissionAlias.mockImplementation((code: string) => code === "settings.configuration.manage");
  mocks.getPolicy.mockResolvedValue({ approvalRequired: true, validityHours: 72, allowRedownload: true, marking: {} });
  mocks.listEligibilityRules.mockResolvedValue([rule]);
  mocks.savePolicy.mockResolvedValue({ approvalRequired: true, validityHours: 72, allowRedownload: true, marking: {} });
  mocks.requestSignature.mockResolvedValue({ signatureToken: "signed-token", reason: "reviewed" });
  mocks.updateEligibilityRule.mockResolvedValue(rule);
  mocks.deleteEligibilityRule.mockResolvedValue(undefined);
});

describe("Eligibility Rules table", () => {
  it.each(["Stamp", "Watermark"] as const)("resets only %s positions in its card, staged until Save Changes", async (kind) => {
    mocks.getPolicy.mockResolvedValue({ approvalRequired: true, validityHours: 72, allowRedownload: true, marking: {
      placements: [
        { pages: "FIRST", stampX: 0.1, stampY: 0.2, stampWidthPercent: 30, watermarkX: 0.4, watermarkY: 0.5, watermarkScalePercent: 90, watermarkAngleDegrees: 35 },
        { pages: "OTHERS", ...(kind === "Stamp" ? { stampX: 0.2 } : { watermarkX: 0.3 }) },
      ],
    } });
    mount();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("tab", { name: "PDF Markings" }));
    const reset = screen.getByRole("button", { name: `Reset ${kind} Position` });
    expect(reset.closest("div.rounded-xl")?.textContent).toContain(kind === "Stamp" ? "Stamp" : "Watermark (mandatory)");
    fireEvent.click(reset);
    expect(screen.queryByRole("button", { name: `Reset ${kind} Position` })).toBeNull();
    expect(screen.getByRole("button", { name: `Reset ${kind === "Stamp" ? "Watermark" : "Stamp"} Position` })).toBeInTheDocument();
    expect(mocks.savePolicy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    const expected = kind === "Stamp"
      ? { pages: "FIRST", watermarkX: 0.4, watermarkY: 0.5, watermarkScalePercent: 90, watermarkAngleDegrees: 35 }
      : { pages: "FIRST", stampX: 0.1, stampY: 0.2, stampWidthPercent: 30 };
    await waitFor(() => expect(mocks.savePolicy).toHaveBeenCalledWith(expect.objectContaining({ marking: expect.objectContaining({ placements: [expected] }) }), expect.anything()));
  });

  it("shows badges, No. and sortable data columns without table switches", async () => {
    mount();
    const table = await screen.findByRole("table");
    expect(within(table).getByRole("columnheader", { name: "No." })).toBeInTheDocument();
    expect(within(table).getByText("Blocked")).toBeInTheDocument();
    expect(within(table).getByText("Active")).toBeInTheDocument();
    expect(within(table).queryByRole("switch")).toBeNull();
    fireEvent.click(within(table).getByRole("columnheader", { name: "Document Type" }));
    expect(mocks.listEligibilityRules).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("tab", { name: "Eligibility Rules" })).toBeNull();
  });

  it("keeps only Edit/Delete in Action and changes status through the Edit modal", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Actions for Any" }));
    for (const name of ["Edit", "Delete"]) {
      expect(screen.getByRole("button", { name })).toBeEnabled();
    }
    expect(screen.queryByRole("button", { name: /Allow uncontrolled copies|Block uncontrolled copies|Activate|Deactivate/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(await screen.findByText("Edit Eligibility Rule")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    const switches = within(dialog).getAllByRole("switch");
    fireEvent.click(switches[0]);
    fireEvent.click(switches[1]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Apply to draft" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("tab", { name: "PDF Markings" }));
    fireEvent.click(screen.getByRole("tab", { name: "Eligibility & Validity" }));
    expect(within(screen.getByRole("table")).getByRole("cell", { name: "Allowed" })).toBeInTheDocument();
    expect(mocks.listEligibilityRules).toHaveBeenCalledTimes(1);
    expect(mocks.updateEligibilityRule).not.toHaveBeenCalled();
    expect(mocks.savePolicy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(mocks.savePolicy).toHaveBeenCalledWith(expect.objectContaining({
      eligibilityRuleChanges: [{ id: "default", expectedUpdatedAt: rule.updatedAt, delete: false, documentTypeId: null, allowed: true, active: false }],
    }), { signatureToken: "signed-token", reason: "reviewed" }));
  });

  it("keeps rule mutations hidden from read-only users", async () => {
    mocks.hasPermissionAlias.mockReturnValue(false);
    mount();
    await screen.findByRole("table");
    expect(screen.queryByRole("button", { name: "Actions for Any" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add Rule" })).toBeNull();
  });

  it("can delete the seeded default from Action", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Actions for Any" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.deleteEligibilityRule).not.toHaveBeenCalled();
    expect(mocks.savePolicy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(mocks.savePolicy).toHaveBeenCalledWith(expect.objectContaining({
      eligibilityRuleChanges: [expect.objectContaining({ id: "default", delete: true })],
    }), expect.anything()));
  });

  it("retains staged additions when signing is cancelled or save fails", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Add Rule" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Apply to draft" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    mocks.requestSignature.mockResolvedValueOnce(null);
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save Changes" })).toBeEnabled());
    expect(mocks.savePolicy).not.toHaveBeenCalled();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3);
    mocks.savePolicy.mockRejectedValueOnce(new Error("conflict"));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(mocks.toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" })));
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3);
    expect(mocks.listEligibilityRules).toHaveBeenCalledTimes(1);
  });
});
