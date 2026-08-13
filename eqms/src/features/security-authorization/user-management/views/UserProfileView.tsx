import React, { useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { User as UserIcon, GraduationCap, ShieldCheck, AlertTriangle, Camera, ChevronDown, SquareX, KeyRound, PauseCircle, RotateCcw, MoreVertical } from "lucide-react";
import { IconBan, IconBrandTelegram, IconMailUp, IconRestore, IconUserX } from "@tabler/icons-react";
import { ROUTES } from "@/app/routes.constants";
import { TabNav } from "@/components/ui/tabs/TabNav";
import type { TabItem } from "@/components/ui/tabs/TabNav";
import { Button } from "@/components/ui/button/Button";
import { cn } from "@/components/ui/utils";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Badge } from "@/components/ui/badge/Badge";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { FormModal } from "@/components/ui/modal/FormModal";
import { useToast } from "@/components/ui/toast";
import { useTranslation } from "@/i18n";
import { getApiErrorMessage } from "@/utils/apiError";
import { usePortalDropdown } from "@/hooks";
import { userProfile as userProfileBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { ResetPasswordModal } from "../components/ResetPasswordModal";
import { SuspendModal } from "../components/SuspendModal";
import { TerminateModal } from "../components/TerminateModal";
import { PersonalTab } from "../tabs/PersonalTab";
import { QualificationsTab } from "../tabs/QualificationsTab";
import { SecurityAuthorizationTab } from "../tabs/SecurityAuthorizationTab";
import { USER_MANAGEMENT_ROUTES } from "../constants";
import { formatDate } from "@/utils/format";
import { useUserProfile } from "../hooks/useUserProfile";
import { navigateBack } from "@/app/navigation/backNavigation";
import { settingsApi } from "@/services/api/settings";
import type { UserActionCapabilitiesResponse, ExternalIdentityProvisioningResponse } from "@/services/api/settings";
import { subscribeNotificationRealtime } from "@/features/notifications/notificationRealtime";

type ExternalAction = "invite" | "disable" | "resend" | "retry" | "remove";

export const UserProfileView: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { userId } = useParams<{ userId: string }>();

    const {
        user,
        draft,
    editingSection,
    isDraftDirty,
    certifications,
    draftDepartments,
    managerOptions,
    initials,
    yearsOfService,
    startSectionEdit,
    saveSection,
    cancelSection,
    resetSection,
    updateField,
    saveCert,
    deleteCert,
    suspendUser,
    terminateUser,
    reinstateUser,
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
  const [isNavigating, setIsNavigating] = useState(false);
  const [capabilities, setCapabilities] = useState<UserActionCapabilitiesResponse | null>(null);
  const [externalProvisioning, setExternalProvisioning] = useState<ExternalIdentityProvisioningResponse | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const { openId: externalMenuOpenId, position: externalMenuPosition, getRef: getExternalMenuRef, toggle: toggleExternalMenu, close: closeExternalMenu } = usePortalDropdown();
  const [externalReasonModal, setExternalReasonModal] = useState<ExternalAction | null>(null);
  const [externalReason, setExternalReason] = useState("");
  const [isExternalActionLoading, setIsExternalActionLoading] = useState(false);

  type MainTab = "personal" | "qualifications" | "security";
  const [activeTab, setActiveTab] = useState<MainTab>("personal");

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
          showToast({ type: "success", title: t("userManagement.external.inviteQueuedTitle"), message: t("userManagement.external.inviteQueuedMessage", { email: user.email }) });
          break;
        case "resend":
          await settingsApi.resendExternalInvitation(userId, reasonText);
          showToast({ type: "success", title: t("userManagement.external.resendQueuedTitle"), message: t("userManagement.external.requestQueuedMessage", { name: user.email }) });
          break;
        case "disable":
          await settingsApi.disableMicrosoftAccess(userId, reasonText);
          showToast({ type: "success", title: t("userManagement.external.disableQueuedTitle"), message: t("userManagement.external.requestQueuedMessage", { name: user.fullName }) });
          break;
        case "retry":
          await settingsApi.retryExternalProvisioning(userId, reasonText);
          showToast({ type: "success", title: t("userManagement.external.retryQueuedTitle"), message: t("userManagement.external.requestQueuedMessage", { name: user.email }) });
          break;
        case "remove":
          await settingsApi.removeExternalUser(userId, reasonText);
          showToast({ type: "success", title: t("userManagement.external.removeQueuedTitle"), message: t("userManagement.external.requestQueuedMessage", { name: user.email }) });
          break;
      }
      setExternalReasonModal(null);
      refreshExternalProvisioning();
      void loadCapabilities();
    } catch (error: any) {
      showToast({
        type: "error",
        title: t("userManagement.external.failedTitle"),
        message: getApiErrorMessage(error, t("userManagement.external.failedMessage")),
      });
    } finally {
      setIsExternalActionLoading(false);
    }
  };

  if (isLoading) {
    return <FullPageLoading text="Loading..." />;
  }

  const canPerform = (action: string) => Boolean(capabilities?.actions?.[action]?.allowed);
  const hasAnyProfileAction =
    canPerform("resetPassword") ||
    canPerform("suspend") ||
    canPerform("terminate") ||
    canPerform("reinstate");
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

  const tabs: TabItem[] = [
    { id: "personal", label: "Personal Information" },
    { id: "qualifications", label: "Professional Qualifications" },
    { id: "security", label: "Security & Authorization" },
  ];

  const handleAvatarClick = () => {
    if (!canPerform("edit")) return;
    avatarInputRef.current?.click();
  };

  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void handleAvatarChange(file);
    }
    event.target.value = "";
  };

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title="User Profile"
        breadcrumbItems={userProfileBreadcrumb(navigate, user.fullName)}
        actions={
          <>
            <Button onClick={handleBack} variant="outline-emerald" size="sm" className="gap-2 whitespace-nowrap">Back</Button>
            {hasAnyProfileAction && (
              <Button
                ref={getExternalMenuRef("profile-actions")}
                size="sm"
                variant="outline-emerald"
                onClick={(event) => toggleExternalMenu("profile-actions", event, { menuWidth: 200, menuHeight: 220 })}
                className="gap-2 whitespace-nowrap"
              >
                More actions
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    externalMenuOpenId === "profile-actions" && "rotate-180",
                  )}
                />
              </Button>
            )}
            {hasAnyExternalAction && (
              <Button
                ref={getExternalMenuRef("microsoft-access")}
                size="sm"
                variant="outline-emerald"
                onClick={(event) => toggleExternalMenu("microsoft-access", event, { menuWidth: 220, menuHeight: 220 })}
                className="gap-2 whitespace-nowrap"
              >
                Microsoft Access
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    externalMenuOpenId === "microsoft-access" && "rotate-180",
                  )}
                />
              </Button>
            )}
          </>
        }
      />

      <div className="bg-gradient-to-br from-emerald-50 via-white to-slate-50 rounded-xl border border-emerald-100 shadow-sm overflow-hidden">
        {/* Suspended / Terminated Banner */}
        {(user.status === "Suspended" || user.status === "Terminated") && (
          <div className={cn(
            "flex items-start gap-2.5 px-5 py-3 border-b text-xs",
            user.status === "Suspended"
              ? "bg-amber-50 border-amber-200"
              : "bg-rose-50 border-rose-200"
          )}>
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
        )}
        <div className="flex items-center gap-5 p-5 bg-gradient-to-b from-emerald-50/50 to-transparent">
          <div className="relative h-16 w-16 rounded-full bg-emerald-600 shadow-md flex items-center justify-center flex-shrink-0 overflow-hidden">
            {avatarPreview ? (
              <img src={avatarPreview} alt={user.fullName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl font-medium text-white">{initials}</span>
            )}
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={isAvatarSaving}
              className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors"
              aria-label="Change avatar"
            >
              <Camera className="h-4.5 w-4.5 text-white opacity-0 hover:opacity-100" />
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
              <span className="text-emerald-600 font-medium">{user.position || user.role}</span>
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
              >
                {user.status}
              </Badge>
              <Badge
                color="purple"
                size="sm"
              >
                {user.role}
              </Badge>
              {user.employmentType && (
                <Badge color="slate" size="sm">{user.employmentType}</Badge>
              )}
              {canPerform("viewExternalProvisioning") && (
                <Badge color={(externalProvisioning?.statusColor || "slate") as any} size="sm" className="gap-1" title="Microsoft Entra external-user status">
                  <ShieldCheck className="h-3 w-3" />
                  {externalProvisioning?.statusLabel}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav
          tabs={tabs}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as MainTab)}
        />
        <div className="p-4 md:p-5 animate-in fade-in duration-200">
          {activeTab === "personal" && (
            <PersonalTab
              user={user}
              draft={draft}
              editingSection={editingSection}
              isDraftDirty={isDraftDirty}
              draftDepartments={draftDepartments}
              businessUnitOptions={businessUnitOptions}
              languageOptions={languageOptions}
              managerOptions={managerOptions}
              positionOptions={lookupPositions}
              yearsOfService={yearsOfService}
              canEdit={canPerform("edit")}
              onSectionEdit={startSectionEdit}
              onSectionSave={saveSection}
              onSectionCancel={cancelSection}
              onSectionReset={resetSection}
              onDraftChange={updateField}
              fieldErrors={fieldErrors}
            />
          )}
          {activeTab === "qualifications" && (
            <QualificationsTab
              user={user}
              draft={draft}
              editingSection={editingSection}
              isDraftDirty={isDraftDirty}
              fieldErrors={fieldErrors}
              certifications={certifications}
              educationList={educationList}
              canEdit={canPerform("edit")}
              onSectionEdit={startSectionEdit}
              onSectionSave={saveSection}
              onSectionCancel={cancelSection}
              onSectionReset={resetSection}
              onDraftChange={updateField}
              onCertSave={saveCert}
              onCertDelete={deleteCert}
              onEduSave={saveEdu}
              onEduDelete={deleteEdu}
            />
          )}
          {activeTab === "security" && (
            <SecurityAuthorizationTab user={user} />
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

      <PortalDropdownMenu
        isOpen={externalMenuOpenId === "profile-actions"}
        onClose={closeExternalMenu}
        position={externalMenuPosition}
        minWidth={200}
      >
        <div className="py-1 whitespace-nowrap">
          {canPerform("resetPassword") && (
            <button
              onClick={() => {
                closeExternalMenu();
                setResetPasswordModal(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <KeyRound className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium text-slate-500">Reset Password</span>
            </button>
          )}
          {canPerform("suspend") && (
            <button
              onClick={() => {
                closeExternalMenu();
                setSuspendModal(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <PauseCircle className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium text-slate-500">Suspend</span>
            </button>
          )}
          {canPerform("terminate") && (
            <button
              onClick={() => {
                closeExternalMenu();
                setTerminateModal(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <IconUserX className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium text-slate-500">Terminate</span>
            </button>
          )}
          {canPerform("reinstate") && (
            <button
              onClick={() => {
                closeExternalMenu();
                setReinstateModal(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium text-slate-500">Reinstate</span>
            </button>
          )}
        </div>
      </PortalDropdownMenu>

      <PortalDropdownMenu
        isOpen={externalMenuOpenId === "microsoft-access"}
        onClose={closeExternalMenu}
        position={externalMenuPosition}
        minWidth={220}
      >
        <div className="py-1 whitespace-nowrap">
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

      {isNavigating && <FullPageLoading text="Loading..." />}
    </div>
  );
};
