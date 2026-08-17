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

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const ERROR_MESSAGES = {
  NEW_PASSWORD_REQUIRED: "New password is required",
  PASSWORDS_MUST_MATCH: "Passwords do not match",
  STRENGTH_REQUIREMENTS: "Password does not meet security requirements",
} as const;

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

  // The strength bar's segment count and fill level must both track the *currently active*
  // policy (minLength is always required; the other 4 are admin toggles from Security
  // Configuration). Only checks the admin has actually turned on go into the bar -- a disabled
  // requirement used to silently count as an automatic point even for an empty password (e.g.
  // with all 4 optional requirements off, an empty password scored 4/4 and rendered a "fully
  // strong" bar), which is misleading regardless of which requirements are enabled.
  const activeChecks = [
    hasMinLength,
    ...(policy.requireUppercase ? [hasUpper] : []),
    ...(policy.requireLowercase ? [hasLower] : []),
    ...(policy.requireNumbers ? [hasNumber] : []),
    ...(policy.requireSpecialChars ? [hasSpecial] : []),
  ];
  const score = activeChecks.filter(Boolean).length;
  const maxScore = activeChecks.length;

  return {
    score,
    maxScore,
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
      title: "Create Your Password",
      description: <>Hi <span className="font-semibold text-slate-700">{username}</span>, replace the temporary password issued for your new account.</>,
    },
    ADMIN_RESET: {
      title: "Reset Your Password",
      description: "An administrator reset your password. Create a new personal password to continue.",
    },
    PASSWORD_EXPIRED: {
      title: "Password Update Required",
      description: "Your password has expired under the organization’s security policy. Create a new password to continue.",
    },
    SECURITY_INCIDENT: {
      title: "Secure Your Account",
      description: "A security event requires you to replace your password before continuing.",
    },
    LEGACY_REQUIRED: {
      title: "Password Update Required",
      description: "Create a new password to continue securely.",
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
      newErrors.currentPassword = "Current password is required";
    }

    if (!formData.newPassword) {
      newErrors.newPassword = ERROR_MESSAGES.NEW_PASSWORD_REQUIRED;
    } else if (formData.newPassword.length < passwordPolicy.passwordMinLength) {
      newErrors.newPassword = `Password must be at least ${passwordPolicy.passwordMinLength} characters`;
    } else if (!strength.isValid) {
      newErrors.newPassword = ERROR_MESSAGES.STRENGTH_REQUIREMENTS;
    }

    if (formData.confirmPassword !== formData.newPassword) {
      newErrors.confirmPassword = ERROR_MESSAGES.PASSWORDS_MUST_MATCH;
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
        setSubmitError("Submission handler not configured");
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

      setSubmitError(result.error || "Failed to update password. Please try again.");
    },
    [formData, onSubmit, strength]
  );

  // ========================================================================
  // RENDER HELPERS
  // ========================================================================

  const PasswordIcon = ({ field }: { field: keyof typeof showPasswords }) => (
    <button
      type="button"
      onClick={() => togglePasswordVisibility(field)}
      className="flex items-center p-1 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none"
      aria-label={showPasswords[field] ? "Hide password" : "Show password"}
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
      {isLoading && <FullPageLoading text="Updating credentials..." />}
      <AuthLayout
        left={
          <div className={AUTH_UI.formColumn}>
            <AuthTopBackButton onClick={onBackToLogin} label="Back to Sign In" disabled={isLoading} />
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
                    <p className="text-sm font-semibold text-red-900">Security Update Failed</p>
                    <p className="mt-0.5 text-sm text-red-700">{submitError}</p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className={AUTH_UI.formStack} noValidate>

              <AuthField htmlFor="currentPassword" label="Current Password" required={true} error={errors.currentPassword}>
                <div className="relative">
                  <input
                    id="currentPassword"
                    type={showPasswords.current ? "text" : "password"}
                    value={formData.currentPassword}
                    onChange={(e) => handleInputChange("currentPassword", e.target.value)}
                    className={cn(AUTH_UI.inputBase, "pr-12", AUTH_UI.inputFocus, errors.currentPassword ? AUTH_UI.inputError : AUTH_UI.inputDefault)}
                    disabled={isLoading}
                    placeholder='Enter Current Password'
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <PasswordIcon field="current" />
                  </div>
                </div>
              </AuthField>

              <AuthField
                htmlFor="newPassword"
                label="New Password"
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
                    placeholder='Enter New Password'
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    {isCapsLockOn && focusedField === "new" && (
                      <div className="mr-2 rounded-md border border-emerald-100 bg-emerald-50 p-1" title="Caps Lock is ON">
                        <IconArrowBigUpFilled className="h-4 w-4 text-emerald-700" />
                      </div>
                    )}
                    <PasswordIcon field="new" />
                  </div>
                </div>

                {/* Password Strength Indicator */}
                <div className="mt-3 space-y-2.5">
                  <div className="flex h-1.5 w-full gap-1.5 overflow-hidden rounded-full bg-slate-100">
                    {[...Array(strength.maxScore)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={false}
                        animate={{
                          backgroundColor: i < strength.score
                            ? strength.score / strength.maxScore <= 0.25 ? "#ef4444" // red-500
                              : strength.score / strength.maxScore <= 0.5 ? "#fb923c" // orange-400
                                : strength.score / strength.maxScore <= 0.75 ? "#facc15" // yellow-400
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
                    <StrengthCheck label={`At least ${passwordPolicy.passwordMinLength} characters`} checked={strength.hasMinLength} />
                    {passwordPolicy.requireUppercase && <StrengthCheck label="One uppercase letter" checked={strength.hasUpper} />}
                    {passwordPolicy.requireLowercase && <StrengthCheck label="One lowercase letter" checked={strength.hasLower} />}
                    {passwordPolicy.requireNumbers && <StrengthCheck label="One number" checked={strength.hasNumber} />}
                    {passwordPolicy.requireSpecialChars && <StrengthCheck label="One special character" checked={strength.hasSpecial} />}
                  </div>
                </div>
              </AuthField>

              <AuthField
                htmlFor="confirmPassword"
                label="Confirm New Password"
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
                    placeholder='Confirm New Password'
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    {isCapsLockOn && focusedField === "confirm" && (
                      <div className="mr-2 rounded-md border border-emerald-100 bg-emerald-50 p-1" title="Caps Lock is ON">
                        <IconArrowBigUpFilled className="h-4 w-4 text-emerald-700" />
                      </div>
                    )}
                    <PasswordIcon field="confirm" />
                  </div>
                </div>
                {formData.confirmPassword && formData.confirmPassword !== formData.newPassword && (
                  <p className="mt-1.5 text-[11px] font-medium text-red-500 animate-in fade-in slide-in-from-top-1 duration-200">
                    Passwords do not match yet
                  </p>
                )}
              </AuthField>

              <Button
                type="submit"
                className={cn(AUTH_UI.submitButton, "mt-2")}
                disabled={isLoading || !strength.isValid || formData.newPassword !== formData.confirmPassword || !formData.currentPassword}
              >
                Continue
              </Button>

              <div className="hidden sm:block">
                <AuthBackLink onClick={onBackToLogin} label="Back to Sign In" disabled={isLoading} />
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
