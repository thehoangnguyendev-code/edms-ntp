import React, { useState, useCallback, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { cn } from "@/components/ui/utils";
import { resetViewportZoom, blurActiveInput } from "@/utils/viewport";
import { BrandLogo } from "@/components/branding/BrandLogo";
import { IconArrowBigUpFilled } from "@tabler/icons-react";
import { AUTH_UI } from "./auth-ui";
import { AuthField, AuthLayout } from "./components";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { getApiErrorMessage } from "@/utils/apiError";
import { ACCOUNT_NOTICE_STORAGE_KEY } from "@/services/api/client";


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
  ) => Promise<{ success: boolean; error?: string }>;
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
const validateLoginForm = (data: FormData): FormErrors => {
  const errors: FormErrors = {
    username: "",
    password: "",
  };

  if (!data.username.trim()) {
    errors.username = ERROR_MESSAGES.USERNAME_REQUIRED;
  }

  if (!data.password) {
    errors.password = ERROR_MESSAGES.PASSWORD_REQUIRED;
  } else if (data.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = ERROR_MESSAGES.PASSWORD_TOO_SHORT;
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

const getLoginErrorTitle = (errorText: string): string => {
  const normalized = errorText.toLowerCase();

  if (normalized.includes("lock")) {
    return "Account Locked";
  }

  if (normalized.includes("inactive") || normalized.includes("administrator")) {
    return "Account Disabled";
  }

  if (normalized.includes("not found")) {
    return "Account Not Found";
  }

  if (normalized.includes("password")) {
    return "Incorrect Password";
  }

  return "Login Failed";
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
  // ========================================================================
  // REFS
  // ========================================================================
  const usernameRef = React.useRef<HTMLInputElement>(null);

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
  const [loginError, setLoginError] = useState("");
  const [loginErrorModalOpen, setLoginErrorModalOpen] = useState(false);
  const [loginErrorTitle, setLoginErrorTitle] = useState("Login Failed");
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
          setLoginErrorTitle(notice.title || "Access Denied");
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
      const validationErrors = validateLoginForm(formData);
      setErrors(validationErrors);

      if (!isFormValid(validationErrors)) {
        return;
      }

      setIsLoading(true);

      if (!onLogin) {
        setIsLoading(false);
        setLoginError(ERROR_MESSAGES.INVALID_CREDENTIALS);
        return;
      }

      try {
        const result = await onLogin(formData.username, formData.password);
        setIsLoading(false);

        if (result.success) {
          // Login stage completed (direct auth or moved to 2FA), normalize viewport before navigation.
          blurActiveInput();
          resetViewportZoom();
          return;
        }

        setLoginError(result.error || ERROR_MESSAGES.INVALID_CREDENTIALS);
        const errorText = result.error || ERROR_MESSAGES.INVALID_CREDENTIALS;
        setLoginErrorTitle(getLoginErrorTitle(errorText));
        setLoginErrorDescription(errorText);
        setLoginErrorModalOpen(true);
      } catch (error) {
        setIsLoading(false);
        const errorText = getApiErrorMessage(error, ERROR_MESSAGES.INVALID_CREDENTIALS);
        setLoginError(errorText);
        setLoginErrorTitle(getLoginErrorTitle(errorText));
        setLoginErrorDescription(errorText);
        setLoginErrorModalOpen(true);
      }
    },
    [formData, onLogin]
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
        description={loginErrorDescription || ERROR_MESSAGES.INVALID_CREDENTIALS}
        confirmText="Close"
      />

      {isLoading && <FullPageLoading text="Signing in..." />}
      <AuthLayout
        left={
          <div className={AUTH_UI.formColumn}>
            <div className="mb-6 flex items-center gap-3 text-slate-900 sm:mb-10 lg:mb-12">
              <BrandLogo className="h-8 w-auto object-contain sm:h-9" />
            </div>

            <div className={AUTH_UI.headerArea}>
              <div className={AUTH_UI.headingBlock}>
                <h1 className={AUTH_UI.pageTitle}>Sign In To Your Account</h1>
                <p className={AUTH_UI.description}>
                  Sign in with your account to access and manage your quality processes efficiently.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className={AUTH_UI.formStack} noValidate autoComplete="off">
              <AuthField htmlFor="username" label="Email or Username" error={errors.username}>
                  <input
                    id="username"
                    ref={usernameRef}
                    name="username"
                    type="text"
                    autoComplete="off"
                    value={formData.username}
                    onChange={(e) => handleInputChange("username", e.target.value)}
                    className={cn(
                      AUTH_UI.inputBase,
                      AUTH_UI.inputFocus,
                      errors.username ? AUTH_UI.inputError : AUTH_UI.inputDefault
                    )}
                    placeholder="Enter your email or username"
                    disabled={isLoading}
                    aria-invalid={!!errors.username}
                    aria-describedby={errors.username ? "username-error" : undefined}
                  />
              </AuthField>

              <AuthField htmlFor="password" label="Password" error={errors.password}>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    className={cn(
                      AUTH_UI.inputBase,
                      "pr-12 sm:pr-12",
                      AUTH_UI.inputFocus,
                      errors.password ? AUTH_UI.inputError : AUTH_UI.inputDefault
                    )}
                    placeholder="Enter your password"
                    disabled={isLoading}
                    onKeyUp={handleCapsLockCheck}
                    onKeyDown={handleCapsLockCheck}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "password-error" : undefined}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:pr-3">
                    {isCapsLockOn && (
                      <div className="mr-2 rounded-md border border-emerald-100 bg-emerald-50 p-1" title="Caps Lock is ON">
                        <IconArrowBigUpFilled className="h-4 w-4 text-emerald-700" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleTogglePassword}
                      className="flex items-center p-1 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus:text-slate-700"
                      disabled={isLoading}
                      aria-label={showPassword ? "Hide password" : "Show password"}
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

              <div className="flex items-center justify-end pt-0.5 sm:pt-1">
                <button
                  type="button"
                  onClick={handleForgotPasswordClick}
                  className="text-xs font-medium text-emerald-700 transition-colors hover:text-emerald-800 focus:outline-none sm:text-sm"
                  disabled={isLoading}
                  aria-label="Forgot password"
                >
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                size="default"
                className={AUTH_UI.submitButton}
                disabled={isLoading}
                aria-busy={isLoading}
              >
                <span className="tracking-wide">Sign In</span>
              </Button>
            </form>

            <div className="relative my-4 sm:my-7" aria-hidden="true">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-[11px]">
                <span className="bg-white px-3 font-semibold uppercase tracking-[0.18em] text-slate-400"></span>
              </div>
            </div>

            <div className="text-center">
              <p className="text-[11px] text-slate-500 sm:text-sm">Product is developed by Nguyen The Hoang - Ngoc Thien Pharma</p>
            </div>
          </div>
        }
      />
    </>
  );
};
