import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// the filtered catalog comes from the server; here it is unreachable, so the explorer keeps the groups it was given
vi.mock("@/services/api/settings", () => ({ settingsApi: { getPermissionCatalog: vi.fn().mockRejectedValue(new Error("offline")) } }));

import { PermissionSplitExplorer } from "../PermissionSplitExplorer";
import type { Permission, PermissionGroup } from "../../permission-types";

const permission = (id: string, module: string, label: string, description = ""): Permission =>
  ({ id, module, resource: id.split(".")[1], action: "view", label, description, riskLevel: "low", requiresAudit: false, requiresESign: false, systemDefined: true, active: true }) as unknown as Permission;
const group = (id: string, permissions: Permission[]): PermissionGroup => ({ id, name: id, description: "", permissions, order: 1 });
const groups = [
  group("settings.business_unit", [
    permission("settings.business_unit.view", "app-settings", "View Business Units", "View controlled business units values."),
    permission("settings.business_unit.manage", "app-settings", "Manage Business Units", "Create, update, and delete business units."),
  ]),
  group("audit.trail", [permission("audit.trail.view", "audit-trail", "View Audit Trail")]),
];

const renderExplorer = async (props: Partial<React.ComponentProps<typeof PermissionSplitExplorer>> = {}) => {
  const onToggle = vi.fn();
  const view = render(<PermissionSplitExplorer groups={groups} selectedCodes={new Set(["settings.business_unit.view"])} onToggle={onToggle} {...props} />);
  // the explorer first asks the server for the filtered catalog: the module buttons appear when that answer (here a failure) is in
  const settings = await screen.findByRole("button", { name: /Application Settings/ });
  fireEvent.click(settings); // the chips follow the order of the menu (Audit Trail comes before Application Settings): open the module these tests look at
  return { onToggle, ...view };
};
const showTable = () => fireEvent.click(screen.getByRole("tab", { name: "Table" }));

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("Permission explorer: modules", () => {
  it("shows one module for the keys the server stores for one menu (app-settings and settings)", async () => {
    const more = group("settings.role", [permission("settings.role.view", "settings", "View Roles")]);
    await renderExplorer({ groups: [...groups, more] });
    expect(screen.getAllByRole("button", { name: /Application Settings/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Application Settings/ }).textContent).toContain("/3"); // the three permissions of both keys
    fireEvent.click(screen.getByRole("tab", { name: "Table" }));
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(1 + 3);
  });
});

describe("Permission explorer: cards and table", () => {
  it("shows the cards first, and the table on request, with the code as a column of its own", async () => {
    await renderExplorer();
    expect(screen.queryByRole("table")).toBeNull();

    showTable();

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["No.", "Granted", "Permission", "Code", "Description"]);
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(1 + 2); // the header and the two permissions of the first module
    expect(rows[1].textContent).toMatch(/^1/); // the lines are numbered
    expect(rows[2].textContent).toMatch(/^2/);
    expect(rows[1].textContent).toContain("View Business Units");
    expect(rows[1].textContent).toContain("settings.business_unit.view");
    expect(rows[1].textContent).toContain("View controlled business units values.");
  });

  it("remembers the choice in this browser, and falls back to the cards when the storage refuses", async () => {
    const { unmount } = await renderExplorer();
    showTable();
    expect(window.localStorage.getItem("eqms.permission-explorer.view")).toBe("table");
    unmount();

    await renderExplorer();
    expect(screen.getByRole("table")).toBeTruthy(); // the choice came back
    cleanup();

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
    await renderExplorer();
    expect(screen.queryByRole("table")).toBeNull();
    showTable(); // still switches for this page
    expect(screen.getByRole("table")).toBeTruthy();
    vi.restoreAllMocks();
  });

  it("changes the selection from a row or from its tick, once each, and shows the same module and count as the cards", async () => {
    const { onToggle } = await renderExplorer();
    expect(screen.getByText("1 selected")).toBeTruthy();
    showTable();
    expect(screen.getByText("1 selected")).toBeTruthy();

    const manage = screen.getByText("Manage Business Units").closest("tr") as HTMLElement;
    fireEvent.click(manage);
    expect(onToggle).toHaveBeenLastCalledWith("settings.business_unit.manage", true);

    fireEvent.click(within(manage).getByRole("checkbox", { name: "Manage Business Units" }));
    expect(onToggle).toHaveBeenCalledTimes(2); // the tick does not also count as a click on the row

    fireEvent.click(screen.getByRole("button", { name: /Audit Trail/ }));
    expect(screen.getByText("View Audit Trail")).toBeTruthy();
  });

  it("locks a permission that a shared set grants: ticked, disabled, named in its tooltip, and never toggled", async () => {
    const { onToggle } = await renderExplorer({
      lockedCodes: new Set(["settings.business_unit.view"]),
      lockedNotes: new Map([["settings.business_unit.view", "Granted by shared set: Quality Admin"]]),
    });
    showTable();

    const row = screen.getByText("View Business Units").closest("tr") as HTMLElement;
    expect(within(row).getByRole("checkbox", { name: /View Business Units \(granted by a shared set\)/ })).toBeDisabled();
    expect(within(row).getByRole("checkbox", { name: /View Business Units/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("View Business Units").getAttribute("title")).toBe("Granted by shared set: Quality Admin"); // the tooltip is on the name of the permission
    fireEvent.click(row);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("is read-only for a profile that cannot be changed, and lists only what is granted without a tick column", async () => {
    const { onToggle, unmount } = await renderExplorer({ readOnly: true });
    showTable();
    const row = screen.getByText("Manage Business Units").closest("tr") as HTMLElement;
    fireEvent.click(row);
    expect(onToggle).not.toHaveBeenCalled();
    expect(within(row).getByRole("checkbox")).toBeDisabled();
    unmount();

    await renderExplorer({ readOnly: true, selectedOnly: true });
    showTable();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Granted" })).toBeNull();
    expect(screen.getByRole("columnheader", { name: "No." })).toBeTruthy(); // the numbers stay
    expect(screen.getAllByRole("row")).toHaveLength(1 + 1); // only the granted permission of the module
    expect(screen.queryByText("Manage Business Units")).toBeNull();
  });
});
