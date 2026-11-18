import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  policy: vi.fn(),
  reset: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@/services/api/auth", () => ({ authApi: { getPasswordPolicy: mocks.policy } }));
vi.mock("@/services/api/settings", () => ({ settingsApi: { resetPassword: mocks.reset } }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: mocks.toast }) }));

import { ResetPasswordModal } from "../ResetPasswordModal";
import { generatePolicyPassword } from "../generatePolicyPassword";
import { evaluatePasswordPolicy } from "@/features/auth/passwordPolicyRules";

const strict = {
  passwordMinLength: 16, requireUppercase: true, requireLowercase: true, requireNumbers: true, requireSpecialChars: true,
  minUniqueChars: 10, maxRepeatedChars: 2, disallowSequentialChars: true, disallowCommonPasswords: true, disallowUserInfo: true, disallowWhitespace: true,
};

const open = (props: Record<string, unknown> = {}) => {
  const onClose = vi.fn();
  render(<ResetPasswordModal isOpen onClose={onClose} userId="u1" userName="Nguyen Van A" userTokens={["nguyenvana"]} {...props} />);
  return onClose;
};
const field = () => screen.findByLabelText("New Password") as Promise<HTMLInputElement>;
const confirm = () => screen.getByRole("button", { name: "Confirm" }) as HTMLButtonElement;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.policy.mockResolvedValue(strict);
  mocks.reset.mockResolvedValue({ password: "x" });
});
afterEach(() => cleanup());

describe("ResetPasswordModal", () => {
  it("opens straight on a suggested password that follows the rules in force, with no step before it and nothing sent yet", async () => {
    open();

    const input = await field();
    await waitFor(() => expect(input.value).not.toBe(""));
    expect(input.value.length).toBeGreaterThanOrEqual(16);
    expect(evaluatePasswordPolicy(input.value, strict as never, ["nguyenvana"]).isValid).toBe(true);
    expect(confirm().disabled).toBe(false);
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it("checks what is typed at once, warns, and keeps Confirm off until every rule is met", async () => {
    open();
    const input = await field();
    await waitFor(() => expect(input.value).not.toBe(""));

    fireEvent.change(input, { target: { value: "short1!" } });

    expect(confirm().disabled).toBe(true);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("At least 16 characters").closest("li")?.textContent).toContain("not met");

    fireEvent.change(input, { target: { value: "Nguyenvana-Zq7!Lm2#Xw" } });
    expect(screen.getByText("Does not contain your username, e-mail or name").closest("li")?.textContent).toContain("not met");
    expect(confirm().disabled).toBe(true);

    fireEvent.change(input, { target: { value: "Kd7#Qm2!Zx9&Tw4Rp" } });
    expect(confirm().disabled).toBe(false);
    expect(input.getAttribute("aria-invalid")).toBe("false");
  });

  it("suggests another password with the button on the left of Copy", async () => {
    open();
    const input = await field();
    await waitFor(() => expect(input.value).not.toBe(""));
    const first = input.value;

    const regenerate = screen.getByRole("button", { name: "Suggest another password" });
    const copy = screen.getByRole("button", { name: "Copy Password" });
    expect(regenerate.compareDocumentPosition(copy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(regenerate);

    expect(input.value).not.toBe(first);
    expect(evaluatePasswordPolicy(input.value, strict as never, ["nguyenvana"]).isValid).toBe(true);
  });

  it("sends the password, and tells the server to e-mail it, only when Confirm is pressed", async () => {
    const onClose = open();
    const input = await field();
    await waitFor(() => expect(input.value).not.toBe(""));
    fireEvent.change(input, { target: { value: "Kd7#Qm2!Zx9&Tw4Rp" } });

    fireEvent.click(confirm());

    await waitFor(() => expect(mocks.reset).toHaveBeenCalledWith("u1", { newPassword: "Kd7#Qm2!Zx9&Tw4Rp", sendEmail: true }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "success", title: "Password reset" }));
  });

  it("keeps the window open and shows the server's reason when it refuses the password, for example one used before", async () => {
    mocks.reset.mockRejectedValue({ response: { data: { message: "You cannot reuse one of your last 5 passwords." } } });
    const onClose = open();
    const input = await field();
    await waitFor(() => expect(input.value).not.toBe(""));

    fireEvent.click(confirm());

    expect((await screen.findByRole("alert")).textContent).toContain("cannot reuse");
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: input.value + "x" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("falls back to the basic rules and says so when the rules cannot be read", async () => {
    mocks.policy.mockRejectedValue(new Error("offline"));
    open();

    expect((await screen.findAllByText(/could not be loaded/))[0]).toBeTruthy();
    const input = await field();
    await waitFor(() => expect(input.value.length).toBeGreaterThanOrEqual(8));
  });
});

describe("generatePolicyPassword", () => {
  it("meets every rule for many draws, including the person's own name and a long minimum", () => {
    for (let i = 0; i < 100; i += 1) {
      const policy = { ...strict, passwordMinLength: 20 + (i % 10) };
      const password = generatePolicyPassword(policy as never, ["nguyenvana"]);
      expect(password.length).toBeGreaterThanOrEqual(policy.passwordMinLength);
      expect(evaluatePasswordPolicy(password, policy as never, ["nguyenvana"]).isValid).toBe(true);
    }
  });

  it("does not draw the same password twice", () => {
    const seen = new Set(Array.from({ length: 50 }, () => generatePolicyPassword(strict as never)));
    expect(seen.size).toBe(50);
  });
});
