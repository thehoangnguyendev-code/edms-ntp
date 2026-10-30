import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getDisplayStyles: vi.fn() }));
vi.mock("@/services/api/electronicSignatureSettings", async (importOriginal) => ({ ...(await importOriginal<object>()), electronicSignatureSettingsApi: api }));

import { SignatureDisplayStyles } from "../SignatureDisplayStyles";

const styles = [
  { style: "COMPACT", label: "Compact", frame: "Small frame", text: "Nguyen Van A\nApproved · 26/10/2026 23:16 (UTC+07)" },
  { style: "STANDARD", label: "Standard", frame: "Standard frame", text: "Nguyen Van A\nElectronically approved\n26/10/2026 23:16 (UTC+07)" },
  { style: "DETAILED", label: "Detailed", frame: "Frame with the signature ID", text: "Nguyen Van A\nApproved · 26/10/2026 23:16 (UTC+07)\nSIG-2026-8F3A9B" },
];

beforeEach(() => api.getDisplayStyles.mockResolvedValue(styles));
afterEach(cleanup);

describe("SignatureDisplayStyles", () => {
  it("shows the three styles drawn by the server, and no placeholder (they are in Publishing Templates)", async () => {
    render(<SignatureDisplayStyles />);

    const detailed = await screen.findByRole("region", { name: "Detailed style" });
    expect(within(detailed).getByText("SIG-2026-8F3A9B")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Compact style" })).getByText("Approved · 26/10/2026 23:16 (UTC+07)")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Standard style" })).getByText("Electronically approved")).toBeTruthy();
    expect(screen.queryByText(/\{\{/)).toBeNull();
    expect(screen.getByText("Publishing Templates")).toBeTruthy();
  });

  it("says what every style keeps", async () => {
    render(<SignatureDisplayStyles />);

    expect(await screen.findByText(/What every style keeps \(21 CFR 11.50\)/)).toBeTruthy();
  });

  it("says so when the styles cannot be loaded", async () => {
    // a plain function, not a spy: the spy of the test runner keeps its own copy of a rejected promise and reports it as unhandled
    api.getDisplayStyles = (() => Promise.reject(new Error("x"))) as never;
    render(<SignatureDisplayStyles />);

    expect((await screen.findByRole("alert")).textContent).toMatch(/could not be loaded/);
  });
});
