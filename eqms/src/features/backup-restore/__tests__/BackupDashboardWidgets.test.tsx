import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import type { BackupOverview } from "@/services/api/backupRestore";
import { useBackupDashboardWidgets } from "../dashboard/BackupDashboardWidgets";
import { groupAlerts, toAlerts } from "../dashboard/backupAlerts";
import { LIBRARY_ONLY_WIDGETS } from "@/features/self-service/dashboard/shared/dashboardWidgetCatalog";

const api = vi.hoisted(() => ({ overview: vi.fn(), overviewDaily: vi.fn(), storeScrubs: vi.fn(), manualCopyStatus: vi.fn(), startStoreScrub: vi.fn() }));
const perms = vi.hoisted(() => ({ granted: new Set<string>() }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (code: string) => perms.granted.has(code) }) }));
vi.mock("@/services/api/backupRestore", () => ({ backupRestoreApi: api }));

const healthy: BackupOverview = {
  environment: "DEV",
  completed: 5,
  failed: 0,
  running: 0,
  notVerified: 0,
  lastCompleted: { backupNumber: "BK-20261008-0831-0008", finishedAt: "2026-10-08T01:31:00Z", sizeBytes: 85_000_000 },
  openAlerts: [],
  ledger: { ok: true, checked: 44, reason: null, fileCopyCompared: true },
};

const alert = (id: string, code: string, severity: string, at: string, detail = "detail " + id, ref: string | null = "BK-" + id) => ({ id, at, severity, code, detail, ref });

/** Every backup card, mounted as the dashboard mounts them: the cards of the widget list, each one by itself. */
const AllCards = ({ only }: { only?: string[] }) => {
  const widgets = useBackupDashboardWidgets();
  return (
    <>
      {widgets.filter((widget) => !only || only.includes(widget.id)).map((widget) => (
        <div key={widget.id} data-card={widget.id}>{widget.content}</div>
      ))}
    </>
  );
};
const renderOverview = (only?: string[]) =>
  render(
    <ToastProvider>
      <AllCards only={only} />
    </ToastProvider>,
  );

beforeEach(() => {
  api.overview.mockReset();
  api.overviewDaily.mockReset();
  api.storeScrubs.mockReset();
  api.manualCopyStatus.mockReset();
  api.startStoreScrub.mockReset();
  perms.granted = new Set(["backup.module.view", "backup.backup.verify"]);
  api.storeScrubs.mockResolvedValue({ data: [], pagination: { page: 1, limit: 1, total: 0, totalPages: 1 } });
  api.manualCopyStatus.mockResolvedValue({ declared: true, description: "Safe", everyDays: 7, lastCopiedOn: "2026-11-10", nextDueOn: "2026-11-17", state: "ON_TIME" });
  api.overviewDaily.mockResolvedValue([{ date: "2026-10-08", completed: 2, failed: 1, notVerified: 1 }]);
});
afterEach(cleanup);

describe("Backup cards on the dashboard", () => {
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
    expect((await screen.findAllByRole("button", { name: "Try again" })).length).toBeGreaterThan(0);
    expect(screen.queryByText("All clear")).toBeNull();
  });

  it("shows no last backup as a problem, not as zero hours", async () => {
    api.overview.mockResolvedValue({ ...healthy, completed: 0, lastCompleted: null });
    renderOverview();
    await waitFor(() => expect(screen.getByText("None yet")).toBeTruthy());
  });

  it("says when the file store was last checked and what the check found, from the server", async () => {
    api.overview.mockResolvedValue(healthy);
    api.storeScrubs.mockResolvedValue({
      data: [{ id: "s1", trigger: "SCHEDULED", requestedBy: "system:scrub", startedAt: "2026-11-09T20:30:00Z", finishedAt: "2026-11-09T20:31:00Z", status: "COMPLETED", backupNumber: "BK-1", checkedFiles: 120, checkedBytes: 5000, differentFiles: 1, missingFiles: 0, referenceDifferences: 0, errorCode: null }],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });
    renderOverview();
    const card = await screen.findByRole("region", { name: "File store check" });
    expect(await within(card).findByText("Differences found")).toBeTruthy();
    expect(within(card).getByText("120")).toBeTruthy();
    expect(api.storeScrubs).toHaveBeenCalledWith({ page: 1, limit: 1 });
  });

  it("says when no file store check has run, and starts one only for a person who may verify", async () => {
    api.overview.mockResolvedValue(healthy);
    api.startStoreScrub.mockResolvedValue({ jobId: "j-9" });
    renderOverview();
    const card = await screen.findByRole("region", { name: "File store check" });
    expect(await within(card).findByText(/No check has run yet/)).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Check Now" }));
    await waitFor(() => expect(api.startStoreScrub).toHaveBeenCalled());
    cleanup();
    perms.granted = new Set(["backup.module.view"]);
    renderOverview();
    const again = await screen.findByRole("region", { name: "File store check" });
    expect(within(again).queryByRole("button", { name: "Check Now" })).toBeNull();
  });

  it("shows the manual copy as the policy asks for it, and says so when it cannot be read", async () => {
    api.overview.mockResolvedValue(healthy);
    renderOverview();
    const card = await screen.findByRole("region", { name: "Manual copy" });
    expect(within(card).getByText("On time")).toBeTruthy();
    cleanup();
    api.manualCopyStatus.mockRejectedValue(new Error("forbidden"));
    renderOverview();
    await screen.findByRole("region", { name: "File store check" });
    expect(await screen.findByText("The manual copy status could not be read.")).toBeTruthy();
  });
});

describe("which cards exist, and how the status is read", () => {
  it("offers the cards only to a person who may view Backup & Restore", () => {
    perms.granted = new Set();
    api.overview.mockResolvedValue(healthy);
    renderOverview();
    expect(document.querySelector("[data-card]")).toBeNull();
    expect(api.overview).not.toHaveBeenCalled();
  });

  it("starts with four cards on the dashboard and keeps the other five in the library", () => {
    perms.granted = new Set(["backup.module.view"]);
    let widgets: ReturnType<typeof useBackupDashboardWidgets> = [];
    const Probe = () => {
      widgets = useBackupDashboardWidgets();
      return null;
    };
    render(<Probe />);
    expect(widgets.filter((w) => w.defaultVisible !== false).map((w) => w.id)).toEqual(["backup-last-success", "backup-failed", "backup-attention", "backup-daily"]);
    const inLibrary = widgets.filter((w) => w.defaultVisible === false).map((w) => w.id);
    expect(inLibrary.every((id) => LIBRARY_ONLY_WIDGETS.has(id))).toBe(true); // the role-defaults screen starts from the same list
  });

  it("asks the agent once however many cards are shown", async () => {
    api.overview.mockResolvedValue(healthy);
    renderOverview();
    await screen.findByRole("region", { name: "Needs attention" });
    expect(api.overview).toHaveBeenCalledTimes(1);
    expect(api.overviewDaily).toHaveBeenCalledTimes(1);
  });

  it("asks for nothing while no card is shown", () => {
    api.overview.mockResolvedValue(healthy);
    renderOverview([]);
    expect(api.overview).not.toHaveBeenCalled();
  });

  it("shows only the card that was chosen, and the others' data is not drawn", async () => {
    api.overview.mockResolvedValue(healthy);
    renderOverview(["backup-ledger"]);
    expect(await screen.findByText("Intact")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Needs attention" })).toBeNull();
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

  it("draws the last 30 days as stacked results, with the unverified part inside the completed count", async () => {
    api.overview.mockResolvedValue(healthy);
    api.overviewDaily.mockResolvedValue([{ date: "2026-10-08", completed: 2, failed: 1, notVerified: 1 }]);
    renderOverview();
    const card = await screen.findByRole("region", { name: "Last 30 days" });
    expect(within(card).getByText("3 runs")).toBeTruthy();
    expect(within(card).getByText("Completed, not verified")).toBeTruthy();
  });

  it("says the history could not be loaded instead of drawing zeros", async () => {
    api.overview.mockResolvedValue(healthy);
    api.overviewDaily.mockRejectedValue(new Error("agent down"));
    renderOverview();
    const card = await screen.findByRole("region", { name: "Last 30 days" });
    expect(await within(card).findByText("Could not load the 30-day history.")).toBeTruthy();
    expect(within(card).queryByText(/runs$/)).toBeNull();
  });
});
