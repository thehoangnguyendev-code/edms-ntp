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
import { useToast } from "@/components/ui/toast";
import { usePortalDropdown } from "@/hooks";
import { userProfile as userProfileBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { ResetPasswordModal } from "../components/ResetPasswordModal";
import { ResetMfaModal } from "../components/ResetMfaModal";
import { passwordUserTokens } from "../components/passwordUserTokens";
import { UnlockAccountModal } from "../components/UnlockAccountModal";
import { UserProfileSummary } from "../components/UserProfileSummary";
import { ProfileTabLayout, profileTabItems } from "../components/ProfileTabLayout";
import type { ProfileTabId } from "../components/ProfileTabLayout";
import { SuspendModal } from "../components/SuspendModal";
import { TerminateModal } from "../components/TerminateModal";
import { PersonalTab } from "../tabs/PersonalTab";
import { EmploymentTab } from "../tabs/EmploymentTab";
import { QualificationsTab } from "../tabs/QualificationsTab";
import { AccountStatusTab } from "../tabs/AccountStatusTab";
import { SecurityAuthorizationTab } from "../tabs/SecurityAuthorizationTab";
import { USER_MANAGEMENT_ROUTES } from "../../constants";
import type { User } from "../../types";
import { formatDate } from "@/utils/format";
import { useUserProfile } from "../hooks/useUserProfile";
import { navigateBack } from "@/app/navigation/backNavigation";
import { settingsApi } from "@/services/api/settings";
import type { UserActionCapabilitiesResponse } from "@/services/api/settings";
import { subscribeNotificationRealtime } from "@/features/notifications/notificationRealtime";
import { AvatarCropModal } from "@/features/settings/user-profile/AvatarCropModal";
import { isAvatarFileWithinLimit, isSupportedAvatarFile } from "@/utils/avatar";
import { tr } from "@/i18n";

type MainTab = ProfileTabId;

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
  const [resetMfaModal, setResetMfaModal] = useState(false);
  const [suspendModal, setSuspendModal] = useState(false);
  const [terminateModal, setTerminateModal] = useState(false);
  const [reinstateModal, setReinstateModal] = useState(false);
  const [unlockModal, setUnlockModal] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>("personal");
  const [capabilities, setCapabilities] = useState<UserActionCapabilitiesResponse | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isAvatarCropOpen, setIsAvatarCropOpen] = useState(false);
  const [avatarImageToCrop, setAvatarImageToCrop] = useState("");
  const { showToast } = useToast();

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

  const canPerform = (action: string) => Boolean(capabilities?.actions?.[action]?.allowed);

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

  const tabs = profileTabItems();

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
        title: tr("Invalid Avatar"),
        message: tr("Only .png or .jpg files are accepted."),
      });
      return;
    }
    if (!isAvatarFileWithinLimit(file)) {
      showToast({
        type: "error",
        title: tr("Invalid Avatar"),
        message: tr("File size exceeds 5MB limit."),
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

  const avatarNode = (
    <div className="group relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-full shadow-md">
      <Avatar name={user.fullName} src={avatarPreview} tone="solid" className="h-16 w-16 text-xl" />
      <button
        type="button"
        onClick={handleAvatarClick}
        disabled={!canPerform("edit") || isAvatarSaving}
        className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-colors hover:bg-black/20 disabled:cursor-not-allowed"
        aria-label={tr("Change avatar")}
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
  );

  return (
    <div className="flex w-full flex-1 flex-col gap-4 md:gap-6">
      <PageHeader
        title={tr("User Profile")}
        breadcrumbItems={userProfileBreadcrumb(navigate, user.fullName)}
        actions={
          <>
            <Button onClick={handleBack} variant="outline-emerald" size="sm" className="gap-2 whitespace-nowrap">{tr("Back")}</Button>
            {/* One Edit/Save/Cancel/Reset for the whole page -- covers every plain field across
                Personal Information, Professional Qualifications, and the MFA requirement
                checkbox in one draft/save cycle. Access Profiles and Education/Certifications
                are deliberately excluded (their own instant-action UI, see useUserProfile). */}
            {canPerform("edit") && (
              isEditingProfile ? (
                <>
                  <Button variant="outline-emerald" size="sm" onClick={resetEdit} disabled={!isDraftDirty} className="whitespace-nowrap">{tr("Reset")}</Button>
                  <Button variant="outline-emerald" size="sm" onClick={cancelEdit} className="whitespace-nowrap">{tr("Cancel")}</Button>
                  <Button variant="outline-emerald" size="sm" onClick={saveAll} className="whitespace-nowrap">{tr("Save")}</Button>
                </>
              ) : (
                <Button variant="outline-emerald" size="sm" onClick={startEdit} className="whitespace-nowrap">{tr("Edit Profile")}</Button>
              )
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
              <p className="font-semibold text-rose-700">{tr("Account Locked")}</p>
              <p className="mt-0.5 text-rose-600">
                {tr("Login is locked out after too many failed login attempts.")}
              </p>
            </div>
          </div>
          {canPerform("unlock") && (
            <Button size="sm" variant="outline-emerald" onClick={() => setUnlockModal(true)} className="gap-1.5 whitespace-nowrap flex-shrink-0">
              <LockOpen className="h-3.5 w-3.5" />
              {tr("Unlock Account")}
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
                {user.status === "Suspended" ? tr("Account Suspended") : tr("Employee Terminated")}
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
              {tr("Reinstate")}
            </Button>
          )}
        </div>
      )}

      <ProfileTabLayout
        summary={<UserProfileSummary user={user} avatar={avatarNode} />}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        panelBadge={isEditingProfile ? <Badge color="emerald" size="sm">{tr("Editing")}</Badge> : undefined}
      >
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
              canResetMfa={canPerform("resetMfa")}
              onResetMfa={() => setResetMfaModal(true)}
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
      </ProfileTabLayout>

      <ResetMfaModal
        isOpen={resetMfaModal}
        onClose={() => setResetMfaModal(false)}
        userId={user.id}
        userName={user.fullName}
        onSuccess={() => void loadCapabilities()}
      />

      <ResetPasswordModal
        isOpen={resetPasswordModal}
        onClose={() => setResetPasswordModal(false)}
        userId={user.id}
        userName={user.fullName}
        userTokens={passwordUserTokens(user)}
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
        title={tr("Reinstate User")}
        description={`Are you sure you want to reinstate ${user.fullName}? Their account will be set to Active and they will regain full access.`}
        confirmText={tr("Yes, Reinstate")}
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
