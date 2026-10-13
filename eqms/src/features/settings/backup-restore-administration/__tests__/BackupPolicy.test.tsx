import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { ROUTES } from "@/app/routes.constants";
import type { PolicyVersion } from "@/services/api/backupRestore";
import { BackupPolicyDetailView } from "../BackupPolicyDetailView";
import { BackupPolicyView } from "../BackupPolicyView";
import { NewBackupPolicyView, previewGate } from "../NewBackupPolicyView";

const api = vi.hoisted(() => ({
  policies: vi.fn(),
  policy: vi.fn(),
  policyGate: vi.fn(),
  targets: vi.fn(),
  proposePolicy: vi.fn(),
  activatePolicy: vi.fn(),
  discardPolicy: vi.fn(),
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
vi.mock("@/components/ui/esign-modal/ESignatureModal", () => ({
  ESignatureModal: ({ isOpen, onConfirm, meaningCode }: { isOpen: boolean; onConfirm: (d: unknown) => void; meaningCode: string }) =>
    isOpen ? (
      <div>
        <span>sign as {meaningCode}</span>
        <button onClick={() => onConfirm({ signatureToken: "tok-1" })}>Confirm signature</button>
      </div>
    ) : null,
}));

const A = ROUTES.SETTINGS.BACKUP_ADMINISTRATION;

const targetsJson = (extra = "") =>
  JSON.stringify({
    targets: [
      { code: "T1", medium: "SERVER_FOLDER", role: "PRIMARY", offsite: false, immutable: false },
      { code: "T3", medium: "OBJECT_STORAGE", role: "COPY", offsite: true, immutable: true },
    ],
    ...(extra ? {} : {}),
  });

const policy = (over: Partial<PolicyVersion> = {}): PolicyVersion => ({
  id: "p-2",
  version: 2,
  status: "DRAFT",
  scope: JSON.stringify({ components: ["DATABASE", "OBJECT_STORE"] }),
  schedule: JSON.stringify({ database: { enabled: true, frequency: "DAILY", time: "01:30", type: "FULL" } }),
  retention: JSON.stringify({ mode: "PERMANENT" }),
  targets: targetsJson(),
  proposedBy: "alice",
  approvedBy: null,
  reason: "Add the immutable copy",
  signatureRef: null,
  createdAt: "2026-10-08T01:00:00Z",
  activatedAt: null,
  sha256: "ab".repeat(32),
  gate: null,
  discardedBy: null,
  discardReason: null,
  ...over,
});

const gateOf = (passed: boolean) => ({
  passed,
  enforced: true,
  conditions: [
    { code: "COPIES", ok: true, relaxed: false, pending: false, detail: "3 copies" },
    { code: "OFFSITE", ok: passed, relaxed: false, pending: false, detail: passed ? "Declared off-site: T3" : "No target is declared off-site" },
    { code: "TARGETS_WORK", ok: false, relaxed: false, pending: true, detail: "Checked when activated" },
  ],
});

const page = (rows: PolicyVersion[]) => ({ data: rows, pagination: { page: 1, limit: 10, total: rows.length, totalPages: 1 } });

const renderApp = (path: string) =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={A.POLICY} element={<BackupPolicyView />} />
            <Route path={A.POLICY_NEW} element={<NewBackupPolicyView />} />
            <Route path="/settings/administration/backup/policy/:version" element={<BackupPolicyDetailView />} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  perms.granted = new Set(["backup.admin.policy.view", "backup.admin.policy.propose", "backup.admin.policy.approve"]);
  perms.username = "bob";
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const header = (id: string) => document.querySelector<HTMLElement>(`[data-table-col="${id}"]`)!;
const lastList = () => api.policies.mock.calls.at(-1)![0];

describe("Backup Policy list", () => {
  beforeEach(() => {
    const active = policy({ version: 1, status: "ACTIVE", proposedBy: null, approvedBy: null, scope: JSON.stringify({ components: ["DATABASE"] }), targets: JSON.stringify({ targets: [{ code: "T1", medium: "SERVER_FOLDER" }] }) });
    api.policies.mockImplementation(async (params?: { status?: string }) => (params?.status === "ACTIVE" ? page([active]) : page([policy(), active])));
  });

  it("shows the running policy and the version history from the server", async () => {
    renderApp(A.POLICY);
    expect(await screen.findByText("Running Policy")).toBeTruthy();
    expect(await screen.findByText("Installed with the Backup Agent")).toBeTruthy();
    expect((await screen.findAllByRole("button", { name: "2" })).length).toBeGreaterThan(0);
    expect(lastList()).toMatchObject({ sortBy: "version", sortDirection: "desc", page: 1, limit: 10 });
  });

  it("searches, filters, sorts and pages on the server", async () => {
    renderApp(A.POLICY);
    await screen.findAllByRole("button", { name: "2" });
    fireEvent.change(screen.getAllByPlaceholderText("Version, person or reason…")[0], { target: { value: "alice" } });
    await waitFor(() => expect(lastList().search).toBe("alice"), { timeout: 2000 });
    fireEvent.click(header("status"));
    await waitFor(() => expect(lastList()).toMatchObject({ sortBy: "status", sortDirection: "asc" }));
    fireEvent.click(header("approvedBy"));
    await waitFor(() => expect(lastList().sortBy).toBe("approvedBy"));
  });

  it("offers Propose Policy Change only with the permission", async () => {
    renderApp(A.POLICY);
    expect(await screen.findByRole("button", { name: "Propose Policy Change" })).toBeTruthy();
    cleanup();
    perms.granted = new Set(["backup.admin.policy.view"]);
    renderApp(A.POLICY);
    await screen.findByText("Running Policy");
    expect(screen.queryByRole("button", { name: "Propose Policy Change" })).toBeNull();
  });

  it("says so when the versions cannot be loaded", async () => {
    api.policies.mockRejectedValue(new Error("network"));
    renderApp(A.POLICY);
    expect((await screen.findAllByText(/could not be loaded/)).length).toBeGreaterThan(0);
  });
});

describe("Backup Policy version", () => {
  it("shows a draft with its targets and the 3-2-1-1 rule, and asks for a signature to activate", async () => {
    api.policy.mockResolvedValue(policy());
    api.policyGate.mockResolvedValue(gateOf(true));
    renderApp(A.POLICY_DETAIL(2));
    expect(await screen.findByText("Policy Information")).toBeTruthy();
    for (const title of ["What Is Backed Up", "Backup Targets", "3-2-1-1 Rule"]) expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    expect(screen.getByText("Declared off-site: T3")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Approve and Activate" })[0]);
    expect(await screen.findByText("sign as BACKUP_POLICY_CHANGE")).toBeTruthy();
    api.activatePolicy.mockResolvedValue(policy({ status: "ACTIVE" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm signature" }));
    await waitFor(() => expect(api.activatePolicy).toHaveBeenCalledWith(2, "tok-1"));
  });

  it("explains a refusal in plain words and signs nothing more", async () => {
    api.policy.mockResolvedValue(policy());
    api.policyGate.mockResolvedValue(gateOf(true));
    renderApp(A.POLICY_DETAIL(2));
    fireEvent.click((await screen.findAllByRole("button", { name: "Approve and Activate" }))[0]);
    api.activatePolicy.mockRejectedValue({ response: { data: { code: "POLICY_GATE_FAILED", message: "raw server text" } } });
    fireEvent.click(await screen.findByRole("button", { name: "Confirm signature" }));
    expect(await screen.findByText(/does not meet the 3-2-1-1 rule, so it was not activated and nothing was signed/)).toBeTruthy();
  });

  it("blocks the person who proposed it from approving, and says why", async () => {
    perms.username = "alice";
    api.policy.mockResolvedValue(policy());
    api.policyGate.mockResolvedValue(gateOf(true));
    renderApp(A.POLICY_DETAIL(2));
    expect(await screen.findByText("Waiting for another person")).toBeTruthy();
    expect((screen.getAllByRole("button", { name: "Approve and Activate" }) as HTMLButtonElement[]).every((b) => b.disabled)).toBe(true);
  });

  it("warns that a draft which fails the rule cannot be activated", async () => {
    api.policy.mockResolvedValue(policy());
    api.policyGate.mockResolvedValue(gateOf(false));
    renderApp(A.POLICY_DETAIL(2));
    expect(await screen.findByText("This version does not meet the 3-2-1-1 rule yet")).toBeTruthy();
    expect(screen.getByText("No target is declared off-site")).toBeTruthy();
  });

  it("shows the recorded result for a policy that was activated, with who approved it and the signature", async () => {
    api.policy.mockResolvedValue(policy({ status: "ACTIVE", approvedBy: "bob", signatureRef: "SIG-000123", activatedAt: "2026-10-08T02:00:00Z", gate: JSON.stringify(gateOf(true)) }));
    renderApp(A.POLICY_DETAIL(2));
    expect(await screen.findByText("SIG-000123")).toBeTruthy();
    expect(screen.getByText("The result recorded when this version was activated.")).toBeTruthy();
    expect(api.policyGate).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Approve and Activate" })).toBeNull();
  });

  it("discards a draft only with a reason", async () => {
    api.policy.mockResolvedValue(policy());
    api.policyGate.mockResolvedValue(gateOf(true));
    api.discardPolicy.mockResolvedValue(policy({ status: "DISCARDED" }));
    renderApp(A.POLICY_DETAIL(2));
    fireEvent.click((await screen.findAllByRole("button", { name: "Discard Draft" }))[0]);
    const confirm = await screen.findByRole("button", { name: "Discard" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Wrong target list" } });
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(api.discardPolicy).toHaveBeenCalledWith(2, "Wrong target list"));
  });

  it("says plainly when the version cannot be read", async () => {
    api.policy.mockRejectedValue(new Error("not found"));
    renderApp(A.POLICY_DETAIL(9));
    expect(await screen.findByText("Unable to open the policy version")).toBeTruthy();
  });
});

const confirmProposal = async () => {
  fireEvent.click(screen.getAllByRole("button", { name: "Propose Version" })[0]);
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Propose Version" }));
};

describe("Propose a policy change", () => {
  const targets = [
    { code: "T1", kind: "FOLDER", immutable: false, location: "/backup/t1" },
    { code: "T3", kind: "S3", immutable: true, location: "s3://eqms-dev-backup-t3/" },
  ];

  beforeEach(() => {
    api.targets.mockResolvedValue(targets);
    api.policies.mockResolvedValue(page([]));
  });

  it("starts from the targets the agent has and shows the rule as the choices change", async () => {
    renderApp(A.POLICY_NEW);
    expect(await screen.findByText("/backup/t1")).toBeTruthy();
    expect(screen.getByText("No target is declared off-site; at least 1 is required")).toBeTruthy();
    expect(screen.getByText(/1 kind\(s\) of medium/)).toBeTruthy();
  });

  it("needs a reason before it can be sent, then sends machine values and opens the new draft", async () => {
    api.proposePolicy.mockResolvedValue(policy({ version: 4 }));
    api.policy.mockResolvedValue(policy({ version: 4 }));
    api.policyGate.mockResolvedValue(gateOf(true));
    renderApp(A.POLICY_NEW);
    await screen.findByText("/backup/t1");
    const submit = screen.getAllByRole("button", { name: "Propose Version" })[0] as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Add the immutable copy" } });
    await waitFor(() => expect((screen.getAllByRole("button", { name: "Propose Version" })[0] as HTMLButtonElement).disabled).toBe(false));
    await confirmProposal();
    await waitFor(() => expect(api.proposePolicy).toHaveBeenCalled());
    expect(api.proposePolicy.mock.calls[0][0]).toMatchObject({
      scope: { components: ["DATABASE", "OBJECT_STORE"] },
      schedule: { database: { enabled: true, frequency: "DAILY", time: "02:00", type: "FULL" } },
      retention: { mode: "PERMANENT" },
      targets: { targets: [{ code: "T1", medium: "SERVER_FOLDER", offsite: false, immutable: false }] },
      reason: "Add the immutable copy",
    });
    expect(await screen.findByText("Backup Policy Detail")).toBeTruthy();
  });

  it("reports a refusal from the server in plain words and stays on the form", async () => {
    api.proposePolicy.mockRejectedValue({ response: { data: { code: "POLICY_DRAFT_EXISTS" } } });
    renderApp(A.POLICY_NEW);
    await screen.findByText("/backup/t1");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "again" } });
    await confirmProposal();
    expect(await screen.findByText(/A draft is already waiting/)).toBeTruthy();
  });
});

describe("previewGate", () => {
  const info = (code: string, kind: "FOLDER" | "S3", immutable = false) => ({ code, kind, immutable, location: code });
  const choice = (code: string, kind: "FOLDER" | "S3", over: Record<string, unknown> = {}) => ({
    info: info(code, kind, !!over.configuredImmutable),
    included: true,
    medium: kind === "S3" ? "OBJECT_STORAGE" : "SERVER_FOLDER",
    offsite: false,
    immutable: false,
    ...over,
  });
  const failing = (gate: ReturnType<typeof previewGate>) => gate.conditions.filter((c) => !c.ok && !c.pending).map((c) => c.code);

  it("fails every condition for T1 alone", () => {
    expect(failing(previewGate([choice("T1", "FOLDER")] as never))).toEqual(["COPIES", "MEDIA", "OFFSITE", "IMMUTABLE"]);
  });

  it("passes with T1 and an off-site immutable object store that the agent has locked", () => {
    const gate = previewGate([choice("T1", "FOLDER"), choice("T3", "S3", { offsite: true, immutable: true, configuredImmutable: true })] as never);
    expect(failing(gate)).toEqual([]);
    expect(gate.passed).toBe(true);
  });

  it("refuses an immutable claim for a target the agent has not locked", () => {
    const gate = previewGate([choice("T1", "FOLDER"), choice("T3", "S3", { offsite: true, immutable: true })] as never);
    expect(failing(gate)).toEqual(["IMMUTABLE_CONFIGURED"]);
  });

  it("ignores a target that is not included", () => {
    const gate = previewGate([choice("T1", "FOLDER"), choice("T3", "S3", { included: false, offsite: true, immutable: true, configuredImmutable: true })] as never);
    expect(failing(gate)).toContain("COPIES");
  });
});
