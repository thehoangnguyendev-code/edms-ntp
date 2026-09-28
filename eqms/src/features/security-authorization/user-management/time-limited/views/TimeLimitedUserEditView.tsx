import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarClock, UserRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormSection } from "@/components/ui/form/FormSection";
import { Button } from "@/components/ui/button/Button";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast";
import { settingsApi } from "@/services/api/settings";
import { authApi } from "@/services/api/auth";
import { ROUTES } from "@/app/routes.constants";
import { editTimeLimitedUser } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import type { TimeLimitedUserGrant } from "../../types";
import { TimeLimitedUserGrantFields } from "../components/TimeLimitedUserGrantFields";
import { toTimeLimitedUserIsoInstant, toTimeLimitedUserPickerDateTime } from "../utils/timeLimitedUserDate";

/** Full-page editor. The server re-evaluates the grant status/window after the signed update. */
export const TimeLimitedUserEditView: React.FC = () => {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [grant, setGrant] = useState<TimeLimitedUserGrant | null>(null);
  const [startDisplay, setStartDisplay] = useState("");
  const [endDisplay, setEndDisplay] = useState("");
  const [notifyEmailOnExpiry, setNotifyEmailOnExpiry] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [signOpen, setSignOpen] = useState(false);

  const loadGrant = useCallback(async () => {
    if (!id) { setLoadError("The time-limited grant identifier is missing."); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await settingsApi.getTimeLimitedUserGrant(id);
      setGrant(data);
      setStartDisplay(toTimeLimitedUserPickerDateTime(data.startAt));
      setEndDisplay(toTimeLimitedUserPickerDateTime(data.endAt));
      setNotifyEmailOnExpiry(data.notifyEmailOnExpiry);
      setReason(data.reason ?? "");
      setLoadError(null);
    } catch (err) {
      setLoadError(extractApiMessage(err, "Unable to load this time-limited access grant."));
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void loadGrant(); }, [loadGrant]);

  const startAt = toTimeLimitedUserIsoInstant(startDisplay);
  const endAt = toTimeLimitedUserIsoInstant(endDisplay);
  const isDirty = useMemo(() => Boolean(grant) && (startAt !== grant.startAt || endAt !== grant.endAt || notifyEmailOnExpiry !== grant.notifyEmailOnExpiry || reason.trim() !== (grant.reason ?? "")), [endAt, grant, notifyEmailOnExpiry, reason, startAt]);
  const canSave = Boolean(grant && grant.status === "ACTIVE" && startAt && endAt && startAt <= endAt && isDirty && !saving);

  const confirmUpdate = async (signature: { username: string; password: string; reason: string }) => {
    // Keep a stable non-null snapshot through awaits; React state may change while the signature
    // verification request is in flight.
    const grantToUpdate = grant;
    if (!grantToUpdate || !canSave) return;
    setSaving(true);
    try {
      const verified = await authApi.verifyESignature({ username: signature.username, password: signature.password });
      await settingsApi.updateTimeLimitedUserGrant(grantToUpdate.id, {
        startAt,
        endAt,
        notifyEmailOnExpiry,
        reason: signature.reason || reason.trim() || undefined,
        signatureToken: verified.signatureToken,
      });
      showToast({ type: "success", title: "Time-Limited User Updated", message: `Access window for ${grantToUpdate.fullName} has been updated.` });
      setSignOpen(false);
      navigate(ROUTES.SECURITY.TIME_LIMITED_USERS_DETAIL(grantToUpdate.id));
    } catch (err) {
      showToast({ type: "error", title: "Update Failed", message: extractApiMessage(err, "Unable to update the time-limited access grant.") });
    } finally { setSaving(false); }
  };

  if (loading) return <FullPageLoading text="Loading time-limited user..." />;
  if (!grant || loadError) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-8 text-center">
        <p className="text-sm font-medium text-amber-800">{loadError ?? "Time-limited access grant not found."}</p>
        <Button size="sm" variant="outline" onClick={() => navigate(ROUTES.SECURITY.TIME_LIMITED_USERS)}>Back to Time-Limited Users</Button>
      </div>
    );
  }

  const detailUrl = ROUTES.SECURITY.TIME_LIMITED_USERS_DETAIL(grant.id);
  const editable = grant.status === "ACTIVE";
  return (
    <div className="flex h-full flex-col gap-6">
      <PageHeader
        title="Edit Time-Limited User"
        breadcrumbItems={editTimeLimitedUser(navigate, grant.id)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => navigate(detailUrl)}>Cancel</Button>
            <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" disabled={!canSave} onClick={() => setSignOpen(true)}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        }
      />

      {!editable && (
        <WarningBanner
          variant="warning"
          description={`Only an active grant can be edited. This grant is ${grant.status.toLowerCase()}.`}
        />
      )}

      <FormSection
        title="User Information"
        description="The assigned account is read-only while editing its access window."
        icon={<UserRound className="h-4 w-4" />}
        contentClassName="p-4 md:p-5"
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">Full Name</p>
            <p className="text-xs font-medium text-slate-900 sm:text-sm">{grant.fullName}</p>
          </div>
          <div>
            <p className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">Username</p>
            <p className="text-xs text-slate-700 sm:text-sm">{grant.username}</p>
          </div>
          <div>
            <p className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">Email</p>
            <p className="break-words text-xs text-slate-700 sm:text-sm">{grant.email}</p>
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Access Window"
        description="Changes are applied after electronic-signature confirmation."
        icon={<CalendarClock className="h-4 w-4" />}
        contentClassName="p-4 md:p-5"
      >
        <TimeLimitedUserGrantFields
          startDisplay={startDisplay}
          endDisplay={endDisplay}
          notifyEmailOnExpiry={notifyEmailOnExpiry}
          reason={reason}
          onStartDisplayChange={setStartDisplay}
          onEndDisplayChange={setEndDisplay}
          onNotifyEmailOnExpiryChange={setNotifyEmailOnExpiry}
          onReasonChange={setReason}
          disabled={!editable || saving}
          reasonPlaceholder="Optional context for this change..."
        />
      </FormSection>

      <ESignatureModal
        isOpen={signOpen}
        onClose={() => setSignOpen(false)}
        onConfirm={confirmUpdate}
        actionTitle={`Update time-limited access: ${grant.fullName}`}
        meaningDisplayName="Time-Limited User Grant Update"
        meaningCode="TIME_LIMITED_USER_GRANT"
      />
    </div>
  );
};
