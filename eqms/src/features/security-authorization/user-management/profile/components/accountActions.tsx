import React from "react";
import { KeyRound, LockOpen, PauseCircle, RotateCcw, SmartphoneNfc } from "lucide-react";
import { IconUserX } from "@tabler/icons-react";
import type { User } from "../../types";

export type AccountActionKey = "unlock" | "resetPassword" | "resetMfa" | "suspend" | "reinstate" | "terminate";

export interface AccountAction {
  key: AccountActionKey;
  label: string;
  /** One sentence on what the action does, shown under the label in the Account Status tab. */
  description: string;
  icon: React.ReactNode;
  destructive?: boolean;
  onClick: () => void;
}

export interface AccountActionInput {
  user: Pick<User, "status" | "accountLocked">;
  /** What the current admin may do -- see UserManagementService.getUserCapabilities. */
  canResetPassword?: boolean;
  canResetMfa?: boolean;
  canSuspend?: boolean;
  canTerminate?: boolean;
  canReinstate?: boolean;
  canUnlock?: boolean;
  onResetPassword?: () => void;
  onResetMfa?: () => void;
  onSuspend?: () => void;
  onTerminate?: () => void;
  onReinstate?: () => void;
  onUnlock?: () => void;
}

/**
 * The account actions an admin can take on this user right now. The header menu and the Account
 * Status tab both read this list, so the rules (a lock can only be cleared when locked, only an
 * Active account is suspended, only a Suspended one is reinstated) live in one place.
 */
export function buildAccountActions(input: AccountActionInput): AccountAction[] {
  const { user } = input;
  const actions: AccountAction[] = [];
  if (input.canUnlock && user.accountLocked) {
    actions.push({
      key: "unlock",
      label: "Unlock Account",
      description: "The account was locked after too many failed sign-ins. Unlock it now instead of waiting.",
      icon: <LockOpen className="h-4 w-4" />,
      onClick: () => input.onUnlock?.(),
    });
  }
  if (input.canResetPassword) {
    actions.push({
      key: "resetPassword",
      label: "Reset Password",
      description: "Issue a new temporary password. The user must change it at the next sign-in.",
      icon: <KeyRound className="h-4 w-4" />,
      onClick: () => input.onResetPassword?.(),
    });
  }
  if (input.canResetMfa) {
    actions.push({
      key: "resetMfa",
      label: "Reset MFA",
      description: "The user lost the device of their authenticator. They are signed out and set up multi-factor authentication again at the next sign-in. Needs your electronic signature and a reason.",
      icon: <SmartphoneNfc className="h-4 w-4" />,
      onClick: () => input.onResetMfa?.(),
    });
  }
  if (input.canSuspend && user.status === "Active") {
    actions.push({
      key: "suspend",
      label: "Suspend",
      description: "Block sign-in until a date you choose. Needs your electronic signature and a reason.",
      icon: <PauseCircle className="h-4 w-4" />,
      onClick: () => input.onSuspend?.(),
    });
  }
  if (input.canReinstate && user.status === "Suspended") {
    actions.push({
      key: "reinstate",
      label: "Reinstate",
      description: "Set the account back to Active so the user regains full access.",
      icon: <RotateCcw className="h-4 w-4" />,
      onClick: () => input.onReinstate?.(),
    });
  }
  if (input.canTerminate) {
    actions.push({
      key: "terminate",
      label: "Terminate",
      description: "Ends employment and closes the account. This cannot be undone. Needs your electronic signature.",
      icon: <IconUserX className="h-4 w-4" />,
      destructive: true,
      onClick: () => input.onTerminate?.(),
    });
  }
  return actions;
}
