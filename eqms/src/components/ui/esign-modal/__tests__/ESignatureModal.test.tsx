import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { username: "admin", fullName: "Admin User", employeeCode: "A1" } }) }));
vi.mock("@/services/api/auth", () => ({ authApi: { verifyESignature: mocks.verify } }));
import { ESignatureModal } from "../ESignatureModal";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockResolvedValue({ username: "admin", signatureToken: "signed", timestamp: "now" });
});
const fill = (username = "admin", password = "secret") => {
  fireEvent.change(screen.getByLabelText(/^Username/), { target: { value: username } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(/Reason for Electronic Signature/), { target: { value: "Reviewed" } });
};

describe("Electronic signature credentials", () => {
  it.each([["", "secret"], ["   ", "secret"], ["admin", ""]])("rejects missing credentials (%s)", async (username, password) => {
    const confirm = vi.fn();
    render(<ESignatureModal isOpen onClose={vi.fn()} onConfirm={confirm} />);
    fill(username, password);
    fireEvent.click(screen.getByRole("button", { name: "Sign & Confirm" }));
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByText(/is required to complete the electronic signature/)).toBeTruthy();
  });

  it("starts blank and sends both entered credentials before confirming", async () => {
    const confirm = vi.fn();
    render(<ESignatureModal isOpen onClose={vi.fn()} onConfirm={confirm} />);
    expect((screen.getByLabelText(/^Username/) as HTMLInputElement).value).toBe("");
    fill(" admin ", "secret");
    fireEvent.click(screen.getByRole("button", { name: "Sign & Confirm" }));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ username: "admin", signatureToken: "signed", reason: "Reviewed" })));
    expect(mocks.verify).toHaveBeenCalledWith({ username: "admin", password: "secret" });
    expect((screen.getByLabelText(/^Username/) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/^Password/) as HTMLInputElement).value).toBe("");
  });

  it("does not confirm when the server rejects another signing user", async () => {
    mocks.verify.mockRejectedValue(new Error("Electronic signature must belong to the current user"));
    const confirm = vi.fn();
    render(<ESignatureModal isOpen onClose={vi.fn()} onConfirm={confirm} />);
    fill("another-user");
    fireEvent.click(screen.getByRole("button", { name: "Sign & Confirm" }));
    await screen.findByText("Enter the username of the currently signed-in account.");
    expect(confirm).not.toHaveBeenCalled();
  });

  it("clears credentials when closed and reopened", async () => {
    const props = { onClose: vi.fn(), onConfirm: vi.fn() };
    const view = render(<ESignatureModal isOpen {...props} />);
    fill();
    view.rerender(<ESignatureModal isOpen={false} {...props} />);
    view.rerender(<ESignatureModal isOpen {...props} />);
    await waitFor(() => expect((screen.getByLabelText(/^Username/) as HTMLInputElement).value).toBe(""));
    expect((screen.getByLabelText(/^Password/) as HTMLInputElement).value).toBe("");
  });
});
