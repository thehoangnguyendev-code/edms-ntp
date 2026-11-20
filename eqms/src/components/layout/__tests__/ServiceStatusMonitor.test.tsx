import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/services/api/systemHealth", () => ({ systemHealthApi: { getDependencies: mocks.get } }));

import { ServiceStatusMonitor } from "../ServiceStatusMonitor";

const dep = (code: string, name: string, status: "UP" | "DOWN", impact = `${name} impact`) => ({ code, name, status, impact, checkedAt: "2026-11-18T08:00:00Z" });
const allUp = [dep("CLAMAV", "Virus scanner (ClamAV)", "UP"), dep("MINIO", "Document storage (MinIO)", "UP")];
const clamDown = [dep("CLAMAV", "Virus scanner (ClamAV)", "DOWN", "Files cannot be uploaded until it is back."), dep("MINIO", "Document storage (MinIO)", "UP")];

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  mocks.get.mockResolvedValue(allUp);
});
afterEach(() => cleanup());

describe("Service status monitor", () => {
  it("says nothing while every service answers", async () => {
    render(<ServiceStatusMonitor />);

    await waitFor(() => expect(mocks.get).toHaveBeenCalled());
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("warns, naming the service that is down and what stops working, but not the ones that answer", async () => {
    mocks.get.mockResolvedValue(clamDown);
    render(<ServiceStatusMonitor />);

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Virus scanner (ClamAV)");
    expect(dialog.textContent).toContain("Files cannot be uploaded until it is back.");
    expect(dialog.textContent).not.toContain("Document storage");
    expect(screen.getByText("A service is not available")).toBeTruthy();
  });

  it("lets the person carry on, and asks again only when a different set of services is down", async () => {
    mocks.get.mockResolvedValue(clamDown);
    render(<ServiceStatusMonitor />);
    await screen.findByRole("alertdialog");

    fireEvent.click(screen.getByRole("button", { name: "Continue Working" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();

    // the same service still down at the next check: not asked again
    await act(async () => { fireEvent(document, new Event("visibilitychange")); });
    await waitFor(() => expect(mocks.get.mock.calls.length).toBeGreaterThan(1));
    expect(screen.queryByRole("alertdialog")).toBeNull();

    // another service goes down: warned again, with both
    mocks.get.mockResolvedValue([clamDown[0], dep("MINIO", "Document storage (MinIO)", "DOWN")]);
    await act(async () => { fireEvent(document, new Event("visibilitychange")); });

    const again = await screen.findByRole("alertdialog");
    expect(again.textContent).toContain("Virus scanner (ClamAV)");
    expect(again.textContent).toContain("Document storage (MinIO)");
    expect(screen.getByText("Some services are not available")).toBeTruthy();
  });

  it("checks again on request and closes by itself, with a note, when everything answers", async () => {
    mocks.get.mockResolvedValue(clamDown);
    render(<ServiceStatusMonitor />);
    await screen.findByRole("alertdialog");

    mocks.get.mockResolvedValue(allUp);
    fireEvent.click(screen.getByRole("button", { name: /Check Again/ }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(await screen.findByText("Services Restored")).toBeTruthy();
  });

  it("keeps what it showed when the question itself fails (the network, maintenance), instead of calling that a service down", async () => {
    mocks.get.mockRejectedValue(new Error("Network Error"));
    render(<ServiceStatusMonitor />);

    await waitFor(() => expect(mocks.get).toHaveBeenCalled());
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("warns when a part of the application cannot be loaded, and offers to reload the page", async () => {
    render(<ServiceStatusMonitor />);
    await waitFor(() => expect(mocks.get).toHaveBeenCalled());

    act(() => {
      window.dispatchEvent(new Event("vite:preloadError"));
    });

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Application files");
    expect(screen.getByRole("button", { name: "Reload Page" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Continue Working" })).toBeNull();
  });
});
