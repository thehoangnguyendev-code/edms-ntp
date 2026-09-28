import React from "react";
import { KeyRound, PauseCircle, RotateCcw, LockOpen } from "lucide-react";
import { IconUserX } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { formatDate } from "@/utils/format";
import { InfoField } from "../components/ProfileSectionCard";
import type { User } from "../../types";

const HOME_PAGE_OPTIONS: { label: string; value: string }[] = [
  { label: "Dashboard", value: "DASHBOARD" },
  { label: "Notifications", value: "NOTIFICATIONS" },
  { label: "Knowledge", value: "KNOWLEDGE" },
];
const HOME_PAGE_LABELS: Record<string, string> = {
  DASHBOARD: "Dashboard",
  NOTIFICATIONS: "Notifications",
  KNOWLEDGE: "Knowledge",
};

interface ExistingModeProps {
  mode?: "existing";
  user: User;
  draft: User;
  canEdit?: boolean;
  isEditingProfile: boolean;
  onDraftChange: (key: keyof User, value: string) => void;
  /** Which status-changing actions the current admin may perform on this user -- see
   *  UserManagementService.getUserCapabilities. Buttons only render when true. */
  canResetPassword?: boolean;
  canSuspend?: boolean;
  canTerminate?: boolean;
  canReinstate?: boolean;
  canUnlock?: boolean;
  onResetPassword?: () => void;
  onSuspend?: () => void;
  onTerminate?: () => void;
  onReinstate?: () => void;
  onUnlock?: () => void;
}

interface CreateModeProps {
  mode: "create";
  /** Initial account status being picked for the new user -- there is no persisted status yet
   *  to display, so this is a required selector instead of the "existing" mode's read-only
   *  badge + status-changing action buttons. */
  status: string;
  statusOptions: { label: string; value: string }[];
  onStatusChange: (value: string) => void;
  statusError?: string;
  homePage: string;
  onHomePageChange: (value: string) => void;
  canInviteExternal?: boolean;
  inviteExternal?: boolean;
  onInviteExternalChange?: (checked: boolean) => void;
}

type Props = ExistingModeProps | CreateModeProps;

export const AccountStatusTab: React.FC<Props> = (props) => {
  if (props.mode === "create") {
    const { status, statusOptions, onStatusChange, statusError, homePage, onHomePageChange, canInviteExternal, inviteExternal, onInviteExternalChange } = props;
    return (
      <div>
        <div className="grid grid-cols-1 gap-y-5">
          <div>
            <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
              Account Status <span className="text-red-500">*</span>
            </label>
            <Select
              label=""
              value={status}
              onChange={(value) => onStatusChange(value as string)}
              options={statusOptions}
              className="w-full sm:max-w-xs"
            />
            {statusError && <p className="text-xs text-red-600 mt-1.5">{statusError}</p>}
          </div>
          <div>
            <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Home Page</label>
            <p className="text-xs text-slate-500 mb-2">Where this user lands immediately after logging in.</p>
            <Select
              label=""
              value={homePage || "DASHBOARD"}
              onChange={(value) => onHomePageChange(value as string)}
              options={HOME_PAGE_OPTIONS}
              className="w-full sm:max-w-xs"
            />
          </div>
        </div>
        {canInviteExternal && (
          <div className="mt-4 flex items-start gap-3">
            <Checkbox
              checked={Boolean(inviteExternal)}
              onChange={(checked) => onInviteExternalChange?.(checked)}
              className="mt-0.5 shrink-0"
            />
            <span>
              <span className="block text-sm font-medium text-slate-700">Invite as Microsoft Entra guest</span>
              <span className="mt-1 block text-xs text-slate-500">Sends a guest invitation only; no Microsoft 365 license, group, or SharePoint site access is granted automatically.</span>
            </span>
          </div>
        )}
      </div>
    );
  }

  const {
    user,
    draft,
    canEdit = false,
    isEditingProfile,
    onDraftChange,
    canResetPassword = false,
    canSuspend = false,
    canTerminate = false,
    canReinstate = false,
    canUnlock = false,
    onResetPassword,
    onSuspend,
    onTerminate,
    onReinstate,
    onUnlock,
  } = props;
  const hasAnyStatusAction = canResetPassword || canSuspend || canTerminate || canReinstate || canUnlock;

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        <InfoField label="Account Created" value={formatDate(user.createdDate)} />
        <InfoField label="Last Login" value={user.lastLogin !== "Never" ? user.lastLogin : "Never logged in"} />
        {isEditingProfile && canEdit ? (
          <div className="md:col-span-2">
            <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Home Page</label>
            <p className="text-xs text-slate-500 mb-2">Where this user lands immediately after logging in.</p>
            <Select
              label=""
              value={draft.homePage || "DASHBOARD"}
              onChange={(value) => onDraftChange("homePage", value as string)}
              options={HOME_PAGE_OPTIONS}
              className="w-full sm:max-w-xs"
            />
          </div>
        ) : (
          <InfoField label="Home Page" value={HOME_PAGE_LABELS[user.homePage || "DASHBOARD"]} />
        )}
      </div>

      {hasAnyStatusAction && (
        <div className="flex flex-wrap items-center gap-2 pt-5 mt-5 border-t border-slate-100">
          {canResetPassword && (
            <Button variant="outline-emerald" size="sm" className="gap-1.5" onClick={onResetPassword}>
              <KeyRound className="h-3.5 w-3.5" />
              Reset Password
            </Button>
          )}
          {canUnlock && user.accountLocked && (
            <Button variant="outline-emerald" size="sm" className="gap-1.5" onClick={onUnlock}>
              <LockOpen className="h-3.5 w-3.5" />
              Unlock Account
            </Button>
          )}
          {canSuspend && user.status === "Active" && (
            <Button variant="outline-emerald" size="sm" className="gap-1.5" onClick={onSuspend}>
              <PauseCircle className="h-3.5 w-3.5" />
              Suspend
            </Button>
          )}
          {canReinstate && user.status === "Suspended" && (
            <Button variant="outline-emerald" size="sm" className="gap-1.5" onClick={onReinstate}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reinstate
            </Button>
          )}
          {canTerminate && (
            <Button variant="outline-emerald" size="sm" className="gap-1.5" onClick={onTerminate}>
              <IconUserX className="h-3.5 w-3.5" />
              Terminate
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
