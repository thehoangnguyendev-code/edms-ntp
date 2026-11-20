import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PasswordPolicy } from "@/services/api/auth";
import { passwordReuseNote } from "../passwordPolicyRules";

const base: PasswordPolicy = { passwordMinLength: 8, requireUppercase: false, requireLowercase: false, requireNumbers: false, requireSpecialChars: false };
const state = vi.hoisted(() => ({ policy: null as unknown as PasswordPolicy }));
vi.mock("../usePasswordPolicy", () => ({ usePasswordPolicy: () => state.policy }));
vi.mock("@/services/api/auth", () => ({ authApi: { validateResetToken: vi.fn().mockResolvedValue({ valid: true }), resetPassword: vi.fn() } }));

import { ForcePasswordChangeView } from "../ForcePasswordChangeView";
import { ResetPasswordView } from "../ResetPasswordView";

describe("passwordReuseNote", () => {
  it("names the number of passwords, in the singular for one", () => {
    expect(passwordReuseNote({ ...base, preventPasswordReuse: true, passwordHistoryCount: 5 })).toMatch(/last 5 passwords\./);
    expect(passwordReuseNote({ ...base, preventPasswordReuse: true, passwordHistoryCount: 1 })).toMatch(/last 1 password\./);
  });

  it("is null when reuse is not prevented, the count is zero, or the server did not say", () => {
    expect(passwordReuseNote({ ...base, preventPasswordReuse: false, passwordHistoryCount: 5 })).toBeNull();
    expect(passwordReuseNote({ ...base, preventPasswordReuse: true, passwordHistoryCount: 0 })).toBeNull();
    expect(passwordReuseNote(base)).toBeNull();
  });
});

describe("the reuse rule on the sign-in password screens", () => {
  beforeEach(() => {
    state.policy = { ...base, preventPasswordReuse: true, passwordHistoryCount: 5 };
  });

  it("is shown on the forced password change", () => {
    render(<ForcePasswordChangeView loginIdentifier="qa.user" />);
    expect(screen.getByText(/Must be different from your last 5 passwords/)).toBeTruthy();
  });

  it("is left out of the forced password change when the policy does not prevent reuse", () => {
    state.policy = { ...base, preventPasswordReuse: false, passwordHistoryCount: 0 };
    render(<ForcePasswordChangeView loginIdentifier="qa.user" />);
    expect(screen.queryByText(/Must be different from your last/)).toBeNull();
  });

  it("is shown on the reset password screen", async () => {
    render(
      <MemoryRouter initialEntries={["/reset-password?token=abc"]}>
        <ResetPasswordView />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Must be different from your last 5 passwords/)).toBeTruthy();
  });
});
