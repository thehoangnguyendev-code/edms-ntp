import React from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { Select } from "@/components/ui/select/Select";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { formatDate } from "@/utils/format";
import { InfoField, FieldGroup } from "../components/ProfileSectionCard";
import { AccountActionList } from "../components/AccountActionList";
import { buildAccountActions } from "../components/accountActions";
import type { User } from "../../types";

const HOME_PAGE_OPTIONS: { label: string; value: string }[] = [
  { label: "Dashboard", value: "DASHBOARD" },
  { label: "Notifications", value: "NOTIFICATIONS" },
  { label: "Knowledge Base", value: "KNOWLEDGE" },
];
const HOME_PAGE_LABELS: Record<string, string> = {
  DASHBOARD: "Dashboard",
  NOTIFICATIONS: "Notifications",
  KNOWLEDGE: "Knowledge Base",
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
  canResetMfa?: boolean;
  onResetPassword?: () => void;
  onSuspend?: () => void;
  onTerminate?: () => void;
  onReinstate?: () => void;
  onUnlock?: () => void;
  onResetMfa?: () => void;
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
}

type Props = ExistingModeProps | CreateModeProps;

export const AccountStatusTab: React.FC<Props> = (props) => {
  if (props.mode === "create") {
    const { status, statusOptions, onStatusChange, statusError, homePage, onHomePageChange } = props;
    return (
      <div>
        <FieldGroup title="Account">
          <div>
            <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block capitalize">
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
            <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block capitalize">Home Page</label>
            <p className="text-xs text-slate-500 mb-2">Where this user lands immediately after logging in.</p>
            <Select
              label=""
              value={homePage || "DASHBOARD"}
              onChange={(value) => onHomePageChange(value as string)}
              options={HOME_PAGE_OPTIONS}
              className="w-full sm:max-w-xs"
            />
          </div>
        </FieldGroup>
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
    canResetMfa = false,
    onResetPassword,
    onSuspend,
    onTerminate,
    onReinstate,
    onUnlock,
    onResetMfa,
  } = props;
  const actions = buildAccountActions({
    user,
    canResetPassword,
    canSuspend,
    canTerminate,
    canReinstate,
    canUnlock,
    canResetMfa,
    onResetPassword,
    onResetMfa,
    onSuspend,
    onTerminate,
    onReinstate,
    onUnlock,
  });

  return (
    <div>
      <FieldGroup title="Account">
        <InfoField label="Account Created" value={formatDate(user.createdDate)} />
        <InfoField
          label="Last Login"
          value={`${user.lastLogin !== "Never" ? user.lastLogin : "Never logged in"}${user.inactive ? ` — Inactive: ${user.inactiveDays} days without a sign-in` : ""}`}
        />
        {isEditingProfile && canEdit ? (
          <div className="md:col-span-2">
            <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block capitalize">Home Page</label>
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
      </FieldGroup>

      {actions.length > 0 && (
        <div className="mt-5 pt-5 border-t border-slate-100">
          <h3 className="text-2xs sm:text-xs font-bold uppercase tracking-wider text-slate-500">Account Actions</h3>
          <div className="mt-3">
            <AccountActionList actions={actions} />
          </div>
        </div>
      )}
    </div>
  );
};
