import React, { useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { User as UserIcon, Briefcase, GraduationCap, ShieldCheck, AlertTriangle, Camera, ChevronDown, SquareX, RotateCcw, LockOpen } from "lucide-react";
import { IconBan, IconBrandTelegram, IconLayoutGrid, IconMailUp, IconRestore } from "@tabler/icons-react";
import { ROUTES } from "@/app/routes.constants";
import { Button } from "@/components/ui/button/Button";
import { cn } from "@/components/ui/utils";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Badge } from "@/components/ui/badge/Badge";
import { Avatar } from "@/components/ui/avatar";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { FormModal } from "@/components/ui/modal/FormModal";
import { TabNav } from "@/components/ui/tabs/TabNav";
import type { TabItem } from "@/components/ui/tabs/TabNav";
import { useToast } from "@/components/ui/toast";
import { usePortalDropdown } from "@/hooks";
import { userProfile as userProfileBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { ResetPasswordModal } from "../components/ResetPasswordModal";
import { UnlockAccountModal } from "../components/UnlockAccountModal";
import { SuspendModal } from "../components/SuspendModal";
import { TerminateModal } from "../components/TerminateModal";
import { PersonalTab } from "../tabs/PersonalTab";
import { EmploymentTab } from "../tabs/EmploymentTab";
import { QualificationsTab } from "../tabs/QualificationsTab";
import { AccountStatusTab } from "../tabs/AccountStatusTab";
import { SecurityAuthorizationTab } from "../tabs/SecurityAuthorizationTab";
import { USER_MANAGEMENT_ROUTES, USER_STATUS_DESCRIPTIONS } from "../../constants";
import type { User } from "../../types";
import { formatDate } from "@/utils/format";
import { useUserProfile } from "../hooks/useUserProfile";
import { navigateBack } from "@/app/navigation/backNavigation";
import { settingsApi } from "@/services/api/settings";
import type { UserActionCapabilitiesResponse, ExternalIdentityProvisioningResponse } from "@/services/api/settings";
import { subscribeNotificationRealtime } from "@/features/notifications/notificationRealtime";
import { AvatarCropModal } from "@/features/settings/user-profile/AvatarCropModal";
import { isAvatarFileWithinLimit, isSupportedAvatarFile } from "@/utils/avatar";

type ExternalAction = "invite" | "disable" | "resend" | "retry" | "remove";
type MainTab = "personal" | "employment" | "qualifications" | "account" | "security";

export const UserProfileView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId } = useParams<{ userId: string }>();

  const {
    user,
    draft,
    isEditingProfile,
    isDraftDirty,
    certifications,
    draftDepartments,
    managerOptions,
    yearsOfService,
    startEdit,
    saveAll,
    cancelEdit,
    resetEdit,
    updateField,
    updateMfaRequiredByAdmin,
    saveCert,
    deleteCert,
    suspendUser,
    terminateUser,
    reinstateUser,
    setUser,
    educationList,
    saveEdu,
    deleteEdu,
    lookupPositions,
    businessUnitOptions,
    languageOptions,
    avatarPreview,
    isAvatarSaving,
    handleAvatarChange,
    fieldErrors,
    isLoading,
  } = useUserProfile(userId);

  const [resetPasswordModal, setResetPasswordModal] = useState(false);
  const [suspendModal, setSuspendModal] = useState(false);
  const [terminateModal, setTerminateModal] = useState(false);
  const [reinstateModal, setReinstateModal] = useState(false);
  const [unlockModal, setUnlockModal] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>("personal");
  const [capabilities, setCapabilities] = useState<UserActionCapabilitiesResponse | null>(null);
  const [externalProvisioning, setExternalProvisioning] = useState<ExternalIdentityProvisioningResponse | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isAvatarCropOpen, setIsAvatarCropOpen] = useState(false);
  const [avatarImageToCrop, setAvatarImageToCrop] = useState("");
  const { showToast } = useToast();
  const { openId: externalMenuOpenId, position: externalMenuPosition, getRef: getExternalMenuRef, toggle: toggleExternalMenu, close: closeExternalMenu } = usePortalDropdown();
  const [externalReasonModal, setExternalReasonModal] = useState<ExternalAction | null>(null);
  const [externalReason, setExternalReason] = useState("");
  const [isExternalActionLoading, setIsExternalActionLoading] = useState(false);

  const loadCapabilities = React.useCallback(async () => {
    if (!userId) return;
    try {
      const response = await settingsApi.getUserCapabilities(userId);
      setCapabilities(response);
    } catch {
      setCapabilities({ userId, actions: {} });
    }
  }, [userId]);

  React.useEffect(() => {
    void loadCapabilities();
  }, [loadCapabilities]);

  const refreshExternalProvisioning = React.useCallback(() => {
    if (!userId) return;
    void settingsApi.getExternalProvisioning(userId)
      .then(setExternalProvisioning)
      .catch(() => setExternalProvisioning(null));
  }, [userId]);

  React.useEffect(() => {
    if (!capabilities?.actions?.viewExternalProvisioning?.allowed) return;
    refreshExternalProvisioning();
  }, [capabilities?.actions?.viewExternalProvisioning?.allowed, refreshExternalProvisioning]);

  React.useEffect(() => {
    if (!capabilities?.actions?.viewExternalProvisioning?.allowed) return;
    return subscribeNotificationRealtime((event) => {
      if (event.type === "external-identity-status-changed") {
        // The badge (externalProvisioning) AND the Microsoft Access menu's button
        // visibility (capabilities) are both derived from this status — both must be
        // refreshed together, or the menu goes stale until a manual page reload.
        refreshExternalProvisioning();
        void loadCapabilities();
      }
    });
  }, [capabilities?.actions?.viewExternalProvisioning?.allowed, refreshExternalProvisioning, loadCapabilities]);

  const openExternalReasonModal = (action: ExternalAction) => {
    closeExternalMenu();
    setExternalReason(
      action === "invite" ? "External user onboarding"
        : action === "disable" ? "Access disabled by administrator"
          : action === "remove" ? "External access no longer required"
            : "External access provisioning",
    );
    setExternalReasonModal(action);
  };

  const submitExternalReason = async () => {
    if (!externalReasonModal || !externalReason.trim() || !userId) return;
    const reasonText = externalReason.trim();
    setIsExternalActionLoading(true);
    try {
      switch (externalReasonModal) {
        case "invite":
          await settingsApi.inviteExternalUser(userId, reasonText);
          showToast({ type: "success", title: "Invitation queued", message: `Microsoft Entra invitation for ${user.email} is being processed.` });
          break;
        case "resend":
          await settingsApi.resendExternalInvitation(userId, reasonText);
          showToast({ type: "success", title: "Invitation resend queued", message: `Microsoft Entra request for ${user.email} is being processed.` });
          break;
        case "disable":
          await settingsApi.disableMicrosoftAccess(userId, reasonText);
          showToast({ type: "success", title: "Microsoft access disable queued", message: `Microsoft Entra request for ${user.fullName} is being processed.` });
          break;
        case "retry":
          await settingsApi.retryExternalProvisioning(userId, reasonText);
          showToast({ type: "success", title: "Provisioning retry queued", message: `Microsoft Entra request for ${user.email} is being processed.` });
          break;
        case "remove":
          await settingsApi.removeExternalUser(userId, reasonText);
          showToast({ type: "success", title: "External user removal queued", message: `Microsoft Entra request for ${user.email} is being processed.` });
          break;
      }
      setExternalReasonModal(null);
      refreshExternalProvisioning();
      void loadCapabilities();
    } catch (error: any) {
      showToast({
        type: "error",
        title: "External provisioning failed",
        message: error?.response?.data?.message || "Unable to complete the operation.",
      });
    } finally {
      setIsExternalActionLoading(false);
    }
  };

  if (isLoading) {
    return <FullPageLoading text="Loading..." />;
  }

  const canPerform = (action: string) => Boolean(capabilities?.actions?.[action]?.allowed);
  // Whether each Microsoft-identity action is currently valid (not just permitted) is decided by
  // the server — canPerform(...) already reflects both permission AND the user's current
  // provisioning status (see UserManagementService.getUserCapabilities). This view only renders
  // what it's told; it does not re-derive eligibility from externalProvisioning.status itself.
  const hasAnyExternalAction =
    canPerform("inviteExternal") ||
    canPerform("resendExternalInvitation") ||
    canPerform("disableMicrosoftAccess") ||
    canPerform("retryExternalProvisioning") ||
    canPerform("removeExternalUser");

  const handleBack = () => {
    setIsNavigating(true);
    setTimeout(() => navigateBack(navigate, location.state, USER_MANAGEMENT_ROUTES.LIST), 600);
  };

  const handleConfirmSuspend = async (reason: string, suspendedUntil: string, signatureToken: string) => {
    await suspendUser(reason, suspendedUntil, signatureToken);
    await loadCapabilities();
    setSuspendModal(false);
  };

  const handleConfirmTerminate = async (reason: string, terminationDate: string, signatureToken: string) => {
    await terminateUser(reason, terminationDate, signatureToken);
    await loadCapabilities();
    setTerminateModal(false);
  };

  const handleConfirmReinstate = async () => {
    await reinstateUser();
    await loadCapabilities();
    setReinstateModal(false);
  };

  const handleUnlockSuccess = (updated: User) => {
    setUser(updated);
    void loadCapabilities();
    setUnlockModal(false);
  };

  const tabs: TabItem[] = [
    { id: "personal", label: "Personal & Identity" },
    { id: "employment", label: "Employment Record" },
    { id: "qualifications", label: "Training & Competency" },
    { id: "account", label: "Account Status" },
    { id: "security", label: "Security & Compliance" },
  ];

  const handleAvatarClick = () => {
    if (!canPerform("edit")) return;
    avatarInputRef.current?.click();
  };

  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!isSupportedAvatarFile(file)) {
      showToast({
        type: "error",
        title: "Invalid Avatar",
        message: "Only .png or .jpg files are accepted.",
      });
      return;
    }
    if (!isAvatarFileWithinLimit(file)) {
      showToast({
        type: "error",
        title: "Invalid Avatar",
        message: "File size exceeds 5MB limit.",
      });
      return;
    }

    setAvatarImageToCrop(URL.createObjectURL(file));
    setIsAvatarCropOpen(true);
  };

  const closeAvatarCrop = () => {
    if (avatarImageToCrop) URL.revokeObjectURL(avatarImageToCrop);
    setAvatarImageToCrop("");
    setIsAvatarCropOpen(false);
  };

  const handleAvatarCropComplete = (croppedBlob: Blob) => {
    if (avatarImageToCrop) URL.revokeObjectURL(avatarImageToCrop);
    setAvatarImageToCrop("");
    setIsAvatarCropOpen(false);
    void handleAvatarChange(new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" }));
  };

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title="User Profile"
        breadcrumbItems={userProfileBreadcrumb(navigate, user.fullName)}
        actions={
          <>
            <Button onClick={handleBack} variant="outline-emerald" size="sm" className="gap-2 whitespace-nowrap">Back</Button>
            {/* One Edit/Save/Cancel/Reset for the whole page -- covers every plain field across
                Personal Information, Professional Qualifications, and the MFA requirement
                checkbox in one draft/save cycle. Access Profiles and Education/Certifications
                are deliberately excluded (their own instant-action UI, see useUserProfile). */}
            {canPerform("edit") && (
              isEditingProfile ? (
                <>
                  <Button variant="outline-emerald" size="sm" onClick={resetEdit} disabled={!isDraftDirty} className="whitespace-nowrap">Reset</Button>
                  <Button variant="outline-emerald" size="sm" onClick={cancelEdit} className="whitespace-nowrap">Cancel</Button>
                  <Button variant="outline-emerald" size="sm" onClick={saveAll} className="whitespace-nowrap">Save</Button>
                </>
              ) : (
                <Button variant="outline-emerald" size="sm" onClick={startEdit} className="whitespace-nowrap">Edit</Button>
              )
            )}
            {hasAnyExternalAction && (
              <Button
                ref={getExternalMenuRef("actions")}
                size="sm"
                variant="outline-emerald"
                onClick={(event) => toggleExternalMenu("actions", event, { menuWidth: 220, menuHeight: 320 })}
                className="gap-2 whitespace-nowrap"
              >
                Microsoft Access
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    externalMenuOpenId === "actions" && "rotate-180",
                  )}
                />
              </Button>
            )}
          </>
        }
      />

      {/* Alert banners -- deliberately outside the hero identity card below, so a warning never
          shares a background with the avatar/name block it isn't about. */}
      {user.accountLocked && (
        <div className="flex items-start justify-between gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-rose-600" />
            <div>
              <p className="font-semibold text-rose-700">Account Locked</p>
              <p className="mt-0.5 text-rose-600">
                Login is locked out after too many failed login attempts.
              </p>
            </div>
          </div>
          {canPerform("unlock") && (
            <Button size="sm" variant="outline-emerald" onClick={() => setUnlockModal(true)} className="gap-1.5 whitespace-nowrap flex-shrink-0">
              <LockOpen className="h-3.5 w-3.5" />
              Unlock Account
            </Button>
          )}
        </div>
      )}
      {(user.status === "Suspended" || user.status === "Terminated") && (
        <div className={cn(
          "flex items-start justify-between gap-2.5 rounded-xl border px-4 py-3 text-xs",
          user.status === "Suspended"
            ? "bg-amber-50 border-amber-200"
            : "bg-rose-50 border-rose-200"
        )}>
          <div className="flex items-start gap-2.5">
            <AlertTriangle className={cn("h-4 w-4 mt-0.5 flex-shrink-0", user.status === "Suspended" ? "text-amber-600" : "text-rose-600")} />
            <div>
              <p className={cn("font-semibold", user.status === "Suspended" ? "text-amber-700" : "text-rose-700")}>
                {user.status === "Suspended" ? "Account Suspended" : "Employee Terminated"}
              </p>
              <p className={cn("mt-0.5", user.status === "Suspended" ? "text-amber-600" : "text-rose-600")}>
                {user.status === "Suspended"
                  ? `Reason: ${user.suspendReason || "—"} · ${user.suspendedUntil ? `Until: ${formatDate(user.suspendedUntil)}` : "Indefinite"}`
                  : `Reason: ${user.terminationReason || "—"} · Date: ${user.terminationDate ? formatDate(user.terminationDate) : "—"}`}
              </p>
            </div>
          </div>
          {user.status === "Suspended" && canPerform("reinstate") && (
            <Button size="sm" variant="outline-emerald" onClick={() => setReinstateModal(true)} className="gap-1.5 whitespace-nowrap flex-shrink-0">
              <RotateCcw className="h-3.5 w-3.5" />
              Reinstate
            </Button>
          )}
        </div>
      )}

      {/* Hero identity card — avatar, name, status only, no longer sharing space with banners */}
      <div className="bg-gradient-to-br from-emerald-50 via-white to-slate-50 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-5 p-5">
          <div className="group relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-full shadow-md">
            <Avatar name={user.fullName} src={avatarPreview} tone="solid" className="h-16 w-16 text-xl" />
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={!canPerform("edit") || isAvatarSaving}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-colors hover:bg-black/20 disabled:cursor-not-allowed"
              aria-label="Change avatar"
            >
              <Camera className="h-4.5 w-4.5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept=".png,.jpg,.jpeg"
              className="hidden"
              onChange={handleAvatarFileChange}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-slate-900 leading-tight">{user.fullName}</h2>
            <p className="text-sm mt-0.5">
              <span className="text-emerald-600 font-medium">{user.position || user.accessProfileNames?.[0] || "—"}</span>
              <span className="text-slate-400"> &middot; </span>
              <span className="text-slate-500">{user.department}</span>
            </p>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <Badge
                color={
                  user.status === "Active" ? "emerald" :
                    user.status === "Inactive" ? "slate" :
                      user.status === "Pending" ? "amber" :
                        user.status === "Suspended" ? "orange" : "red"
                }
                size="sm"
                showDot
                pill
                title={USER_STATUS_DESCRIPTIONS[user.status]}
              >
                {user.status}
              </Badge>
              {user.employmentType && (
                <Badge color="slate" size="sm">{user.employmentType}</Badge>
              )}
              {canPerform("viewExternalProvisioning") && (
                <Badge color={(externalProvisioning?.statusColor || "slate") as any} size="sm" className="gap-1" title="Microsoft Entra external-user status">
                  <IconLayoutGrid className="h-3 w-3" />
                  {externalProvisioning?.statusLabel}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as MainTab)} />
        <div className="p-4 md:p-5 animate-in fade-in duration-200">
          {activeTab === "personal" && (
            <PersonalTab
              user={user}
              draft={draft}
              isEditing={isEditingProfile}
              languageOptions={languageOptions}
              onDraftChange={updateField}
              fieldErrors={fieldErrors}
            />
          )}
          {activeTab === "employment" && (
            <EmploymentTab
              user={user}
              draft={draft}
              isEditing={isEditingProfile}
              draftDepartments={draftDepartments}
              businessUnitOptions={businessUnitOptions}
              managerOptions={managerOptions}
              positionOptions={lookupPositions}
              yearsOfService={yearsOfService}
              onDraftChange={updateField}
              fieldErrors={fieldErrors}
            />
          )}
          {activeTab === "qualifications" && (
            <QualificationsTab
              user={user}
              draft={draft}
              isEditing={isEditingProfile}
              fieldErrors={fieldErrors}
              certifications={certifications}
              educationList={educationList}
              canEdit={canPerform("edit")}
              onDraftChange={updateField}
              onCertSave={saveCert}
              onCertDelete={deleteCert}
              onEduSave={saveEdu}
              onEduDelete={deleteEdu}
            />
          )}
          {activeTab === "account" && (
            <AccountStatusTab
              user={user}
              draft={draft}
              canEdit={canPerform("edit")}
              isEditingProfile={isEditingProfile}
              onDraftChange={updateField}
              canResetPassword={canPerform("resetPassword")}
              canSuspend={canPerform("suspend")}
              canTerminate={canPerform("terminate")}
              canReinstate={canPerform("reinstate")}
              canUnlock={canPerform("unlock")}
              onResetPassword={() => setResetPasswordModal(true)}
              onSuspend={() => setSuspendModal(true)}
              onTerminate={() => setTerminateModal(true)}
              onReinstate={() => setReinstateModal(true)}
              onUnlock={() => setUnlockModal(true)}
            />
          )}
          {activeTab === "security" && (
            <SecurityAuthorizationTab
              user={user}
              canEdit={canPerform("edit")}
              mfaRequiredByAdmin={Boolean(draft.mfaRequiredByAdmin)}
              isEditingProfile={isEditingProfile}
              onMfaRequiredByAdminChange={updateMfaRequiredByAdmin}
            />
          )}
        </div>
      </div>

      <ResetPasswordModal
        isOpen={resetPasswordModal}
        onClose={() => setResetPasswordModal(false)}
        userId={user.id}
        userName={user.fullName}
      />

      <SuspendModal
        isOpen={suspendModal}
        onClose={() => setSuspendModal(false)}
        onConfirm={handleConfirmSuspend}
        userName={user.fullName}
      />

      <TerminateModal
        isOpen={terminateModal}
        onClose={() => setTerminateModal(false)}
        onConfirm={handleConfirmTerminate}
        userName={user.fullName}
      />

      <AlertModal
        isOpen={reinstateModal}
        onClose={() => setReinstateModal(false)}
        onConfirm={handleConfirmReinstate}
        type="confirm"
        title="Reinstate User"
        description={`Are you sure you want to reinstate ${user.fullName}? Their account will be set to Active and they will regain full access.`}
        confirmText="Yes, Reinstate"
        cancelText="Cancel"
        showCancel
      />

      <UnlockAccountModal
        isOpen={unlockModal}
        onClose={() => setUnlockModal(false)}
        userId={user.id}
        userName={user.fullName}
        userEmail={user.email}
        onSuccess={handleUnlockSuccess}
      />

      <PortalDropdownMenu
        isOpen={externalMenuOpenId === "actions"}
        onClose={closeExternalMenu}
        position={externalMenuPosition}
        minWidth={220}
      >
        <div className="py-1 whitespace-nowrap">
          {hasAnyExternalAction && (
            <>
              <p className="px-3 pt-1.5 pb-1 text-2xs font-bold uppercase tracking-wider text-slate-400">Microsoft Access</p>
              {canPerform("inviteExternal") && (
                <button
                  onClick={() => openExternalReasonModal("invite")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <IconBrandTelegram className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium text-slate-500">Invite External User</span>
                </button>
              )}
              {canPerform("resendExternalInvitation") && (
                <button
                  onClick={() => openExternalReasonModal("resend")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <IconMailUp className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium text-slate-500">Resend Invitation</span>
                </button>
              )}
              {canPerform("disableMicrosoftAccess") && (
                <button
                  onClick={() => openExternalReasonModal("disable")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <IconBan className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium text-slate-500">Disable Microsoft Access</span>
                </button>
              )}
              {canPerform("retryExternalProvisioning") && (
                <button
                  onClick={() => openExternalReasonModal("retry")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <IconRestore className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium text-slate-500">Retry Provisioning</span>
                </button>
              )}
              {canPerform("removeExternalUser") && (
                <button
                  onClick={() => openExternalReasonModal("remove")}
                  title="Permanently deletes the guest account from Microsoft Entra. This cannot be undone."
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <SquareX className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium">Remove External User</span>
                </button>
              )}
            </>
          )}
        </div>
      </PortalDropdownMenu>

      <FormModal
        isOpen={Boolean(externalReasonModal)}
        onClose={() => setExternalReasonModal(null)}
        onConfirm={() => void submitExternalReason()}
        title={
          externalReasonModal === "invite" ? "Invite External User"
            : externalReasonModal === "disable" ? "Disable Microsoft Access"
              : externalReasonModal === "resend" ? "Resend Invitation"
                : externalReasonModal === "remove" ? "Remove External User"
                  : "Retry Provisioning"
        }
        description={
          externalReasonModal
            ? `Enter the reason for ${externalReasonModal === "invite" ? "inviting" : externalReasonModal === "disable" ? "disabling Microsoft access for" : externalReasonModal === "resend" ? "resending the invitation to" : externalReasonModal === "remove" ? "permanently removing" : "retrying provisioning for"} ${user.email}.`
            : undefined
        }
        confirmText={externalReasonModal === "remove" ? "Remove Permanently" : "Confirm"}
        isLoading={isExternalActionLoading}
        confirmDisabled={!externalReason.trim()}
        size="md"
      >
        {externalReasonModal === "remove" && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
            This permanently deletes the guest account from Microsoft Entra. The user will lose all Word Online / SharePoint access immediately and must be invited again from scratch to regain it. This action cannot be undone.
          </div>
        )}
        <label htmlFor="external-action-reason-profile" className="block text-sm font-medium text-slate-700">
          Reason
        </label>
        <textarea
          id="external-action-reason-profile"
          value={externalReason}
          onChange={(event) => setExternalReason(event.target.value)}
          rows={4}
          maxLength={500}
          autoFocus
          placeholder="Describe the reason..."
          className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        />
      </FormModal>

      <AvatarCropModal
        imageSrc={avatarImageToCrop}
        isOpen={isAvatarCropOpen}
        onClose={closeAvatarCrop}
        onCropComplete={handleAvatarCropComplete}
      />

      {isNavigating && <FullPageLoading text="Loading..." />}
    </div>
  );
};
