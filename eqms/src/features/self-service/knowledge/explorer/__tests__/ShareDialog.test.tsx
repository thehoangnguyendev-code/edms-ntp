import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>, useReducedMotion: () => true };
});
const stableToast = { showToast: vi.fn() };
vi.mock("@/components/ui/toast", () => ({ useToast: () => stableToast }));

const { api } = vi.hoisted(() => ({
  api: {
    sharingFolder: vi.fn(),
    sharingAccess: vi.fn(),
    sharingOptions: vi.fn(async () => ({ positions: [], departments: [] })),
    sharingUsers: vi.fn(async () => []),
    sharingPeople: vi.fn(),
    sharingGrant: vi.fn(),
    sharingRevoke: vi.fn(async () => undefined),
    sharingRevokeGrantee: vi.fn(async () => undefined),
    sharingLinks: vi.fn(),
    sharingCreateLink: vi.fn(),
    sharingRevokeLink: vi.fn(async () => undefined),
    sharingDelegates: vi.fn(),
    sharingAddDelegate: vi.fn(),
    sharingRemoveDelegate: vi.fn(async () => undefined),
  },
}));
vi.mock("@/services/api/knowledge", () => ({ knowledgeApi: api }));

import { ShareDialog } from "../ShareDialog";

const node = (extra: Record<string, unknown> = {}) => ({
  shareable: true, reason: null, kind: "DOCUMENT", businessUnitId: "bu1", businessUnitName: "Quality Unit", departmentId: "dep1", departmentName: "QC Laboratory",
  documentTypeId: null, documentId: "d1", label: "SOP.0001 - Balance calibration", canManage: true, level: "DEPARTMENT_HEAD", canExclude: true, canManageDelegates: true, ...extra,
});

const entry = (id: string, extra: Record<string, unknown> = {}) => ({
  ruleId: id, effect: "ALLOW", scopeKind: "DOCUMENT", scopeLabel: "Document: SOP.0001", inherited: false, removable: true, grantees: ["Nguyen Van A"],
  chips: [{ label: "Nguyen Van A", canShare: false }], createdBy: "Head", createdByLevel: "DEPARTMENT_HEAD", createdAt: "03/11/2026 10:00", createdByMe: false, ...extra,
});

const person = (label: string, extra: Record<string, unknown> = {}) => ({
  ruleId: "r1", effect: "ALLOW", granteeType: "USER", granteeId: `id-${label}`, label, detail: "E01 · QC Laboratory", canShare: false, inherited: false, removable: true,
  scopeLabel: "Document: SOP.0001", createdBy: "Head", createdByLevel: "DEPARTMENT_HEAD", createdAt: "03/11/2026 10:00", createdByMe: false, ...extra,
});
const page = <T,>(items: T[], total = items.length) => ({ items, total });

const target = { kind: "document" as const, documentId: "d1", label: "SOP.0001 - Balance calibration" };

const open = async (access: { node: ReturnType<typeof node>; entries: unknown[] }, people: unknown[] = []) => {
  api.sharingAccess.mockResolvedValue(access);
  api.sharingPeople.mockResolvedValue(page(people));
  render(<ShareDialog target={target} onClose={() => undefined} />);
  await screen.findByText("Who has access");
};

beforeEach(() => {
  vi.clearAllMocks();
  api.sharingLinks.mockResolvedValue(page([]));
  api.sharingDelegates.mockResolvedValue(page([]));
  api.sharingPeople.mockResolvedValue(page([]));
  Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(async () => undefined) }, configurable: true });
});
afterEach(cleanup);

describe("ShareDialog", () => {
  it("shows what the user is, and the three tabs to a Head", async () => {
    await open({ node: node(), entries: [] });
    expect(screen.getByRole("tab", { name: "People" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Links" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Who may share" })).toBeTruthy();
  });

  it("gives a delegate no tab to name others and no way to exclude", async () => {
    await open({ node: node({ level: "DELEGATE", canExclude: false, canManageDelegates: false }), entries: [] });
    expect(screen.queryByRole("tab", { name: "Who may share" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Exclude" })).toBeNull();
  });

  it("lists who has access as a row for each person, with the Can share badge on the people who may share", async () => {
    await open({ node: node(), entries: [entry("r1")] }, [person("Trainer One", { canShare: true }), person("Nguyen Van A")]);
    expect(await screen.findByText("Trainer One")).toBeTruthy();
    expect(screen.getByText("Nguyen Van A")).toBeTruthy();
    expect(screen.getAllByText("Can share")).toHaveLength(1);
    expect(api.sharingPeople).toHaveBeenCalledWith(expect.objectContaining({ kind: "DOCUMENT", documentId: "d1" }), expect.objectContaining({ offset: 0, limit: 20, mine: false }));
  });

  it("shows a lock instead of a bin for what a higher level made, and the bin for what the user may remove", async () => {
    await open(
      { node: node({ level: "DELEGATE", canExclude: false, canManageDelegates: false }), entries: [entry("r2", { removable: true, createdByLevel: "DELEGATE", createdByMe: true })] },
      [person("Head's person", { removable: false }), person("My person", { ruleId: "r2", removable: true, createdByLevel: "DELEGATE", createdByMe: true })],
    );
    expect(await screen.findByText("My person")).toBeTruthy();
    expect(screen.getAllByText("Locked")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Remove My person" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove Head's person" })).toBeNull();
  });

  it("takes one person out of a share after a confirmation, leaving the rest", async () => {
    await open({ node: node(), entries: [entry("r1")] }, [person("Anna"), person("Binh")]);
    fireEvent.click(await screen.findByRole("button", { name: "Remove Anna" }));
    const buttons = await screen.findAllByRole("button", { name: "Remove" });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(api.sharingRevokeGrantee).toHaveBeenCalledWith("r1", "USER", "id-Anna"));
    expect(api.sharingRevoke).not.toHaveBeenCalled();
    // the list is read again
    await waitFor(() => expect(api.sharingPeople.mock.calls.length).toBeGreaterThan(1));
  });

  it("keeps a Remove all beside the search that takes away every share the user may remove", async () => {
    await open({ node: node(), entries: [entry("r1"), entry("r2"), entry("r3", { removable: false })] }, [person("Anna")]);
    fireEvent.click(await screen.findByRole("button", { name: "Remove all" }));
    const buttons = await screen.findAllByRole("button", { name: "Remove all" });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(api.sharingRevoke).toHaveBeenCalledTimes(2));
    expect(api.sharingRevoke).toHaveBeenCalledWith("r1");
    expect(api.sharingRevoke).toHaveBeenCalledWith("r2");
  });

  it("offers no Remove all when nothing may be removed", async () => {
    await open({ node: node(), entries: [entry("r1", { removable: false })] }, [person("Anna", { removable: false })]);
    await screen.findByText("Anna");
    expect(screen.queryByRole("button", { name: "Remove all" })).toBeNull();
  });

  it("searches on the server and says so when nobody matches", async () => {
    await open({ node: node(), entries: [entry("r1")] }, [person("Anna")]);
    await screen.findByText("Anna");
    api.sharingPeople.mockResolvedValue(page([]));
    fireEvent.change(screen.getByLabelText("Search who has access"), { target: { value: "zzz" } });
    await waitFor(() => expect(api.sharingPeople).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ search: "zzz", offset: 0 })));
    expect(await screen.findByText("Nobody matches your search.")).toBeTruthy();
  });

  it("reads the next page only when the list is scrolled to it, and lets the far pages go", async () => {
    api.sharingAccess.mockResolvedValue({ node: node(), entries: [entry("r1")] });
    const rows = (from: number, count: number) => Array.from({ length: count }, (_, i) => person(`Person ${from + i}`, { granteeId: `id-${from + i}` }));
    api.sharingPeople.mockImplementation(async (_ref: unknown, q: { offset: number; limit: number }) => page(rows(q.offset, Math.min(q.limit, 100 - q.offset)), 100));
    render(<ShareDialog target={target} onClose={() => undefined} />);
    expect(await screen.findByText("Person 0")).toBeTruthy();
    // only the first page (and the one after it, ready for the scroll) was asked for, never the 100
    expect(api.sharingPeople.mock.calls.every(([, q]) => q.limit === 20)).toBe(true);
    expect(api.sharingPeople.mock.calls.some(([, q]) => q.offset === 60)).toBe(false);

    const list = screen.getAllByTestId("scroll-list")[0];
    fireEvent.scroll(list, { target: { scrollTop: 60 * 60 } });
    await waitFor(() => expect(api.sharingPeople.mock.calls.some(([, q]) => q.offset === 60)).toBe(true));
    expect(await screen.findByText("Person 60")).toBeTruthy();
    // the first page was let go
    expect(screen.queryByText("Person 0")).toBeNull();
  });

  it("lets the person see only what they shared themselves", async () => {
    await open({ node: node(), entries: [entry("r1"), entry("r2", { createdByMe: true })] }, [person("Someone Else")]);
    await screen.findByText("Someone Else");
    api.sharingPeople.mockResolvedValue(page([person("Mine", { createdByMe: true })]));
    fireEvent.click(screen.getByRole("tab", { name: "Shared by me" }));
    expect(await screen.findByText("Mine")).toBeTruthy();
    expect(screen.queryByText("Someone Else")).toBeNull();
    expect(api.sharingPeople).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ mine: true }));
  });

  it("puts the two Everyone switches on a row each, one under the other", async () => {
    await open({ node: node(), entries: [] });
    const everyone = screen.getByRole("switch", { name: "Everyone" });
    const department = screen.getByRole("switch", { name: "Everyone in the Department" });
    const group = screen.getByTestId("everyone-switches");
    expect(group.children).toHaveLength(2);
    expect(group.children[0].contains(everyone)).toBe(true);
    expect(group.children[1].contains(department)).toBe(true);
    // no frame around a row
    expect(group.children[0].className).not.toContain("border");
    expect(group.children[1].className).not.toContain("border");
  });

  it("shares with the chosen people and reads the list again", async () => {
    await open({ node: node(), entries: [] });
    api.sharingGrant.mockResolvedValue({ node: node(), entries: [entry("r9")] });
    api.sharingPeople.mockResolvedValue(page([person("Nguyen Van A")]));
    fireEvent.click(screen.getByRole("switch", { name: "Everyone" }));
    // "Share" is also the name of the effect option; the submit button is the last one
    const shareButtons = screen.getAllByRole("button", { name: "Share" });
    fireEvent.click(shareButtons[shareButtons.length - 1]);
    await waitFor(() => expect(api.sharingGrant).toHaveBeenCalledWith(expect.objectContaining({ kind: "DOCUMENT", documentId: "d1", effect: "ALLOW", everyone: true })));
    expect(await screen.findByText("Nguyen Van A")).toBeTruthy();
  });

  it("asks the server what a Unit folder is and shares it as a Unit", async () => {
    api.sharingFolder.mockResolvedValue(node({ kind: "BUSINESS_UNIT", departmentId: null, departmentName: null, documentId: null, label: "Quality Unit", level: "UNIT_HEAD" }));
    api.sharingAccess.mockResolvedValue({ node: node({ kind: "BUSINESS_UNIT", departmentId: null, departmentName: null, documentId: null, label: "Quality Unit", level: "UNIT_HEAD" }), entries: [] });
    render(<ShareDialog target={{ kind: "folder", knowledgeBase: "bu1", path: [], label: "Quality Unit" }} onClose={() => undefined} />);
    await screen.findByText("Who has access");
    expect(api.sharingAccess).toHaveBeenCalledWith(expect.objectContaining({ kind: "BUSINESS_UNIT", businessUnitId: "bu1" }));
    expect(screen.getByRole("switch", { name: "Everyone in the Business Unit" })).toBeTruthy();
  });

  // ---- what is typed or picked stays when the tab is changed ----

  it("keeps what was chosen in a tab when the person goes to another tab and comes back", async () => {
    await open({ node: node(), entries: [] });
    const everyone = screen.getByRole("switch", { name: "Everyone" });
    fireEvent.click(everyone);
    expect(everyone.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: "Links" }));
    await screen.findByText("Make a link");
    fireEvent.click(screen.getByRole("tab", { name: "Who may share" }));
    await screen.findByText("People who may share");
    fireEvent.click(screen.getByRole("tab", { name: "People" }));
    expect(screen.getByRole("switch", { name: "Everyone" }).getAttribute("aria-checked")).toBe("true");
    // nothing was sent: the person never pressed the button
    expect(api.sharingGrant).not.toHaveBeenCalled();
  });

  it("keeps the search typed in a list when the person comes back to the tab", async () => {
    await open({ node: node(), entries: [] });
    fireEvent.click(screen.getByRole("tab", { name: "Links" }));
    await screen.findByText("Make a link");
    fireEvent.change(screen.getByLabelText("Search the links"), { target: { value: "sop" } });
    fireEvent.click(screen.getByRole("tab", { name: "People" }));
    fireEvent.click(screen.getByRole("tab", { name: "Links" }));
    expect((screen.getByLabelText("Search the links") as HTMLInputElement).value).toBe("sop");
  });

  // ---- links ----

  it("makes a link, shows it once and copies it", async () => {
    await open({ node: node(), entries: [] });
    fireEvent.click(screen.getByRole("tab", { name: "Links" }));
    await screen.findByText("Make a link");
    api.sharingCreateLink.mockResolvedValue({
      token: "tok-123",
      link: { id: "l1", scopeKind: "DOCUMENT", scopeLabel: "Document", label: "SOP.0001", inherited: false, status: "ACTIVE", createdBy: "Head", createdByLevel: "DEPARTMENT_HEAD",
        createdAt: "03/11/2026 10:00", expiresAt: "03/12/2026 10:00", revokedAt: null, revokedBy: null, opens: 0, revocable: true },
    });
    fireEvent.click(screen.getByRole("button", { name: "Make link" }));
    await waitFor(() => expect(api.sharingCreateLink).toHaveBeenCalledWith(expect.objectContaining({ kind: "DOCUMENT", documentId: "d1", expiresInDays: 30 })));
    const field = (await screen.findByLabelText("The link")) as HTMLInputElement;
    expect(field.value).toContain("/documents/knowledge/link/tok-123");
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(field.value));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
    expect(screen.getByText(/shown only once/)).toBeTruthy();
  });

  it("lists the links that reach the item a page at a time, searches them and revokes one after a confirmation", async () => {
    await open({ node: node(), entries: [] });
    api.sharingLinks.mockResolvedValue(page([
      { id: "l1", scopeKind: "DEPARTMENT", scopeLabel: "Whole Department", label: "QC Laboratory", inherited: true, status: "ACTIVE", createdBy: "Head", createdByLevel: "DEPARTMENT_HEAD",
        createdAt: "01/11/2026 09:00", expiresAt: null, revokedAt: null, revokedBy: null, opens: 3, revocable: true },
      { id: "l2", scopeKind: "DOCUMENT", scopeLabel: "Document", label: "SOP.0001", inherited: false, status: "REVOKED", createdBy: "Head", createdByLevel: "DEPARTMENT_HEAD",
        createdAt: "01/11/2026 09:00", expiresAt: null, revokedAt: "02/11/2026 09:00", revokedBy: "Head", opens: 1, revocable: false },
    ]));
    fireEvent.click(screen.getByRole("tab", { name: "Links" }));
    expect(await screen.findByText("From Whole Department: QC Laboratory")).toBeTruthy();
    expect(screen.getByText("Revoked")).toBeTruthy();
    expect(api.sharingLinks).toHaveBeenCalledWith(expect.objectContaining({ kind: "DOCUMENT" }), expect.objectContaining({ offset: 0, limit: 20 }));
    expect(screen.getAllByRole("button", { name: "Revoke" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    const buttons = await screen.findAllByRole("button", { name: "Revoke" });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(api.sharingRevokeLink).toHaveBeenCalledWith("l1"));
  });

  // ---- delegates ----

  it("lists the people who may share with the badge, adds one and removes one", async () => {
    await open({ node: node(), entries: [] });
    api.sharingDelegates.mockResolvedValue(page([
      { id: "dg1", userId: "u1", fullName: "Trainer One", employeeCode: "E01", department: "QC", position: "QC Specialist", scopeKind: "DEPARTMENT", scopeLabel: "Department QC Laboratory", grantedBy: "Head", grantedAt: "03/11/2026 10:00" },
    ]));
    fireEvent.click(screen.getByRole("tab", { name: "Who may share" }));
    expect(await screen.findByText("Trainer One")).toBeTruthy();
    // only the employee ID and the Position under the name; no badge
    expect(screen.getByText("E01 · QC Specialist")).toBeTruthy();
    expect(screen.queryByText("Can share")).toBeNull();
    expect(api.sharingDelegates).toHaveBeenCalledWith(expect.objectContaining({ scopeKind: "DEPARTMENT", departmentId: "dep1" }), expect.objectContaining({ offset: 0, limit: 20 }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Trainer One" }));
    const buttons = await screen.findAllByRole("button", { name: "Remove" });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(api.sharingRemoveDelegate).toHaveBeenCalledWith("dg1"));
    expect(screen.getByRole("button", { name: "Add" }).hasAttribute("disabled")).toBe(true);
  });

  it("offers, to name a person who may share, only the people of the Department: the search carries the scope", async () => {
    await open({ node: node(), entries: [] });
    fireEvent.click(screen.getByRole("tab", { name: "Who may share" }));
    await screen.findByText("People who may share");
    fireEvent.click(screen.getByText("Search a person of the Department"));
    await waitFor(() => expect(api.sharingUsers).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ scopeKind: "DEPARTMENT", departmentId: "dep1" })));
  });

  it("offers the people of the whole Unit when the scope is the Unit", async () => {
    api.sharingFolder.mockResolvedValue(node({ kind: "BUSINESS_UNIT", departmentId: null, departmentName: null, documentId: null, label: "Quality Unit", level: "UNIT_HEAD" }));
    api.sharingAccess.mockResolvedValue({ node: node({ kind: "BUSINESS_UNIT", departmentId: null, departmentName: null, documentId: null, label: "Quality Unit", level: "UNIT_HEAD" }), entries: [] });
    render(<ShareDialog target={{ kind: "folder", knowledgeBase: "bu1", path: [], label: "Quality Unit" }} onClose={() => undefined} />);
    await screen.findByText("Who has access");
    fireEvent.click(screen.getByRole("tab", { name: "Who may share" }));
    await screen.findByText("People who may share");
    fireEvent.click(screen.getByText("Search a person of the Unit"));
    await waitFor(() => expect(api.sharingUsers).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ scopeKind: "BUSINESS_UNIT", businessUnitId: "bu1" })));
  });
});
