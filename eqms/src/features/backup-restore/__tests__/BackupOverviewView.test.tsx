import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import type { BackupOverview } from "@/services/api/backupRestore";
import { BackupOverviewView, groupAlerts, toAlerts } from "../views/BackupOverviewView";

const api = vi.hoisted(() => ({ overview: vi.fn() }));
vi.mock("@/services/api/backupRestore", () => ({ backupRestoreApi: api }));

const healthy: BackupOverview = {
  environment: "DEV",
  completed: 5,
  failed: 0,
  running: 0,
  notVerified: 0,
  lastCompleted: { backupId: "BK-20261008-0831-0008", finishedAt: "2026-10-08T01:31:00Z", sizeBytes: 85_000_000 },
  openAlerts: [],
  ledger: { ok: true, checked: 44, reason: null, fileCopyCompared: true },
};

const alert = (id: string, code: string, severity: string, at: string, detail = "detail " + id, ref: string | null = "BK-" + id) => ({ id, at, severity, code, detail, ref });

const renderOverview = () =>
  render(
    <BreadcrumbProvider>
      <MemoryRouter>
        <BackupOverviewView />
      </MemoryRouter>
    </BreadcrumbProvider>,
  );

beforeEach(() => {
  api.overview.mockReset();
});
afterEach(cleanup);

describe("BackupOverviewView", () => {
  it("says all is clear when nothing failed and the ledger is intact", async () => {
    api.overview.mockResolvedValue(healthy);
    renderOverview();
    const area = await screen.findByRole("region", { name: "Needs attention" });
    expect(within(area).getByText("All clear")).toBeTruthy();
    expect(screen.getByText("Intact")).toBeTruthy();
    expect(screen.getByText("backup BK-20261008-0831-0008")).toBeTruthy();
  });

  it("puts the same kind of problem on one line with a count, and shows each occurrence on request", async () => {
    api.overview.mockResolvedValue({
      ...healthy,
      failed: 3,
      openAlerts: [
        alert("a", "BACKUP_DUMP_FAILED", "HIGH", "2026-10-08T01:00:00Z"),
        alert("b", "BACKUP_DUMP_FAILED", "HIGH", "2026-10-08T02:00:00Z"),
        alert("c", "BACKUP_DUMP_FAILED", "HIGH", "2026-10-08T03:00:00Z"),
      ],
    });
    renderOverview();
    const area = await screen.findByRole("region", { name: "Needs attention" });
    expect(within(area).getAllByRole("button")).toHaveLength(1);
    expect(within(area).getByText("×3")).toBeTruthy();
    expect(within(area).getByText("3 open")).toBeTruthy();
    expect(within(area).getByText("3 need action · 0 to review · 1 kind of problem")).toBeTruthy();
    expect(within(area).queryByText("BK-a")).toBeNull();
    fireEvent.click(within(area).getByRole("button"));
    expect(within(area).getByText("BK-a")).toBeTruthy();
    expect(within(area).getByText("BK-c")).toBeTruthy();
    expect(within(area).getByRole("button").getAttribute("aria-expanded")).toBe("true");
  });

  it("lists a broken ledger first, then failures, then the warning", async () => {
    api.overview.mockResolvedValue({
      ...healthy,
      failed: 1,
      notVerified: 2,
      openAlerts: [alert("a1", "BACKUP_DUMP_FAILED", "HIGH", "2026-10-08T01:00:00Z", "pg_dump failed", "BK-1")],
      ledger: { ok: false, checked: 3, reason: "event 2 was changed", fileCopyCompared: true },
    });
    renderOverview();
    const area = await screen.findByRole("region", { name: "Needs attention" });
    const titles = within(area).getAllByRole("button").map((b) => b.querySelector("p")?.textContent);
    expect(titles).toEqual(["The backup ledger has been changed", "A backup failed while reading the database", "2 backups have no passing integrity check"]);
    expect(within(area).getByText("2 need action · 1 to review · 3 kinds of problem")).toBeTruthy();
    expect(screen.getByText("Broken")).toBeTruthy();
  });

  it("shows only the first kinds of problem and keeps the rest one click away", async () => {
    const codes = ["BACKUP_DUMP_FAILED", "BACKUP_TARGET_UNAVAILABLE", "BACKUP_INSUFFICIENT_SPACE", "BACKUP_ENCRYPTION_KEY_MISSING", "BACKUP_SOURCE_UNAVAILABLE", "AGENT_RESTARTED"];
    api.overview.mockResolvedValue({ ...healthy, openAlerts: codes.map((code, i) => alert(String(i), code, "HIGH", `2026-10-08T0${i}:00:00Z`)) });
    renderOverview();
    const area = await screen.findByRole("region", { name: "Needs attention" });
    expect(within(area).getAllByRole("button").filter((b) => b.hasAttribute("aria-expanded"))).toHaveLength(4);
    fireEvent.click(within(area).getByRole("button", { name: "Show 2 more kinds of problem" }));
    expect(within(area).getAllByRole("button").filter((b) => b.hasAttribute("aria-expanded"))).toHaveLength(6);
    fireEvent.click(within(area).getByRole("button", { name: "Show fewer" }));
    expect(within(area).getAllByRole("button").filter((b) => b.hasAttribute("aria-expanded"))).toHaveLength(4);
  });

  it("says plainly when the agent cannot be reached, and never shows invented figures", async () => {
    api.overview.mockRejectedValue(new Error("network"));
    renderOverview();
    expect((await screen.findAllByText("Unable to read the backup status")).length).toBeGreaterThan(0);
    expect(screen.queryByText("All clear")).toBeNull();
  });

  it("shows no last backup as a problem, not as zero hours", async () => {
    api.overview.mockResolvedValue({ ...healthy, completed: 0, lastCompleted: null });
    renderOverview();
    await waitFor(() => expect(screen.getByText("None yet")).toBeTruthy());
  });

  it("tells what is not covered yet instead of implying it is fine", async () => {
    api.overview.mockResolvedValue(healthy);
    renderOverview();
    const card = await screen.findByRole("region", { name: "Not covered yet" });
    expect(within(card).getByText("Object storage and file backups")).toBeTruthy();
  });
});

describe("grouping", () => {
  it("groups by severity and code, errors first, newest group first, newest item first", () => {
    const groups = groupAlerts(
      toAlerts({
        ...healthy,
        notVerified: 1,
        openAlerts: [
          alert("w", "SOMETHING_ODD", "WARNING", "2026-10-08T05:00:00Z"),
          alert("x1", "BACKUP_DUMP_FAILED", "HIGH", "2026-10-08T01:00:00Z"),
          alert("x2", "BACKUP_DUMP_FAILED", "HIGH", "2026-10-08T03:00:00Z"),
          alert("c", "LEDGER_CHAIN_BROKEN", "CRITICAL", "2026-10-08T02:00:00Z"),
        ],
      }),
    );
    expect(groups.map((g) => g.key)).toEqual(["error:LEDGER_CHAIN_BROKEN", "error:BACKUP_DUMP_FAILED", "warning:SOMETHING_ODD", "warning:NOT_VERIFIED"]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["x2", "x1"]);
    expect(groups[2].title).toBe("Something Odd");
  });

  it("does not merge a warning and an error that share a code", () => {
    const groups = groupAlerts(
      toAlerts({ ...healthy, openAlerts: [alert("a", "X", "HIGH", "2026-10-08T01:00:00Z"), alert("b", "X", "WARNING", "2026-10-08T02:00:00Z")] }),
    );
    expect(groups).toHaveLength(2);
  });
});
