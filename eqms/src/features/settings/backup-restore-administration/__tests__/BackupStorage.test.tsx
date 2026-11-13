import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { ROUTES } from "@/app/routes.constants";
import { BackupStorageView } from "../BackupStorageView";

const api = vi.hoisted(() => ({
  targets: vi.fn(),
  encryption: vi.fn(),
  testTarget: vi.fn(),
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
const ALL_PERMS = ["backup.admin.storage.view", "backup.admin.storage.test"];

const page = <T,>(rows: T[]) => ({ data: rows, pagination: { page: 1, limit: 10, total: rows.length, totalPages: 1 } });

const renderApp = (path: string, ui: React.ReactNode = null) =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={A.STORAGE} element={<BackupStorageView />} />
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

});
