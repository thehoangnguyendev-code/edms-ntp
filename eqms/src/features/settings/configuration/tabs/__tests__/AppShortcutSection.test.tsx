import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import type { GeneralConfig } from "../../types";
import { AppShortcutSection, appIconProblem } from "../AppShortcutSection";

const config = { systemDisplayName: "Quality Management System", appIcon: "", appShortName: "", appIconBackground: "" } as unknown as GeneralConfig;
const size = { width: 1024, height: 1024 };

beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
  vi.stubGlobal("Image", class { onload: () => void = () => {}; onerror: () => void = () => {}; naturalWidth = size.width; naturalHeight = size.height; set src(_v: string) { queueMicrotask(() => this.onload()); } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const renderIt = (onChange = vi.fn(), value = config) => { render(<ToastProvider><AppShortcutSection config={value} onChange={onChange} /></ToastProvider>); return onChange; };
const upload = (file: File) => fireEvent.change(screen.getByLabelText("Upload shortcut icon"), { target: { files: [file] } });

describe("AppShortcutSection", () => {
  it("checks the picture the way the server does", () => {
    expect(appIconProblem({ type: "image/svg+xml", size: 100 })).toMatch(/PNG or JPEG/);
    expect(appIconProblem({ type: "image/png", size: 5 * 1024 * 1024 })).toMatch(/smaller than 3 MB/);
    expect(appIconProblem({ type: "image/png", size: 100 }, { width: 300, height: 300 })).toMatch(/at least 512/);
    expect(appIconProblem({ type: "image/png", size: 100 }, { width: 2000, height: 600 })).toMatch(/roughly square/);
    expect(appIconProblem({ type: "image/png", size: 100 }, size)).toBeNull();
  });

  it("puts a good icon in the configuration as a data URL", async () => {
    const onChange = renderIt();
    upload(new File([new Uint8Array([137, 80, 78, 71])], "logo.png", { type: "image/png" }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls[0][0].appIcon).toMatch(/^data:image\/png;base64,/);
  });

  it("refuses a file that is not a PNG or JPEG without touching the configuration", async () => {
    const onChange = renderIt();
    upload(new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" }));

    expect(await screen.findByText("Use a PNG or JPEG image.")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("limits the label to 12 characters, offers Reset only when an icon is set, and says how a change reaches phones", () => {
    const onChange = renderIt();
    fireEvent.change(screen.getByLabelText("Shortcut Label"), { target: { value: "A very long shortcut label" } });
    expect(onChange.mock.calls[0][0].appShortName).toHaveLength(12);
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
    expect(screen.getByText(/iPhone keeps the old icon/)).toBeTruthy();

    cleanup();
    const onChange2 = renderIt(vi.fn(), { ...config, appIcon: "data:image/png;base64,AAAA" } as GeneralConfig);
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onChange2.mock.calls[0][0].appIcon).toBe("");
  });
});
