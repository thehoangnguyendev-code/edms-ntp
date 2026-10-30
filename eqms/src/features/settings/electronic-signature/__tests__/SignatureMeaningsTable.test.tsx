import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@/components/ui/toast/Toast";

const api = vi.hoisted(() => ({ meaningsPage: vi.fn() }));
vi.mock("@/services/api/electronicSignatureSettings", async (importOriginal) => ({ ...(await importOriginal<object>()), electronicSignatureSettingsApi: api }));

import { SignatureMeaningsTable } from "../SignatureMeaningsTable";

const page = () => ({
  data: [
    { id: "1", code: "APPROVED", displayName: "Approved", module: "APPROVED", updatedAt: "2026-10-13T03:28:52Z" },
    { id: "2", code: "BACKUP_DR_TARGET_CHANGE", displayName: "Disaster Recovery Target Change", module: "BACKUP", updatedAt: null },
  ],
  pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
  modules: ["APPROVED", "BACKUP"],
});

const renderTable = (props: Partial<React.ComponentProps<typeof SignatureMeaningsTable>> = {}) => {
  const onRename = vi.fn();
  render(<ToastProvider><MemoryRouter><SignatureMeaningsTable meanings={[{ code: "APPROVED", displayName: "Approved" }, { code: "BACKUP_DR_TARGET_CHANGE", displayName: "Disaster Recovery Target Change" }]} canEdit onRename={onRename} savedVersion="v1" {...props} /></MemoryRouter></ToastProvider>);
  return onRename;
};

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
  api.meaningsPage.mockReset();
  api.meaningsPage.mockResolvedValue(page());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("SignatureMeaningsTable", () => {
  it("asks the server for a page, sorted by code, and shows code, module and display name", async () => {
    renderTable();

    expect(await screen.findByText("BACKUP_DR_TARGET_CHANGE")).toBeTruthy();
    expect(api.meaningsPage).toHaveBeenCalledWith(expect.objectContaining({ sortBy: "code", sortDirection: "asc", page: 1 }));
    expect((screen.getByLabelText("Display name of APPROVED") as HTMLInputElement).value).toBe("Approved");
  });

  it("reports a renamed display name without changing the server's rows, and shows what is typed over them", async () => {
    const onRename = renderTable({ meanings: [{ code: "APPROVED", displayName: "Signed Off" }, { code: "BACKUP_DR_TARGET_CHANGE", displayName: "Disaster Recovery Target Change" }] });

    await screen.findByText("BACKUP_DR_TARGET_CHANGE");
    expect((screen.getByLabelText("Display name of APPROVED") as HTMLInputElement).value).toBe("Signed Off");
    fireEvent.change(screen.getByLabelText("Display name of BACKUP_DR_TARGET_CHANGE"), { target: { value: "DR Target" } });
    expect(onRename).toHaveBeenCalledWith("BACKUP_DR_TARGET_CHANGE", "DR Target");
  });

  it("cannot be edited by a person who may not change the configuration", async () => {
    renderTable({ canEdit: false });

    await screen.findByText("BACKUP_DR_TARGET_CHANGE");
    expect((screen.getByLabelText("Display name of APPROVED") as HTMLInputElement).disabled).toBe(true);
  });

  it("asks the server again when the settings were saved", async () => {
    const view = render(<ToastProvider><MemoryRouter><SignatureMeaningsTable meanings={[]} canEdit onRename={vi.fn()} savedVersion="v1" /></MemoryRouter></ToastProvider>);
    await screen.findByText("BACKUP_DR_TARGET_CHANGE");
    const calls = api.meaningsPage.mock.calls.length;

    view.rerender(<ToastProvider><MemoryRouter><SignatureMeaningsTable meanings={[]} canEdit onRename={vi.fn()} savedVersion="v2" /></MemoryRouter></ToastProvider>);

    await waitFor(() => expect(api.meaningsPage.mock.calls.length).toBeGreaterThan(calls));
  });
});
