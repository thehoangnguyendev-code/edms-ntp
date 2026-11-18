import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ reset: vi.fn(), toast: vi.fn() }));
vi.mock("@/services/api/settings", () => ({ settingsApi: { resetUserMfa: mocks.reset } }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: mocks.toast }) }));
vi.mock("@/components/ui/esign-modal/ESignatureModal", () => ({
  ESignatureModal: ({ isOpen, onConfirm, meaningCode, actionTitle }: { isOpen: boolean; onConfirm: (d: { signatureToken: string; reason: string }) => Promise<void>; meaningCode: string; actionTitle: string }) => {
    const [error, setError] = React.useState("");
    return isOpen ? (
      <div role="dialog" aria-label="signature">
        <p>{actionTitle}</p><p>{meaningCode}</p>
        <button onClick={() => onConfirm({ signatureToken: "tok", reason: "  Phone lost  " }).catch((e) => setError(e?.response?.data?.message ?? "failed"))}>Sign</button>
        {error && <p role="alert">{error}</p>}
      </div>
    ) : null;
  },
}));

import { ResetMfaModal } from "../ResetMfaModal";
import { buildAccountActions } from "../accountActions";

const open = () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  render(<ResetMfaModal isOpen onClose={onClose} userId="u1" userName="Nguyen Van A" onSuccess={onSuccess} />);
  return { onClose, onSuccess };
};

beforeEach(() => { vi.clearAllMocks(); mocks.reset.mockResolvedValue(undefined); });
afterEach(() => cleanup());

describe("ResetMfaModal", () => {
  it("explains what will happen, then asks for the signature, and sends nothing before it", () => {
    open();

    expect(screen.getByText(/signed out on every device/)).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "signature" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("dialog", { name: "signature" })).toBeTruthy();
    expect(screen.getByText("USER_MFA_RESET")).toBeTruthy();
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it("sends the reason typed in the signature window with the signature, then tells the administrator and closes", async () => {
    const { onClose, onSuccess } = open();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    fireEvent.click(screen.getByRole("button", { name: "Sign" }));

    await waitFor(() => expect(mocks.reset).toHaveBeenCalledWith("u1", { reason: "Phone lost", signatureToken: "tok" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSuccess).toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "success", title: "MFA reset" }));
  });

  it("lets the signature window show why the server refused, and keeps everything open", async () => {
    mocks.reset.mockRejectedValue({ response: { data: { message: "Nguyen Van A has no multi-factor authentication set up, so there is nothing to reset." } } });
    const { onClose, onSuccess } = open();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign" }));

    expect((await screen.findByRole("alert")).textContent).toContain("nothing to reset");
    expect(onClose).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "signature" })).toBeTruthy();
  });
});

describe("account actions", () => {
  it("offers Reset MFA only when the server says it may be done, in the same list as Reset Password", () => {
    const base = { user: { status: "Active", accountLocked: false } as never };
    expect(buildAccountActions({ ...base, canResetPassword: true }).map((a) => a.key)).toEqual(["resetPassword"]);
    const keys = buildAccountActions({ ...base, canResetPassword: true, canResetMfa: true }).map((a) => a.key);
    expect(keys).toEqual(["resetPassword", "resetMfa"]);
  });
});
