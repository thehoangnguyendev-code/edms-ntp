import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button/Button";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { cn } from "@/components/ui/utils";
import { resetViewportZoom, blurActiveInput } from "@/utils/viewport";
import { BrandLogo } from "@/components/branding/BrandLogo";
import { IconMailOpened, IconQrcode, IconRefresh } from "@tabler/icons-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { AUTH_UI } from "./auth-ui";
import { AuthBackLink, AuthLayout, AuthTopBackButton } from "./components";
import { AlertModal } from "@/components/ui/modal/AlertModal";

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // 60 seconds

// ============================================================================
// TYPES
// ============================================================================

interface TwoFactorViewProps {
  onVerify?: (payload: {
    code: string;
    method: 'email' | 'app';
    rememberDevice: boolean;
  }) => Promise<{ success: boolean; error?: string; passwordChangeRequired?: boolean }>;
  onResend?: (method: 'email') => Promise<{ success: boolean; error?: string; cooldownSeconds?: number }>;
  onBackToLogin?: () => void;
  email?: string; // Masked email address
  username?: string;
  availableMethods?: Array<'email' | 'app'>;
  rememberDeviceAllowed?: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const TwoFactorView: React.FC<TwoFactorViewProps> = ({
  onVerify,
  onResend,
  onBackToLogin,
  email = "a***n@eqms.com",
  username = "Unknown User",
  availableMethods = ['email', 'app'],
  rememberDeviceAllowed = true,
}) => {
  // ========================================================================
  // STATE
  // ========================================================================

  const [method, setMethod] = useState<'email' | 'app' | null>(null);
  const [otp, setOtp] = useState<string[]>(new Array(OTP_LENGTH).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Helper to mask email for privacy
  const maskEmail = (emailStr: string) => {
    if (!emailStr || !emailStr.includes("@")) return emailStr;
    const [name, domain] = emailStr.split("@");
    if (name.length <= 2) return `${name}***@${domain}`;
    return `${name[0]}***${name[name.length - 1]}@${domain}`;
  };
  const [error, setError] = useState("");
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
  const [canResend, setCanResend] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const swapTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: "easeOut" as const };

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const emailMethodInitiatedRef = useRef(false);

  const requestEmailCode = useCallback(async () => {
    if (!onResend || isSendingEmail) {
      return;
    }

    setIsSendingEmail(true);
    setCanResend(false);
    setError("");

    try {
      const result = await onResend('email');
      if (!result.success) {
        setResendTimer(0);
        setCanResend(true);
        setError(result.error || 'Unable to send email verification code.');
        setErrorModalOpen(true);
        return;
      }

      setResendTimer(result.cooldownSeconds ?? RESEND_COOLDOWN);
    } catch {
      setResendTimer(0);
      setCanResend(true);
      setError('Unable to send email verification code. Please try again.');
      setErrorModalOpen(true);
    } finally {
      setIsSendingEmail(false);
    }
  }, [isSendingEmail, onResend]);

  // ========================================================================
  // EFFECTS
  // ========================================================================

  // Resend timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [resendTimer]);

  // Focus first input on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  useEffect(() => {
    if (method !== 'email') {
      emailMethodInitiatedRef.current = false;
      return;
    }

    if (emailMethodInitiatedRef.current) {
      return;
    }

    emailMethodInitiatedRef.current = true;
    void requestEmailCode();
  }, [method, requestEmailCode]);

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  const handleOtpChange = (index: number, value: string) => {
    if (isNaN(Number(value)) && value !== "") return;

    const newOtp = [...otp];
    // Take only the last character if multiple characters are pasted/typed
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);
    setError("");

    // Move to next input if value is entered
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Move to previous input on backspace if current is empty
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData
      .getData("text")
      .replace(/\D/g, '')
      .slice(0, OTP_LENGTH)
      .split("");
    const newOtp = [...otp];

    pastedData.forEach((char, index) => {
      if (!isNaN(Number(char))) {
        newOtp[index] = char;
      }
    });

    setOtp(newOtp);

    // Focus the last filled input or the first empty one
    const lastIndex = Math.min(pastedData.length, OTP_LENGTH - 1);
    inputRefs.current[lastIndex]?.focus();
  };

  const handleResend = useCallback(async () => {
    if (!canResend || isSendingEmail) return;
    await requestEmailCode();
  }, [canResend, isSendingEmail, requestEmailCode]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const code = otp.join("");

      if (code.length < OTP_LENGTH) {
        setError("Please enter all 6 digits");
        setErrorModalOpen(true);
        return;
      }

      if (!method) {
        setError("Please choose a verification method first");
        setErrorModalOpen(true);
        return;
      }

      if (!onVerify) {
        setError("Verification handler is not configured");
        return;
      }

      setIsLoading(true);
      setError("");

      // Submit the OTP to the backend for verification
      const result = await onVerify({
        code,
        method,
        rememberDevice,
      });

      setIsLoading(false);

      if (result.success) {
        setIsSuccess(true);
        blurActiveInput();
        resetViewportZoom();
        return;
      }

      setError(result.error || "Invalid verification code. Please try again.");
      setErrorModalOpen(true);
      setOtp(new Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    },
    [method, onVerify, otp, rememberDevice]
  );

  const emailMethodEnabled = availableMethods.includes('email');
  const appMethodEnabled = availableMethods.includes('app');

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <>
      <AlertModal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        type="error"
        title="Verification Failed"
        description={error}
        confirmText="Close"
      />

      {isLoading && <FullPageLoading text="Verifying code..." />}
      <AuthLayout
        left={
          <div className={AUTH_UI.formColumn}>
            <AuthTopBackButton onClick={onBackToLogin} label="Back to Sign In" disabled={isLoading} />
            <div className="mb-6 flex items-center gap-3 text-slate-900 sm:mb-10 lg:mb-12">
              <BrandLogo className="h-8 w-auto object-contain sm:h-9" />
            </div>

            <div className="flex flex-col justify-start">
              <AnimatePresence mode="wait" initial={false}>
                {!method ? (
                  <motion.div
                    key="selection"
                    initial={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: 16 }}
                    transition={swapTransition}
                    className="space-y-6 sm:space-y-5"
                  >
                    <div className={AUTH_UI.headerArea}>
                      <div className={AUTH_UI.headingBlock}>
                        <h1 className={AUTH_UI.pageTitle}>Verify Your Identity</h1>
                        <p className={AUTH_UI.description}>
                          Select a verification method for account <span className="font-semibold text-slate-700">{username}</span>.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 sm:space-y-3">
                      <button
                        type="button"
                        onClick={() => setMethod("email")}
                        disabled={!emailMethodEnabled}
                        className="group flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white p-2.5 text-left transition-colors hover:border-emerald-700/40 hover:bg-emerald-50/30 sm:p-4"
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className="text-slate-600">
                            <IconMailOpened size={26} stroke={1.5} className="h-[26px] w-[26px] sm:h-[30px] sm:w-[30px]" />
                          </span>
                          <div>
                            <p className="text-xs font-semibold text-slate-900 sm:text-sm">Email Authentication</p>
                            <p className="text-xs text-slate-500">Receive the code at {email}</p>
                          </div>
                        </div>
                        {!emailMethodEnabled && <span className="text-xs font-medium text-slate-400">Unavailable</span>}
                      </button>

                      <button
                        type="button"
                        onClick={() => setMethod("app")}
                        disabled={!appMethodEnabled}
                        className="group flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white p-2.5 text-left transition-colors hover:border-emerald-700/40 hover:bg-emerald-50/30 sm:p-4"
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className="text-slate-600">
                            <IconQrcode size={26} stroke={1.5} className="h-[26px] w-[26px] sm:h-[30px] sm:w-[30px]" />
                          </span>
                          <div>
                            <p className="text-xs font-semibold text-slate-900 sm:text-sm">Authenticator App</p>
                            <p className="text-xs text-slate-500">Use code from your authenticator app</p>
                          </div>
                        </div>
                        {!appMethodEnabled && <span className="text-xs font-medium text-slate-400">Unavailable</span>}
                      </button>
                    </div>

                    <div className="hidden sm:block">
                      <AuthBackLink onClick={onBackToLogin} label="Back to Sign In" />
                    </div>
                  </motion.div>
                ) : (
                  <motion.form
                    key="otp-form"
                    initial={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
                    transition={swapTransition}
                    onSubmit={handleSubmit}
                    className={`${AUTH_UI.formStack} flex flex-col justify-start sm:justify-center`}
                  >
                    <div className={cn(AUTH_UI.headerArea, "mb-1 sm:mb-1")}>
                      <div className={AUTH_UI.headingBlock}>
                        <h1 className={AUTH_UI.pageTitle}>Enter Verification Code</h1>
                        <p className={AUTH_UI.description}>
                          {method === "email" ? (
                            <>
                              Enter the 6-digit code sent to <span className="font-semibold text-slate-700">{maskEmail(email)}</span>.
                            </>
                          ) : (
                            <>Enter the 6-digit code from your authenticator app.</>
                          )}
                        </p>
                      </div>
                    </div>

                    {error && (
                      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700" role="alert" aria-live="assertive">
                        {error}
                      </div>
                    )}

                    <motion.div
                      className="grid grid-cols-6 gap-2 sm:gap-3"
                      onPaste={handlePaste}
                      animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
                      transition={{ duration: 0.4, ease: "easeInOut" }}
                    >
                      {otp.map((digit, index) => (
                        <motion.div
                          key={index}
                          initial={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, y: 10, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 20,
                            delay: index * 0.05
                          }}
                        >
                          <motion.input
                            ref={(el) => {
                              inputRefs.current[index] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={1}
                            value={digit}
                            whileFocus={{ scale: 1.05 }}
                            animate={digit ? { scale: [1, 1.1, 1] } : {}}
                            transition={{ duration: 0.15 }}
                            onChange={(e) => handleOtpChange(index, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            disabled={isLoading}
                            aria-label={`Verification code digit ${index + 1}`}
                            className={cn(
                              "otp-input h-16 w-full rounded-[12px] border text-center font-bold outline-none leading-normal transition-all",
                              "focus:ring-1 focus:ring-emerald-600",
                              digit
                                ? "border-emerald-600 bg-emerald-50/20 text-emerald-900"
                                : "border-slate-200 bg-white focus:border-emerald-600",
                              isSuccess && "border-emerald-500 bg-emerald-500/10"
                            )}
                          />
                        </motion.div>
                      ))}
                    </motion.div>

                    <Button
                      type="submit"
                      className={cn(AUTH_UI.submitButton, "mt-4")}
                      disabled={isLoading || otp.join("").length < OTP_LENGTH}
                    >
                      Verify Account
                    </Button>

                    <Checkbox
                      id="rememberDevice"
                      checked={rememberDevice}
                      onChange={setRememberDevice}
                      label={rememberDeviceAllowed ? "Remember this device for 8 hours" : "Remember this device disabled by policy"}
                      labelClassName="text-xs text-slate-600 sm:text-sm"
                      disabled={isLoading || !rememberDeviceAllowed}
                    />

                    <div className="flex flex-col items-start gap-2 pt-0.5 sm:gap-3 sm:pt-1">
                      {method === "email" && (
                        <button
                          type="button"
                          onClick={handleResend}
                          disabled={!canResend || isLoading || isSendingEmail}
                          className={cn(
                            "flex items-center gap-2 text-xs sm:text-sm font-semibold transition-colors sm:text-sm",
                            canResend && !isSendingEmail ? "text-emerald-700 hover:text-emerald-800" : "cursor-not-allowed text-slate-500"
                          )}
                        >
                          <IconRefresh
                            size={16}
                            className={cn(isSendingEmail ? "animate-spin opacity-80" : "opacity-100")}
                            style={isSendingEmail ? { animationDuration: "1s" } : {}}
                          />
                          {isSendingEmail ? "Sending code..." : canResend ? "Resend Code" : `Resend in ${resendTimer}s`}
                        </button>
                      )}

                      <AuthBackLink
                        onClick={() => {
                          setMethod(null);
                          setOtp(new Array(OTP_LENGTH).fill(""));
                          setError("");
                        }}
                        label="Change verification method"
                        disabled={isLoading}
                      />
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </div>
        }
      />
    </>
  );
};
