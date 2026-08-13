import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button/Button";
import { ButtonLoading } from "@/components/ui/loading/Loading";
import { cn } from "@/components/ui/utils";
import { resetViewportZoom, blurActiveInput } from "@/utils/viewport";
import { isValidEmail } from "@/utils/validation";
import { BrandLogo } from "@/components/branding/BrandLogo";
import { AUTH_UI } from "./auth-ui";
import { AuthBackLink, AuthField, AuthLayout, AuthTopBackButton } from "./components";
import { getApiErrorMessage } from "@/utils/apiError";
import { useTranslation } from "@/i18n";

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

interface ForgotPasswordViewProps {
  onBackToLogin?: () => void;
  onRequestSubmit?: (identifier: string, reason: string) => Promise<void> | void;
}

interface FormData {
  identifier: string;
  reason: string;
}

interface FormErrors {
  identifier: string;
  reason: string;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validates forgot password form data
 * @param data - Form data to validate
 * @returns Object containing validation errors (empty strings if no errors)
 */
const validateForm = (data: FormData, t: (key: string) => string): FormErrors => {
  const errors: FormErrors = {
    identifier: "",
    reason: "",
  };

  if (!data.identifier.trim()) {
    errors.identifier = t('authExt.forgot.identifierRequired');
  } else if (data.identifier.includes("@") && !isValidEmail(data.identifier)) {
    errors.identifier = t('authExt.forgot.invalidEmail');
  }

  if (!data.reason.trim()) {
    errors.reason = t('authExt.forgot.reasonRequired');
  }

  return errors;
};

/**
 * Checks if form has any validation errors
 * @param errors - Form errors object
 * @returns true if form is valid (no errors)
 */
const isFormValid = (errors: FormErrors): boolean => {
  return !errors.identifier && !errors.reason;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * ForgotPasswordView Component
 * Password reset request form - initiates self-service reset via email link
 * 
 * @component
 * @example
 * ```tsx
 * <ForgotPasswordView 
 *   onBackToLogin={() => navigate('/login')}
 *   onRequestSubmit={(identifier, reason) => console.log('Request sent')}
 * />
 * ```
 */
export const ForgotPasswordView: React.FC<ForgotPasswordViewProps> = ({
  onBackToLogin,
  onRequestSubmit
}) => {
  const { t } = useTranslation();
  // ========================================================================
  // STATE
  // ========================================================================

  const [formData, setFormData] = useState<FormData>({
    identifier: "",
    reason: "",
  });
  const [errors, setErrors] = useState<FormErrors>({
    identifier: "",
    reason: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

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

  const handleBackToLogin = useCallback(() => {
    blurActiveInput();
    resetViewportZoom();

    if (onBackToLogin) {
      onBackToLogin();
    }
  }, [onBackToLogin]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError("");

      // Validate form
      const validationErrors = validateForm(formData, t);
      setErrors(validationErrors);

      if (!isFormValid(validationErrors)) {
        return;
      }

      setIsLoading(true);

      try {
        if (onRequestSubmit) {
          await onRequestSubmit(formData.identifier, formData.reason);
        }
        setIsSuccess(true);
        blurActiveInput();
        resetViewportZoom();
      } catch (error) {
        setSubmitError(getApiErrorMessage(error, t('authExt.forgot.submitUnavailable')));
      } finally {
        setIsLoading(false);
      }
    },
    [formData, onRequestSubmit, t]
  );

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <AuthLayout
      left={
        <div className={AUTH_UI.formColumn}>
          <AuthTopBackButton onClick={handleBackToLogin} label={t('authExt.shared.backToLogin')} disabled={isLoading} />
          <div className="mb-6 flex items-center gap-3 text-slate-900 sm:mb-10 lg:mb-12">
            <BrandLogo className="h-8 w-auto object-contain sm:h-9" />
          </div>

          {isSuccess ? (
            <div className="space-y-6 sm:space-y-5" role="status" aria-live="polite">
              <div className={AUTH_UI.headerArea}>
                <div className={AUTH_UI.headingBlock}>
                  <h1 className={AUTH_UI.pageTitle}>{t('authExt.forgot.requestSent')}</h1>
                  <p className={AUTH_UI.description}>{t('authExt.forgot.successMessage')}</p>
                </div>
              </div>

              <div className="space-y-3 pt-2 sm:space-y-3 sm:pt-2">
                <Button
                  onClick={handleBackToLogin}
                  size="default"
                  className={cn(AUTH_UI.submitButton, "sm:h-12")}
                >
                  {t('authExt.shared.backToLogin')}
                </Button>

                <p className="text-[11px] text-slate-500 sm:text-xs">{t('authExt.forgot.backHint')}</p>
              </div>
            </div>
          ) : (
            <>
              <div className={AUTH_UI.headerArea}>
                <div className={AUTH_UI.headingBlock}>
                  <h1 className={AUTH_UI.pageTitle}>{t('authExt.forgot.heading')}</h1>
                  <p className={AUTH_UI.description}>
                    {t('authExt.forgot.description')}
                  </p>
                </div>
              </div>

              {submitError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
                  {submitError}
                </div>
              )}

              <form onSubmit={handleSubmit} className={AUTH_UI.formStack} noValidate>

              <AuthField htmlFor="identifier" label={t('authExt.shared.emailOrUsername')} required error={errors.identifier}>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="email"
                  value={formData.identifier}
                  onChange={(e) => handleInputChange("identifier", e.target.value)}
                  className={cn(
                    AUTH_UI.inputBase,
                    AUTH_UI.inputFocus,
                    errors.identifier ? AUTH_UI.inputError : AUTH_UI.inputDefault
                  )}
                  placeholder={t('authExt.shared.emailOrUsernamePlaceholder')}
                  disabled={isLoading}
                  aria-invalid={!!errors.identifier}
                  aria-describedby={errors.identifier ? "identifier-error" : undefined}
                />
              </AuthField>

              <AuthField htmlFor="reason" label={t('authExt.forgot.reasonLabel')} required error={errors.reason}>
                <textarea
                  id="reason"
                  name="reason"
                  rows={4}
                  value={formData.reason}
                  onChange={(e) => handleInputChange("reason", e.target.value)}
                  className={cn(
                    "w-full resize-none rounded-xl border bg-white px-4 py-3 text-sm text-slate-700 transition-all sm:px-4 sm:py-3 sm:text-sm",
                    AUTH_UI.inputFocus,
                    errors.reason ? AUTH_UI.inputError : AUTH_UI.inputDefault
                  )}
                  placeholder={t('authExt.forgot.reasonPlaceholder')}
                  disabled={isLoading}
                  aria-invalid={!!errors.reason}
                  aria-describedby={errors.reason ? "reason-error" : undefined}
                />
              </AuthField>

              <Button
                type="submit"
                size="default"
                className={AUTH_UI.submitButton}
                disabled={isLoading}
                aria-busy={isLoading}
              >
                {isLoading ? <ButtonLoading text={t('authExt.forgot.submitting')} light /> : t('authExt.forgot.submit')}
              </Button>

              <div className="hidden sm:block">
                <AuthBackLink onClick={handleBackToLogin} label={t('authExt.shared.backToLogin')} disabled={isLoading} />
              </div>
            </form>
          </>
        )}
        </div>
      }
    />
  );
};
