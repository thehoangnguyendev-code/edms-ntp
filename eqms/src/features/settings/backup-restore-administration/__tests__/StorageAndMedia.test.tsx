import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { ROUTES } from "@/app/routes.constants";
import { ExportBackupModal } from "@/features/backup-restore/components/ExportBackupModal";
import type { BackupExport, OfflineMedium } from "@/services/api/backupRestore";
import { BackupControlsView } from "../BackupControlsView";
import { BackupStorageView } from "../BackupStorageView";
import { BackupExportsView } from "@/features/backup-restore/views/BackupExportsView";
import { OfflineMediumDetailView } from "../OfflineMediumDetailView";

const api = vi.hoisted(() => ({
  targets: vi.fn(),
  encryption: vi.fn(),
  testTarget: vi.fn(),
  media: vi.fn(),
  medium: vi.fn(),
  mediumEvents: vi.fn(),
  mediumPackages: vi.fn(),
  registerMedium: vi.fn(),
  handoverMedium: vi.fn(),
  receiveMedium: vi.fn(),
  readTestMedium: vi.fn(),
  recycleMedium: vi.fn(),
  retireMedium: vi.fn(),
  exports: vi.fn(),
  exportEstimate: vi.fn(),
  approveExport: vi.fn(),
  rejectExport: vi.fn(),
}));
const perms = vi.hoisted(() => ({ granted: new Set<string>(), username: "bob" }));

vi.mock("@/services/api/backupRestore", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/backupRestore")>("@/services/api/backupRestore");
  return { ...actual, backupRestoreApi: api };
});
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (code: string) => perms.granted.has(code) }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { username: perms.username } }) }));
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => ({ compactDesktopFilters: false }) }));
vi.mock("@/components/ui/table/useTableColumnPreferences", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/table/useTableColumnPreferences")>("@/components/ui/table/useTableColumnPreferences");
  return { ...actual, useTableColumnPreferences: (_key: string, defaults: unknown[]) => ({ columns: defaults, saveColumns: vi.fn(), resetColumns: vi.fn() }) };
});

const A = ROUTES.SETTINGS.BACKUP_ADMINISTRATION;
const ALL_PERMS = ["backup.admin.storage.view", "backup.admin.storage.test", "backup.media.manage", "backup.backup.export.approve", "backup.backup.export"];

const medium = (over: Partial<OfflineMedium> = {}): OfflineMedium => ({
  id: "m-1",
  label: "USB-01",
  serialNumber: "SN1",
  kind: "USB",
  capacityBytes: 2_000_000_000,
  exportDir: "usb-01",
  status: "AVAILABLE",
  holder: null,
  storageLocation: null,
  handedOverAt: null,
  lastReadTestAt: null,
  lastReadTestResult: null,
  expiresOn: null,
  destructionRecord: null,
  holdsLegalHold: false,
  registeredBy: "custodian",
  createdAt: "2026-10-08T01:00:00Z",
  packageCount: 0,
  ...over,
});

const exportRow = (over: Partial<BackupExport> = {}): BackupExport => ({
  id: "e-1",
  exportId: "EXP-20261008-0001",
  backupNumber: "BK-20261008-1031-0015",
  mediaId: "m-1",
  mediaLabel: "USB-01",
  status: "REQUESTED",
  requestedBy: "alice",
  reason: "Weekly",
  requestedAt: "2026-10-08T01:00:00Z",
  approvedBy: null,
  decidedAt: null,
  decisionReason: null,
  startedAt: null,
  finishedAt: null,
  estimatedBytes: 1000,
  sizeBytes: null,
  fileCount: null,
  receiptSha256: null,
  packagePath: null,
  errorCode: null,
  errorDetail: null,
  ...over,
});

const page = <T,>(rows: T[]) => ({ data: rows, pagination: { page: 1, limit: 10, total: rows.length, totalPages: 1 } });

const renderApp = (path: string, ui: React.ReactNode = null) =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={A.STORAGE} element={<BackupStorageView />} />
            <Route path={ROUTES.BACKUP_RESTORE.EXPORTS} element={<BackupExportsView />} />
            <Route path="/settings/administration/backup/storage/media/:id" element={<OfflineMediumDetailView />} />
            <Route path={A.CONTROLS} element={<BackupControlsView />} />
            <Route path="/modal" element={ui} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  perms.granted = new Set(ALL_PERMS);
  perms.username = "bob";
  api.targets.mockResolvedValue([
    { code: "T1", kind: "FOLDER", immutable: false, location: "/backup/t1" },
    { code: "T3", kind: "S3", immutable: true, location: "s3://eqms-dev-backup-t3/" },
  ]);
  api.encryption.mockResolvedValue({ scheme: "OpenPGP", cipher: "AES256", signingAlgorithm: "Ed25519", signingKeyId: "abc123", available: true, recipientKeyId: "RK1", fingerprint: "FP1", agentCanDecrypt: false });
  api.media.mockResolvedValue(page([medium()]));
  api.exports.mockResolvedValue(page([exportRow()]));
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const header = (id: string) => document.querySelector<HTMLElement>(`[data-table-col="${id}"]`)!;

describe("Backup Storage & Encryption", () => {
  it("shows the targets, and the encryption facts on their own tab", async () => {
    renderApp(A.STORAGE);
    expect(await screen.findByText("/backup/t1")).toBeTruthy();
    expect(screen.getByText("s3://eqms-dev-backup-t3/")).toBeTruthy();
    fireEvent.click(screen.getByText("Encryption"));
    expect(await screen.findByText(/OpenPGP with AES256/)).toBeTruthy();
    expect(screen.getByText(/The Backup Agent holds only the public key/)).toBeTruthy();
  });

  it("tests a target on request and shows each step", async () => {
    api.testTarget.mockResolvedValue({ target: "T3", ok: true, steps: [{ name: "write", ok: true, detail: "" }, { name: "read-back", ok: true, detail: "" }, { name: "delete-refused", ok: true, detail: "" }] });
    renderApp(A.STORAGE);
    await screen.findByText("s3://eqms-dev-backup-t3/");
    fireEvent.click(screen.getAllByRole("button", { name: "Test" })[1]);
    await waitFor(() => expect(api.testTarget).toHaveBeenCalledWith("T3"));
    expect(await screen.findByText("Passed")).toBeTruthy();
  });

  it("offers Test only with its permission", async () => {
    perms.granted = new Set(["backup.admin.storage.view"]);
    renderApp(A.STORAGE);
    await screen.findByText("/backup/t1");
    expect(screen.queryByRole("button", { name: "Test" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Register Medium" })).toBeNull();
  });

  it("says so when the agent cannot be reached", async () => {
    api.targets.mockRejectedValue(new Error("network"));
    api.encryption.mockRejectedValue(new Error("network"));
    renderApp(A.STORAGE);
    expect(await screen.findByText("The backup targets could not be read")).toBeTruthy();
  });

  it("searches, filters, sorts and pages the media register on the server", async () => {
    renderApp(`${A.STORAGE}?tab=media`);
    await screen.findAllByPlaceholderText("Label, serial or holder…");
    await waitFor(() => expect(api.media).toHaveBeenCalled());
    const last = () => api.media.mock.calls.at(-1)![0];
    expect(last()).toMatchObject({ sortBy: "label", sortDirection: "asc", page: 1, limit: 10 });
    fireEvent.change(screen.getAllByPlaceholderText("Label, serial or holder…")[0], { target: { value: "usb" } });
    await waitFor(() => expect(last().search).toBe("usb"), { timeout: 5000 });
    fireEvent.click(header("status"));
    await waitFor(() => expect(last()).toMatchObject({ sortBy: "status", sortDirection: "asc" }));
  });

  it("registers a medium with machine values and a capacity in bytes", async () => {
    api.registerMedium.mockResolvedValue(medium());
    renderApp(`${A.STORAGE}?tab=media`);
    fireEvent.click(await screen.findByRole("button", { name: "Register Medium" }));
    const confirm = (await screen.findByRole("button", { name: "Register" })) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    const boxes = screen.getAllByRole("textbox");
    fireEvent.change(boxes[boxes.length - 3], { target: { value: "USB-02" } });
    fireEvent.change(boxes[boxes.length - 2], { target: { value: "SN-22" } });
    fireEvent.change(document.querySelector('input[type="number"]')!, { target: { value: "64" } });
    fireEvent.change(boxes[boxes.length - 1], { target: { value: "usb-02" } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Register" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    await waitFor(() => expect(api.registerMedium).toHaveBeenCalled());
    expect(api.registerMedium.mock.calls[0][0]).toMatchObject({ label: "USB-02", serialNumber: "SN-22", kind: "USB", capacityBytes: 64_000_000_000, exportDir: "usb-02" });
  });

  it("refuses a folder name that could leave the export mount before asking the server", async () => {
    renderApp(`${A.STORAGE}?tab=media`);
    fireEvent.click(await screen.findByRole("button", { name: "Register Medium" }));
    const boxes = screen.getAllByRole("textbox");
    fireEvent.change(boxes[boxes.length - 3], { target: { value: "USB-02" } });
    fireEvent.change(boxes[boxes.length - 2], { target: { value: "SN-22" } });
    fireEvent.change(document.querySelector('input[type="number"]')!, { target: { value: "64" } });
    fireEvent.change(boxes[boxes.length - 1], { target: { value: "../escape" } });
    expect((screen.getByRole("button", { name: "Register" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("lets someone else approve an export, and blocks the person who asked", async () => {
    api.approveExport.mockResolvedValue(exportRow({ status: "APPROVED" }));
    renderApp(ROUTES.BACKUP_RESTORE.EXPORTS);
    const approve = (await screen.findAllByRole("button", { name: "Approve" }))[0] as HTMLButtonElement;
    expect(approve.disabled).toBe(false);
    fireEvent.click(approve);
    await waitFor(() => expect(api.approveExport).toHaveBeenCalledWith("EXP-20261008-0001"));
    cleanup();
    perms.username = "alice";
    renderApp(ROUTES.BACKUP_RESTORE.EXPORTS);
    expect(((await screen.findAllByRole("button", { name: "Approve" }))[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it("rejects an export only with a reason", async () => {
    api.rejectExport.mockResolvedValue(exportRow({ status: "REJECTED" }));
    renderApp(ROUTES.BACKUP_RESTORE.EXPORTS);
    fireEvent.click((await screen.findAllByRole("button", { name: "Reject" }))[0]);
    const confirm = (await screen.findAllByRole("button", { name: "Reject" })).at(-1) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: /reason/i }), { target: { value: "Wrong medium" } });
    await waitFor(() => expect((screen.getAllByRole("button", { name: "Reject" }).at(-1) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getAllByRole("button", { name: "Reject" }).at(-1)!);
    await waitFor(() => expect(api.rejectExport).toHaveBeenCalledWith("EXP-20261008-0001", "Wrong medium"));
  });

  it("explains a refused approval in plain words", async () => {
    api.approveExport.mockRejectedValue({ response: { data: { code: "EXPORT_SAME_PERSON" } } });
    renderApp(ROUTES.BACKUP_RESTORE.EXPORTS);
    fireEvent.click((await screen.findAllByRole("button", { name: "Approve" }))[0]);
    expect(await screen.findByText(/You asked for this export, so someone else has to approve it/)).toBeTruthy();
  });
});

describe("Offline medium", () => {
  const open = (m: OfflineMedium, events: { event: string; by: string; at: string; detail: string | null }[] = []) => {
    api.medium.mockResolvedValue(m);
    api.mediumPackages.mockResolvedValue([]);
    api.mediumEvents.mockResolvedValue(events);
    return renderApp("/settings/administration/backup/storage/media/m-1");
  };
  const ev = (event: string, by: string, detail: object = {}) => ({ event, by, at: "2026-10-08T01:00:00Z", detail: JSON.stringify(detail) });

  it("shows what the medium is, what it holds and every step in its history", async () => {
    api.mediumPackages.mockResolvedValue([]);
    open(medium({ status: "STORED_OFFSITE", holder: "Ms Keeper", storageLocation: "Vault", packageCount: 1 }), [ev("RECEIVED", "keeper", { holder: "Ms Keeper", location: "Vault", deliveredBy: "courier" }), ev("REGISTERED", "custodian", { kind: "USB", serial: "SN1" })]);
    expect(await screen.findByText("Medium Information")).toBeTruthy();
    for (const title of ["Packages on This Medium", "History"]) expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ms Keeper").length).toBeGreaterThan(0);
    expect(screen.getByText("Receipt confirmed")).toBeTruthy();
  });

  it("offers only the steps that make sense for the status", async () => {
    open(medium({ status: "AVAILABLE" }));
    await screen.findByText("Medium Information");
    expect(screen.queryByRole("button", { name: "Record Handover" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Record Read Test" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Retire Medium" }).length).toBeGreaterThan(0);
  });

  it("will not let the deliverer confirm their own handover", async () => {
    perms.username = "courier";
    open(medium({ status: "IN_TRANSIT" }), [ev("HANDED_OVER", "courier", { holder: "Ms Keeper", location: "Vault" }), ev("EXPORTED", "agent")]);
    const receive = (await screen.findAllByRole("button", { name: "Confirm Receipt" })) as HTMLButtonElement[];
    expect(receive.every((b) => b.disabled)).toBe(true);
  });

  it("confirms receipt when someone else delivered it", async () => {
    api.receiveMedium.mockResolvedValue(medium({ status: "STORED_OFFSITE" }));
    open(medium({ status: "IN_TRANSIT" }), [ev("HANDED_OVER", "courier", { holder: "Ms Keeper", location: "Vault" }), ev("EXPORTED", "agent")]);
    fireEvent.click((await screen.findAllByRole("button", { name: "Confirm Receipt" }))[0]);
    await waitFor(() => expect(api.receiveMedium).toHaveBeenCalledWith("m-1"));
  });

  it("cannot be received before a handover is recorded", async () => {
    open(medium({ status: "IN_TRANSIT" }), [ev("EXPORTED", "agent")]);
    const receive = (await screen.findAllByRole("button", { name: "Confirm Receipt" })) as HTMLButtonElement[];
    expect(receive.every((b) => b.disabled)).toBe(true);
  });

  it("warns about a quarantined medium and one under legal hold", async () => {
    open(medium({ status: "QUARANTINED", holdsLegalHold: true }));
    expect(await screen.findByText("This medium failed a read test")).toBeTruthy();
    expect(screen.getByText("Holds data under legal hold")).toBeTruthy();
  });

  it("needs a confirmed wipe and a reason to return a medium to use", async () => {
    api.recycleMedium.mockResolvedValue(medium());
    open(medium({ status: "STORED_OFFSITE" }));
    fireEvent.click((await screen.findAllByRole("button", { name: "Wipe and Reuse" }))[0]);
    const confirm = (await screen.findByRole("button", { name: "Return to Use" })) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Rotation" } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Return to Use" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Return to Use" }));
    await waitFor(() => expect(api.recycleMedium).toHaveBeenCalledWith("m-1", true, "Rotation"));
  });

  it("records a read test and a retirement with what the server needs", async () => {
    api.readTestMedium.mockResolvedValue(medium());
    api.retireMedium.mockResolvedValue(medium({ status: "RETIRED" }));
    open(medium({ status: "STORED_OFFSITE" }));
    fireEvent.click((await screen.findAllByRole("button", { name: "Record Read Test" }))[0]);
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "verify-chain.sh run" } });
    fireEvent.click(await screen.findByRole("button", { name: "Record" }));
    await waitFor(() => expect(api.readTestMedium).toHaveBeenCalledWith("m-1", "PASSED", "verify-chain.sh run"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Record" })).toBeNull());
    fireEvent.click((await screen.findAllByRole("button", { name: "Retire Medium" }))[0]);
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "Shredded, certificate 77" } });
    fireEvent.click(await screen.findByRole("button", { name: "Retire" }));
    await waitFor(() => expect(api.retireMedium).toHaveBeenCalledWith("m-1", "Shredded, certificate 77"));
  });

  it("hides every step from someone who may only look", async () => {
    perms.granted = new Set(["backup.admin.storage.view"]);
    open(medium({ status: "STORED_OFFSITE" }));
    await screen.findByText("Medium Information");
    for (const name of ["Record Read Test", "Wipe and Reuse", "Retire Medium", "Record Handover"]) expect(screen.queryByRole("button", { name })).toBeNull();
  });

  it("says plainly when the medium cannot be read", async () => {
    api.medium.mockRejectedValue(new Error("not found"));
    api.mediumPackages.mockRejectedValue(new Error("x"));
    api.mediumEvents.mockRejectedValue(new Error("x"));
    renderApp("/settings/administration/backup/storage/media/m-9");
    expect(await screen.findByText("Unable to open the medium")).toBeTruthy();
  });
});

describe("Export Backup Set request", () => {
  const modal = (onConfirm = vi.fn()) => renderApp("/modal", <ExportBackupModal backupNumber="BK-20261008-1031-0015" isOpen onClose={vi.fn()} onConfirm={onConfirm} />);

  it("offers only the media the package fits on and sends the choice with a reason", async () => {
    api.media.mockResolvedValue(page([medium({ id: "small", label: "TINY", capacityBytes: 500 }), medium({ id: "big", label: "BIG", capacityBytes: 4_000_000_000 })]));
    api.exportEstimate.mockResolvedValue({ backupNumber: "BK-20261008-1031-0015", estimatedBytes: 1_000_000, fileCount: 10 });
    const onConfirm = vi.fn();
    modal(onConfirm);
    expect(await screen.findByText(/The package is about/)).toBeTruthy();
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "Weekly copy" } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Request Export" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Request Export" }));
    expect(onConfirm).toHaveBeenCalledWith("big", "Weekly copy");
  });

  it("says when no medium is available and cannot be sent", async () => {
    api.media.mockResolvedValue(page([]));
    api.exportEstimate.mockResolvedValue({ backupNumber: "x", estimatedBytes: 1, fileCount: 1 });
    modal();
    expect(await screen.findByText("No medium is available")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Request Export" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Backup Controls: retention tab", () => {
  it("states the permanent retention as a fixed decision and says legal hold is not built", () => {
    perms.granted = new Set(["backup.admin.retention.view"]);
    renderApp(`${A.CONTROLS}?tab=retention`);
    expect(screen.getByText("Permanently")).toBeTruthy();
    expect(screen.getByText("Legal hold is not available yet")).toBeTruthy();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });
});
