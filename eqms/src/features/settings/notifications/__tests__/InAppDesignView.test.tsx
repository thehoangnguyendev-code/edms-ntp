import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { InAppDesignView } from "../InAppDesignView";

const api = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
const toast = vi.hoisted(() => ({ showToast: vi.fn() }));
const perms = vi.hoisted(() => ({ manage: true }));
const branding = vi.hoisted(() => ({ navigationLabelOverrides: {} }));

vi.mock("@/services/api/inAppDesign", () => ({ inAppDesignApi: api }));
vi.mock("@/components/ui/toast/Toast", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/toast/Toast")>("@/components/ui/toast/Toast");
  return { ...actual, useToast: () => toast };
});
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermissionAlias: () => perms.manage }) }));
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => branding }));
vi.mock("@/components/ui/color-picker/ColorPickerInput", () => ({
  ColorPickerInput: ({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) => (
    <label>
      {label}
      <input aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </label>
  ),
}));

beforeAll(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
});

const design = (over: Record<string, unknown> = {}) => ({
  toastPosition: "top-right", toastDurationSeconds: 5, toastColor: "#3B82F6", toastShadow: 40, version: 3, updatedBy: "admin", updatedAt: "2026-11-13T01:00:00Z", ...over,
});

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  toast.showToast.mockReset();
  perms.manage = true;
  api.get.mockResolvedValue(design());
  api.update.mockImplementation(async (input: Record<string, unknown>) => design({ ...input, version: 4 }));
});
afterEach(cleanup);

const open = async () => {
  render(
    <BreadcrumbProvider>
      <MemoryRouter initialEntries={["/settings/notifications/in-app-design"]}>
        <Routes>
          <Route path="/settings/notifications/in-app-design" element={<InAppDesignView />} />
          <Route path="/settings/notifications" element={<div>the list</div>} />
        </Routes>
      </MemoryRouter>
    </BreadcrumbProvider>,
  );
  await screen.findByRole("heading", { level: 1, name: "In-App Notification Design" });
};
const save = () => screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;

describe("In-App Notification Design: one look for every toast", () => {
  it("shows what is saved, with nothing to save until something is changed", async () => {
    await open();
    expect((screen.getByLabelText("Toast Colour") as HTMLInputElement).value).toBe("#3B82F6");
    expect((screen.getByLabelText("Toast display time in seconds") as HTMLInputElement).value).toBe("5");
    expect(screen.getByText("40%")).toBeTruthy();
    expect(screen.getByLabelText("Contrast of the toast colour").textContent).toMatch(/easy to see/);
    expect(save().disabled).toBe(true);
  });

  it("saves the four settings with the version it opened, and says the new version", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Toast Colour"), { target: { value: "#D946EF" } });
    fireEvent.change(screen.getByLabelText("Toast display time in seconds"), { target: { value: "9" } });
    fireEvent.keyDown(screen.getByRole("slider", { name: "Toast shadow" }), { key: "ArrowRight" });
    fireEvent.click(save());
    await waitFor(() => expect(api.update).toHaveBeenCalledWith({ toastPosition: "top-right", toastDurationSeconds: 9, toastColor: "#D946EF", toastShadow: 41 }, 3));
    await waitFor(() => expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ type: "success", message: expect.stringContaining("version 4") })));
    expect(save().disabled).toBe(true);
  });

  it("will not save a colour half typed or a display time outside 2 to 60", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Toast Colour"), { target: { value: "#D946" } });
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Toast Colour"), { target: { value: "#D946EF" } });
    expect(save().disabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Toast display time in seconds"), { target: { value: "1" } });
    expect(save().disabled).toBe(true);
    expect(screen.getByText(/whole number from 2 to 60/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Toast display time in seconds"), { target: { value: "61" } });
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Toast display time in seconds"), { target: { value: "60" } });
    expect(save().disabled).toBe(false);
  });

  it("says the contrast of the colour and moves it with the slider, keeping the preview in step", async () => {
    api.get.mockResolvedValue(design({ toastColor: "#FDE68A" }));
    await open();
    expect(screen.getByLabelText("Contrast of the toast colour").textContent).toMatch(/faint/);
    fireEvent.keyDown(screen.getByRole("slider", { name: "Toast colour contrast" }), { key: "ArrowRight" });
    const colour = (screen.getByLabelText("Toast Colour") as HTMLInputElement).value;
    expect(colour).toMatch(/^#[0-9A-F]{6}$/);
    expect(colour).not.toBe("#FDE68A");
    expect(save().disabled).toBe(false);
  });

  it("Test Toast shows the toast with the settings on the screen now, saved or not, and saves nothing", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Toast Colour"), { target: { value: "#D946EF" } });
    fireEvent.change(screen.getByLabelText("Toast display time in seconds"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Test Toast" }));
    expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ color: "#D946EF", shadow: 40, position: "top-right", duration: 7000 }));
    expect(api.update).not.toHaveBeenCalled();
  });

  it("says so and offers to reload when someone else saved first, and keeps what was typed until the person reloads", async () => {
    api.update.mockRejectedValue({ response: { status: 409, data: { error: { message: "This was changed by someone else after you opened it. Reload it to see their change, then make yours again." } } } });
    await open();
    fireEvent.change(screen.getByLabelText("Toast Colour"), { target: { value: "#D946EF" } });
    fireEvent.click(save());
    expect(await screen.findByText(/Someone else changed this after you opened it/)).toBeTruthy();
    expect((screen.getByLabelText("Toast Colour") as HTMLInputElement).value).toBe("#D946EF");
    api.get.mockResolvedValue(design({ toastColor: "#10B981", version: 4 }));
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect((screen.getByLabelText("Toast Colour") as HTMLInputElement).value).toBe("#10B981"));
  });

  it("is read only for a person who may not manage it", async () => {
    perms.manage = false;
    await open();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect((screen.getByLabelText("Toast Colour") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Toast display time in seconds") as HTMLInputElement).disabled).toBe(true);
  });

  it("says why it cannot open when the design cannot be loaded", async () => {
    api.get.mockRejectedValue(new Error("down"));
    render(
      <BreadcrumbProvider>
        <MemoryRouter>
          <InAppDesignView />
        </MemoryRouter>
      </BreadcrumbProvider>,
    );
    expect(await screen.findByText("Unable to open the in-app notification design.")).toBeTruthy();
  });
});
