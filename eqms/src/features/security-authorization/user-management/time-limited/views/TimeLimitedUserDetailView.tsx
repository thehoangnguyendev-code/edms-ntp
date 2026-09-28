import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarClock, ShieldCheck, UserRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormSection } from "@/components/ui/form/FormSection";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { usePermissions } from "@/hooks/usePermissions";
import { settingsApi } from "@/services/api/settings";
import { ROUTES } from "@/app/routes.constants";
import { timeLimitedUserDetail } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { formatDateTime } from "@/utils/format";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import { USER_MANAGEMENT_ROUTES } from "../../constants";
import type { TimeLimitedUserGrant } from "../../types";

const WINDOW_STATE: Record<
  string,
  { label: string; color: "emerald" | "amber" | "slate" | "rose" }
> = {
  PENDING: { label: "Pending", color: "amber" },
  IN_WINDOW: { label: "Active", color: "emerald" },
  EXPIRED: { label: "Expired", color: "slate" },
  CANCELLED: { label: "Cancelled", color: "rose" },
};

const DetailField = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div>
    <p className="mb-1.5 text-xs font-medium text-slate-700 sm:text-sm">{label}</p>
    <div className="text-xs text-slate-700 sm:text-sm">{children}</div>
  </div>
);

/** Authoritative, full-page view of one time-limited grant. */
export const TimeLimitedUserDetailView: React.FC = () => {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermissionAlias } = usePermissions();
  const [grant, setGrant] = useState<TimeLimitedUserGrant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGrant = useCallback(async () => {
    if (!id) {
      setError("The time-limited grant identifier is missing.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setGrant(await settingsApi.getTimeLimitedUserGrant(id));
    } catch (err) {
      setError(
        extractApiMessage(
          err,
          "Unable to load this time-limited access grant.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadGrant();
  }, [loadGrant]);

  if (loading) return <FullPageLoading text="Loading time-limited user..." />;

  if (!grant) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 text-center">
        <p className="text-sm font-medium text-amber-800">
          {error ?? "Time-limited access grant not found."}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(ROUTES.SECURITY.TIME_LIMITED_USERS)}
        >
          Back to Time-Limited Users
        </Button>
      </div>
    );
  }

  const state = WINDOW_STATE[grant.windowState] ?? {
    label: grant.windowState,
    color: "slate" as const,
  };
  const canEdit =
    hasPermissionAlias("settings.user.edit") && grant.status === "ACTIVE";

  return (
    <div className="flex h-full flex-col gap-6">
      <PageHeader
        title="Time-Limited User Details"
        breadcrumbItems={timeLimitedUserDetail(navigate)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline-emerald"
              className="whitespace-nowrap"
              onClick={() => navigate(ROUTES.SECURITY.TIME_LIMITED_USERS)}
            >
              Back
            </Button>
            {canEdit && (
              <Button
                size="sm"
                variant="outline-emerald"
                className="whitespace-nowrap"
                onClick={() =>
                  navigate(ROUTES.SECURITY.TIME_LIMITED_USERS_EDIT(grant.id))
                }
              >
                Edit
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <FormSection
          title="User Information"
          description="Identity information for the account receiving time-limited access."
          icon={<UserRound className="h-4 w-4" />}
          className="h-full"
          contentClassName="p-4 md:p-5"
        >
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <DetailField label="Full Name">
              <span className="font-medium text-slate-900">{grant.fullName}</span>
            </DetailField>
            <DetailField label="Username">{grant.username}</DetailField>
            <DetailField label="Email">{grant.email}</DetailField>
            <DetailField label="Employee ID">
              {grant.employeeCode || "—"}
            </DetailField>
          </div>
          <Button
            className="mt-5 whitespace-nowrap"
            size="sm"
            variant="outline-emerald"
            onClick={() => navigate(USER_MANAGEMENT_ROUTES.PROFILE(grant.userId))}
          >
            View User Profile
          </Button>
        </FormSection>

        <FormSection
          title="Access Window"
          description="The current period in which this user can sign in."
          icon={<CalendarClock className="h-4 w-4" />}
          className="h-full"
          contentClassName="p-4 md:p-5"
        >
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <DetailField label="Start Date & Time">
              {formatDateTime(grant.startAt)}
            </DetailField>
            <DetailField label="End Date & Time">
              {formatDateTime(grant.endAt)}
            </DetailField>
            <DetailField label="Grant Status">
              <Badge
                size="sm"
                color={
                  grant.status === "ACTIVE"
                    ? "emerald"
                    : grant.status === "CANCELLED"
                      ? "rose"
                      : "slate"
                }
              >
                {grant.status}
              </Badge>
            </DetailField>
            <DetailField label="Access State">
              <Badge size="sm" color={state.color}>
                {state.label}
              </Badge>
            </DetailField>
            <DetailField label="Notify on Expiry">
              <Badge
                size="sm"
                color={grant.notifyEmailOnExpiry ? "emerald" : "slate"}
              >
                {grant.notifyEmailOnExpiry ? "Yes" : "No"}
              </Badge>
            </DetailField>
          </div>
          {grant.reason && (
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-700 sm:text-sm">
                Reason / Comment
              </p>
              <p className="mt-1 text-xs text-slate-700 sm:text-sm">{grant.reason}</p>
            </div>
          )}
        </FormSection>
      </div>

      <FormSection
        title="Record History"
        description="Creation, notification and cancellation history for this grant."
        icon={<ShieldCheck className="h-4 w-4" />}
        contentClassName="p-4 md:p-5"
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <DetailField label="Created">
            {formatDateTime(grant.createdAt)}
            {grant.createdByName ? ` by ${grant.createdByName}` : ""}
          </DetailField>
          <DetailField label="Expiry Notification">
            {grant.notifiedAt ? formatDateTime(grant.notifiedAt) : "Not sent"}
          </DetailField>
          {grant.cancelledAt && (
            <DetailField label="Cancelled">
              {formatDateTime(grant.cancelledAt)}
              {grant.cancelledByName ? ` by ${grant.cancelledByName}` : ""}
              {grant.cancelReason ? ` — ${grant.cancelReason}` : ""}
            </DetailField>
          )}
        </div>
      </FormSection>
    </div>
  );
};
