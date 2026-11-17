import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAccountActions } from "../accountActions";
import { AccountActionList } from "../AccountActionList";

afterEach(cleanup);

const all = { canResetPassword: true, canSuspend: true, canTerminate: true, canReinstate: true, canUnlock: true };
const keys = (input: Parameters<typeof buildAccountActions>[0]) => buildAccountActions(input).map((a) => a.key);

describe("buildAccountActions", () => {
  it("offers suspend but not reinstate on an Active account, and unlock only while it is locked", () => {
    expect(keys({ user: { status: "Active", accountLocked: false }, ...all })).toEqual(["resetPassword", "suspend", "terminate"]);
    expect(keys({ user: { status: "Active", accountLocked: true }, ...all })).toEqual(["unlock", "resetPassword", "suspend", "terminate"]);
  });

  it("offers reinstate but not suspend on a Suspended account", () => {
    expect(keys({ user: { status: "Suspended", accountLocked: false }, ...all })).toEqual(["resetPassword", "reinstate", "terminate"]);
  });

  it("offers nothing the admin is not allowed to do", () => {
    expect(keys({ user: { status: "Active", accountLocked: true }, canResetPassword: false, canSuspend: false, canTerminate: false, canUnlock: false })).toEqual([]);
    expect(keys({ user: { status: "Active", accountLocked: false }, canTerminate: true })).toEqual(["terminate"]);
  });

  it("marks only Terminate as destructive", () => {
    const actions = buildAccountActions({ user: { status: "Active", accountLocked: true }, ...all });
    expect(actions.filter((a) => a.destructive).map((a) => a.key)).toEqual(["terminate"]);
  });
});

describe("AccountActionList", () => {
  it("shows what each action does and runs the one that is pressed", () => {
    const onSuspend = vi.fn();
    const onTerminate = vi.fn();
    const actions = buildAccountActions({ user: { status: "Active", accountLocked: false }, ...all, onSuspend, onTerminate });
    render(<AccountActionList actions={actions} />);

    expect(screen.getByText(/Block sign-in until a date you choose/)).toBeTruthy();
    expect(screen.getByText(/This cannot be undone/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Suspend" }));
    expect(onSuspend).toHaveBeenCalledTimes(1);
    expect(onTerminate).not.toHaveBeenCalled();
  });
});
