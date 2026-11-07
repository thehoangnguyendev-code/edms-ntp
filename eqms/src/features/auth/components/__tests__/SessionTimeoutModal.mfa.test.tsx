import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ reauthenticate: vi.fn(), reauthenticateMfa: vi.fn(), sendEmailOtp: vi.fn() }));
vi.mock("@/services/api/auth", () => ({ authApi: api }));
vi.mock("@/services/api/settings", () => ({ settingsApi: { getSecurityConfiguration: vi.fn().mockResolvedValue({ sessionTimeoutMinutes: 15 }) } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { fullName: "An Nguyen", username: "an" }, updateUser: vi.fn() }) }));

import { SessionTimeoutModal } from "../SessionTimeoutModal";

const authenticated = { accessToken: "new-access", refreshToken: "new-refresh", expiresIn: 900, user: { id: "u1" } };
const challenge = (methods: Array<"email" | "app">) => ({ mfaRequired: true, mfaToken: "challenge", availableMethods: methods, maskedEmail: "a***n@eqms.com", expiresIn: 300 });

const locked = async () => {
  render(<MemoryRouter><SessionTimeoutModal isAuthenticated username="an" logout={vi.fn()} /></MemoryRouter>);
  await act(async () => { window.dispatchEvent(new Event("eqms:session-locked")); });
};
const typePassword = (value: string) => {
  fireEvent.change(screen.getByPlaceholderText("Enter your password"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.sendEmailOtp.mockResolvedValue({ expiresIn: 300, cooldownSeconds: 60 });
  localStorage.clear();
});
afterEach(cleanup);

describe("unlocking a locked session", () => {
  it("unlocks with the password alone when the account uses no second factor", async () => {
    const unlocked = vi.fn();
    window.addEventListener("eqms:session-unlocked", unlocked);
    api.reauthenticate.mockResolvedValue(authenticated);
    await locked();

    typePassword("right");

    await waitFor(() => expect(unlocked).toHaveBeenCalled());
    expect(screen.queryByTestId("reauth-code-step")).toBeNull();
    window.removeEventListener("eqms:session-unlocked", unlocked);
  });

  it("asks for the code after a right password, and does not unlock until the code is right", async () => {
    const unlocked = vi.fn();
    window.addEventListener("eqms:session-unlocked", unlocked);
    api.reauthenticate.mockResolvedValue(challenge(["app"]));
    api.reauthenticateMfa.mockResolvedValue(authenticated);
    await locked();

    typePassword("right");

    const input = await screen.findByLabelText("Verification code");
    expect(screen.getByTestId("reauth-code-step")).toBeTruthy();
    expect(unlocked).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText("Enter your password")).toBeNull(); // the password is not kept on screen

    expect((screen.getByRole("button", { name: "Unlock" }) as HTMLButtonElement).disabled).toBe(true); // needs all six digits
    fireEvent.change(input, { target: { value: "12a34b56" } });
    expect((input as HTMLInputElement).value).toBe("123456"); // digits only, six at most
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => expect(unlocked).toHaveBeenCalled());
    expect(api.reauthenticateMfa).toHaveBeenCalledWith({ mfaToken: "challenge", otp: "123456", method: "app" });
    window.removeEventListener("eqms:session-unlocked", unlocked);
  });

  it("shows the message of a wrong code, clears the box and stays locked", async () => {
    const unlocked = vi.fn();
    window.addEventListener("eqms:session-unlocked", unlocked);
    api.reauthenticate.mockResolvedValue(challenge(["app"]));
    api.reauthenticateMfa.mockRejectedValue({ response: { status: 401, data: { message: "Verification code is incorrect. You have 2 login attempts remaining before your account is locked." } } });
    await locked();
    typePassword("right");

    const input = await screen.findByLabelText("Verification code");
    fireEvent.change(input, { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByText(/Verification code is incorrect\. You have 2 login attempts remaining/)).toBeTruthy();
    expect((screen.getByLabelText("Verification code") as HTMLInputElement).value).toBe("");
    expect(unlocked).not.toHaveBeenCalled();
    window.removeEventListener("eqms:session-unlocked", unlocked);
  });

  it("sends the email code by itself when email is the only method, and lets the person send it again after the wait", async () => {
    api.reauthenticate.mockResolvedValue(challenge(["email"]));
    await locked();
    typePassword("right");

    await screen.findByLabelText("Verification code");
    await waitFor(() => expect(api.sendEmailOtp).toHaveBeenCalledWith({ mfaToken: "challenge" }));
    expect(await screen.findByText(/A code was sent to a\*\*\*n@eqms\.com/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Send again in/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("lets the person choose between the app and the email when the account has both", async () => {
    api.reauthenticate.mockResolvedValue(challenge(["app", "email"]));
    await locked();
    typePassword("right");

    fireEvent.click(await screen.findByRole("button", { name: "Authenticator app" }));
    expect(await screen.findByLabelText("Verification code")).toBeTruthy();
    expect(api.sendEmailOtp).not.toHaveBeenCalled(); // nothing is emailed unless the person chose email

    fireEvent.click(screen.getByRole("button", { name: "Use another method" }));
    fireEvent.click(await screen.findByRole("button", { name: /Email code/ }));
    await waitFor(() => expect(api.sendEmailOtp).toHaveBeenCalledTimes(1));
  });

  it("shows a wrong password and stays on the password step", async () => {
    api.reauthenticate.mockRejectedValue({ response: { status: 401, data: { message: "Password is incorrect. You have 2 login attempts remaining before your account is locked." } } });
    await locked();

    typePassword("wrong");

    expect(await screen.findByText(/Password is incorrect\. You have 2 login attempts remaining/)).toBeTruthy();
    expect(screen.queryByTestId("reauth-code-step")).toBeNull();
    expect(api.reauthenticateMfa).not.toHaveBeenCalled();
  });

  it("goes back to the password step from the code step", async () => {
    api.reauthenticate.mockResolvedValue(challenge(["app"]));
    await locked();
    typePassword("right");
    await screen.findByLabelText("Verification code");

    fireEvent.click(screen.getByRole("button", { name: "Back to password" }));

    expect(await screen.findByPlaceholderText("Enter your password")).toBeTruthy();
    expect(screen.queryByTestId("reauth-code-step")).toBeNull();
  });
});
