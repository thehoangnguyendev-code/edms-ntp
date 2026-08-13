import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { ButtonLoading, FullPageLoading } from "@/components/ui/loading/Loading";
import { authApi } from "@/services/api/auth";
import { settingsApi } from "@/services/api/settings";
import { ROUTES } from "@/app/routes.constants";
import { secureStorage } from "@/utils/security";
import { authTokenStore } from "@/services/authTokenStore";
import { useTranslation } from "@/i18n";

import { useAuth } from "@/contexts/AuthContext";
import { SECURITY_CONFIG_STORAGE_KEY } from "@/config/security";

const SESSION_LOCKED_EVENT = "eqms:session-locked";
const SESSION_UNLOCKED_EVENT = "eqms:session-unlocked";
const DEFAULT_TIMEOUT_MINUTES = 30;

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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [timeoutMinutes, setTimeoutMinutes] = useState(DEFAULT_TIMEOUT_MINUTES);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState("");

  const timeoutLabel = useMemo(() => t('sessionTimeout.minutes', { count: timeoutMinutes }), [t, timeoutMinutes]);

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
      const systemConfig = await settingsApi.getSystemConfiguration();
      if (systemConfig?.security?.sessionTimeoutMinutes) {
        setTimeoutMinutes(readTimeoutMinutes(systemConfig.security.sessionTimeoutMinutes));
        return;
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
      setPassword("");
      setError("");
      setShowPassword(false);
      setIsLoading(false);
      setIsLoggingOut(false);
      setIsOpen(true);
    };

    const handleUnlocked = () => {
      setIsOpen(false);
      setPassword("");
      setError("");
      setShowPassword(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError(t('sessionTimeout.passwordRequired'));
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await authApi.reauthenticate({ password });
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
      setError("");
      setShowPassword(false);
    } catch (err) {
      const httpStatus = typeof err === "object" && err && "response" in err
        ? (err as any).response?.status
        : undefined;
      const responseMessage = typeof err === "object" && err && "response" in err
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (err as any).response?.data?.message || (err as any).response?.data?.error?.message
        : undefined;
      const rawMessage = err instanceof Error && err.message.trim() ? err.message : "";
      const message = responseMessage || rawMessage || t('sessionTimeout.incorrectPassword');

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
        setError(responseMessage || t('sessionTimeout.incorrectPassword'));
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
              <h2 className="text-md md:text-lg font-semibold text-slate-900">{t('sessionTimeout.title')}</h2>
              <p className="mt-1 text-xs md:text-sm text-slate-500">
                {t('sessionTimeout.description')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-4 md:p-5 pt-6">
              <div className="mb-6 rounded-lg bg-emerald-50 p-4">
                <p className="text-sm text-emerald-800">
                  {t('sessionTimeout.lockedUser')}: <span className="font-bold">{user?.fullName || user?.username || username || t('sessionTimeout.unknownUser')}</span>
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  {t('sessionTimeout.configuredTimeout')}: <span className="font-semibold">{timeoutLabel}</span>
                </p>
              </div>

              {error && (
                <div className="mb-4 rounded-md bg-red-50 p-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    {t('auth.login.password')}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError("");
                      }}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-10 text-sm outline-none transition-all focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                      placeholder={t('sessionTimeout.passwordPlaceholder')}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
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
                    {t('sessionTimeout.signOut')}
                  </Button>
                  <Button
                    type="submit"
                    variant="default"
                    className="flex-1"
                    disabled={isLoading || !password.trim()}
                  >
                    {isLoading ? <ButtonLoading text={t('sessionTimeout.verifying')} light /> : t('sessionTimeout.unlock')}
                  </Button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {isLoggingOut && <FullPageLoading text={t('sessionTimeout.signingOut')} />}
      {createPortal(modalContent, document.body)}
    </>
  );
};
