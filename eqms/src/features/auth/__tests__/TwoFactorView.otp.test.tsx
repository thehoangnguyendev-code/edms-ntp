import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/components/branding/BrandLogo", () => ({ BrandLogo: () => <span>logo</span>, useBranding: () => ({}) }));
vi.mock("@/components/branding/loginLogoTransition", () => ({ captureLoginLogo: () => null, startLoginLogoTransition: () => undefined }));
vi.mock("@/utils/viewport", () => ({ resetViewportZoom: () => undefined, blurActiveInput: () => undefined }));

import { TwoFactorView } from "../TwoFactorView";

const open = async (onVerify = vi.fn(async () => ({ success: true }))) => {
  render(
    <MemoryRouter>
      <TwoFactorView onVerify={onVerify} onResend={vi.fn(async () => ({ success: true }))} availableMethods={["app"]} />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole("button", { name: /Authenticator App/ }));
  await screen.findByText("Enter Verification Code");
  return onVerify;
};

const type = (digits: string) => {
  digits.split("").forEach((digit, i) => {
    fireEvent.change(screen.getByLabelText(`Digit ${i + 1} of 6`), { target: { value: digit } });
  });
};

describe("TwoFactorView > code input", () => {
  it("has a slot for each of the six digits", async () => {
    await open();
    expect(screen.getAllByLabelText(/^Digit \d of 6$/)).toHaveLength(6);
  });

  it("does not check the code when the last digit is typed: only the Verify button does", async () => {
    const onVerify = await open();
    const verify = screen.getByRole("button", { name: "Verify Account" });
    expect(verify.hasAttribute("disabled")).toBe(true);
    type("123456");
    // all six digits are in: nothing was sent
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(onVerify).not.toHaveBeenCalled();
    expect(verify.hasAttribute("disabled")).toBe(false);
    fireEvent.click(verify);
    await waitFor(() => expect(onVerify).toHaveBeenCalledWith({ code: "123456", method: "app", rememberDevice: false }));
    expect(onVerify).toHaveBeenCalledTimes(1);
  });

  it("keeps the button off until all six digits are in", async () => {
    await open();
    type("12345");
    expect(screen.getByRole("button", { name: "Verify Account" }).hasAttribute("disabled")).toBe(true);
  });

  it("takes a pasted code", async () => {
    const onVerify = await open();
    fireEvent.paste(screen.getByLabelText("Digit 1 of 6"), { clipboardData: { getData: () => "654 321" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Verify Account" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Verify Account" }));
    await waitFor(() => expect(onVerify).toHaveBeenCalledWith(expect.objectContaining({ code: "654321" })));
  });
});
