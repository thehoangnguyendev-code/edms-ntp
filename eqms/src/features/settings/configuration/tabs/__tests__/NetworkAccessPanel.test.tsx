import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNetworkAccessDraft } from "../../useNetworkAccessDraft";
import { ToastProvider } from "@/components/ui/toast/Toast";

const http = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }));
vi.mock("@/services/api/client", () => ({ api: http }));

import { NetworkAccessPanel } from "../NetworkAccessPanel";

const settings = { enabled: false, allowedNetworks: ["10.0.0.0/8"], trustedProxies: [], emergencyUserId: null };

beforeEach(() => {
  http.get.mockReset(); http.put.mockReset(); http.post.mockReset();
  http.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith("/emergency-users") ? [] : settings }));
});
afterEach(cleanup);

function PanelHarness() {
  const network = useNetworkAccessDraft(true);
  return <NetworkAccessPanel value={network.draft} onChange={network.setDraft} failed={network.failed} />;
}
const renderPanel = () => render(<ToastProvider><PanelHarness /></ToastProvider>);

describe("NetworkAccessPanel", () => {
  it("checks the address of this computer against the networks typed, without saving", async () => {
    http.post.mockResolvedValue({ data: { address: "203.0.113.9", allowed: false, recoveryDisabled: false } });
    renderPanel();

    fireEvent.change(await screen.findByLabelText(/Allowed networks/), { target: { value: "192.168.1.0/24\n\n10.0.0.0/8 " } });
    fireEvent.click(screen.getByRole("button", { name: "Check My Address" }));

    await waitFor(() => expect(http.post).toHaveBeenCalledWith("/settings/network-access/check-address", expect.objectContaining({ allowedNetworks: ["192.168.1.0/24", "10.0.0.0/8"] })));
    expect((await screen.findByRole("status")).textContent).toMatch(/203\.0\.113\.9.*outside the allowed networks/);
    expect(http.put).not.toHaveBeenCalled();
  });

  it("says when the restriction is switched off on the server", async () => {
    http.post.mockResolvedValue({ data: { address: "10.1.1.1", allowed: true, recoveryDisabled: true } });
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Check My Address" }));

    expect((await screen.findByRole("status")).textContent).toMatch(/inside the allowed networks.*switched off on the server/);
  });

  it("explains how to get back in when everyone is locked out", async () => {
    renderPanel();

    expect(await screen.findByText(/APP_ADMIN_NETWORK_RECOVERY_DISABLE=true/)).toBeTruthy();
  });

  it("uses tall fixed-size scrollable lists and leaves saving to the page header", async () => {
    renderPanel();
    const allowed = await screen.findByLabelText(/Allowed networks/);
    const proxies = screen.getByLabelText(/Trusted proxies/);
    for (const field of [allowed, proxies]) {
      expect(field).toHaveClass("h-48", "resize-none", "overflow-y-auto");
    }
    fireEvent.change(proxies, { target: { value: "172.18.0.0/16" } });
    expect(proxies).toHaveValue("172.18.0.0/16");
    expect(screen.queryByRole("button", { name: "Save Network Policy" })).not.toBeInTheDocument();
    expect(http.put).not.toHaveBeenCalled();
    const description = screen.getByText(/The emergency account bypasses/);
    expect(description).toHaveClass("mt-1");
    expect(description.parentElement).toContainElement(screen.getByText("Emergency Account"));
  });
});
