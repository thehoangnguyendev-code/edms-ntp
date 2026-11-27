import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/datetime-picker/DateTimePicker", () => ({ DateTimePicker: () => <div>until picker</div> }));
vi.mock("@/components/ui/esign-modal/ESignatureModal", () => ({
  ESignatureModal: ({ isOpen, onConfirm }: { isOpen: boolean; onConfirm: (d: { signatureToken: string }) => void }) =>
    isOpen ? <div role="dialog" aria-label="signature"><button onClick={() => onConfirm({ signatureToken: "tok" })}>Sign</button></div> : null,
}));

import { SuspendModal } from "../SuspendModal";

const onConfirm = vi.fn();
const open = () => render(<SuspendModal isOpen onClose={vi.fn()} onConfirm={onConfirm} userName="Nguyen Van A" />);
const submit = () => fireEvent.click(screen.getAllByRole("button", { name: "Suspend User" }).at(-1)!);

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => cleanup());

describe("SuspendModal (SOP.0003 5.1.1 kind of suspension)", () => {
  it("does not go to the signature until a reason and a kind are given", () => {
    open();
    submit();
    expect(screen.getByText("Suspension reason is required")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/reason for suspension/i), { target: { value: "Maternity leave" } });
    submit();
    expect(screen.getByRole("alert").textContent).toBe("Choose the kind of suspension");
    expect(screen.queryByRole("dialog", { name: "signature" })).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("sends the machine code of the chosen kind with the reason and the signature", async () => {
    open();
    fireEvent.change(screen.getByPlaceholderText(/reason for suspension/i), { target: { value: "  Maternity leave  " } });
    fireEvent.click(screen.getAllByRole("radio")[0]);
    submit();
    fireEvent.click(screen.getByRole("button", { name: "Sign" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("Maternity leave", "", "tok", "LONG_LEAVE"));
  });

  it("sends OTHER for the second choice", async () => {
    open();
    fireEvent.change(screen.getByPlaceholderText(/reason for suspension/i), { target: { value: "Security" } });
    fireEvent.click(screen.getAllByRole("radio")[1]);
    submit();
    fireEvent.click(screen.getByRole("button", { name: "Sign" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("Security", "", "tok", "OTHER"));
  });
});
