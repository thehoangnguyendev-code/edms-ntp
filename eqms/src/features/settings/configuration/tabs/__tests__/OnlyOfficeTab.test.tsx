import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ test: vi.fn(), toast: vi.fn() }));
vi.mock("@/services/api/settings", () => ({ settingsApi: { testOnlyOfficeConnection: mocks.test } }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: mocks.toast }) }));

import { OnlyOfficeTab, generateJwtSecret, hasUnsavedConnectionChange } from "../OnlyOfficeTab";
import type { OnlyOfficeStorageConfig } from "../../types";
import type { IntegrationChecksController } from "../../useIntegrationChecks";

const saved: OnlyOfficeStorageConfig = { enabled: true, documentServerUrl: "http://onlyoffice-documentserver", callbackBaseUrl: "http://backend:5000", jwtSecret: "", jwtSecretConfigured: true, jwtSecretMasked: "********", jwtSecretChangedAt: "2026-11-12T03:00:00Z" };
const controller = (checks: IntegrationChecksController["checks"] = {}, reload = vi.fn()): IntegrationChecksController => ({ checks, loaded: true, reload });
const check = (success: boolean, steps: NonNullable<IntegrationChecksController["checks"]["ONLYOFFICE"]>["steps"], message = "message") => ({
  integration: "ONLYOFFICE" as const, success, message, subject: "OnlyOffice · http://onlyoffice-documentserver", steps, checkedAt: "2026-11-19T04:00:00Z", checkedBy: "Admin",
});

function Harness({ initial = saved, savedConfig = saved, checks }: { initial?: OnlyOfficeStorageConfig; savedConfig?: OnlyOfficeStorageConfig; checks: IntegrationChecksController }) {
  const [config, setConfig] = useState(initial);
  return <OnlyOfficeTab onlyOfficeConfig={config} onOnlyOfficeChange={setConfig} savedOnlyOffice={savedConfig} checks={checks} />;
}

beforeEach(() => {
  mocks.test.mockReset(); mocks.toast.mockReset();
  Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
});
afterEach(cleanup);

describe("OnlyOffice tab: state and test (O1, O2)", () => {
  it("shows each step of the last test, and what failed, not only one sentence", () => {
    const steps = [
      { key: "reachable", label: "Document Server reachable", status: "OK" as const, detail: "The Document Server answered its health check." },
      { key: "jwt", label: "JWT secret accepted", status: "FAILED" as const, detail: "The Document Server refused the saved secret: it must be the same value on both sides." },
    ];
    render(<Harness checks={controller({ ONLYOFFICE: check(false, steps, "OnlyOffice Document Server is reachable, but it refused the saved JWT secret.") })} />);

    expect(screen.getByText("Last test failed")).toBeTruthy();
    expect(screen.getByText("Document Server reachable")).toBeTruthy();
    expect(screen.getByText("JWT secret accepted")).toBeTruthy();
    expect(screen.getByText(/refused the saved secret/)).toBeTruthy();
    expect(screen.getByLabelText("Failed")).toBeTruthy();
    expect(screen.getByLabelText("Passed")).toBeTruthy();
  });

  it("does not call a step that could not be checked a failure", () => {
    const steps = [{ key: "jwt", label: "JWT secret accepted", status: "NOT_CHECKED" as const, detail: "No JWT secret is saved." }];
    render(<Harness checks={controller({ ONLYOFFICE: check(true, steps) })} />);

    expect(screen.getByLabelText("Not checked")).toBeTruthy();
    expect(screen.queryByLabelText("Failed")).toBeNull();
  });

  it("runs the test, tells it with a toast, and reads the kept result again", async () => {
    const reload = vi.fn();
    mocks.test.mockResolvedValue({ success: true, message: "OnlyOffice Document Server is reachable and healthy." });
    render(<Harness checks={controller({}, reload)} />);

    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "success", title: "Connection successful" })));
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it("says that the test reads the saved settings while there are changes that are not saved, and offers no test while the saved setting is off", () => {
    render(<Harness checks={controller()} />);
    expect(screen.queryByText(/Test connection checks the saved settings/)).toBeNull();

    fireEvent.change(screen.getByLabelText("Document Server URL (browser-reachable)"), { target: { value: "http://elsewhere" } });
    expect(screen.getByText(/Test connection checks the saved settings/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Test saved settings" })).toBeTruthy();
    cleanup();

    render(<Harness initial={{ ...saved, enabled: false }} savedConfig={{ ...saved, enabled: false }} checks={controller()} />);
    expect(screen.queryByRole("button", { name: /Test/ })).toBeNull();
    expect(screen.getByText("OnlyOffice is off, so there is nothing to test.")).toBeTruthy();
  });

  it("tells a change that the test cannot see from one that it can", () => {
    expect(hasUnsavedConnectionChange(saved, saved)).toBe(false);
    expect(hasUnsavedConnectionChange({ ...saved, documentServerUrl: " http://onlyoffice-documentserver " }, saved)).toBe(false);
    expect(hasUnsavedConnectionChange({ ...saved, documentServerUrl: "http://x" }, saved)).toBe(true);
    expect(hasUnsavedConnectionChange({ ...saved, enabled: false }, saved)).toBe(true);
    expect(hasUnsavedConnectionChange({ ...saved, jwtSecret: "new" }, saved)).toBe(true);
    expect(hasUnsavedConnectionChange({ ...saved, clearJwtSecret: true }, saved)).toBe(true);
    expect(hasUnsavedConnectionChange(saved, undefined)).toBe(false);
  });
});

describe("OnlyOffice tab: the switch and the settings of the other side (O4, O5)", () => {
  it("turns the settings off with the switch and says what it means; the values for the other side are shown only while it is on", () => {
    render(<Harness checks={controller()} />);
    expect(screen.getByText("OnlyOffice is on")).toBeTruthy();
    expect(screen.getByText("Settings for the Document Server")).toBeTruthy();

    fireEvent.click(screen.getByRole("switch", { name: "Enable OnlyOffice" }));

    expect(screen.getByText("OnlyOffice is off")).toBeTruthy();
    expect(screen.getByText(/the OnlyOffice editor and viewer cannot be opened/)).toBeTruthy();
    expect(screen.queryByText("Settings for the Document Server")).toBeNull();
  });

  it("lists the address of the frontend and the callback base URL with copy buttons, and names the secret without showing it", async () => {
    render(<Harness checks={controller()} />);

    const section = screen.getByText("Settings for the Document Server").closest("section") as HTMLElement;
    expect(within(section).getByText("http://onlyoffice-documentserver")).toBeTruthy();
    expect(within(section).getByText("http://backend:5000")).toBeTruthy();
    expect(within(section).getByText("The same value as JWT_SECRET of the Document Server")).toBeTruthy();

    fireEvent.click(within(section).getByRole("button", { name: "Copy the callback base URL" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("http://backend:5000"));
  });
});

describe("OnlyOffice tab: the JWT secret (O3)", () => {
  it("says when the secret last changed, in the time format of the system, and never shows the saved value", () => {
    render(<Harness checks={controller()} />);

    expect(screen.getByText(/A secret is saved\. Last changed 12\/11\/2026/)).toBeTruthy();
    expect(screen.getByLabelText("JWT Secret")).toHaveValue("Stored secret configured");
  });

  it("makes a new secret of 32 random bytes, shows it once with a copy button, and warns to put it on the other side first", async () => {
    render(<Harness checks={controller()} />);

    fireEvent.click(screen.getByRole("button", { name: "Generate new" }));

    const value = (screen.getByLabelText("JWT Secret") as HTMLInputElement).value;
    expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(screen.getByText(/shown here once/)).toBeTruthy();
    expect(screen.getByText(/Put the same value in the Document Server's JWT_SECRET before you press Save/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy the new JWT secret" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(value));
    expect(generateJwtSecret()).not.toBe(generateJwtSecret());
  });

  it("does not offer to copy a secret that was typed, and Reset Secret clears the generated one", () => {
    render(<Harness checks={controller()} />);
    fireEvent.click(screen.getByRole("button", { name: "Replace Secret" }));
    fireEvent.change(screen.getByLabelText("JWT Secret"), { target: { value: "typed-by-hand" } });
    expect(screen.queryByRole("button", { name: "Copy the new JWT secret" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Generate new" }));
    expect(screen.getByRole("button", { name: "Copy the new JWT secret" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset Secret" }));
    expect(screen.queryByRole("button", { name: "Copy the new JWT secret" })).toBeNull();
    expect(screen.getByText("JWT Secret is required (must match the onlyoffice-documentserver container's JWT_SECRET).")).toBeTruthy();
  });
});
