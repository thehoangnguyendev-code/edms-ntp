import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ summary: vi.fn(), items: vi.fn() }));
vi.mock("@/services/api", () => ({
  settingsApi: {
    getAccessReviewSummary: mocks.summary,
    listAccessReviewItemsPaged: mocks.items,
    getAccessReviewListOptions: vi.fn().mockResolvedValue({ userStatuses: [], decisions: [] }),
  },
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermissionAlias: () => true, hasPermission: () => true }) }));
vi.mock("@/features/security-authorization/shared/useSecurityESign", () => ({ useSecurityESign: () => ({ requestSignature: vi.fn(), signatureModal: null }) }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/hooks", async (importOriginal) => ({ ...(await importOriginal<object>()), useLocalizationPreferences: () => undefined }));

import { AccessReviewCampaignDetailView } from "../AccessReviewCampaignDetailView";

const campaign = { id: "c1", campaignNumber: "AR-0001", name: "Q4 review", status: "IN_PROGRESS", statusLabel: "In Progress", totalItems: 3, pendingItems: 3, createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z" };
const base = { userId: "u", employeeCode: "E", userStatus: "ACTIVE", userStatusLabel: "Active", accessProfiles: "Reader", permissionCount: 4, superAdmin: false, decision: "PENDING", decisionLabel: "Pending" };
const item = (extra: Record<string, unknown>) => ({ ...base, id: String(extra.username), ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  mocks.summary.mockResolvedValue(campaign);
  mocks.items.mockResolvedValue({
    data: [
      item({ username: "stale.user", fullName: "Stale User", lastLoginAt: "2026-06-01T03:00:00Z", inactiveDays: 170, inactive: true, mfaState: "REQUIRED_NOT_ENROLLED", mfaStateLabel: "Required, not enrolled", timeLimitedUntil: "2026-12-31T03:00:00Z", openSodViolations: 2 }),
      item({ username: "fresh.user", fullName: "Fresh User", lastLoginAt: "2026-11-17T03:00:00Z", inactiveDays: 1, inactive: false, mfaState: "ENROLLED", mfaStateLabel: "Enrolled", timeLimitedUntil: null, openSodViolations: 0 }),
      item({ username: "old.campaign", fullName: "Old Campaign" }),
    ],
    pagination: { total: 3, totalPages: 1 },
  });
});
afterEach(() => cleanup());

const open = () => render(<MemoryRouter initialEntries={["/security/access-review/c1"]}><BreadcrumbProvider><Routes><Route path="/security/access-review/:id" element={<AccessReviewCampaignDetailView />} /></Routes></BreadcrumbProvider></MemoryRouter>);
const row = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;

describe("Access Review items: the facts that help the reviewer decide", () => {
  it("shows the last sign-in, the days without one, the state of MFA, the end of a time-limited account and the SoD conflicts, and flags the inactive person", async () => {
    open();
    await waitFor(() => expect(screen.getByText("Stale User")).toBeTruthy());

    const stale = row("Stale User");
    expect(stale.textContent).toContain("170 days without sign-in");
    expect(stale.textContent).toContain("Required, not enrolled");
    expect(stale.textContent).toContain("Inactive");
    expect(stale.textContent).toContain("2"); // SoD conflicts
    const fresh = row("Fresh User");
    expect(fresh.textContent).toContain("1 days without sign-in");
    expect(fresh.textContent).toContain("Enrolled");
    expect(fresh.textContent).not.toContain("Inactive");
  });

  it("says 'Not captured' for a campaign made before the facts existed, instead of showing a guess", async () => {
    open();
    await waitFor(() => expect(screen.getByText("Old Campaign")).toBeTruthy());

    const old = row("Old Campaign");
    expect(old.textContent).toContain("Not captured");
    expect(old.textContent).not.toContain("days without sign-in");
    expect(old.textContent).not.toContain("Inactive");
  });
});
