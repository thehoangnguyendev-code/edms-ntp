import React, { useState, useCallback } from "react";
import { Eye, EyeOff, ShieldCheck, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button/Button";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { cn } from "@/components/ui/utils";
import { resetViewportZoom, blurActiveInput } from "@/utils/viewport";
import { BrandLogo } from "@/components/branding/BrandLogo";
import { AUTH_UI } from "./auth-ui";
import { AuthField, AuthLayout, AuthBackLink, AuthTopBackButton } from "./components";
import { IconArrowBigUpFilled } from "@tabler/icons-react";
import { usePasswordPolicy } from "./usePasswordPolicy";
import { useTranslation } from "@/i18n";

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

interface ForcePasswordChangeViewProps {
  onSubmit?: (data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onBackToLogin?: () => void;
  username?: string;
  passwordChangeReason?: 'FIRST_LOGIN' | 'ADMIN_RESET' | 'PASSWORD_EXPIRED' | 'SECURITY_INCIDENT' | 'LEGACY_REQUIRED' | null;
}

interface FormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface FormErrors {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

const checkPasswordStrength = (password: string, policy: ReturnType<typeof usePasswordPolicy>) => {
  const hasMinLength = password.length >= policy.passwordMinLength;
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);

  let score = 0;
  if (hasMinLength) score++;
  if (!policy.requireSpecialChars || hasSpecial) score++;
  if (!policy.requireNumbers || hasNumber) score++;
  if (!policy.requireUppercase || hasUpper) score++;
  if (!policy.requireLowercase || hasLower) score++;

  return {
    score, // 0-4
    hasMinLength,
    hasSpecial,
    hasNumber,
    hasUpper,
    hasLower,
    isValid: hasMinLength && (!policy.requireSpecialChars || hasSpecial) && (!policy.requireNumbers || hasNumber) && (!policy.requireUppercase || hasUpper) && (!policy.requireLowercase || hasLower)
  };
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ForcePasswordChangeView: React.FC<ForcePasswordChangeViewProps> = ({
  onSubmit,
  onBackToLogin,
  username = "User",
  passwordChangeReason,
}) => {
  const { t } = useTranslation();
  const passwordPolicy = usePasswordPolicy();
  // ========================================================================
  // STATE
  // ========================================================================

  const [formData, setFormData] = useState<FormData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [errors, setErrors] = useState<FormErrors>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [focusedField, setFocusedField] = useState<"new" | "confirm" | null>(null);

  const strength = checkPasswordStrength(formData.newPassword, passwordPolicy);
  const passwordChangeContext = {
    FIRST_LOGIN: {
      title: t('authExt.forcePassword.firstLoginTitle'),
      description: <>{t('authExt.forcePassword.firstLoginDescription')} <span className="font-semibold text-slate-700">{username}</span>.</>,
    },
    ADMIN_RESET: {
      title: t('authExt.forcePassword.adminResetTitle'),
      description: t('authExt.forcePassword.adminResetDescription'),
    },
    PASSWORD_EXPIRED: {
      title: t('authExt.forcePassword.updateRequiredTitle'),
      description: t('authExt.forcePassword.expiredDescription'),
    },
    SECURITY_INCIDENT: {
      title: t('authExt.forcePassword.secureAccountTitle'),
      description: t('authExt.forcePassword.securityIncidentDescription'),
    },
    LEGACY_REQUIRED: {
      title: t('authExt.forcePassword.updateRequiredTitle'),
      description: t('authExt.forcePassword.legacyDescription'),
    },
  }[passwordChangeReason || 'LEGACY_REQUIRED'];

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  const handleInputChange = useCallback(
    (field: keyof FormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: "" }));
      setSubmitError("");
    },
    []
  );

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };
  
  const handleCapsLockCheck = useCallback((e: React.KeyboardEvent) => {
    const capsLockState = e.getModifierState("CapsLock");
    setIsCapsLockOn(capsLockState);
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    };

    if (!formData.currentPassword) {
      newErrors.currentPassword = t('authExt.forcePassword.currentPasswordRequired');
    }

    if (!formData.newPassword) {
      newErrors.newPassword = t('authExt.forcePassword.newPasswordRequired');
    } else if (formData.newPassword.length < passwordPolicy.passwordMinLength) {
      newErrors.newPassword = t('authExt.forcePassword.minLength', { count: passwordPolicy.passwordMinLength });
    } else if (!strength.isValid) {
      newErrors.newPassword = t('authExt.forcePassword.policyNotMet');
    }

    if (formData.confirmPassword !== formData.newPassword) {
      newErrors.confirmPassword = t('authExt.forcePassword.passwordsDoNotMatch');
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error !== "");
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError("");

      if (!validateForm()) return;

      setIsLoading(true);

      if (!onSubmit) {
        setIsLoading(false);
        setSubmitError(t('authExt.forcePassword.handlerUnavailable'));
        return;
      }

      const result = await onSubmit({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
        confirmPassword: formData.confirmPassword,
      });

      setIsLoading(false);

      if (result.success) {
        blurActiveInput();
        resetViewportZoom();
        return;
      }

      setSubmitError(result.error || t('authExt.forcePassword.updateFailed'));
    },
    [formData, onSubmit, strength, t]
  );

  // ========================================================================
  // RENDER HELPERS
  // ========================================================================

  const PasswordIcon = ({ field }: { field: keyof typeof showPasswords }) => (
    <button
      type="button"
      onClick={() => togglePasswordVisibility(field)}
      className="flex items-center p-1 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none"
      aria-label={showPasswords[field] ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
      tabIndex={-1}
    >
      {showPasswords[field] ? (
        <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" />
      ) : (
        <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
      )}
    </button>
  );

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <>
      {isLoading && <FullPageLoading text={t('authExt.forcePassword.updating')} />}
      <AuthLayout
        left={
          <div className={AUTH_UI.formColumn}>
            <AuthTopBackButton onClick={onBackToLogin} label={t('authExt.shared.backToLogin')} disabled={isLoading} />
            <div className="mb-6 flex items-center gap-3 text-slate-900 sm:mb-10 lg:mb-12">
              <BrandLogo className="h-8 w-auto object-contain sm:h-9" />
            </div>

            <div className={AUTH_UI.headerArea}>
              <div className={AUTH_UI.headingBlock}>
              <h1 className={AUTH_UI.pageTitle}>{passwordChangeContext.title}</h1>
              <p className={AUTH_UI.description}>
                  {passwordChangeContext.description}
              </p>
              </div>
            </div>

            {submitError && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
                <div className="flex gap-3">
                  <ShieldAlert className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-sm font-semibold text-red-900">{t('authExt.forcePassword.securityUpdateFailed')}</p>
                    <p className="mt-0.5 text-sm text-red-700">{submitError}</p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className={AUTH_UI.formStack} noValidate>

              <AuthField htmlFor="currentPassword" label={t('authExt.forcePassword.currentPassword')} required={true} error={errors.currentPassword}>
                <div className="relative">
                  <input
                    id="currentPassword"
                    type={showPasswords.current ? "text" : "password"}
                    value={formData.currentPassword}
                    onChange={(e) => handleInputChange("currentPassword", e.target.value)}
                    className={cn(AUTH_UI.inputBase, "pr-12", AUTH_UI.inputFocus, errors.currentPassword ? AUTH_UI.inputError : AUTH_UI.inputDefault)}
                    disabled={isLoading}
                    placeholder={t('authExt.forcePassword.currentPasswordPlaceholder')}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <PasswordIcon field="current" />
                  </div>
                </div>
              </AuthField>

              <AuthField
                htmlFor="newPassword"
                label={t('authExt.reset.newPassword')}
                required={true}
                error={errors.newPassword}
              >
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showPasswords.new ? "text" : "password"}
                    value={formData.newPassword}
                    onChange={(e) => handleInputChange("newPassword", e.target.value)}
                    className={cn(AUTH_UI.inputBase, "pr-12", AUTH_UI.inputFocus, errors.newPassword ? AUTH_UI.inputError : AUTH_UI.inputDefault)}
                    disabled={isLoading}
                    onKeyUp={handleCapsLockCheck}
                    onKeyDown={handleCapsLockCheck}
                    onFocus={() => setFocusedField("new")}
                    onBlur={() => setFocusedField(null)}
                    placeholder={t('authExt.reset.newPasswordPlaceholder')}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    {isCapsLockOn && focusedField === "new" && (
                      <div className="mr-2 rounded-md border border-emerald-100 bg-emerald-50 p-1" title={t('authExt.forcePassword.capsLockOn')}>
                        <IconArrowBigUpFilled className="h-4 w-4 text-emerald-700" />
                      </div>
                    )}
                    <PasswordIcon field="new" />
                  </div>
                </div>

                {/* Password Strength Indicator */}
                <div className="mt-3 space-y-2.5">
                  <div className="flex h-1.5 w-full gap-1.5 overflow-hidden rounded-full bg-slate-100">
                    {[...Array(4)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={false}
                        animate={{
                          backgroundColor: i < strength.score
                            ? strength.score <= 1 ? "#ef4444" // red-500
                              : strength.score <= 2 ? "#fb923c" // orange-400
                                : strength.score <= 3 ? "#facc15" // yellow-400
                                  : "#10b981" // emerald-500
                            : "#f1f5f9", // slate-100
                          scaleX: i < strength.score ? 1 : 0
                        }}
                        transition={{ 
                          type: "spring", 
                          stiffness: 300, 
                          damping: 25,
                          delay: i * 0.05 
                        }}
                        className="h-full flex-1 origin-left"
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-0.5">
                    <StrengthCheck label={t('authExt.forcePassword.minLength', { count: passwordPolicy.passwordMinLength })} checked={strength.hasMinLength} />
                    {passwordPolicy.requireUppercase && <StrengthCheck label={t('authExt.reset.uppercase')} checked={strength.hasUpper} />}
                    {passwordPolicy.requireLowercase && <StrengthCheck label={t('authExt.reset.lowercase')} checked={strength.hasLower} />}
                    {passwordPolicy.requireNumbers && <StrengthCheck label={t('authExt.reset.number')} checked={strength.hasNumber} />}
                    {passwordPolicy.requireSpecialChars && <StrengthCheck label={t('authExt.reset.specialCharacter')} checked={strength.hasSpecial} />}
                  </div>
                </div>
              </AuthField>

              <AuthField
                htmlFor="confirmPassword"
                label={t('authExt.reset.confirmNewPassword')}
                required={true}
                error={errors.confirmPassword}
              >
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showPasswords.confirm ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    className={cn(AUTH_UI.inputBase, "pr-12", AUTH_UI.inputFocus, errors.confirmPassword ? AUTH_UI.inputError : AUTH_UI.inputDefault)}
                    disabled={isLoading}
                    onKeyUp={handleCapsLockCheck}
                    onKeyDown={handleCapsLockCheck}
                    onFocus={() => setFocusedField("confirm")}
                    onBlur={() => setFocusedField(null)}
                    placeholder={t('authExt.reset.confirmPasswordPlaceholder')}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    {isCapsLockOn && focusedField === "confirm" && (
                      <div className="mr-2 rounded-md border border-emerald-100 bg-emerald-50 p-1" title={t('authExt.forcePassword.capsLockOn')}>
                        <IconArrowBigUpFilled className="h-4 w-4 text-emerald-700" />
                      </div>
                    )}
                    <PasswordIcon field="confirm" />
                  </div>
                </div>
                {formData.confirmPassword && formData.confirmPassword !== formData.newPassword && (
                  <p className="mt-1.5 text-[11px] font-medium text-red-500 animate-in fade-in slide-in-from-top-1 duration-200">
                    {t('authExt.forcePassword.passwordsDoNotMatchYet')}
                  </p>
                )}
              </AuthField>

              <Button
                type="submit"
                className={cn(AUTH_UI.submitButton, "mt-2")}
                disabled={isLoading || !strength.isValid || formData.newPassword !== formData.confirmPassword || !formData.currentPassword}
              >
                {t('authExt.forcePassword.continue')}
              </Button>

              <div className="hidden sm:block">
                <AuthBackLink onClick={onBackToLogin} label={t('authExt.shared.backToLogin')} disabled={isLoading} />
              </div>
            </form>
          </div>
        }
      />
    </>
  );
};

const StrengthCheck = ({ label, checked }: { label: string; checked: boolean }) => (
  <div className="flex items-center gap-2">
    <div className={cn(
      "flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-colors",
      checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white"
    )}>
      {checked && <svg className="h-2 w-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
    </div>
    <span className={cn("text-[11px] font-medium transition-colors sm:text-xs", checked ? "text-slate-900" : "text-slate-400")}>{label}</span>
  </div>
);
