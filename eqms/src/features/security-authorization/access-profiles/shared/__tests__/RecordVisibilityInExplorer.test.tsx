import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// the filtered catalog comes from the server; here it is unreachable, so the explorer keeps the groups it was given
vi.mock("@/services/api/settings", () => ({ settingsApi: { getPermissionCatalog: vi.fn().mockRejectedValue(new Error("offline")) } }));

import { PermissionSplitExplorer } from "@/features/security-authorization/shared/explorer/PermissionSplitExplorer";
import type { Permission, PermissionGroup } from "@/features/security-authorization/shared/permission-types";
import { RecordVisibilityForModule, hasRecordVisibility } from "../RecordVisibilityForModule";

const permission = (id: string, module: string, label: string): Permission =>
  ({ id, module, resource: id.split(".")[1], action: "view", label, description: "", riskLevel: "low", requiresAudit: false, requiresESign: false, systemDefined: true, active: true }) as unknown as Permission;
const group = (id: string, permissions: Permission[]): PermissionGroup => ({ id, name: id, description: "", permissions, order: 1 });
const groups = [
  group("documents.document", [permission("documents.document.view", "documents", "View Documents")]),
  group("training.record", [permission("training.record.view", "training", "View Training Records")]),
  group("notifications.module", [permission("notifications.module.view", "notifications", "View Notifications")]),
];

const none = new Set<string>();
const renderExplorer = async (selected: string[]) => {
  render(
    <PermissionSplitExplorer
      groups={groups}
      selectedCodes={new Set(selected)}
      onToggle={() => {}}
      moduleExtras={(moduleName) => (
        <RecordVisibilityForModule moduleName={moduleName} selectedCodes={new Set(selected)} lockedCodes={none} onChooseDocumentControl={() => {}} onChooseModule={() => {}} />
      )}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: /^Document Control\s*\d/ }));
};
const chip = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}\\s*\\d`) });

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("Record visibility under the chip of its module", () => {
  it("does not ask for the visibility of a module the profile holds no permission of", async () => {
    await renderExplorer(["notifications.module.view"]);
    expect(screen.queryByTestId("record-visibility-picker")).toBeNull();
  });

  it("shows the Document Control choice once a Document Control permission is ticked, and not under another module", async () => {
    await renderExplorer(["documents.document.view"]);
    expect(screen.getByTestId("record-visibility-picker")).toBeTruthy();
    fireEvent.click(chip("Training Management"));
    // Training has no tick yet, so no picker either: the Document Control one slides away and is then gone
    await waitFor(() => expect(screen.queryByTestId("record-visibility-picker")).toBeNull(), { timeout: 2000 });
  });

  it("shows the Training choice under the Training chip when a Training permission is ticked", async () => {
    await renderExplorer(["training.record.view"]);
    fireEvent.click(chip("Training Management"));
    expect(screen.getByTestId("record-visibility-training")).toBeTruthy();
    expect(screen.queryByTestId("record-visibility-picker")).toBeNull();
  });

  it("gives no choice to a module without records: the open module has no picker even with a permission ticked", async () => {
    await renderExplorer(["notifications.module.view"]);
    fireEvent.click(chip("Notifications"));
    expect(screen.queryByTestId("record-visibility-picker")).toBeNull();
    expect(screen.queryByTestId("record-visibility-training")).toBeNull();
  });

  it("keeps the long explanation closed until the person opens Details, and closes it again", async () => {
    await renderExplorer(["documents.document.view"]);
    // the explanation stays in the page and slides open and closed (GSAP); what the test reads is the state of the panel and of the button
    const panel = () => screen.getByText(/Copies:/).closest("[data-details]") as HTMLElement;
    expect(panel().getAttribute("data-open")).toBe("false");
    expect(screen.getByRole("button", { name: /Details/ }).getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: /Details/ }));
    expect(panel().getAttribute("data-open")).toBe("true");
    expect(screen.getByRole("button", { name: /Details/ }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /Details/ }));
    expect(panel().getAttribute("data-open")).toBe("false");
  });

  it("knows which modules have a choice", () => {
    expect(hasRecordVisibility("Document Control")).toBe(true);
    expect(hasRecordVisibility("Training Management")).toBe(true);
    expect(hasRecordVisibility("Reports")).toBe(true);
    expect(hasRecordVisibility("Notifications")).toBe(false);
    expect(hasRecordVisibility("Backup & Restore")).toBe(false);
  });
});
