import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";

const mocks = vi.hoisted(() => ({
  toast: { showToast: vi.fn() },
  getPolicy: vi.fn(),
  getDcoEligibleUsers: vi.fn(),
  savePolicy: vi.fn(),
  requestSignature: vi.fn(),
  hasPermissionAlias: vi.fn(),
}));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => mocks.toast }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermissionAlias: mocks.hasPermissionAlias }) }));
vi.mock("@/hooks/useNavigateWithLoading", () => ({ useNavigateWithLoading: () => ({ navigateTo: vi.fn() }) }));
vi.mock("@/features/security-authorization/shared/useSecurityESign", () => ({ useSecurityESign: () => ({ requestSignature: mocks.requestSignature, signatureModal: null }) }));
vi.mock("@/services/api", () => ({ controlledCopyPolicyApi: mocks }));
vi.mock("@/services/api/dictionary", () => ({ dictionaryApi: { getDocumentTypes: async () => [], getDepartments: async () => [] } }));
vi.mock("../MarkingPreviewPane", () => ({ MarkingPreviewPane: () => null }));

import { ControlledCopiesPolicyView } from "../ControlledCopiesPolicyView";

const placements = [
  { pages: "FIRST", stampX: 0.1, stampY: 0.2, stampWidthPercent: 30, watermarkX: 0.4, watermarkY: 0.5, watermarkScalePercent: 90, watermarkAngleDegrees: 35 },
  { pages: "OTHERS", stampX: 0.3, watermarkY: 0.6 },
];
const mount = () => render(
  <MemoryRouter initialEntries={["/?tab=markings"]}>
    <BreadcrumbProvider><ControlledCopiesPolicyView /></BreadcrumbProvider>
  </MemoryRouter>,
);
const scenarios = [
  { key: "ISSUED", label: "Distributed Copy" },
  { key: "OBSOLETED", label: "Obsoleted" },
  { key: "CLOSED_CANCELLED", label: "Closed - Cancelled" },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasPermissionAlias.mockReturnValue(true);
  mocks.getDcoEligibleUsers.mockResolvedValue([]);
  mocks.getPolicy.mockResolvedValue({
    marking: { placements },
    statusMarking: { OBSOLETED: { placements }, CLOSED_CANCELLED: { placements } },
  });
  mocks.requestSignature.mockResolvedValue({ signatureToken: "signed-token", reason: "reviewed" });
  mocks.savePolicy.mockResolvedValue({});
});

describe("Controlled Copy per-card position reset", () => {
  for (const scenario of scenarios) {
    for (const kind of ["stamp", "watermark"] as const) {
      it(`resets only ${kind} in ${scenario.key}, across page groups, on signed Save only`, async () => {
        // Include a page group with only the reset kind, which must be removed after reset.
        const customPlacements = [placements[0], { pages: "OTHERS", [`${kind}X`]: 0.3 }];
        mocks.getPolicy.mockResolvedValue({
          marking: { placements: customPlacements },
          statusMarking: {
            OBSOLETED: { placements: customPlacements },
            CLOSED_CANCELLED: { placements: customPlacements },
          },
        });
        mount();
        fireEvent.click(await screen.findByRole("tab", { name: scenario.label }));
        const resetName = `Reset ${kind === "stamp" ? "Stamp" : "Watermark"} Position`;
        const reset = screen.getByRole("button", { name: resetName });
        expect(reset.closest("div.rounded-xl")?.textContent).toContain(kind === "stamp" ? "Stamp" : "Watermark");
        fireEvent.click(reset);
        expect(screen.queryByRole("button", { name: resetName })).toBeNull();
        expect(screen.getByRole("button", { name: kind === "stamp" ? "Reset Watermark Position" : "Reset Stamp Position" })).toBeTruthy();
        expect(mocks.savePolicy).not.toHaveBeenCalled();
        expect(mocks.requestSignature).not.toHaveBeenCalled();
        // Switching scenarios must not discard the reset or modify another scenario.
        const other = scenarios.find((item) => item.key !== scenario.key)!;
        fireEvent.click(screen.getByRole("tab", { name: other.label }));
        expect(screen.getByRole("button", { name: resetName })).toBeTruthy();
        fireEvent.click(screen.getByRole("tab", { name: scenario.label }));
        expect(screen.queryByRole("button", { name: resetName })).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
        await waitFor(() => expect(mocks.savePolicy).toHaveBeenCalledTimes(1));
        const [payload, signature] = mocks.savePolicy.mock.calls[0];
        const expected = kind === "stamp"
          ? [{ pages: "FIRST", watermarkX: 0.4, watermarkY: 0.5, watermarkScalePercent: 90, watermarkAngleDegrees: 35 }]
          : [{ pages: "FIRST", stampX: 0.1, stampY: 0.2, stampWidthPercent: 30 }];
        for (const item of scenarios) {
          const config = item.key === "ISSUED" ? payload.marking : payload.statusMarking[item.key];
          expect(config.placements).toEqual(item.key === scenario.key ? expected : customPlacements);
          expect(config.stampPosition).toBe("TOP_RIGHT");
          expect(config.watermarkAngleDegrees).toBe(35);
        }
        expect(signature).toEqual({ signatureToken: "signed-token", reason: "reviewed" });
      });
    }
  }

  it("hides position reset from read-only users", async () => {
    mocks.hasPermissionAlias.mockReturnValue(false);
    mount();
    await screen.findByRole("tab", { name: "Distributed Copy" });
    for (const scenario of scenarios) {
      fireEvent.click(screen.getByRole("tab", { name: scenario.label }));
      expect(screen.queryByRole("button", { name: /Reset (Stamp|Watermark) Position/ })).toBeNull();
    }
  });

  it("hides reset when no custom placement exists", async () => {
    mocks.getPolicy.mockResolvedValue({});
    mount();
    await screen.findByRole("tab", { name: "Distributed Copy" });
    expect(screen.queryByRole("button", { name: /Reset (Stamp|Watermark) Position/ })).toBeNull();
  });
});
