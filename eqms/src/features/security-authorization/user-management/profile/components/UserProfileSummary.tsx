import React from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { USER_STATUS_DESCRIPTIONS } from "../../constants";
import type { User } from "../../types";
import { useLanguage } from "@/i18n";

const statusColor = (status: User["status"]) =>
  status === "Active" ? "emerald" :
    status === "Inactive" ? "slate" :
      status === "Pending" ? "amber" :
        status === "Suspended" ? "orange" : "red";

const Fact: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => {
  const { tLabel } = useLanguage();
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{tLabel(label)}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-slate-900">{value || "—"}</dd>
    </div>
  );
};

/**
 * Who this person is and whether the account can be used, kept beside the tabs of the profile.
 * `avatar` is passed in because changing the picture (file picker, crop, save) belongs to the page.
 */
export const UserProfileSummary: React.FC<{ user: User; avatar: React.ReactNode }> = ({ user, avatar }) => {
  const { tLabel } = useLanguage();
  const profileCount = user.accessProfileNames?.length ?? 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="flex items-center gap-4 lg:flex-col lg:text-center">
        {avatar}
        <div className="min-w-0">
          <h2 className="break-words text-base font-semibold leading-tight text-slate-900">{user.fullName}</h2>
          <p className="mt-0.5 text-sm">
            <span className="font-medium text-emerald-600">{user.position || user.accessProfileNames?.[0] || "—"}</span>
            <span className="text-slate-400"> &middot; </span>
            <span className="text-slate-500">{user.department}</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 lg:justify-center">
            <Badge color={statusColor(user.status)} size="sm" pill title={USER_STATUS_DESCRIPTIONS[user.status]}>
              {user.status}
            </Badge>
            {user.employmentType && <Badge color="slate" size="sm">{user.employmentType}</Badge>}
            {user.accountLocked && <Badge color="red" size="sm">Locked</Badge>}
            {user.inactive && <Badge color="amber" size="sm" title={`No sign-in for ${user.inactiveDays} days`}>Inactive</Badge>}
          </div>
        </div>
      </div>
      <dl className="mt-4 hidden space-y-3 border-t border-slate-100 pt-4 lg:block">
        <Fact label="Employee ID" value={user.employeeCode} />
        <Fact label="Email" value={user.email} />
        <Fact label="Direct Manager" value={user.managerName} />
        <Fact label="Last Login" value={user.lastLogin && user.lastLogin !== "Never" ? user.lastLogin : tLabel("Never logged in")} />
        <Fact label="Access Profiles" value={profileCount > 0 ? `${profileCount} ${tLabel("assigned")}` : tLabel("None assigned")} />
      </dl>
    </div>
  );
};
