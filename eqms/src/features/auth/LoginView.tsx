import React, { useState, useCallback, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { cn } from "@/components/ui/utils";
import { resetViewportZoom, blurActiveInput } from "@/utils/viewport";
import { BrandLogo, useBranding } from "@/components/branding/BrandLogo";
import { DEFAULT_FOOTER_LEFT } from "@/services/api/branding";
import { LoginSplitLayout, SPLIT_UI, SplitField } from "./components/LoginSplitLayout";
import { captureLoginLogo, startLoginLogoTransition } from "@/components/branding/loginLogoTransition";
import { IconArrowBigUpFilled } from "@tabler/icons-react";
import { AUTH_UI } from "./auth-ui";
import { AuthField, AuthLayout } from "./components";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { getApiErrorMessage } from "@/utils/apiError";
import { ACCOUNT_NOTICE_STORAGE_KEY } from "@/services/api/client";
import { LoginMaintenanceNotice } from "@/features/maintenance/LoginMaintenanceNotice";
import { useLanguage, tr } from "@/i18n";


// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const MIN_PASSWORD_LENGTH = 6;

const ERROR_MESSAGES = {
  USERNAME_REQUIRED: "Username or email is required",
  PASSWORD_REQUIRED: "Password is required",
  PASSWORD_TOO_SHORT: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
  INVALID_CREDENTIALS: "Invalid username or password. Please try again.",
} as const;

// ============================================================================
// TYPES
// ============================================================================

interface LoginViewProps {
  onLogin?: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; error?: string; passwordManagerEligible?: boolean }>;
  onForgotPassword?: () => void;
}

interface FormData {
  username: string;
  password: string;
}

interface FormErrors {
  username: string;
  password: string;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validates login form data
 * @param data - Form data to validate
 * @returns Object containing validation errors (empty strings if no errors)
 */
type LoginMessages = {
  usernameRequired: string;
  passwordRequired: string;
  passwordTooShort: string;
};

const validateLoginForm = (data: FormData, messages: LoginMessages = {
  usernameRequired: ERROR_MESSAGES.USERNAME_REQUIRED,
  passwordRequired: ERROR_MESSAGES.PASSWORD_REQUIRED,
  passwordTooShort: ERROR_MESSAGES.PASSWORD_TOO_SHORT,
}): FormErrors => {
  const errors: FormErrors = {
    username: "",
    password: "",
  };

  if (!data.username.trim()) {
    errors.username = messages.usernameRequired;
  }

  if (!data.password) {
    errors.password = messages.passwordRequired;
  } else if (data.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = messages.passwordTooShort;
  }

  return errors;
};

/**
 * Checks if form has any validation errors
 * @param errors - Form errors object
 * @returns true if form is valid (no errors)
 */
const isFormValid = (errors: FormErrors): boolean => {
  return !errors.username && !errors.password;
};

const getLoginErrorTitle = (errorText: string, translate: (key: string, fallback: string) => string): string => {
  const normalized = errorText.toLowerCase();

  if (normalized.includes("lock")) {
    return translate("auth.accountLocked", "Account Locked");
  }

  if (normalized.includes("inactive") || normalized.includes("administrator")) {
    return translate("auth.accountDisabled", "Account Disabled");
  }

  if (normalized.includes("not found")) {
    return translate("auth.accountNotFound", "Account Not Found");
  }

  if (normalized.includes("password")) {
    return translate("auth.incorrectPassword", "Incorrect Password");
  }

  return translate("auth.loginFailed", "Login Failed");
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * LoginView Component
 * Full-page login interface with splash screen, carousel, and form validation
 * 
 * @component
 * @example
 * ```tsx
 * <LoginView onLogin={(username, password, rememberMe) => {
 *   // Handle successful login
 * }} />
 * ```
 */
export const LoginView: React.FC<LoginViewProps> = ({ onLogin, onForgotPassword }) => {
  const { t } = useLanguage();
  const invalidCredentials = t("auth.invalidCredentials", ERROR_MESSAGES.INVALID_CREDENTIALS);
  // ========================================================================
  // REFS
  // ========================================================================
  const usernameRef = React.useRef<HTMLInputElement>(null);
  const { loginLayout, systemFooterLeft, systemFooterRight } = useBranding();
  const isSplit = loginLayout === "SPLIT";

  // ========================================================================
  // STATE
  // ========================================================================

  const [formData, setFormData] = useState<FormData>({
    username: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({
    username: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSignInAccepted, setIsSignInAccepted] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginErrorModalOpen, setLoginErrorModalOpen] = useState(false);
  const [loginErrorTitle, setLoginErrorTitle] = useState(() => t("auth.loginFailed", "Login Failed"));
  const [loginErrorDescription, setLoginErrorDescription] = useState<string | React.ReactNode>("");
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);

  // Auto-focus on mount
  useEffect(() => {
    sessionStorage.removeItem('pending_mfa_challenge');
    sessionStorage.removeItem('csrf_token');

    // Q7 — a suspended/terminated/deactivated account was just force-redirected here by the
    // 401 interceptor; show why instead of leaving it indistinguishable from a normal expired
    // session. Read-once: cleared immediately so it doesn't resurface on a later visit.
    const rawNotice = sessionStorage.getItem(ACCOUNT_NOTICE_STORAGE_KEY);
    if (rawNotice) {
      sessionStorage.removeItem(ACCOUNT_NOTICE_STORAGE_KEY);
      try {
        const notice = JSON.parse(rawNotice) as { title?: string; message?: string };
        if (notice.message) {
          setLoginErrorTitle(notice.title || t("auth.accessDenied", "Access Denied"));
          setLoginErrorDescription(notice.message);
          setLoginErrorModalOpen(true);
        }
      } catch {
        // Malformed notice — ignore, no banner shown.
      }
    }

    const timer = setTimeout(() => {
      usernameRef.current?.focus();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  const handleInputChange = useCallback(
    (field: keyof Pick<FormData, "username" | "password">, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: "" }));
      setLoginError("");
    },
    []
  );

  const handleTogglePassword = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const handleCapsLockCheck = useCallback((e: React.KeyboardEvent) => {
    const capsLockState = e.getModifierState("CapsLock");
    setIsCapsLockOn(capsLockState);
  }, []);

  const handleForgotPasswordClick = useCallback(() => {
    blurActiveInput();
    resetViewportZoom();

    if (onForgotPassword) {
      onForgotPassword();
    }
  }, [onForgotPassword]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError("");

      // Validate form
      const validationErrors = validateLoginForm(formData, {
        usernameRequired: t("auth.usernameRequired", ERROR_MESSAGES.USERNAME_REQUIRED),
        passwordRequired: t("auth.passwordRequired", ERROR_MESSAGES.PASSWORD_REQUIRED),
        passwordTooShort: t("auth.passwordTooShort", ERROR_MESSAGES.PASSWORD_TOO_SHORT),
      });
      setErrors(validationErrors);

      if (!isFormValid(validationErrors)) {
        return;
      }

      setIsLoading(true);

      if (!onLogin) {
        setIsLoading(false);
        setLoginError(invalidCredentials);
        return;
      }

      try {
        const logo = captureLoginLogo();
        const result = await onLogin(formData.username, formData.password);
        setIsLoading(false);

        if (result.success) {
          // In a SPA, remove the password form before the route transition so Chrome can
          // recognize a confirmed sign-in and offer to save the credential. MFA challenges
          // are intentionally excluded because the sign-in is not complete yet.
          if (result.passwordManagerEligible) {
            startLoginLogoTransition(logo);
            setIsSignInAccepted(true);
          }
          blurActiveInput();
          resetViewportZoom();
          return;
        }

        setLoginError(result.error || invalidCredentials);
        const errorText = result.error || invalidCredentials;
        setLoginErrorTitle(getLoginErrorTitle(errorText, t));
        setLoginErrorDescription(errorText);
        setLoginErrorModalOpen(true);
      } catch (error) {
        setIsLoading(false);
        const errorText = getApiErrorMessage(error, invalidCredentials);
        setLoginError(errorText);
        setLoginErrorTitle(getLoginErrorTitle(errorText, t));
        setLoginErrorDescription(errorText);
        setLoginErrorModalOpen(true);
      }
    },
    [formData, onLogin, invalidCredentials, t]
  );

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <>
      <AlertModal
        isOpen={loginErrorModalOpen}
        onClose={() => setLoginErrorModalOpen(false)}
        type="error"
        title={loginErrorTitle}
        description={loginErrorDescription || invalidCredentials}
        confirmText={t("shell.close", "Close")}
      />

      {isLoading && <FullPageLoading text={t("auth.signingIn", "Signing in...")} />}
      {isSplit ? (
        <LoginSplitLayout
          logo={<div data-login-logo><BrandLogo className="h-8 w-auto object-contain sm:h-9" /></div>}
          footerLeft={(systemFooterLeft ?? DEFAULT_FOOTER_LEFT).replace("{year}", String(new Date().getFullYear()))}
          footerRight={systemFooterRight ?? ""}
          headline={t("auth.splitHeadline", "Keep your quality processes under control.")}
          tagline={t("auth.splitTagline", "Sign in to access your eQMS and manage your quality.")}
        >
          <h1 className={SPLIT_UI.title}>{t("auth.welcomeBack", "Welcome Back")}</h1>
          <p className={SPLIT_UI.subtitle}>{t("auth.splitSubtitle", "Enter your credentials to access your account.")}</p>

          {!isSignInAccepted && <div className="mt-6"><LoginMaintenanceNotice /></div>}

          {isSignInAccepted ? (
            <div className="mt-10 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">
              {t("auth.success", "Sign-in successful. Opening your workspace…")}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-10" noValidate autoComplete="on">
              <div className="space-y-6">
                <SplitField htmlFor="username" label={t("auth.emailOrUsername", "Email or Username")} error={errors.username}>
                  <input
                    id="username"
                    ref={usernameRef}
                    name="username"
                    type="text"
                    autoComplete="username"
                    value={formData.username}
                    onChange={(e) => handleInputChange("username", e.target.value)}
                    className={cn(SPLIT_UI.input, errors.username && SPLIT_UI.inputError)}
                    placeholder={t("auth.emailPlaceholder", "Enter your email or username")}
                    disabled={isLoading}
                    aria-invalid={!!errors.username}
                    aria-describedby={errors.username ? "username-error" : undefined}
                  />
                </SplitField>

                <SplitField htmlFor="current-password" label={t("auth.password", "Password")} error={errors.password}>
                  <div className="relative">
                    <input
                      id="current-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={formData.password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
                      className={cn(SPLIT_UI.input, "pr-12", errors.password && SPLIT_UI.inputError)}
                      placeholder={t("auth.passwordPlaceholder", "Enter your password")}
                      disabled={isLoading}
                      onKeyUp={handleCapsLockCheck}
                      onKeyDown={handleCapsLockCheck}
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? "current-password-error" : undefined}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center">
                      {isCapsLockOn && (
                        <div className="mr-1 rounded-md border border-amber-200 bg-amber-50 p-1" title={t("auth.capsLock", "Caps Lock is ON")}>
                          <IconArrowBigUpFilled className="h-4 w-4 text-amber-600" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleTogglePassword}
                        className={cn(SPLIT_UI.eye, "static my-0")}
                        disabled={isLoading}
                        aria-label={showPassword ? t("auth.hidePassword", "Hide password") : t("auth.showPassword", "Show password")}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                      </button>
                    </div>
                  </div>
                </SplitField>
              </div>

              <div className="mt-3 flex justify-end">
                <button type="button" onClick={handleForgotPasswordClick} className={cn(SPLIT_UI.link, "flex min-h-8 items-center")} disabled={isLoading} aria-label={t("auth.forgotPasswordAria", "Forgot password")}>
                  {t("auth.forgotPassword", "Forgot Your Password?")}
                </button>
              </div>

              <Button type="submit" size="default" className={SPLIT_UI.button} disabled={isLoading} aria-busy={isLoading}>
                {t("auth.logIn", "Log In")}
              </Button>
            </form>
          )}
        </LoginSplitLayout>
      ) : (
      <AuthLayout
        left={
          <div className={AUTH_UI.formColumn}>
            <div className="mb-6 flex items-center gap-3 text-slate-900 sm:mb-10 lg:mb-12">
              <div data-login-logo><BrandLogo className="h-8 w-auto object-contain sm:h-9" /></div>
            </div>

            <div className={AUTH_UI.headerArea}>
              <div className={AUTH_UI.headingBlock}>
                <h1 className={AUTH_UI.pageTitle}>{t("auth.signInTitle", "Sign In To Your Account")}</h1>
                <p className={AUTH_UI.description}>
                  {t("auth.signInSubtitle", "Sign in with your account to access and manage your quality processes efficiently.")}
                </p>
              </div>
            </div>

            {!isSignInAccepted && <LoginMaintenanceNotice />}

            {/* Keep semantic credential fields so the browser password manager can offer to
                save/update credentials only after the existing login request succeeds. */}
            {isSignInAccepted ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">
                {t("auth.success", "Sign-in successful. Opening your workspace…")}
              </div>
            ) : (
            <form onSubmit={handleSubmit} className={AUTH_UI.formStack} noValidate autoComplete="on">
              <AuthField htmlFor="username" label={t("auth.emailOrUsername", "Email or Username")} error={errors.username}>
                  <input
                    id="username"
                    ref={usernameRef}
                    name="username"
                    type="text"
                    autoComplete="username"
                    value={formData.username}
                    onChange={(e) => handleInputChange("username", e.target.value)}
                    className={cn(
                      AUTH_UI.inputBase,
                      AUTH_UI.inputFocus,
                      errors.username ? AUTH_UI.inputError : AUTH_UI.inputDefault
                    )}
                    placeholder={t("auth.emailPlaceholder", "Enter your email or username")}
                    disabled={isLoading}
                    aria-invalid={!!errors.username}
                    aria-describedby={errors.username ? "username-error" : undefined}
                  />
              </AuthField>

              <AuthField htmlFor="current-password" label={t("auth.password", "Password")} error={errors.password}>
                <div className="relative">
                  <input
                    id="current-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    className={cn(
                      AUTH_UI.inputBase,
                      "pr-12 sm:pr-12",
                      AUTH_UI.inputFocus,
                      errors.password ? AUTH_UI.inputError : AUTH_UI.inputDefault
                    )}
                    placeholder={t("auth.passwordPlaceholder", "Enter your password")}
                    disabled={isLoading}
                    onKeyUp={handleCapsLockCheck}
                    onKeyDown={handleCapsLockCheck}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "current-password-error" : undefined}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center sm:pr-1.5">
                    {isCapsLockOn && (
                      <div className="mr-2 rounded-md border border-emerald-100 bg-emerald-50 p-1" title={t("auth.capsLock", "Caps Lock is ON")}>
                        <IconArrowBigUpFilled className="h-4 w-4 text-emerald-700" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleTogglePassword}
                      className={AUTH_UI.eyeButton}
                      disabled={isLoading}
                      aria-label={showPassword ? t("auth.hidePassword", "Hide password") : t("auth.showPassword", "Show password")}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              </AuthField>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleForgotPasswordClick}
                  className="flex min-h-11 items-center text-sm font-medium text-emerald-700 transition-colors hover:text-emerald-800 focus:outline-none"
                  disabled={isLoading}
                  aria-label={t("auth.forgotPasswordAria", "Forgot password")}
                >
                  {t("auth.forgotPassword", "Forgot password?")}
                </button>
              </div>

              <Button
                type="submit"
                size="default"
                className={AUTH_UI.submitButton}
                disabled={isLoading}
                aria-busy={isLoading}
              >
                <span className="tracking-wide">{t("auth.signIn", "Sign In")}</span>
              </Button>
            </form>
            )}

            <div className="relative my-4 sm:my-7" aria-hidden="true">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-[11px]">
                <span className="bg-white px-3 font-semibold uppercase tracking-[0.18em] text-slate-400"></span>
              </div>
            </div>

            <div className="text-center">
              <p className="text-xs text-slate-500 sm:text-sm">{t("auth.developedBy", "Product is developed by")} {tr("Nguyen The Hoang")}</p>
            </div>
          </div>
        }
      />
      )}
    </>
  );
};
