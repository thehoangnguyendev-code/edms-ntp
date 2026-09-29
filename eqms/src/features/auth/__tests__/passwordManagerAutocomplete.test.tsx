import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginView } from "../LoginView";
import { ForcePasswordChangeView } from "../ForcePasswordChangeView";

vi.mock("../usePasswordPolicy", () => ({
  usePasswordPolicy: () => ({
    passwordMinLength: 8,
    requireUppercase: false,
    requireLowercase: false,
    requireNumbers: false,
    requireSpecialChars: false,
  }),
}));

describe("browser password-manager semantics", () => {
  it("identifies the login credentials as an existing username/password pair", () => {
    render(<LoginView />);

    expect(screen.getByLabelText("Email or Username")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByLabelText("Password")).toHaveAttribute("id", "current-password");
  });

  it("removes the login form after a completed password-only sign-in", async () => {
    const onLogin = vi.fn().mockResolvedValue({ success: true, passwordManagerEligible: true });
    render(<LoginView onLogin={onLogin} />);

    fireEvent.change(screen.getByLabelText("Email or Username"), { target: { value: "qa.user" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Password1" } });
    fireEvent.submit(screen.getByLabelText("Password").closest("form")!);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Sign-in successful"));
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("identifies a forced password change as an update to a saved password", () => {
    const { container } = render(<ForcePasswordChangeView loginIdentifier="qa.user" />);

    expect(screen.getByLabelText(/Current Password/)).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByLabelText(/Current Password/)).toHaveAttribute("id", "current-password");
    expect(screen.getByLabelText(/^New Password/)).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText(/^New Password/)).toHaveAttribute("id", "new-password");
    expect(screen.getByLabelText(/^Confirm New Password/)).toHaveAttribute("autocomplete", "new-password");
    expect(container.querySelector('input[name="username"]')).toHaveValue("qa.user");
  });

  it("removes the password-change form after the server confirms the update", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: true });
    render(<ForcePasswordChangeView loginIdentifier="qa.user" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Current Password/), { target: { value: "OldPassword1" } });
    fireEvent.change(screen.getByLabelText(/^New Password/), { target: { value: "NewPassword1" } });
    fireEvent.change(screen.getByLabelText(/^Confirm New Password/), { target: { value: "NewPassword1" } });
    fireEvent.submit(screen.getByLabelText(/^Confirm New Password/).closest("form")!);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Password updated successfully"));
    expect(screen.queryByLabelText(/Current Password/)).not.toBeInTheDocument();
  });
});
