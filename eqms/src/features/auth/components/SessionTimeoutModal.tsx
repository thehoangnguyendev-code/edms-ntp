import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { IconArrowBigUpFilled } from "@tabler/icons-react";
import { Button } from "@/components/ui/button/Button";
import { ButtonLoading, FullPageLoading } from "@/components/ui/loading/Loading";
import { authApi, type AuthResponse, type LoginChallengeResponse, type MfaMethod } from "@/services/api/auth";
import { settingsApi } from "@/services/api/settings";
import { ROUTES } from "@/app/routes.constants";
import { secureStorage } from "@/utils/security";
import { authTokenStore } from "@/services/authTokenStore";

import { useAuth } from "@/contexts/AuthContext";
import { SECURITY_CONFIG_STORAGE_KEY } from "@/config/security";

const SESSION_LOCKED_EVENT = "eqms:session-locked";
const SESSION_UNLOCKED_EVENT = "eqms:session-unlocked";
const DEFAULT_TIMEOUT_MINUTES = 30;
const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

const readTimeoutMinutes = (value: unknown) => {
  const minutes = Number(value);
  if (Number.isFinite(minutes) && minutes >= 1 && minutes <= 1440) {
    return minutes;
  }
  return DEFAULT_TIMEOUT_MINUTES;
};

interface SessionTimeoutModalProps {
  isAuthenticated: boolean;
  username?: string | null;
  logout: () => Promise<void>;
}

export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  isAuthenticated,
  username,
  logout,
}) => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [timeoutMinutes, setTimeoutMinutes] = useState(DEFAULT_TIMEOUT_MINUTES);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState("");
  // Second step: the password was right and the account uses a second factor, so the session stays locked until the code is given.
  const [challenge, setChallenge] = useState<LoginChallengeResponse | null>(null);
  const [method, setMethod] = useState<MfaMethod | null>(null);
  const [code, setCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const timeoutLabel = useMemo(() => `${timeoutMinutes} minute${timeoutMinutes === 1 ? "" : "s"}`, [timeoutMinutes]);

  const loadSecurityConfig = async () => {
    try {
      const raw = localStorage.getItem(SECURITY_CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const val = Number(parsed?.security?.sessionTimeoutMinutes);
        if (Number.isFinite(val) && val >= 1 && val <= 1440) {
          setTimeoutMinutes(val);
          return;
        }
      }
    } catch {
      // ignore
    }

    try {
      const config = await settingsApi.getSecurityConfiguration();
      setTimeoutMinutes(readTimeoutMinutes(config.sessionTimeoutMinutes));
    } catch {
      setTimeoutMinutes(DEFAULT_TIMEOUT_MINUTES);
    }
  };

  useEffect(() => {
    void loadSecurityConfig();
  }, []);

  useEffect(() => {
    const handleLocked = () => {
      setChallenge(null);
      setMethod(null);
      setCode("");
      setEmailSent(false);
      setResendIn(0);
      setPassword("");
      setError("");
      setShowPassword(false);
      setIsCapsLockOn(false);
      setIsLoading(false);
      setIsLoggingOut(false);
      setIsOpen(true);
    };

    const handleUnlocked = () => {
      setChallenge(null);
      setMethod(null);
      setCode("");
      setEmailSent(false);
      setResendIn(0);
      setIsOpen(false);
      setPassword("");
      setError("");
      setShowPassword(false);
      setIsCapsLockOn(false);
      setIsLoading(false);
      setIsLoggingOut(false);
    };

    const handleConfigUpdated = () => {
      void loadSecurityConfig();
    };

    window.addEventListener(SESSION_LOCKED_EVENT, handleLocked);
    window.addEventListener(SESSION_UNLOCKED_EVENT, handleUnlocked);
    window.addEventListener("eqms:security-config-updated", handleConfigUpdated);

    return () => {
      window.removeEventListener(SESSION_LOCKED_EVENT, handleLocked);
      window.removeEventListener(SESSION_UNLOCKED_EVENT, handleUnlocked);
      window.removeEventListener("eqms:security-config-updated", handleConfigUpdated);
    };
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const errorMessageOf = (err: unknown, fallback: string) => {
    const data = typeof err === "object" && err && "response" in err ? (err as any).response?.data : undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
    const message: string | undefined = data?.message || data?.error?.message;
    return message || (err instanceof Error && err.message.trim() ? err.message : fallback);
  };

  /** The account was locked by the failed attempts: the session has ended on the server, so the person goes back to the sign-in page. */
  const leaveWhenLocked = (message: string) => {
    if (message.toLowerCase().includes("account is locked")) {
      window.setTimeout(redirectToLogin, 2500);
    }
  };

  const unlockWith = (response: AuthResponse) => {
    if (response?.accessToken) {
      authTokenStore.set(response.accessToken);
      secureStorage.setItem("authToken", response.accessToken);
    }
    if (response?.refreshToken) {
      secureStorage.setItem("refreshToken", response.refreshToken);
    }
    // Re-authentication issues a fresh session representation. Keep the
    // existing route/layout mounted and refresh the in-memory user context;
    // treating this as a new login would unnecessarily redirect to /login.
    if (response?.user) {
      updateUser(response.user);
    }
    window.dispatchEvent(new Event(SESSION_UNLOCKED_EVENT));
    setIsOpen(false);
    setPassword("");
    setChallenge(null);
    setMethod(null);
    setCode("");
    setError("");
    setShowPassword(false);
    setIsCapsLockOn(false);
  };

  const sendEmailCode = async (token: string) => {
    setError("");
    try {
      const result = await authApi.sendEmailOtp({ mfaToken: token });
      setEmailSent(true);
      setResendIn(result.cooldownSeconds ?? RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(errorMessageOf(err, "The code could not be sent. Please try again."));
    }
  };

  const chooseMethod = (next: MfaMethod, token: string) => {
    setMethod(next);
    setCode("");
    setError("");
    if (next === "email") void sendEmailCode(token);
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge || !method || code.length !== OTP_LENGTH) return;
    setIsLoading(true);
    setError("");
    try {
      unlockWith(await authApi.reauthenticateMfa({ mfaToken: challenge.mfaToken, otp: code, method }));
    } catch (err) {
      const message = errorMessageOf(err, "The verification code is incorrect. Please try again.");
      setCode("");
      setError(message);
      leaveWhenLocked(message);
    } finally {
      setIsLoading(false);
    }
  };

  const backToPassword = () => {
    setChallenge(null);
    setMethod(null);
    setCode("");
    setEmailSent(false);
    setResendIn(0);
    setPassword("");
    setError("");
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      window.dispatchEvent(new Event(SESSION_UNLOCKED_EVENT));
      navigate(ROUTES.LOGIN, { replace: true });
    }
  };

  const redirectToLogin = () => {
    secureStorage.removeItem("authToken");
    secureStorage.removeItem("refreshToken");
    secureStorage.removeItem("user");
    authTokenStore.clear();
    secureStorage.removeItem("mfaToken");
    secureStorage.removeItem("trustedDeviceToken");
    window.dispatchEvent(new Event(SESSION_UNLOCKED_EVENT));
    navigate(ROUTES.LOGIN, { replace: true });
  };

  const handleCapsLockCheck = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setIsCapsLockOn(event.getModifierState("CapsLock"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Password is required");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await authApi.reauthenticate({ password });
      if ("mfaRequired" in response && response.mfaRequired) {
        // The password was right; the code is the second step. The password is not kept.
        setPassword("");
        setChallenge(response);
        const methods = response.availableMethods;
        if (methods.length === 1) chooseMethod(methods[0], response.mfaToken);
        return;
      }
      unlockWith(response as AuthResponse);
    } catch (err) {
      const httpStatus = typeof err === "object" && err && "response" in err
        ? (err as any).response?.status
        : undefined;
      const responseMessage = typeof err === "object" && err && "response" in err
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (err as any).response?.data?.message || (err as any).response?.data?.error?.message
        : undefined;
      const rawMessage = err instanceof Error && err.message.trim() ? err.message : "";
      const message = responseMessage || rawMessage || "Incorrect password. Please try again.";

      // Keep the locked session modal open for invalid credentials so the user
      // can retry without losing the page they were working on. The server
      // records failed re-authentication attempts; Sign Out remains available
      // when the user explicitly wants to leave the session.
      const normalizedMessage = message.toLowerCase();
      const invalidCredentials =
        httpStatus === 401 ||
        httpStatus === 403 ||
        normalizedMessage.includes("incorrect password") ||
        normalizedMessage.includes("invalid password") ||
        normalizedMessage.includes("authentication failed");
      if (invalidCredentials) {
        setError(responseMessage || "Password is incorrect. Please try again.");
        leaveWhenLocked(responseMessage || "");
        return;
      }

      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated && !isOpen) {
    return null;
  }

  const modalContent = (
    <AnimatePresence>
      {isOpen && isAuthenticated && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-slate-900/5"
          >
            <div className="flex flex-col items-center border-b border-slate-100 p-5 text-center">
              <h2 className="text-md md:text-lg font-semibold text-slate-900">Session Expired</h2>
              <p className="mt-1 text-xs md:text-sm text-slate-500">
                Required to provide Auth information
              </p>
            </div>

            <form onSubmit={challenge ? handleVerifyCode : handleSubmit} className="p-4 md:p-5 pt-6">
              <div className="mb-6 rounded-lg bg-emerald-50 p-4">
                <p className="text-sm text-emerald-800">
                  Locked user: <span className="font-bold">{user?.fullName || user?.username || username || "Unknown"}</span>
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  Configured system timeout: <span className="font-semibold">{timeoutLabel}</span>
                </p>
              </div>

              {error && (
                <div className="mb-4 rounded-md bg-red-50 p-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              {challenge ? (
                <div className="space-y-4" data-testid="reauth-code-step">
                  {!method ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">Choose how to receive your verification code</p>
                      {challenge.availableMethods.map((option) => (
                        <Button key={option} type="button" variant="outline" className="w-full justify-start" onClick={() => chooseMethod(option, challenge.mfaToken)}>
                          {option === "app" ? "Authenticator app" : `Email code${challenge.maskedEmail ? ` to ${challenge.maskedEmail}` : ""}`}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="reauth-code" className="mb-2 block text-sm font-medium text-slate-700 capitalize">
                        Verification code
                      </label>
                      <input
                        id="reauth-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={OTP_LENGTH}
                        value={code}
                        onChange={(e) => {
                          setCode(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH));
                          setError("");
                        }}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-lg tracking-[0.4em] outline-none transition-all focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                        placeholder="000000"
                        autoFocus
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        {method === "app"
                          ? "Enter the 6-digit code from your authenticator app."
                          : emailSent
                            ? `A code was sent${challenge.maskedEmail ? ` to ${challenge.maskedEmail}` : ""}. It is valid for a few minutes.`
                            : "Sending the code…"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        {method === "email" && (
                          <button type="button" className="font-medium text-emerald-700 disabled:text-slate-400" disabled={resendIn > 0} onClick={() => void sendEmailCode(challenge.mfaToken)}>
                            {resendIn > 0 ? `Send again in ${resendIn}s` : "Send the code again"}
                          </button>
                        )}
                        {challenge.availableMethods.length > 1 && (
                          <button type="button" className="font-medium text-emerald-700" onClick={() => { setMethod(null); setCode(""); setError(""); }}>
                            Use another method
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={handleLogout} disabled={isLoading || isLoggingOut}>
                      Sign Out
                    </Button>
                    <Button type="submit" variant="default" className="flex-1" disabled={isLoading || !method || code.length !== OTP_LENGTH}>
                      {isLoading ? <ButtonLoading text="Verifying..." light /> : "Unlock"}
                    </Button>
                  </div>
                  <button type="button" className="w-full text-center text-xs font-medium text-slate-500 hover:text-slate-700" onClick={backToPassword} disabled={isLoading}>
                    Back to password
                  </button>
                </div>
              ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 capitalize">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError("");
                      }}
                      onKeyDown={handleCapsLockCheck}
                      onKeyUp={handleCapsLockCheck}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-20 text-sm outline-none transition-all focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                      placeholder="Enter your password"
                      autoFocus
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      {isCapsLockOn && (
                        <div className="mr-2 rounded-md border border-emerald-100 bg-emerald-50 p-1" title="Caps Lock is ON">
                          <IconArrowBigUpFilled className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="flex items-center p-1 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus:text-slate-700"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleLogout}
                    disabled={isLoading || isLoggingOut}
                  >
                    Sign Out
                  </Button>
                  <Button
                    type="submit"
                    variant="default"
                    className="flex-1"
                    disabled={isLoading || !password.trim()}
                  >
                    {isLoading ? <ButtonLoading text="Verifying..." light /> : "Unlock"}
                  </Button>
                </div>
              </div>
              )}
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {isLoggingOut && <FullPageLoading text="Signing out..." />}
      {createPortal(modalContent, document.body)}
    </>
  );
};
