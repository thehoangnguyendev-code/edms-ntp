import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getDisplayStyle: vi.fn() }));
vi.mock("@/services/api/electronicSignatureSettings", async (importOriginal) => ({ ...(await importOriginal<object>()), electronicSignatureSettingsApi: api }));

import { SignatureDisplay } from "../SignatureDisplay";

const sample = { style: "STANDARD", label: "Standard", frame: "Standard frame", text: "Nguyen Van A\nElectronically approved\n26/10/2026 23:16 (UTC+07)" };

beforeEach(() => api.getDisplayStyle.mockResolvedValue(sample));
afterEach(cleanup);

describe("SignatureDisplay", () => {
  it("shows the one frame drawn by the server, and no placeholder (they are in Publishing Templates)", async () => {
    render(<SignatureDisplay />);

    const frame = await screen.findByRole("region", { name: "Standard signature display" });
    expect(await within(frame).findByText("Electronically approved")).toBeTruthy();
    expect(within(frame).getByText("26/10/2026 23:16 (UTC+07)")).toBeTruthy();
    expect(screen.queryByText(/\{\{/)).toBeNull();
    expect(screen.getByText("Publishing Templates")).toBeTruthy();
  });

  it("offers no other style", async () => {
    render(<SignatureDisplay />);
    await screen.findByText("Electronically approved");

    expect(screen.queryByText(/Compact/)).toBeNull();
    expect(screen.queryByText(/Detailed/)).toBeNull();
  });

  it("says what the signature keeps", async () => {
    render(<SignatureDisplay />);

    expect(await screen.findByText(/What the signature keeps \(21 CFR 11.50\)/)).toBeTruthy();
  });

  it("says so when the display cannot be loaded", async () => {
    // a plain function, not a spy: the spy of the test runner keeps its own copy of a rejected promise and reports it as unhandled
    api.getDisplayStyle = (() => Promise.reject(new Error("x"))) as never;
    render(<SignatureDisplay />);

    expect((await screen.findByRole("alert")).textContent).toMatch(/could not be loaded/);
  });
});
