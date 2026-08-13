import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye, EyeOff, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { ButtonLoading, FullPageLoading } from "@/components/ui/loading/Loading";
import { cn } from "@/components/ui/utils";
import { getApiErrorMessage } from "@/utils/apiError";
import { BrandLogo } from "@/components/branding/BrandLogo";
import { AUTH_UI } from "./auth-ui";
import { AuthBackLink, AuthField, AuthLayout, AuthTopBackButton } from "./components";
import { authApi } from "@/services/api";
import { usePasswordPolicy } from "./usePasswordPolicy";
import { useTranslation } from "@/i18n";

interface ResetPasswordViewProps {
  onBackToLogin?: () => void;
}

const checkPasswordStrength = (password: string, policy: ReturnType<typeof usePasswordPolicy>) => {
  const hasMinLength = password.length >= policy.passwordMinLength;
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);

  return {
    hasMinLength,
    hasSpecial,
    hasNumber,
    hasUpper,
    hasLower,
    isValid: hasMinLength
      && (!policy.requireSpecialChars || hasSpecial)
      && (!policy.requireNumbers || hasNumber)
      && (!policy.requireUppercase || hasUpper)
      && (!policy.requireLowercase || hasLower),
  };
};

export const ResetPasswordView: React.FC<ResetPasswordViewProps> = ({ onBackToLogin }) => {
  const { t } = useTranslation();
  const passwordPolicy = usePasswordPolicy();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() || "";

  const [validationLoading, setValidationLoading] = useState(true);
  const [validationError, setValidationError] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    newPassword: false,
    confirmPassword: false,
  });
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;

    const validateToken = async () => {
      if (!token) {
        if (!mounted) return;
        setValidationError(t('authExt.reset.tokenMissing'));
        setValidationLoading(false);
        return;
      }

      try {
        const result = await authApi.validateResetToken(token);
        if (!mounted) return;

        if (!result.valid) {
          setValidationError(t('authExt.reset.linkInvalid'));
        } else {
          setExpiresAt(result.expiresAt);
        }
      } catch (error) {
        if (!mounted) return;
        setValidationError(getApiErrorMessage(error, t('authExt.reset.validationUnavailable')));
      } finally {
        if (mounted) {
          setValidationLoading(false);
        }
      }
    };

    void validateToken();

    return () => {
      mounted = false;
    };
  }, [token, t]);

  const strength = useMemo(() => checkPasswordStrength(formData.newPassword, passwordPolicy), [formData.newPassword, passwordPolicy]);

  const setField = (field: "newPassword" | "confirmPassword", value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
    setSubmitError("");
  };

  const validateForm = () => {
    const nextErrors = {
      newPassword: "",
      confirmPassword: "",
    };

    if (!formData.newPassword) {
      nextErrors.newPassword = t('authExt.reset.newPasswordRequired');
    } else if (!strength.isValid) {
      nextErrors.newPassword = t('authExt.reset.policyNotMet');
    }

    if (!formData.confirmPassword) {
      nextErrors.confirmPassword = t('authExt.reset.confirmRequired');
    } else if (formData.confirmPassword !== formData.newPassword) {
      nextErrors.confirmPassword = t('authExt.reset.passwordsDoNotMatch');
    }

    setErrors(nextErrors);
    return !nextErrors.newPassword && !nextErrors.confirmPassword;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

      try {
        await authApi.resetPassword({
          token,
          newPassword: formData.newPassword,
          confirmPassword: formData.confirmPassword,
        });
        setIsSuccess(true);
      } catch (error) {
        setSubmitError(getApiErrorMessage(error, t('authExt.reset.submitUnavailable')));
      } finally {
        setIsSubmitting(false);
      }
  };

  const renderStrengthCheck = (label: string, passed: boolean) => (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-colors",
          passed ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white"
        )}
      >
        {passed && <ShieldCheck className="h-2.5 w-2.5" />}
      </div>
      <span className={cn("text-[11px] sm:text-xs", passed ? "text-slate-900" : "text-slate-400")}>{label}</span>
    </div>
  );

  if (validationLoading) {
    return <FullPageLoading text={t('authExt.reset.validating')} />;
  }

  return (
    <>
      {isSubmitting && <FullPageLoading text={t('authExt.reset.resetting')} />}
      <AuthLayout
        left={
          <div className={AUTH_UI.formColumn}>
            <AuthTopBackButton onClick={onBackToLogin} label={t('authExt.shared.backToLogin')} disabled={isSubmitting} />
            <div className="mb-6 flex items-center gap-3 text-slate-900 sm:mb-10 lg:mb-12">
              <BrandLogo className="h-8 w-auto object-contain sm:h-9" />
            </div>

            {validationError ? (
              <div className="space-y-6">
                <div className={AUTH_UI.headerArea}>
                  <div className={AUTH_UI.headingBlock}>
                    <h1 className={AUTH_UI.pageTitle}>{t('authExt.reset.linkUnavailable')}</h1>
                    <p className={AUTH_UI.description}>{validationError}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  {t('authExt.reset.newLinkHint')}
                </div>
                <Button onClick={onBackToLogin} className={AUTH_UI.submitButton}>
                  {t('authExt.shared.backToLogin')}
                </Button>
              </div>
            ) : isSuccess ? (
              <div className="space-y-6">
                <div className={AUTH_UI.headerArea}>
                  <div className={AUTH_UI.headingBlock}>
                    <h1 className={AUTH_UI.pageTitle}>{t('authExt.reset.complete')}</h1>
                    <p className={AUTH_UI.description}>
                      {t('authExt.reset.successMessage')}
                    </p>
                  </div>
                </div>
                <Button onClick={onBackToLogin} className={AUTH_UI.submitButton}>
                  {t('authExt.shared.backToLogin')}
                </Button>
              </div>
            ) : (
              <>
                <div className={AUTH_UI.headerArea}>
                  <div className={AUTH_UI.headingBlock}>
                    <h1 className={AUTH_UI.pageTitle}>{t('authExt.reset.heading')}</h1>
                    <p className={AUTH_UI.description}>
                      {t('authExt.reset.description')}
                      {expiresAt ? ` ${t('authExt.reset.expiresAt', { value: expiresAt })}` : ""}
                    </p>
                  </div>
                </div>

                {submitError && (
                  <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
                    <div className="flex gap-3">
                      <ShieldAlert className="h-5 w-5 text-red-600" />
                      <div>
                        <p className="text-sm font-semibold text-red-900">{t('authExt.reset.failed')}</p>
                        <p className="mt-0.5 text-sm text-red-700">{submitError}</p>
                      </div>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className={AUTH_UI.formStack} noValidate>
                  <AuthField htmlFor="newPassword" label={t('authExt.reset.newPassword')} required error={errors.newPassword}>
                    <div className="relative">
                      <input
                        id="newPassword"
                        type={showPasswords.newPassword ? "text" : "password"}
                        value={formData.newPassword}
                        onChange={(e) => setField("newPassword", e.target.value)}
                        className={cn(
                          AUTH_UI.inputBase,
                          "pr-12",
                          AUTH_UI.inputFocus,
                          errors.newPassword ? AUTH_UI.inputError : AUTH_UI.inputDefault
                        )}
                        disabled={isSubmitting}
                        placeholder={t('authExt.reset.newPasswordPlaceholder')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords((prev) => ({ ...prev, newPassword: !prev.newPassword }))}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                      >
                        {showPasswords.newPassword ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
                      </button>
                    </div>
                  </AuthField>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-0.5">
                    {renderStrengthCheck(t('authExt.reset.minLength', { count: passwordPolicy.passwordMinLength }), strength.hasMinLength)}
                    {passwordPolicy.requireUppercase && renderStrengthCheck(t('authExt.reset.uppercase'), strength.hasUpper)}
                    {passwordPolicy.requireLowercase && renderStrengthCheck(t('authExt.reset.lowercase'), strength.hasLower)}
                    {passwordPolicy.requireNumbers && renderStrengthCheck(t('authExt.reset.number'), strength.hasNumber)}
                    {passwordPolicy.requireSpecialChars && renderStrengthCheck(t('authExt.reset.specialCharacter'), strength.hasSpecial)}
                  </div>

                  <AuthField htmlFor="confirmPassword" label={t('authExt.reset.confirmNewPassword')} required error={errors.confirmPassword}>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showPasswords.confirmPassword ? "text" : "password"}
                        value={formData.confirmPassword}
                        onChange={(e) => setField("confirmPassword", e.target.value)}
                        className={cn(
                          AUTH_UI.inputBase,
                          "pr-12",
                          AUTH_UI.inputFocus,
                          errors.confirmPassword ? AUTH_UI.inputError : AUTH_UI.inputDefault
                        )}
                        disabled={isSubmitting}
                        placeholder={t('authExt.reset.confirmPasswordPlaceholder')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords((prev) => ({ ...prev, confirmPassword: !prev.confirmPassword }))}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                      >
                        {showPasswords.confirmPassword ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
                      </button>
                    </div>
                  </AuthField>

                  <Button
                    type="submit"
                    className={AUTH_UI.submitButton}
                    disabled={isSubmitting || !strength.isValid || formData.confirmPassword !== formData.newPassword}
                  >
                    {isSubmitting ? <ButtonLoading text={t('authExt.reset.updating')} light /> : t('authExt.reset.submit')}
                  </Button>

                  <div className="hidden sm:block">
                    <AuthBackLink onClick={onBackToLogin} label={t('authExt.shared.backToLogin')} disabled={isSubmitting} />
                  </div>
                </form>
              </>
            )}
          </div>
        }
      />
    </>
  );
};
