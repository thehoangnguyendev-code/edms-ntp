import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MaintenanceCountdownChip } from "../MaintenanceCountdownChip";
import { MaintenanceNoticeHost } from "../MaintenanceNoticeHost";
import { MaintenanceStatusProvider } from "../MaintenanceStatusProvider";
import { announcementFor, formatCountdown, mustSignOut, pollIntervalMs, remainingSeconds } from "../maintenanceStatus";

const ctl = vi.hoisted(() => ({ fetch: vi.fn(), logout: vi.fn(), navigate: vi.fn() }));

vi.mock("../maintenanceStatus", async () => {
  const actual = await vi.importActual<typeof import("../maintenanceStatus")>("../maintenanceStatus");
  return { ...actual, fetchMaintenanceStatus: ctl.fetch };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ logout: ctl.logout }) }));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => ctl.navigate };
});

const statusAt = (state: string, endsInSec: number | null) => {
  const now = Date.now();
  return {
    state,
    endsAt: endsInSec === null ? null : new Date(now + endsInSec * 1000).toISOString(),
    serverNow: new Date(now).toISOString(),
    locked: state === "LOCKED" || state === "DRAINED",
    source: "agent" as const,
  };
};

const renderInside = (ui: React.ReactNode) =>
  render(
    <MemoryRouter>
      <MaintenanceStatusProvider>{ui}</MaintenanceStatusProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  Object.values(ctl).forEach((fn) => fn.mockReset());
  ctl.logout.mockResolvedValue(undefined);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("countdown arithmetic", () => {
  it("formats mm:ss", () => {
    expect(formatCountdown(600)).toBe("10:00");
    expect(formatCountdown(59)).toBe("0:59");
    expect(formatCountdown(5)).toBe("0:05");
    expect(formatCountdown(-3)).toBe("0:00");
  });

  it("counts on the server's clock, so a wrong browser clock does not change the time left", () => {
    const now = 1_000_000_000_000;
    const endsAt = new Date(now + 120_000).toISOString();
    expect(remainingSeconds(endsAt, 0, now)).toBe(120);
    // the browser is 10 minutes behind the server: the end time is on the server's clock, the offset corrects the comparison
    const serverEnds = new Date(now + 600_000 + 120_000).toISOString();
    expect(remainingSeconds(serverEnds, 600_000, now)).toBe(120);
    expect(remainingSeconds(null, 0, now)).toBeNull();
    expect(remainingSeconds(endsAt, 0, now + 200_000)).toBe(0);
  });

  it("reads the status every 5 seconds only in the last minute of a notice, otherwise every 15", () => {
    expect(pollIntervalMs("NOTICE", 60)).toBe(5000);
    expect(pollIntervalMs("NOTICE", 120)).toBe(15000);
    expect(pollIntervalMs("NORMAL", null)).toBe(15000);
  });

  it("reads aloud only the 5-minute and 1-minute marks, with fixed texts", () => {
    expect(announcementFor(400, "NOTICE")).toBeNull();
    expect(announcementFor(300, "NOTICE")).toContain("5 minutes");
    expect(announcementFor(200, "NOTICE")).toBe(announcementFor(299, "NOTICE"));
    expect(announcementFor(60, "NOTICE")).toContain("1 minute");
    expect(announcementFor(5, "NOTICE")).toBe(announcementFor(59, "NOTICE"));
    expect(announcementFor(30, "NORMAL")).toBeNull();
  });

  it("knows when people must be signed out", () => {
    expect(mustSignOut("NOTICE")).toBe(false);
    expect(mustSignOut("DRAINED")).toBe(true);
    expect(mustSignOut("LOCKED")).toBe(true);
    expect(mustSignOut("NORMAL")).toBe(false);
  });
});

describe("header countdown chip", () => {
  it("shows nothing when there is no notice", async () => {
    ctl.fetch.mockResolvedValue(statusAt("NORMAL", null));
    renderInside(<MaintenanceCountdownChip />);
    await waitFor(() => expect(ctl.fetch).toHaveBeenCalled());
    expect(screen.queryByText("Maintenance")).toBeNull();
  });

  it("shows the time left in red, and opens the notice again when it is pressed", async () => {
    ctl.fetch.mockResolvedValue(statusAt("NOTICE", 600));
    renderInside(<><MaintenanceCountdownChip /><MaintenanceNoticeHost /></>);
    const chip = await screen.findByRole("button", { name: /System maintenance in \d+:\d\d/ }, { timeout: 3000 });
    expect(chip.className).toContain("bg-red-50");
    expect(chip.className).toContain("text-red-700");
    expect(await screen.findByText("Sign out now", {}, { timeout: 3000 })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByText("Sign out now")).toBeNull());
    expect(screen.getByRole("button", { name: /System maintenance/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /System maintenance/ }));
    expect(await screen.findByText("Sign out now")).toBeTruthy();
  });

  it("does not blink when the person asks for reduced motion", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
    ctl.fetch.mockResolvedValue(statusAt("NOTICE", 600));
    renderInside(<MaintenanceCountdownChip />);
    const chip = await screen.findByRole("button", { name: /System maintenance/ });
    expect(chip.getAttribute("style") ?? "").not.toContain("opacity");
  });
});

describe("notice to signed-in people", () => {
  it("opens by itself when a notice starts, and signs everyone out when the notice runs out", async () => {
    ctl.fetch.mockResolvedValue(statusAt("DRAINED", null));
    renderInside(<MaintenanceNoticeHost />);
    await waitFor(() => expect(ctl.logout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(ctl.navigate).toHaveBeenCalledWith("/maintenance", { replace: true }));
  });

  it("does not sign out while only a notice runs", async () => {
    ctl.fetch.mockResolvedValue(statusAt("NOTICE", 600));
    renderInside(<MaintenanceNoticeHost />);
    expect(await screen.findByText("Sign out now")).toBeTruthy();
    expect(ctl.logout).not.toHaveBeenCalled();
  });

  it("signs out from the dialog when the person chooses to", async () => {
    ctl.fetch.mockResolvedValue(statusAt("NOTICE", 600));
    renderInside(<MaintenanceNoticeHost />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign out now" }));
    await waitFor(() => expect(ctl.logout).toHaveBeenCalledTimes(1));
  });
});
