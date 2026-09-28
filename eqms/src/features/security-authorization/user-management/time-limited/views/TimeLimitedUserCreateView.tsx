import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GalleryVerticalEnd, Timer } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormSection } from "@/components/ui/form/FormSection";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/select/MultiSelect";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/hooks/usePermissions";
import { authApi } from "@/services/api/auth";
import { settingsApi } from "@/services/api/settings";
import { ROUTES } from "@/app/routes.constants";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import { createTimeLimitedUser } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { TimeLimitedUserGrantFields } from "../components/TimeLimitedUserGrantFields";
import { toTimeLimitedUserIsoInstant } from "../utils/timeLimitedUserDate";

const labelClass = "text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block";

/**
 * Full-page "New Time-Limited User" -- selects one or many users (never merged: the list screen
 * shows one row per user afterwards), a [start, end] date+time window they're allowed to be
 * active in, and an optional "notify by e-mail on expiry" toggle. Mirrors Add User's own
 * PageHeader/FormSection conventions for this feature area.
 */
export const TimeLimitedUserCreateView: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("settings.user.edit");
  const { showToast } = useToast();

  const [selectedUserIds, setSelectedUserIds] = useState<(string | number)[]>([]);
  const [selectedUserOptions, setSelectedUserOptions] = useState<MultiSelectOption[]>([]);
  const [startDisplay, setStartDisplay] = useState("");
  const [endDisplay, setEndDisplay] = useState("");
  const [notifyEmailOnExpiry, setNotifyEmailOnExpiry] = useState(false);
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSignOpen, setIsSignOpen] = useState(false);

  const goBack = () => navigate(ROUTES.SECURITY.TIME_LIMITED_USERS);

  // Stable across renders (useCallback) -- MultiSelect's debounced-search effect depends on this
  // function by reference, so a function re-created every render re-triggers the search on every
  // parent re-render (including the one the search itself causes via setSelectedUserOptions
  // below), which is what produced the "dropdown loading liên tục" loop.
  const searchUsers = useCallback(async (query: string): Promise<MultiSelectOption[]> => {
    const response = await settingsApi.getUsers({ search: query, limit: 20, page: 1 } as any);
    const options: MultiSelectOption[] = response.data.map((u: any) => ({
      label: `${u.fullName} (${u.username})`,
      value: u.id,
    }));
    // Keep already-selected options resolvable even if a later search doesn't return them again.
    setSelectedUserOptions((prev) => {
      const known = new Map(prev.map((o) => [o.value, o]));
      options.forEach((o) => known.set(o.value, o));
      return Array.from(known.values());
    });
    return options;
  }, []);

  const startAt = toTimeLimitedUserIsoInstant(startDisplay);
  const endAt = toTimeLimitedUserIsoInstant(endDisplay);
  const canSubmit =
    selectedUserIds.length > 0 && !!startAt && !!endAt && startAt <= endAt && !isSaving;

  const selectedUsers = useMemo(
    () => selectedUserOptions.filter((o) => selectedUserIds.includes(o.value)),
    [selectedUserOptions, selectedUserIds],
  );

  const handleSubmit = () => {
    if (!canSubmit) return;
    setIsSignOpen(true);
  };

  const confirmCreate = async (data: { username: string; password: string; reason: string }) => {
    setIsSaving(true);
    try {
      const signatureResponse = await authApi.verifyESignature({ username: data.username, password: data.password });
      await settingsApi.createTimeLimitedUserGrants({
        userIds: selectedUserIds.map(String),
        startAt,
        endAt,
        notifyEmailOnExpiry,
        reason: data.reason || reason || undefined,
        signatureToken: signatureResponse.signatureToken,
      });
      showToast({
        type: "success",
        title: "Time-Limited User Created",
        message: `Created ${selectedUserIds.length} time-limited access grant(s).`,
      });
      setIsSignOpen(false);
      navigate(ROUTES.SECURITY.TIME_LIMITED_USERS);
    } catch (err) {
      showToast({ type: "error", title: "Failed to create grant", message: extractApiMessage(err, "Failed to create time-limited access grant.") });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <PageHeader
        title="New Time-Limited User"
        breadcrumbItems={createTimeLimitedUser(navigate)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline-emerald" onClick={goBack} className="whitespace-nowrap">
              Back
            </Button>
            {canManage && (
              <Button size="sm" variant="outline-emerald" onClick={handleSubmit} disabled={!canSubmit} className="whitespace-nowrap">
                {isSaving ? "Saving..." : "Save"}
              </Button>
            )}
          </div>
        }
      />

      <FormSection
        title="Time-Limited Access"
        description="Configure the user selection, access window and expiry notification."
        icon={<Timer className="h-4 w-4" />}
        contentClassName="p-4 md:p-5"
      >
        <div className="space-y-5">
          <div>
            <label className={labelClass}>
              Select user(s) <span className="text-red-500">*</span>
            </label>
            <MultiSelect
              value={selectedUserIds}
              onChange={setSelectedUserIds}
              options={selectedUserOptions}
              onSearch={searchUsers}
              minSearchLength={0}
              placeholder="Search and select one or more users..."
              searchPlaceholder="Search name, username, email..."
              disabled={isSaving || !canManage}
            />
            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-normal text-slate-400 sm:text-xs">
              Selecting several users creates one separate record for each -- they are never merged into a single row.
            </p>
          </div>

          <div>
            <TimeLimitedUserGrantFields
              startDisplay={startDisplay}
              endDisplay={endDisplay}
              notifyEmailOnExpiry={notifyEmailOnExpiry}
              reason={reason}
              onStartDisplayChange={setStartDisplay}
              onEndDisplayChange={setEndDisplay}
              onNotifyEmailOnExpiryChange={setNotifyEmailOnExpiry}
              onReasonChange={setReason}
              disabled={isSaving || !canManage}
              reasonPlaceholder="Optional context for this time-limited access grant..."
            />
          </div>
        </div>
      </FormSection>

      {/* Summary -- most useful when several users are selected at once, so there's something to
          review before submitting a bulk grant instead of trusting the MultiSelect's tag list alone. */}
      <FormSection
        title="Summary"
        description="Review the access grant before confirming with an electronic signature."
        icon={<GalleryVerticalEnd className="h-4 w-4" />}
        contentClassName="p-4 md:p-5"
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <div>
            <p className={labelClass}>Selected Users ({selectedUsers.length})</p>
            {selectedUsers.length === 0 ? (
              <p className="text-[11px] font-normal text-slate-400 sm:text-xs">No users selected yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selectedUsers.map((u) => (
                  <Badge key={u.value} size="sm" color="emerald">{u.label}</Badge>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className={labelClass}>Active Window</p>
            <p className="text-xs text-slate-700 sm:text-sm">
              {startDisplay && endDisplay ? `${startDisplay} → ${endDisplay}` : <span className="text-[11px] font-normal text-slate-400 sm:text-xs">Not set yet.</span>}
            </p>
          </div>
          <div>
            <p className={labelClass}>Notify on Expiry</p>
            <Badge size="sm" color={notifyEmailOnExpiry ? "emerald" : "slate"}>{notifyEmailOnExpiry ? "Yes" : "No"}</Badge>
          </div>
          <div>
            <p className={labelClass}>Records to be created</p>
            <p className="text-xs text-slate-700 sm:text-sm">
              {selectedUsers.length} separate record{selectedUsers.length === 1 ? "" : "s"} -- one per selected user, never merged.
            </p>
          </div>
        </div>
      </FormSection>

      <ESignatureModal
        isOpen={isSignOpen}
        onClose={() => setIsSignOpen(false)}
        onConfirm={confirmCreate}
        actionTitle={`Create time-limited access for ${selectedUserIds.length} user(s)`}
        meaningDisplayName="Time-Limited User Grant Creation"
        meaningCode="TIME_LIMITED_USER_GRANT"
      />
    </div>
  );
};
